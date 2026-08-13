import { describe, expect, it } from "vitest";

import { isPersonaShowcaseEmail } from "./showcase";

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
