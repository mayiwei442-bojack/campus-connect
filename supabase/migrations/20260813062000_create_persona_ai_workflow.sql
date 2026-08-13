alter table public.persona_assets
add column analysis_nonce uuid;

create or replace function public.consume_persona_ai_rate_limit(p_scope text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  normalized_scope text;
  request_limit integer;
  current_window timestamptz := date_trunc('minute', now());
  new_count integer;
begin
  if viewer_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  normalized_scope := case p_scope
    when 'analyze' then 'persona_analyze'
    when 'ask' then 'persona_ask'
    else null
  end;
  request_limit := case p_scope when 'analyze' then 4 when 'ask' then 12 else null end;

  if normalized_scope is null then
    raise exception 'INVALID_RATE_LIMIT_SCOPE' using errcode = '22023';
  end if;

  delete from app_private.ai_rate_limit_windows
  where actor_id = viewer_id
    and scope = normalized_scope
    and window_started_at < current_window - interval '1 minute';

  insert into app_private.ai_rate_limit_windows (actor_id, scope, window_started_at, request_count)
  values (viewer_id, normalized_scope, current_window, 1)
  on conflict (actor_id, scope, window_started_at) do update
  set request_count = ai_rate_limit_windows.request_count + 1
  where ai_rate_limit_windows.request_count < request_limit
  returning request_count into new_count;

  return new_count is not null;
end;
$$;

create or replace function public.begin_persona_asset_analysis(
  p_persona_id uuid,
  p_asset_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  target public.persona_assets%rowtype;
  persona_name text;
  persona_topic text;
  current_nonce uuid := gen_random_uuid();
begin
  if viewer_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select asset.*
  into target
  from public.persona_assets asset
  join public.personas persona on persona.id = asset.persona_id
  where asset.id = p_asset_id
    and asset.persona_id = p_persona_id
    and asset.owner_id = viewer_id
    and persona.owner_id = viewer_id
  for update of asset;

  if target.id is null then
    raise exception 'PERSONA_ASSET_NOT_FOUND' using errcode = '42501';
  end if;

  select name, topic into persona_name, persona_topic
  from public.personas
  where id = target.persona_id;

  if target.analysis_status = 'analyzing'
    and target.updated_at > timezone('utc', now()) - interval '2 minutes' then
    raise exception 'ANALYSIS_IN_PROGRESS' using errcode = '55000';
  end if;

  update public.persona_assets
  set analysis_status = 'analyzing',
      analysis_error = null,
      model_name = null,
      analysis_nonce = current_nonce,
      updated_at = timezone('utc', now())
  where id = target.id;

  return jsonb_build_object(
    'assetId', target.id,
    'analysisNonce', current_nonce,
    'personaId', target.persona_id,
    'storagePath', target.storage_path,
    'mimeType', target.mime_type,
    'byteSize', target.byte_size,
    'userDescription', target.user_description,
    'personaName', persona_name,
    'personaTopic', persona_topic
  );
end;
$$;

create or replace function public.complete_persona_asset_analysis(
  p_persona_id uuid,
  p_asset_id uuid,
  p_analysis_nonce uuid,
  p_model_name text,
  p_entries jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  target public.persona_assets%rowtype;
  proposed jsonb;
  proposed_kind text;
  proposed_key text;
  proposed_content text;
begin
  if viewer_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_model_name, ''))) not between 2 and 100
    or coalesce(jsonb_typeof(p_entries), '') <> 'array'
    or jsonb_array_length(p_entries) not between 1 and 6 then
    raise exception 'INVALID_ANALYSIS_RESULT' using errcode = '22023';
  end if;

  select asset.* into target
  from public.persona_assets asset
  join public.personas persona on persona.id = asset.persona_id
  where asset.id = p_asset_id
    and asset.persona_id = p_persona_id
    and asset.owner_id = viewer_id
    and persona.owner_id = viewer_id
  for update of asset;

  if target.id is null then
    raise exception 'PERSONA_ASSET_NOT_FOUND' using errcode = '42501';
  end if;
  if target.analysis_status <> 'analyzing' or target.analysis_nonce is distinct from p_analysis_nonce then
    raise exception 'ANALYSIS_NOT_ACTIVE' using errcode = '55000';
  end if;

  delete from public.persona_entries
  where source_asset_id = target.id
    and owner_id = viewer_id
    and status = 'draft';

  for proposed in select value from jsonb_array_elements(p_entries)
  loop
    proposed_kind := proposed ->> 'kind';
    proposed_key := btrim(coalesce(proposed ->> 'knowledgeKey', ''));
    proposed_content := btrim(coalesce(proposed ->> 'content', ''));

    if proposed_kind not in ('fact', 'preference', 'opinion', 'experience', 'boundary')
      or char_length(proposed_key) not between 2 and 80
      or char_length(proposed_content) not between 1 and 1000 then
      raise exception 'INVALID_ANALYSIS_ENTRY' using errcode = '22023';
    end if;

    insert into public.persona_entries (
      persona_id, owner_id, source_asset_id, kind, knowledge_key, content, status
    ) values (
      target.persona_id,
      viewer_id,
      target.id,
      proposed_kind::public.persona_entry_kind,
      proposed_key,
      proposed_content,
      'draft'
    );
  end loop;

  update public.persona_assets
  set analysis_status = 'ready',
      analysis_error = null,
      model_name = btrim(p_model_name),
      analysis_nonce = null,
      updated_at = timezone('utc', now())
  where id = target.id;
end;
$$;

create or replace function public.fail_persona_asset_analysis(
  p_persona_id uuid,
  p_asset_id uuid,
  p_analysis_nonce uuid,
  p_error text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  update public.persona_assets
  set analysis_status = 'failed',
      analysis_error = left(nullif(btrim(coalesce(p_error, '')), ''), 500),
      model_name = null,
      analysis_nonce = null,
      updated_at = timezone('utc', now())
  where id = p_asset_id
    and persona_id = p_persona_id
    and owner_id = viewer_id
    and analysis_status = 'analyzing'
    and analysis_nonce = p_analysis_nonce;

  if not found then
    raise exception 'ANALYSIS_NOT_ACTIVE' using errcode = '55000';
  end if;
end;
$$;

revoke all on function public.consume_persona_ai_rate_limit(text) from public, anon, authenticated;
revoke all on function public.begin_persona_asset_analysis(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_persona_asset_analysis(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.fail_persona_asset_analysis(uuid, uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.consume_persona_ai_rate_limit(text) to authenticated;
grant execute on function public.begin_persona_asset_analysis(uuid, uuid) to authenticated;
grant execute on function public.complete_persona_asset_analysis(uuid, uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.fail_persona_asset_analysis(uuid, uuid, uuid, text) to authenticated;
