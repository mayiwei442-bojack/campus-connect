import { NextResponse, type NextRequest } from "next/server";

import { DeepSeekUnavailableError, requestDeepSeekJson } from "@/lib/ai/deepseek";
import {
  classifyPersonaQuestionTopic,
  composeGroundedPersonaAnswer,
  fallbackPersonaEvidenceIndexes,
  normalizePersonaQuestion,
  sanitizePersonaEvidenceIndexes,
  type PersonaAnswerEvidence,
} from "@/lib/persona/ask";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, context: { params: Promise<{ personaId: string }> }) {
  try {
    const { personaId } = await context.params;
    if (!UUID_PATTERN.test(personaId)) return NextResponse.json({ error: "Persona 不存在。" }, { status: 404 });

    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
    if (!userId) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

    const { data: withinLimit, error: limitError } = await supabase.rpc("consume_persona_ai_rate_limit", { p_scope: "ask" });
    if (limitError) throw new Error("Persona 问答限流检查失败。");
    if (!withinLimit) return NextResponse.json({ error: "提问过于频繁，请稍后再试。" }, { status: 429 });

    const body = await request.json() as { question?: unknown };
    const question = normalizePersonaQuestion(body.question);
    const [{ data: persona, error: personaError }, { data: rows, error: entriesError }] = await Promise.all([
      supabase.from("personas").select("id,name,owner_id").eq("id", personaId).maybeSingle(),
      supabase
        .from("persona_entries")
        .select("id,kind,knowledge_key,content")
        .eq("persona_id", personaId)
        .eq("status", "confirmed")
        .order("confirmed_at", { ascending: false })
        .limit(40),
    ]);
    if (personaError || !persona || entriesError) return NextResponse.json({ error: "Persona 不存在或不可见。" }, { status: 404 });

    const entries: PersonaAnswerEvidence[] = (rows ?? []).map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      knowledgeKey: entry.knowledge_key,
      content: entry.content,
    }));
    const topic = classifyPersonaQuestionTopic(question);
    if (persona.owner_id !== userId) {
      const { error: topicError } = await supabase.rpc("record_persona_question_topic", { p_persona_id: personaId, p_topic: topic });
      if (topicError) return NextResponse.json({ error: "Persona 不存在或不可见。" }, { status: 404 });
    }

    if (!entries.length) {
      return NextResponse.json({ answer: "这张 Persona 还没有主人确认过的依据，因此我不能替对方推断。", citations: [], refused: true, topic });
    }

    let indexes: number[] = [];
    let organizedByModel = true;
    let warning: string | null = null;
    try {
      const { value } = await requestDeepSeekJson([
        {
          role: "system",
          content: "你只判断已确认 Persona 证据是否足以回答问题。不得补充常识、猜测或新事实。输出 JSON：{\"refuse\":boolean,\"evidenceIndexes\":[0,1]}，最多3个索引；证据不足必须 refuse=true。",
        },
        {
          role: "user",
          content: JSON.stringify({
            question,
            evidence: entries.map((entry) => ({ kind: entry.kind, key: entry.knowledgeKey, content: entry.content })),
          }),
        },
      ], 300);
      indexes = sanitizePersonaEvidenceIndexes(value, entries.length);
    } catch (error) {
      organizedByModel = false;
      indexes = fallbackPersonaEvidenceIndexes(question, entries);
      warning = error instanceof DeepSeekUnavailableError ? "AI 暂时不可用，已仅按文字证据检索。" : "已使用基础证据检索。";
    }

    const grounded = composeGroundedPersonaAnswer(persona.name, entries, indexes);
    if (!grounded) {
      return NextResponse.json({
        answer: "已确认的 Persona 信息不足以回答这个问题，因此我不会替对方推断。",
        citations: [],
        refused: true,
        topic,
        ai: { organizedByModel, warning },
      });
    }

    return NextResponse.json({ ...grounded, refused: false, topic, ai: { organizedByModel, warning } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Persona 问答暂时不可用。";
    return NextResponse.json({ error: message }, { status: /问题|字符|输入/.test(message) ? 400 : 500 });
  }
}
