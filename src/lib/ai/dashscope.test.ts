import { afterEach, describe, expect, it, vi } from "vitest";

import { normalizePersonaAnalysisEntries, requestPersonaImageAnalysis } from "./dashscope";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

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

describe("requestPersonaImageAnalysis", () => {
  it("retries malformed structured output without setting a token cap", async () => {
    vi.stubEnv("DASHSCOPE_API_KEY", "test-api-key");
    vi.stubEnv("DASHSCOPE_WORKSPACE_ID", "test-workspace");
    vi.stubEnv("DASHSCOPE_MODEL", "qwen3.6-flash");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "response-first",
        choices: [{ finish_reason: "length", message: { content: '{"entries":[' } }],
      }), { status: 200, headers: { "x-request-id": "request-first" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "response-second",
        choices: [{
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              entries: [{ kind: "experience", knowledgeKey: "动手经验", content: "使用电子设备进行实践" }],
            }),
          },
        }],
      }), { status: 200, headers: { "x-request-id": "request-second" } }));
    vi.stubGlobal("fetch", fetchMock);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(requestPersonaImageAnalysis({
      dataUrl: "data:image/png;base64,dGVzdA==",
      personaName: "测试 Persona",
      personaTopic: "动手实践",
      userDescription: null,
    })).resolves.toEqual({
      entries: [{ kind: "experience", knowledgeKey: "动手经验", content: "使用电子设备进行实践" }],
      model: "qwen3.6-flash",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string) as {
      messages: Array<{ content: Array<{ type: string; text?: string }> }>;
    };
    expect(firstBody).not.toHaveProperty("max_tokens");
    expect(secondBody.messages[0].content[1].text).toContain("这是格式重试");
    expect(warning).toHaveBeenCalledWith(
      "[persona-image-analysis] DashScope returned invalid structured output.",
      expect.objectContaining({
        attempt: 1,
        responseId: "request-first",
        finishReason: "length",
        contentLength: 12,
      }),
    );
  });

  it("accepts a JSON object surrounded by harmless provider prose", async () => {
    vi.stubEnv("DASHSCOPE_API_KEY", "test-api-key");
    vi.stubEnv("DASHSCOPE_WORKSPACE_ID", "test-workspace");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        finish_reason: "stop",
        message: {
          content: '结果如下：\n```json\n{"entries":[{"kind":"fact","knowledgeKey":"设备","content":"桌面上有电子设备"}]}\n```',
        },
      }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestPersonaImageAnalysis({
      dataUrl: "data:image/png;base64,dGVzdA==",
      personaName: "测试 Persona",
      personaTopic: "设备",
      userDescription: null,
    })).resolves.toMatchObject({
      entries: [{ kind: "fact", knowledgeKey: "设备", content: "桌面上有电子设备" }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
