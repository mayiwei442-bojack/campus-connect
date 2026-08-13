import { describe, expect, it } from "vitest";

import { rankCandidates, scoreCandidate } from "./ranking";
import type { CandidateEvidence } from "./types";

const base: CandidateEvidence = {
  userId: "a",
  nickname: "候选人",
  bio: null,
  hasTimeConflict: false,
  evidence: ["公开 Skill：足球"],
  matchedSkills: ["足球"],
  personaIds: [],
  skillCount: 1,
  personaCount: 0,
  ratingTotal: 4,
  bioTermMatches: 0,
};

describe("deterministic Connect ranking", () => {
  it("penalizes but does not remove a time-conflicting candidate", () => {
    expect(scoreCandidate({ ...base, hasTimeConflict: true })).toBeLessThan(scoreCandidate(base));
    expect(rankCandidates([{ ...base, hasTimeConflict: true }])).toHaveLength(1);
  });

  it("accepts only model-selected indexes from supplied evidence", () => {
    const selected = new Map([["a", [1, 99, -1]]]);
    const result = rankCandidates([{ ...base, evidence: ["证据一", "证据二"] }], selected);
    expect(result[0].reasons).toEqual(["证据二"]);
  });

  it("orders candidates by deterministic score", () => {
    const result = rankCandidates([base, { ...base, userId: "b", skillCount: 0, ratingTotal: 0 }]);
    expect(result.map((candidate) => candidate.userId)).toEqual(["a", "b"]);
  });
});
