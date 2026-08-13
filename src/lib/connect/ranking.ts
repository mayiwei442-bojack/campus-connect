import type { CandidateEvidence, ConnectCandidate } from "./types";

export function scoreCandidate(candidate: CandidateEvidence) {
  const skillScore = Math.min(candidate.skillCount * 22 + candidate.ratingTotal * 2, 62);
  const personaScore = Math.min(candidate.personaCount * 16, 32);
  const bioScore = Math.min(candidate.bioTermMatches * 4, 12);
  const conflictPenalty = candidate.hasTimeConflict ? 24 : 0;
  return Math.max(0, Math.min(100, 8 + skillScore + personaScore + bioScore - conflictPenalty));
}

export function rankCandidates(
  candidates: CandidateEvidence[],
  selectedEvidence: Map<string, number[]> = new Map(),
): ConnectCandidate[] {
  return candidates
    .map((candidate) => {
      const indexes = selectedEvidence.get(candidate.userId) ?? candidate.evidence.map((_, index) => index).slice(0, 2);
      const reasons = Array.from(new Set(indexes))
        .filter((index) => Number.isInteger(index) && index >= 0 && index < candidate.evidence.length)
        .slice(0, 3)
        .map((index) => candidate.evidence[index]);

      return {
        userId: candidate.userId,
        nickname: candidate.nickname,
        bio: candidate.bio,
        score: scoreCandidate(candidate),
        reasons: reasons.length ? reasons : ["公开资料符合当前连接条件"],
        hasTimeConflict: candidate.hasTimeConflict,
        personaIds: candidate.personaIds,
        matchedSkills: candidate.matchedSkills,
      };
    })
    .sort((left, right) => right.score - left.score || Number(left.hasTimeConflict) - Number(right.hasTimeConflict) || left.userId.localeCompare(right.userId));
}
