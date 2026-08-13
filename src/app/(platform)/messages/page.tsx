import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  MessagesWorkspace,
  type ConversationItem,
  type FriendRequestItem,
  type MessageItem,
} from "@/components/messages/messages-workspace";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "消息", description: "好友与活动连接的实时沟通空间。" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const [viewer, query, supabase] = await Promise.all([getViewer(), searchParams, createClient()]);
  if (!viewer) redirect("/login");

  const [{ data: conversationRows }, { data: friendshipRows }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, title, kind, activity_id, is_archived, updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, introduction, requested_at")
      .eq("status", "pending")
      .order("requested_at", { ascending: false }),
  ]);

  const conversationIds = (conversationRows ?? []).map((conversation) => conversation.id);
  const { data: directMemberRows } = conversationIds.length
    ? await supabase
        .from("conversation_members")
        .select("conversation_id, profile_id")
        .in("conversation_id", conversationIds)
        .is("left_at", null)
    : { data: [] };
  const requestProfileIds = (friendshipRows ?? []).map((friendship) =>
    friendship.requester_id === viewer.id ? friendship.addressee_id : friendship.requester_id,
  );
  const peerProfileIds = (directMemberRows ?? [])
    .filter((member) => member.profile_id !== viewer.id)
    .map((member) => member.profile_id);
  const visibleProfileIds = [...new Set([...requestProfileIds, ...peerProfileIds])];
  const { data: visibleProfiles } = visibleProfileIds.length
    ? await supabase.from("profiles").select("id, nickname, campus").in("id", visibleProfileIds)
    : { data: [] };
  const profilesById = new Map((visibleProfiles ?? []).map((profile) => [profile.id, profile]));
  const peerByConversation = new Map(
    (directMemberRows ?? [])
      .filter((member) => member.profile_id !== viewer.id)
      .map((member) => [member.conversation_id, member.profile_id]),
  );

  const conversations: ConversationItem[] = (conversationRows ?? []).map((conversation) => {
    const peerProfileId = conversation.kind === "direct" ? peerByConversation.get(conversation.id) ?? null : null;
    return {
      ...conversation,
      peerProfileId,
      title: conversation.kind === "direct"
        ? profilesById.get(peerProfileId ?? "")?.nickname ?? "好友私聊"
        : conversation.title,
    };
  });
  const friendRequests: FriendRequestItem[] = (friendshipRows ?? []).map((friendship) => {
    const incoming = friendship.addressee_id === viewer.id;
    const profileId = incoming ? friendship.requester_id : friendship.addressee_id;
    const profile = profilesById.get(profileId);
    return {
      id: friendship.id,
      direction: incoming ? "incoming" : "outgoing",
      introduction: friendship.introduction,
      requestedAt: friendship.requested_at,
      profileId,
      nickname: profile?.nickname ?? "Campus member",
      campus: profile?.campus ?? null,
    };
  });
  const requestedId = query.conversation;
  const activeId = conversations.some((conversation) => conversation.id === requestedId) ? requestedId! : conversations[0]?.id;
  let initialMessages: MessageItem[] = [];

  if (activeId) {
    const [{ data: rows }, { data: memberRows }] = await Promise.all([
      supabase.from("messages").select("*").eq("conversation_id", activeId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(200),
      supabase.from("conversation_members").select("profile_id").eq("conversation_id", activeId),
    ]);
    const profileIds = [...new Set([...(memberRows ?? []).map((member) => member.profile_id), ...(rows ?? []).map((message) => message.sender_id)])];
    const { data: profiles } = profileIds.length ? await supabase.from("profiles").select("id, nickname").in("id", profileIds) : { data: [] };
    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.nickname]));

    initialMessages = await Promise.all([...(rows ?? [])].reverse().map(async (message) => {
      const signed = message.storage_path ? await supabase.storage.from("chat-images").createSignedUrl(message.storage_path, 3600) : null;
      return { ...message, senderName: names.get(message.sender_id) ?? "Campus member", imageUrl: signed?.data?.signedUrl ?? null };
    }));
  }

  return (
    <MessagesWorkspace
      conversations={conversations}
      friendRequests={friendRequests}
      initialConversationId={activeId ?? null}
      initialMessages={initialMessages}
      key={activeId ?? "empty"}
      viewerId={viewer.id}
    />
  );
}
