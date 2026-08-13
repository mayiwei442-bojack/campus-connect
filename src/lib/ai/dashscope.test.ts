import { describe, expect, it } from "vitest";

import { normalizePersonaAnalysisEntries } from "./dashscope";

describe("normalizePersonaAnalysisEntries", () => {
  it("keeps only bounded known draft shapes and deduplicates knowledge keys", () => {
    expect(normalizePersonaAnalysisEntries({
      entries: [
        { kind: "experience", knowledgeKey: " 夜景经验 ", content: "  拍过校园夜景  " },
        { kind: "fact", knowledgeKey: "夜景经验", content: "重复" },
        { kind: "sensitive", knowledgeKey: "身份", content: "无效" },
        { kind: "preference", knowledgeKey: "构图", content: "重视环境关系" },
      ],
    })).toEqual([
      { kind: "experience", knowledgeKey: "夜景经验", content: "拍过校园夜景" },
      { kind: "preference", knowledgeKey: "构图", content: "重视环境关系" },
    ]);
  });

  it("never returns more than six proposals", () => {
    const entries = Array.from({ length: 9 }, (_, index) => ({
      kind: "fact",
      knowledgeKey: `知识${index}`,
      content: `内容${index}`,
    }));
    expect(normalizePersonaAnalysisEntries({ entries })).toHaveLength(6);
  });
});
