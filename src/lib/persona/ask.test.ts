import { describe, expect, it } from "vitest";

import {
  classifyPersonaQuestionTopic,
  composeGroundedPersonaAnswer,
  fallbackPersonaEvidenceIndexes,
  sanitizePersonaEvidenceIndexes,
} from "./ask";

const entries = [
  { id: "1", kind: "experience" as const, knowledgeKey: "夜景经验", content: "拍摄过校园夜景并关注高光控制" },
  { id: "2", kind: "preference" as const, knowledgeKey: "合作方式", content: "喜欢先明确分工再开始拍摄" },
];

describe("Persona grounded answers", () => {
  it("classifies only a fixed anonymous topic", () => {
    expect(classifyPersonaQuestionTopic("周末什么时候有空？")).toBe("availability");
    expect(classifyPersonaQuestionTopic("最喜欢什么风格？")).toBe("preference");
  });

  it("drops model indexes outside the supplied confirmed evidence", () => {
    expect(sanitizePersonaEvidenceIndexes({ evidenceIndexes: [1, 99, -1, 1, "0"] }, entries.length)).toEqual([1]);
    expect(sanitizePersonaEvidenceIndexes({ refuse: true, evidenceIndexes: [0] }, entries.length)).toEqual([]);
  });

  it("falls back to lexical evidence and composes only confirmed text", () => {
    const indexes = fallbackPersonaEvidenceIndexes("有校园夜景拍摄经验吗？", entries);
    expect(indexes).toEqual([0]);
    expect(composeGroundedPersonaAnswer("摄影现场", entries, indexes)?.answer).toContain(entries[0].content);
    expect(fallbackPersonaEvidenceIndexes("有登山经验吗？", entries)).toEqual([]);
  });
});
