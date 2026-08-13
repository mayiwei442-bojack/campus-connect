"use client";

import { Archive, ImagePlus, MessageCircle, Radio, Send, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";

type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type ConversationItem = Pick<ConversationRow, "id" | "title" | "kind" | "activity_id" | "is_archived" | "updated_at">;
export type MessageItem = MessageRow & { senderName: string; imageUrl: string | null };

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }).format(new Date(value));
}

export function MessagesWorkspace({ conversations, initialConversationId, initialMessages, viewerId }: { conversations: ConversationItem[]; initialConversationId: string | null; initialMessages: MessageItem[]; viewerId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [activeId, setActiveId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<"connecting" | "live" | "offline">("connecting");
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const requestTokenRef = useRef(0);
  const activeIdRef = useRef(initialConversationId);
  const activeConversation = conversations.find((conversation) => conversation.id === activeId) ?? null;

  const hydrateMessage = useCallback(async (row: MessageRow): Promise<MessageItem> => {
    const [{ data: profile }, signed] = await Promise.all([
      supabase.from("profiles").select("nickname").eq("id", row.sender_id).maybeSingle(),
      row.storage_path ? supabase.storage.from("chat-images").createSignedUrl(row.storage_path, 3600) : Promise.resolve(null),
    ]);
    return { ...row, senderName: profile?.nickname ?? "Campus member", imageUrl: signed?.data?.signedUrl ?? null };
  }, [supabase]);

  useEffect(() => {
    if (!activeId) return;
    const channel = supabase.channel(`messages:${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` }, (payload) => {
        void hydrateMessage(payload.new as MessageRow).then((message) => setMessages((current) => activeIdRef.current !== message.conversation_id || current.some((item) => item.id === message.id) ? current : [...current, message]));
      })
      .subscribe((status) => setConnection(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "offline" : "connecting"));
    return () => { void supabase.removeChannel(channel); };
  }, [activeId, hydrateMessage, supabase]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function selectConversation(id: string) {
    if (id === activeId) return;
    setActiveId(id);
    activeIdRef.current = id;
    setMessages([]);
    setError("");
    setConnection("connecting");
    const requestToken = ++requestTokenRef.current;
    router.replace(`/messages?conversation=${id}`, { scroll: false });
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(200);
    const hydrated = await Promise.all([...(data ?? [])].reverse().map(hydrateMessage));
    if (requestTokenRef.current === requestToken) setMessages(hydrated);
  }

  async function sendText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = body.trim();
    if (!activeId || !normalized || busy || activeConversation?.is_archived) return;
    setBusy(true); setError("");
    const { data: messageId, error: sendError } = await supabase.rpc("send_message", { p_conversation_id: activeId, p_kind: "text", p_body: normalized, p_client_nonce: crypto.randomUUID() });
    if (sendError || !messageId) {
      setError("消息发送失败，请确认你仍是活动成员。");
    } else {
      setBody("");
      const { data: sentMessage, error: sentMessageError } = await supabase.from("messages").select("*").eq("id", messageId).single();
      if (sentMessageError) {
        setError("消息已发送，但页面同步失败，请刷新后查看。");
      } else {
        const hydrated = await hydrateMessage(sentMessage);
        setMessages((current) => activeIdRef.current !== hydrated.conversation_id || current.some((item) => item.id === hydrated.id) ? current : [...current, hydrated]);
      }
    }
    setBusy(false);
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !activeId || busy || activeConversation?.is_archived) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size > 10 * 1024 * 1024) { setError("请选择 10 MB 以内的 JPG、PNG、WebP 或 GIF 图片。"); return; }
    setBusy(true); setError("");
    const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "image";
    const path = `${activeId}/${viewerId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("chat-images").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { setError("图片上传失败。"); setBusy(false); return; }
    const { error: sendError } = await supabase.rpc("send_message", { p_conversation_id: activeId, p_kind: "image", p_storage_path: path, p_mime_type: file.type, p_client_nonce: crypto.randomUUID() });
    if (sendError) { await supabase.storage.from("chat-images").remove([path]); setError("图片消息发送失败。"); }
    setBusy(false);
  }

  if (!conversations.length) return <div className="rounded-[1.8rem] border border-dashed border-forest/15 bg-white/35 p-12 text-center"><MessageCircle className="mx-auto text-forest/25" size={36} /><h1 className="mt-4 font-display text-3xl font-semibold text-forest">还没有会话</h1><p className="mt-2 text-sm text-forest/50">加入活动后，对应的临时群聊会自动出现在这里。</p></div>;

  return (
    <section className="rise-in overflow-hidden rounded-[1.8rem] border border-forest/10 bg-white/45 shadow-[0_22px_80px_rgba(20,35,31,0.07)] lg:grid lg:h-[calc(100vh-9rem)] lg:min-h-[38rem] lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="border-b border-forest/10 bg-paper/55 p-3 lg:border-b-0 lg:border-r">
        <div className="px-3 py-3"><p className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-cobalt">Realtime rooms</p><h1 className="mt-1 font-display text-2xl font-semibold text-forest">消息</h1></div>
        <div className="mt-2 space-y-2">{conversations.map((conversation) => <button key={conversation.id} onClick={() => void selectConversation(conversation.id)} className={`w-full rounded-xl p-3 text-left ${conversation.id === activeId ? "bg-forest text-paper" : "bg-white/45 text-forest hover:bg-white/70"}`}><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold">{conversation.title ?? "Campus conversation"}</span>{conversation.is_archived ? <Archive size={14} /> : null}</span><span className={`mt-1 block text-[0.62rem] ${conversation.id === activeId ? "text-paper/55" : "text-forest/40"}`}>{conversation.kind === "activity" ? "活动临时群聊" : "私聊"}</span></button>)}</div>
      </aside>
      <div className="flex min-h-[34rem] flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-forest/10 px-5 py-4"><div><h2 className="font-display text-xl font-semibold text-forest">{activeConversation?.title ?? "会话"}</h2><p className="mt-1 flex items-center gap-1.5 text-[0.62rem] text-forest/45"><Radio size={12} className={connection === "live" ? "text-signal" : "text-forest/30"} />{connection === "live" ? "实时连接" : connection === "offline" ? "连接中断，历史仍可查看" : "正在连接"}</p></div>{activeConversation?.is_archived ? <span className="rounded-full bg-forest/8 px-3 py-1.5 text-xs font-bold text-forest/55">只读归档</span> : null}</header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{messages.map((message) => { const mine = message.sender_id === viewerId; return <article key={message.id} className={`mb-4 flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-[1.2rem] px-4 py-3 ${mine ? "bg-forest text-paper" : "bg-paper text-forest"}`}><p className={`text-[0.62rem] font-bold ${mine ? "text-paper/55" : "text-forest/42"}`}>{message.senderName} · {formatMessageTime(message.created_at)}</p>{message.kind === "text" ? <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6">{message.body}</p> : message.imageUrl ? <a href={message.imageUrl} target="_blank" rel="noreferrer"><Image unoptimized width={640} height={480} src={message.imageUrl} alt={message.body || "聊天图片"} className="mt-2 h-auto max-h-72 w-auto max-w-full rounded-lg object-contain" /></a> : <p className="mt-2 text-xs opacity-65">图片暂时无法加载</p>}</div></article>; })}<div ref={endRef} /></div>
        <form onSubmit={sendText} className="border-t border-forest/10 bg-paper/45 p-4"><div className="flex items-end gap-2"><label className={`grid size-11 shrink-0 place-items-center rounded-full border border-forest/10 bg-white/65 text-cobalt ${busy || activeConversation?.is_archived ? "pointer-events-none opacity-40" : "cursor-pointer"}`} aria-label="上传聊天图片"><ImagePlus size={18} /><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => void uploadImage(event)} /></label><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={2} maxLength={4000} disabled={activeConversation?.is_archived} placeholder={activeConversation?.is_archived ? "活动已结束，历史会话只读" : "输入消息…"} className="min-h-11 flex-1 resize-none rounded-2xl border border-forest/10 bg-white/70 px-4 py-3 text-sm text-forest" /><button disabled={!body.trim() || busy || activeConversation?.is_archived} className="grid size-11 shrink-0 place-items-center rounded-full bg-signal text-white disabled:opacity-35" aria-label="发送消息"><Send size={17} /></button></div>{error ? <p role="alert" className="mt-2 flex items-center gap-2 text-xs font-semibold text-signal"><TriangleAlert size={14} />{error}</p> : null}</form>
      </div>
    </section>
  );
}
