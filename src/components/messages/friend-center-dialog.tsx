"use client";

import { Check, Clock3, Mail, MessageCircle, Search, Send, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";

import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";

export type FriendRequestItem = {
  id: string;
  direction: "incoming" | "outgoing";
  introduction: string;
  requestedAt: string;
  profileId: string;
  nickname: string;
  campus: string | null;
};

type FriendSearchResult = Database["public"]["Functions"]["search_people"]["Returns"][number];

const DEFAULT_INTRODUCTION = "你好！很高兴在 Campus Connect 认识你，想加你为好友。";

function formatRequestDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function AvatarLetter({ nickname }: { nickname: string }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-forest text-sm font-bold text-paper shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
      {nickname.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function FriendCenterDialog({
  friendRequests,
  onClose,
  viewerId,
}: {
  friendRequests: FriendRequestItem[];
  onClose: () => void;
  viewerId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [introduction, setIntroduction] = useState(DEFAULT_INTRODUCTION);
  const [results, setResults] = useState<FriendSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [handledRequestIds, setHandledRequestIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const visibleRequests = friendRequests.filter((request) => !handledRequestIds.includes(request.id));
  const incomingRequests = visibleRequests.filter((request) => request.direction === "incoming");
  const outgoingRequests = visibleRequests.filter((request) => request.direction === "outgoing");

  useEffect(() => {
    searchInputRef.current?.focus();
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  async function searchPeople(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 2) {
      setError("昵称至少输入 2 个字；使用邮箱时请输入完整地址。");
      return;
    }

    setSearching(true);
    setError("");
    setNotice("");
    const { data, error: searchError } = await supabase.rpc("search_people", { p_query: normalized });
    setSearching(false);
    setHasSearched(true);

    if (searchError) {
      setResults([]);
      setError("暂时无法搜索同学，请稍后再试。");
      return;
    }
    setResults(data ?? []);
  }

  async function sendFriendRequest(result: FriendSearchResult) {
    const normalizedIntroduction = introduction.trim();
    if (!normalizedIntroduction) {
      setError("请先写一句简短的自我介绍。");
      return;
    }

    setBusyId(result.profile_id);
    setError("");
    setNotice("");
    const { data: friendshipId, error: requestError } = await supabase.rpc("send_friend_request", {
      p_addressee_id: result.profile_id,
      p_introduction: normalizedIntroduction,
    });
    setBusyId(null);

    if (requestError || !friendshipId) {
      setError("好友申请未发送。对方可能已关闭陌生人联系，或你们之间存在联系限制。");
      return;
    }

    setResults((current) => current.map((item) => item.profile_id === result.profile_id
      ? { ...item, friendship_id: friendshipId, friendship_status: "pending", requested_by: viewerId }
      : item));
    setNotice(`已向 ${result.nickname} 发送好友申请。`);
    router.refresh();
  }

  async function respondToRequest(friendshipId: string, accept: boolean, nickname: string) {
    setBusyId(friendshipId);
    setError("");
    setNotice("");
    const { data: conversationId, error: responseError } = await supabase.rpc("respond_friend_request", {
      p_accept: accept,
      p_friendship_id: friendshipId,
    });
    setBusyId(null);

    if (responseError) {
      setError("这条好友申请已失效或暂时无法处理，请刷新后重试。");
      return;
    }

    setHandledRequestIds((current) => [...current, friendshipId]);
    setResults((current) => current.map((item) => item.friendship_id === friendshipId
      ? { ...item, friendship_status: accept ? "accepted" : "declined", conversation_id: conversationId }
      : item));

    if (accept && conversationId) {
      onClose();
      router.push(`/messages?conversation=${conversationId}`);
      router.refresh();
      return;
    }

    setNotice(`已婉拒 ${nickname} 的好友申请。`);
    router.refresh();
  }

  function openConversation(conversationId: string) {
    onClose();
    router.push(`/messages?conversation=${conversationId}`);
  }

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/45 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={closeFromBackdrop}
    >
      <section
        aria-labelledby="friend-center-title"
        aria-modal="true"
        className="rise-in relative my-auto w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/25 bg-paper shadow-[0_32px_120px_rgba(10,28,23,0.32)]"
        role="dialog"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#e3572d_0_18%,#8db9c7_18%_48%,#143c32_48%)]" />
        <header className="flex items-start justify-between gap-6 border-b border-forest/10 px-5 py-5 sm:px-7">
          <div>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.22em] text-signal">Friend signals</p>
            <h2 id="friend-center-title" className="mt-1 font-display text-3xl font-semibold text-forest">好友中心</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-forest/55">用昵称找到新同学，或输入对方的完整邮箱。双方确认后，私聊会自动出现在消息列表。</p>
          </div>
          <button
            aria-label="关闭好友中心"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-forest/10 bg-white/55 text-forest transition hover:rotate-3 hover:bg-white"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid max-h-[min(46rem,calc(100vh-8rem))] overflow-y-auto lg:grid-cols-[0.82fr_1.18fr]">
          <aside className="border-b border-forest/10 bg-forest px-5 py-6 text-paper lg:border-b-0 lg:border-r lg:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-skyline">Inbox</p>
                <h3 className="mt-1 font-display text-2xl font-semibold">待处理申请</h3>
              </div>
              {incomingRequests.length ? <span className="grid size-8 place-items-center rounded-full bg-signal text-xs font-bold text-white">{incomingRequests.length}</span> : null}
            </div>

            <div className="mt-5 space-y-3">
              {incomingRequests.map((request) => (
                <article key={request.id} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                  <div className="flex items-center gap-3">
                    <AvatarLetter nickname={request.nickname} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{request.nickname}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[0.62rem] text-paper/45"><Clock3 size={11} />{formatRequestDate(request.requestedAt)}</p>
                    </div>
                  </div>
                  <p className="mt-3 rounded-xl bg-black/10 px-3 py-2.5 text-xs leading-5 text-paper/75">“{request.introduction}”</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      className="rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-paper/70 transition hover:bg-white/10 disabled:opacity-45"
                      disabled={busyId === request.id}
                      onClick={() => void respondToRequest(request.id, false, request.nickname)}
                      type="button"
                    >
                      婉拒
                    </button>
                    <button
                      className="rounded-full bg-signal px-3 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-45"
                      disabled={busyId === request.id}
                      onClick={() => void respondToRequest(request.id, true, request.nickname)}
                      type="button"
                    >
                      {busyId === request.id ? "处理中…" : "接受并聊天"}
                    </button>
                  </div>
                </article>
              ))}

              {!incomingRequests.length ? (
                <div className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center">
                  <Check className="mx-auto text-skyline" size={22} />
                  <p className="mt-2 text-sm font-bold">申请都处理完了</p>
                  <p className="mt-1 text-xs leading-5 text-paper/45">新的好友申请会实时出现在这里。</p>
                </div>
              ) : null}
            </div>

            {outgoingRequests.length ? (
              <div className="mt-6 border-t border-white/10 pt-5">
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-paper/45">等待对方确认</p>
                <div className="mt-3 space-y-2">
                  {outgoingRequests.map((request) => (
                    <div key={request.id} className="flex items-center gap-3 rounded-xl bg-black/10 px-3 py-2.5">
                      <AvatarLetter nickname={request.nickname} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{request.nickname}</p>
                        <p className="mt-0.5 truncate text-[0.6rem] text-paper/40">{request.campus ?? "好友申请已送达"}</p>
                      </div>
                      <span className="size-2 rounded-full bg-skyline" aria-label="等待确认" />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>

          <div className="px-5 py-6 sm:px-7">
            <form onSubmit={searchPeople}>
              <label className="text-xs font-bold text-forest" htmlFor="friend-search">搜索昵称或完整邮箱</label>
              <div className="mt-2 flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-forest/35" size={17} />
                  <input
                    autoComplete="off"
                    className="h-12 w-full rounded-2xl border border-forest/12 bg-white/65 pl-10 pr-4 text-sm text-forest placeholder:text-forest/30"
                    id="friend-search"
                    maxLength={254}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="例如：陈知行 / friend@campus.edu"
                    ref={searchInputRef}
                    value={query}
                  />
                </div>
                <button
                  className="grid h-12 min-w-20 place-items-center rounded-2xl bg-forest px-5 text-sm font-bold text-paper transition hover:-translate-y-0.5 disabled:opacity-45"
                  disabled={searching}
                  type="submit"
                >
                  {searching ? "搜索中" : "搜索"}
                </button>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[0.65rem] leading-5 text-forest/42"><Mail size={12} />邮箱仅支持完整匹配，搜索结果只显示脱敏提示。</p>

              <label className="mt-5 block text-xs font-bold text-forest" htmlFor="friend-introduction">好友申请介绍</label>
              <textarea
                className="mt-2 min-h-20 w-full resize-none rounded-2xl border border-forest/12 bg-white/65 px-4 py-3 text-sm leading-6 text-forest"
                id="friend-introduction"
                maxLength={240}
                onChange={(event) => setIntroduction(event.target.value)}
                value={introduction}
              />
              <p className="mt-1 text-right text-[0.62rem] text-forest/35">{introduction.length}/240</p>
            </form>

            <div aria-live="polite" className="min-h-7 pt-1">
              {error ? <p className="text-xs font-semibold text-signal" role="alert">{error}</p> : null}
              {notice ? <p className="text-xs font-semibold text-cobalt" role="status">{notice}</p> : null}
            </div>

            <div className="mt-1 space-y-2">
              {results.map((result) => {
                const outgoingPending = result.friendship_status === "pending" && result.requested_by === viewerId;
                const incomingPending = result.friendship_status === "pending" && result.requested_by !== viewerId;
                return (
                  <article key={result.profile_id} className="group flex items-center gap-3 rounded-2xl border border-forest/10 bg-white/48 p-3 transition hover:border-cobalt/25 hover:bg-white/72">
                    <AvatarLetter nickname={result.nickname} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-forest">{result.nickname}</p>
                        {result.email_hint ? <span className="rounded-full bg-cobalt/8 px-2 py-0.5 text-[0.58rem] font-bold text-cobalt">{result.email_hint}</span> : null}
                      </div>
                      <p className="mt-0.5 truncate text-[0.65rem] text-forest/42">{result.campus ?? result.bio ?? "Campus Connect 同学"}</p>
                    </div>
                    {result.friendship_status === "accepted" && result.conversation_id ? (
                      <button
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cobalt px-3 py-2 text-xs font-bold text-white"
                        onClick={() => openConversation(result.conversation_id!)}
                        type="button"
                      >
                        <MessageCircle size={14} />聊天
                      </button>
                    ) : incomingPending && result.friendship_id ? (
                      <button
                        className="shrink-0 rounded-full bg-signal px-3 py-2 text-xs font-bold text-white disabled:opacity-45"
                        disabled={busyId === result.friendship_id}
                        onClick={() => void respondToRequest(result.friendship_id!, true, result.nickname)}
                        type="button"
                      >
                        接受
                      </button>
                    ) : outgoingPending ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-forest/7 px-3 py-2 text-xs font-bold text-forest/45"><Clock3 size={13} />已发送</span>
                    ) : (
                      <button
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-signal px-3 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-45"
                        disabled={busyId === result.profile_id}
                        onClick={() => void sendFriendRequest(result)}
                        type="button"
                      >
                        {busyId === result.profile_id ? <Send size={13} /> : <UserPlus size={14} />}
                        {busyId === result.profile_id ? "发送中" : "添加"}
                      </button>
                    )}
                  </article>
                );
              })}

              {hasSearched && !searching && !results.length ? (
                <div className="rounded-2xl border border-dashed border-forest/15 px-5 py-8 text-center">
                  <Search className="mx-auto text-forest/25" size={24} />
                  <p className="mt-2 text-sm font-bold text-forest">没有找到可添加的同学</p>
                  <p className="mt-1 text-xs leading-5 text-forest/42">检查昵称或邮箱是否正确；对方也可能关闭了陌生人联系。</p>
                </div>
              ) : null}

              {!hasSearched ? (
                <div className="rounded-2xl bg-[radial-gradient(circle_at_82%_20%,rgba(141,185,199,0.24),transparent_36%),linear-gradient(135deg,rgba(20,60,50,0.06),rgba(255,255,255,0.3))] px-5 py-8 text-center">
                  <UserPlus className="mx-auto text-signal" size={27} />
                  <p className="mt-3 font-display text-xl font-semibold text-forest">从一次真诚的介绍开始</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-forest/48">申请被接受后，系统会建立仅你们两人可访问的好友会话。</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
