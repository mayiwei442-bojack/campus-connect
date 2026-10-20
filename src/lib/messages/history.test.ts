import { describe, expect, it } from "vitest";

import { mergeMessageHistory } from "./history";

const message = (id: string, conversation = "room", second = "00") => ({
  id,
  conversation_id: conversation,
  created_at: `2026-10-21T10:00:${second}.000Z`,
  body: id,
});

describe("mergeMessageHistory", () => {
  it("keeps messages received while an older history snapshot was loading", () => {
    const older = message("older");
    const incoming = message("incoming", "room", "01");
    expect(mergeMessageHistory("room", [older], [incoming])).toEqual([older, incoming]);
  });

  it("deduplicates history, Realtime events, and send acknowledgements", () => {
    const original = message("same");
    const hydrated = { ...original, body: "hydrated" };
    expect(mergeMessageHistory("room", [original], [hydrated])).toEqual([hydrated]);
  });

  it("excludes messages from another conversation", () => {
    expect(mergeMessageHistory("room", [message("a", "other")], [message("b", "other")])).toEqual([]);
  });

  it("orders out-of-order events chronologically with a deterministic tie break", () => {
    const first = message("a");
    const second = message("b");
    const last = message("last", "room", "02");
    expect(mergeMessageHistory("room", [last, second], [first])).toEqual([first, second, last]);
  });
});
