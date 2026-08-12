create or replace function public.touch_activity_on_participation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.activities
  set updated_at = timezone('utc', now())
  where id = coalesce(new.activity_id, old.activity_id);

  return null;
end;
$$;

revoke all on function public.touch_activity_on_participation_change() from public, anon, authenticated;

drop trigger if exists touch_activity_on_participation_change on public.activity_participations;
create trigger touch_activity_on_participation_change
after insert or update or delete on public.activity_participations
for each row execute procedure public.touch_activity_on_participation_change();
