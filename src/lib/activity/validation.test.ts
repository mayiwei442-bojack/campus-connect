import { describe, expect, it } from "vitest";

import { parseActivityDraft } from "./validation";

describe("parseActivityDraft", () => {
  it("normalizes a valid activity draft", () => {
    const form = new FormData();
    form.set("placeId", "library");
    form.set("title", "  Study sprint  ");
    form.set("capacity", "6");
    form.set("joinMode", "approval");
    form.set("timezoneOffset", "-480");

    expect(parseActivityDraft(form)).toMatchObject({
      placeId: "library",
      title: "Study sprint",
      capacity: 6,
      joinMode: "approval",
    });
  });

  it("converts a browser-local time using its timezone offset", () => {
    const form = new FormData();
    form.set("placeId", "library");
    form.set("title", "Study sprint");
    form.set("startsAt", "2026-08-13T10:00");
    form.set("timezoneOffset", "-480");

    expect(parseActivityDraft(form).startsAt).toBe("2026-08-13T02:00:00.000Z");
  });

  it("rejects an invalid capacity", () => {
    const form = new FormData();
    form.set("placeId", "library");
    form.set("title", "Study sprint");
    form.set("capacity", "0");

    expect(() => parseActivityDraft(form)).toThrow("人数上限");
  });
});
