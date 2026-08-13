export type ConnectIntent = {
  activity: string;
  timeText: string | null;
  desiredPeople: number | null;
  style: string | null;
  place: string | null;
  skillTerms: string[];
  socialPreference: string | null;
  constraints: string[];
  startsAt: string | null;
  endsAt: string | null;
};

export type ConnectCandidate = {
  userId: string;
  nickname: string;
  bio: string | null;
  score: number;
  reasons: string[];
  hasTimeConflict: boolean;
  personaIds: string[];
  matchedSkills: string[];
};

export type ConnectRecommendationResponse = {
  intent: ConnectIntent;
  candidates: ConnectCandidate[];
  ai: {
    parsedByModel: boolean;
    explanationsOrganizedByModel: boolean;
    model: string;
    warning: string | null;
  };
};

export type CandidateEvidence = {
  userId: string;
  nickname: string;
  bio: string | null;
  hasTimeConflict: boolean;
  evidence: string[];
  matchedSkills: string[];
  personaIds: string[];
  skillCount: number;
  personaCount: number;
  ratingTotal: number;
  bioTermMatches: number;
};
