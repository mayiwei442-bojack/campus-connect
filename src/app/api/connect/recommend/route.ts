import { NextResponse, type NextRequest } from "next/server";

import { DeepSeekUnavailableError, requestDeepSeekJson } from "@/lib/ai/deepseek";
import { rankCandidates } from "@/lib/connect/ranking";
import type { CandidateEvidence, ConnectRecommendationResponse } from "@/lib/connect/types";
import { fallbackIntent, normalizeModelIntent, parseRecommendationInput } from "@/lib/connect/validation";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asRecords(value: Json): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const records: Record<string, unknown>[] = [];
  for (const item of value) {
    if (item && typeof item === "object" && !Array.isArray(item)) records.push(item as Record<string, unknown>);
  }
  return records;
}

function text(value: unknown, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function toCandidateEvidence(
  row: {
    profile_id: string;
    nickname: string;
    bio: string | null;
    matched_skills: Json;
    persona_evidence: Json;
    has_time_conflict: boolean;
  },
  terms: string[],
): CandidateEvidence {
  const skills = asRecords(row.matched_skills);
  const personas = asRecords(row.persona_evidence);
  const skillEvidence = skills.map((skill) => {
    const name = text(skill.name, 80);
    const rating = typeof skill.rating === "number" ? ` · 自评 ${skill.rating}/5` : "";
    const note = text(skill.note, 80);
    return `公开 Skill：${name}${rating}${note ? ` · ${note}` : ""}`;
  });
  const personaEvidence = personas.map((entry) => {
    const personaName = text(entry.personaName, 40);
    const key = text(entry.key, 80);
    const content = text(entry.content, 120);
    return `已确认 Persona「${personaName}」：${key} · ${content}`;
  });
  const lowerBio = (row.bio ?? "").toLowerCase();
  const bioTermMatches = terms.filter((term) => lowerBio.includes(term.toLowerCase())).length;
  const evidence = [...skillEvidence, ...personaEvidence];
  if (bioTermMatches) evidence.push("公开简介与当前需求中的关键词相关");
  if (row.has_time_conflict) evidence.push("时间存在冲突，已按规则降权");

  return {
    userId: row.profile_id,
    nickname: row.nickname,
    bio: row.bio,
    hasTimeConflict: row.has_time_conflict,
    evidence,
    matchedSkills: skills.map((skill) => text(skill.name, 80)).filter(Boolean),
    personaIds: Array.from(new Set(personas.map((entry) => text(entry.personaId, 40)).filter(Boolean))),
    skillCount: skills.length,
    personaCount: personas.length,
    ratingTotal: skills.reduce((total, skill) => total + (typeof skill.rating === "number" ? skill.rating : 0), 0),
    bioTermMatches,
  };
}

async function parseWithModel(source: string) {
  const now = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date());
  const { value, model } = await requestDeepSeekJson([
    {
      role: "system",
      content:
        "你只解析用户本人表达的校园活动意图，不判断候选人或权限。输出 JSON 对象，字段严格为 activity,timeText,desiredPeople,style,place,skillTerms,socialPreference,constraints,startsAt,endsAt。skillTerms 是最多12个用于匹配公开 Skill/Persona 的简短中英文关键词数组；时间无法确定则 ISO 时间字段为 null。",
    },
    { role: "user", content: `北京时间：${now}\n需求：${source}` },
  ]);
  return { intent: normalizeModelIntent(value, source), model };
}

async function selectEvidenceWithModel(intent: string, candidates: CandidateEvidence[]) {
  const payload = candidates.map((candidate) => ({
    userId: candidate.userId,
    evidence: candidate.evidence,
  }));
  const { value } = await requestDeepSeekJson(
    [
      {
        role: "system",
        content:
          "你只能从每位候选人已给 evidence 数组中选择最能解释推荐的索引，不得写新文本。输出 {\"selections\":[{\"userId\":\"...\",\"evidenceIndexes\":[0,1]}]}，每人最多3项。",
      },
      { role: "user", content: JSON.stringify({ intent, candidates: payload }) },
    ],
    500,
  );
  const selections = value && typeof value === "object" && Array.isArray((value as { selections?: unknown }).selections)
    ? (value as { selections: unknown[] }).selections
    : [];
  return new Map(
    selections.flatMap((selection) => {
      if (!selection || typeof selection !== "object") return [];
      const record = selection as { userId?: unknown; evidenceIndexes?: unknown };
      if (typeof record.userId !== "string" || !Array.isArray(record.evidenceIndexes)) return [];
      return [[record.userId, record.evidenceIndexes.filter((index): index is number => Number.isInteger(index)).slice(0, 3)] as const];
    }),
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    if (!userId) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    const { data: withinRateLimit, error: rateLimitError } = await supabase.rpc("consume_connect_rate_limit");
    if (rateLimitError) throw new Error("推荐服务限流检查失败。");
    if (!withinRateLimit) return NextResponse.json({ error: "请求过于频繁，请稍后再试。" }, { status: 429 });

    const source = parseRecommendationInput(await request.json());
    let parsedByModel = true;
    let model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
    let warning: string | null = null;
    let intent;
    try {
      const parsed = await parseWithModel(source);
      intent = parsed.intent;
      model = parsed.model;
    } catch (error) {
      parsedByModel = false;
      intent = fallbackIntent(source);
      warning = error instanceof DeepSeekUnavailableError ? error.message : "AI 暂时不可用，已使用基础解析。";
    }

    const terms = Array.from(new Set([intent.activity, ...intent.skillTerms, intent.place].filter((item): item is string => Boolean(item)))).slice(0, 12);
    const { data: rows, error } = await supabase.rpc("get_connect_candidates", {
      p_terms: terms,
      p_starts_at: intent.startsAt ?? undefined,
      p_ends_at: intent.endsAt ?? undefined,
      p_limit: 24,
    });
    if (error) throw new Error("候选人筛选暂时不可用。");
    const evidence = (rows ?? []).map((row) => toCandidateEvidence(row, terms));

    let explanationsOrganizedByModel = parsedByModel && evidence.length > 0;
    let selectedEvidence = new Map<string, number[]>();
    if (explanationsOrganizedByModel) {
      try {
        selectedEvidence = await selectEvidenceWithModel(source, evidence.slice(0, 12));
      } catch (error) {
        explanationsOrganizedByModel = false;
        warning ||= error instanceof DeepSeekUnavailableError ? error.message : "推荐解释已使用确定性证据顺序。";
      }
    }

    const response: ConnectRecommendationResponse = {
      intent,
      candidates: rankCandidates(evidence, selectedEvidence).slice(0, 12),
      ai: { parsedByModel, explanationsOrganizedByModel, model, warning },
    };
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "推荐暂时不可用。";
    const status = /需求|字符|输入/.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
