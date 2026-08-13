import { describe, expect, it } from "vitest";

import { fallbackIntent, normalizeModelIntent, parseRecommendationInput } from "./validation";

describe("Connect input validation", () => {
  it("rejects empty or oversized-free malformed input", () => {
    expect(() => parseRecommendationInput({ intent: " " })).toThrow();
    expect(parseRecommendationInput({ intent: "  今晚踢球  " })).toBe("今晚踢球");
  });

  it("normalizes model output into a bounded contract", () => {
    expect(
      normalizeModelIntent(
        {
          activity: "  踢足球 ",
          desiredPeople: 2,
          skillTerms: ["足球", "足球", "体能"],
          startsAt: "2026-08-13T11:00:00+08:00",
          endsAt: "invalid",
        },
        "今晚踢球",
      ),
    ).toMatchObject({ activity: "踢足球", desiredPeople: 2, skillTerms: ["足球", "体能"], endsAt: null });
  });

  it("provides a deterministic fallback when AI is unavailable", () => {
    expect(fallbackIntent("今晚想找两个人随便踢足球")).toMatchObject({
      timeText: "今晚",
      desiredPeople: 2,
      style: "轻松随意",
    });
  });
});
