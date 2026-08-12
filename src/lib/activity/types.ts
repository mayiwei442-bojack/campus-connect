import type { Database } from "@/lib/supabase/database.types";

export type ActivityStatus = Database["public"]["Enums"]["activity_status"];
export type ParticipationStatus = Database["public"]["Enums"]["activity_participation_status"];

export type ActivitySummary = {
  id: string;
  creatorId: string;
  creatorName: string;
  placeId: string;
  placeName: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  capacity: number | null;
  joinMode: "free" | "approval";
  status: ActivityStatus;
  joinedCount: number;
  viewerStatus: ParticipationStatus | null;
};

export type MapActivity = Pick<
  ActivitySummary,
  "id" | "title" | "placeId" | "startsAt" | "capacity" | "joinedCount" | "joinMode"
>;

export type ActivityParticipant = {
  profileId: string;
  nickname: string;
  status: ParticipationStatus;
  queuePosition: number | null;
};

export type ActivityDetail = ActivitySummary & {
  conversationId: string | null;
  participants: ActivityParticipant[];
};
