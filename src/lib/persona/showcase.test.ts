import { describe, expect, it } from "vitest";

import { isPersonaShowcaseEmail, shouldShowLocalPersonaRoadshow } from "./showcase";

describe("isPersonaShowcaseEmail", () => {
  it("allows the roadshow account regardless of email casing or whitespace", () => {
    expect(isPersonaShowcaseEmail("  3022387588@QQ.COM ")).toBe(true);
  });

  it("rejects every other account", () => {
    expect(isPersonaShowcaseEmail("someone@example.com")).toBe(false);
    expect(isPersonaShowcaseEmail(null)).toBe(false);
    expect(isPersonaShowcaseEmail(undefined)).toBe(false);
  });
});

describe("shouldShowLocalPersonaRoadshow", () => {
  it("keeps the built-in models for the roadshow account only when running locally", () => {
    expect(shouldShowLocalPersonaRoadshow("3022387588@qq.com", undefined)).toBe(true);
  });

  it("never exposes the built-in roadshow models on Vercel", () => {
    expect(shouldShowLocalPersonaRoadshow("3022387588@qq.com", "1")).toBe(false);
  });
});
