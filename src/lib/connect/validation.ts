import type { ConnectIntent } from "./types";

const maxTerms = 12;

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : null;
}

function cleanList(value: unknown, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => cleanText(item, maxLength))
        .filter((item): item is string => Boolean(item)),
    ),
  ).slice(0, maxTerms);
}

function cleanIsoDate(value: unknown) {
  const text = cleanText(value, 40);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function parseRecommendationInput(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("请输入连接需求。");
  const intent = cleanText((value as { intent?: unknown }).intent, 500);
  if (!intent || intent.length < 2) throw new Error("需求至少需要 2 个字符。");
  return intent;
}

export function normalizeModelIntent(value: unknown, source: string): ConnectIntent {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const desired = Number(record.desiredPeople);
  const startsAt = cleanIsoDate(record.startsAt);
  const endsAt = cleanIsoDate(record.endsAt);

  return {
    activity: cleanText(record.activity, 80) ?? source.slice(0, 80),
    timeText: cleanText(record.timeText, 80),
    desiredPeople: Number.isInteger(desired) && desired >= 1 && desired <= 50 ? desired : null,
    style: cleanText(record.style, 80),
    place: cleanText(record.place, 80),
    skillTerms: cleanList(record.skillTerms, 80),
    socialPreference: cleanText(record.socialPreference, 120),
    constraints: cleanList(record.constraints, 120),
    startsAt,
    endsAt: startsAt && endsAt && endsAt > startsAt ? endsAt : null,
  };
}

export function fallbackIntent(source: string): ConnectIntent {
  const normalized = source.trim();
  const terms = normalized
    .replace(/[，。！？、；：,.!?;:]/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && term.length <= 24)
    .slice(0, 8);
  const countMatch = normalized.match(/(?:找|约|需要)?\s*([一二两三四五六七八九十\d]+)\s*(?:个|位|名|人)/);
  const chineseCounts: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  const countText = countMatch?.[1];
  const desiredPeople = countText ? Number(countText) || chineseCounts[countText] || null : null;

  return {
    activity: normalized.slice(0, 80),
    timeText: /今晚|今夜/.test(normalized) ? "今晚" : /明天/.test(normalized) ? "明天" : null,
    desiredPeople,
    style: /随便|轻松|休闲/.test(normalized) ? "轻松随意" : null,
    place: null,
    skillTerms: Array.from(new Set(terms)),
    socialPreference: null,
    constraints: [],
    startsAt: null,
    endsAt: null,
  };
}
