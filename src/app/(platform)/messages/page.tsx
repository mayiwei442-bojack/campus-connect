import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MessagesWorkspace, type ConversationItem, type MessageItem } from "@/components/messages/messages-workspace";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "消息", description: "好友与活动连接的实时沟通空间。" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const [viewer, query, supabase] = await Promise.all([getViewer(), searchParams, createClient()]);
  if (!viewer) redirect("/login");

  const { data: conversationRows } = await supabase.from("conversations").select("id, title, kind, activity_id, is_archived, updated_at").order("updated_at", { ascending: false });
  const conversations: ConversationItem[] = conversationRows ?? [];
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

  return <MessagesWorkspace conversations={conversations} initialConversationId={activeId ?? null} initialMessages={initialMessages} viewerId={viewer.id} />;
}
