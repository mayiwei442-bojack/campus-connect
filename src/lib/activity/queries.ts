import { cache } from "react";

import type { ActivityDetail, ActivityParticipant, ActivitySummary } from "@/lib/activity/types";
import { createClient } from "@/lib/supabase/server";

export const listActivities = cache(async (viewerId: string): Promise<ActivitySummary[]> => {
  const supabase = await createClient();
  const [{ data: activities, error }, { data: places }] = await Promise.all([
    supabase
      .from("activities")
      .select("*")
      .in("status", ["scheduled", "active"])
      .order("starts_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("places").select("id, display_name"),
  ]);

  if (error || !activities?.length) {
    return [];
  }

  const activityIds = activities.map((activity) => activity.id);
  const creatorIds = [...new Set(activities.map((activity) => activity.creator_id))];
  const [{ data: participations }, { data: creators }] = await Promise.all([
    supabase
      .from("activity_participations")
      .select("activity_id, profile_id, status")
      .in("activity_id", activityIds),
    supabase.from("profiles").select("id, nickname").in("id", creatorIds),
  ]);

  const placeNames = new Map((places ?? []).map((place) => [place.id, place.display_name]));
  const creatorNames = new Map((creators ?? []).map((profile) => [profile.id, profile.nickname]));
  const joinedCounts = new Map<string, number>();
  const viewerStatuses = new Map<string, ActivitySummary["viewerStatus"]>();

  for (const participation of participations ?? []) {
    if (participation.status === "joined") {
      joinedCounts.set(participation.activity_id, (joinedCounts.get(participation.activity_id) ?? 0) + 1);
    }
    if (participation.profile_id === viewerId) {
      viewerStatuses.set(participation.activity_id, participation.status);
    }
  }

  return activities.map((activity) => ({
    id: activity.id,
    creatorId: activity.creator_id,
    creatorName: creatorNames.get(activity.creator_id) ?? "Campus member",
    placeId: activity.place_id,
    placeName: placeNames.get(activity.place_id) ?? activity.place_id,
    title: activity.title,
    description: activity.description,
    startsAt: activity.starts_at,
    endsAt: activity.ends_at,
    capacity: activity.capacity,
    joinMode: activity.join_mode,
    status: activity.status,
    joinedCount: joinedCounts.get(activity.id) ?? 0,
    viewerStatus: viewerStatuses.get(activity.id) ?? null,
  }));
});

export const getActivityDetail = cache(async (activityId: string, viewerId: string): Promise<ActivityDetail | null> => {
  const activities = await listActivities(viewerId);
  let summary = activities.find((activity) => activity.id === activityId) ?? null;
  const supabase = await createClient();

  if (!summary) {
    const { data: activity } = await supabase.from("activities").select("*").eq("id", activityId).maybeSingle();
    if (!activity) {
      return null;
    }

    const [{ data: place }, { data: creator }] = await Promise.all([
      supabase.from("places").select("display_name").eq("id", activity.place_id).maybeSingle(),
      supabase.from("profiles").select("nickname").eq("id", activity.creator_id).maybeSingle(),
    ]);
    summary = {
      id: activity.id,
      creatorId: activity.creator_id,
      creatorName: creator?.nickname ?? "Campus member",
      placeId: activity.place_id,
      placeName: place?.display_name ?? activity.place_id,
      title: activity.title,
      description: activity.description,
      startsAt: activity.starts_at,
      endsAt: activity.ends_at,
      capacity: activity.capacity,
      joinMode: activity.join_mode,
      status: activity.status,
      joinedCount: 0,
      viewerStatus: null,
    };
  }

  const [{ data: participationRows }, { data: conversation }] = await Promise.all([
    supabase
      .from("activity_participations")
      .select("profile_id, status, queue_position")
      .eq("activity_id", activityId)
      .order("queue_position", { ascending: true, nullsFirst: false }),
    supabase.from("conversations").select("id").eq("activity_id", activityId).maybeSingle(),
  ]);

  const profileIds = [...new Set((participationRows ?? []).map((row) => row.profile_id))];
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, nickname").in("id", profileIds)
    : { data: [] };
  const profileNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.nickname]));
  const participants: ActivityParticipant[] = (participationRows ?? []).map((row) => ({
    profileId: row.profile_id,
    nickname: profileNames.get(row.profile_id) ?? "Campus member",
    status: row.status,
    queuePosition: row.queue_position,
  }));

  return {
    ...summary,
    joinedCount: participants.filter((participant) => participant.status === "joined").length,
    viewerStatus: participants.find((participant) => participant.profileId === viewerId)?.status ?? null,
    conversationId: conversation?.id ?? null,
    participants,
  };
});
