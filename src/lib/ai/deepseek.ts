type DeepSeekMessage = { role: "system" | "user"; content: string };

export class DeepSeekUnavailableError extends Error {}

function readJsonObject(content: unknown) {
  if (typeof content !== "string") throw new DeepSeekUnavailableError("AI 返回格式无效。");
  const normalized = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    throw new DeepSeekUnavailableError("AI 返回格式无效。");
  }
}

export async function requestDeepSeekJson(messages: DeepSeekMessage[], maxTokens = 600) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  if (!apiKey) throw new DeepSeekUnavailableError("DeepSeek 尚未配置。");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, max_tokens: maxTokens, temperature: 0 }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new DeepSeekUnavailableError(`DeepSeek 暂时不可用（${response.status}）。`);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    return { value: readJsonObject(payload.choices?.[0]?.message?.content), model };
  } catch (error) {
    if (error instanceof DeepSeekUnavailableError) throw error;
    throw new DeepSeekUnavailableError(error instanceof Error && error.name === "AbortError" ? "AI 请求超时。" : "AI 请求失败。");
  } finally {
    clearTimeout(timer);
  }
}
