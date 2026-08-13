import type { Database } from "@/lib/supabase/database.types";

export type PersonaQuestionTopic = Database["public"]["Enums"]["persona_question_topic_kind"];

export type PersonaAnswerEvidence = {
  id: string;
  kind: Database["public"]["Enums"]["persona_entry_kind"];
  knowledgeKey: string;
  content: string;
};

const topicRules: Array<[PersonaQuestionTopic, RegExp]> = [
  ["availability", /时间|空闲|周末|几点|什么时候|档期|available|schedule/i],
  ["collaboration", /合作|搭档|组队|沟通|分工|协作|collaborat|team/i],
  ["learning", /学习|课程|学会|入门|教程|练习|learn|study/i],
  ["boundary", /边界|不接受|拒绝|禁区|介意|不能|boundary|avoid/i],
  ["preference", /偏好|喜欢|风格|倾向|习惯|prefer|style/i],
  ["experience", /经验|做过|参加过|作品|经历|拍过|experience|portfolio/i],
  ["background", /背景|专业|年级|学院|来自|擅长|background|major/i],
];

export function normalizePersonaQuestion(value: unknown) {
  if (typeof value !== "string") throw new Error("请输入想问 Persona 的问题。");
  const question = value.trim().replace(/\s+/g, " ");
  if (question.length < 2 || question.length > 500) throw new Error("问题需为 2–500 个字符。");
  return question;
}

export function classifyPersonaQuestionTopic(question: string): PersonaQuestionTopic {
  return topicRules.find(([, pattern]) => pattern.test(question))?.[0] ?? "other";
}

function bigrams(value: string) {
  const normalized = value.toLocaleLowerCase("zh-CN").replace(/[^\p{L}\p{N}]+/gu, "");
  const generic = new Set(["什么", "如何", "可以", "是否", "经验", "喜欢", "合作", "时间", "风格", "偏好"]);
  const grams = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const gram = normalized.slice(index, index + 2);
    if (!generic.has(gram)) grams.add(gram);
  }
  return grams;
}

export function fallbackPersonaEvidenceIndexes(question: string, entries: PersonaAnswerEvidence[]) {
  const questionGrams = bigrams(question);
  const topic = classifyPersonaQuestionTopic(question);
  const preferredKinds: Partial<Record<PersonaQuestionTopic, PersonaAnswerEvidence["kind"][]>> = {
    experience: ["experience"],
    preference: ["preference", "opinion"],
    boundary: ["boundary"],
    collaboration: ["preference", "boundary", "experience"],
    background: ["fact", "experience"],
  };
  const ranked = entries
    .map((entry, index) => {
      const evidenceGrams = bigrams(`${entry.knowledgeKey}${entry.content}`);
      let lexicalScore = 0;
      for (const gram of questionGrams) if (evidenceGrams.has(gram)) lexicalScore += 1;
      let score = lexicalScore;
      if (preferredKinds[topic]?.includes(entry.kind)) score += 3;
      return { index, lexicalScore, score };
    })
    .filter((item) => item.lexicalScore > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const minimumScore = ranked.length ? Math.max(2, Math.ceil(ranked[0].score * 0.35)) : Number.POSITIVE_INFINITY;
  return ranked
    .filter((item) => item.score >= minimumScore)
    .slice(0, 3)
    .map((item) => item.index);
}

export function sanitizePersonaEvidenceIndexes(value: unknown, entryCount: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as { evidenceIndexes?: unknown; refuse?: unknown };
  if (record.refuse === true || !Array.isArray(record.evidenceIndexes)) return [];
  return Array.from(new Set(record.evidenceIndexes))
    .filter((index): index is number => Number.isInteger(index) && Number(index) >= 0 && Number(index) < entryCount)
    .slice(0, 3);
}

export function composeGroundedPersonaAnswer(personaName: string, entries: PersonaAnswerEvidence[], indexes: number[]) {
  if (!indexes.length) return null;
  const citations = indexes.map((index) => entries[index]).filter(Boolean);
  if (!citations.length) return null;
  return {
    answer: `根据「${personaName}」主人已确认的信息：${citations.map((entry) => `${entry.knowledgeKey}：${entry.content.slice(0, 320)}`).join("；")}`,
    citations,
  };
}
