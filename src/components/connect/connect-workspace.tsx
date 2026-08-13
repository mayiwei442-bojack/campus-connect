"use client";

import { AlertTriangle, ArrowUpRight, BrainCircuit, CalendarClock, LoaderCircle, Sparkles, UserRoundSearch } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import type { ConnectRecommendationResponse } from "@/lib/connect/types";

const examples = ["今晚想找两个人随便踢足球", "找会做产品设计的同学参加 AI 比赛", "周末想找人散步练英语"];

export function ConnectWorkspace({ initialIntent = "" }: { initialIntent?: string }) {
  const [intent, setIntent] = useState(initialIntent);
  const [result, setResult] = useState<ConnectRecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  async function recommend(source: string) {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/connect/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: source }),
      });
      const payload = (await response.json()) as ConnectRecommendationResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "推荐暂时不可用。");
      if (currentRequest === requestId.current) setResult(payload);
    } catch (requestError) {
      if (currentRequest === requestId.current) {
        setError(requestError instanceof Error ? requestError.message : "推荐暂时不可用。");
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    const normalized = initialIntent.trim();
    if (!normalized) return;
    const timer = window.setTimeout(() => void recommend(normalized), 0);
    return () => window.clearTimeout(timer);
    // Initial query intent should run only once; later requests are explicit submissions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = intent.trim();
    if (normalized) void recommend(normalized);
  }

  return (
    <div className="space-y-6">
      <section className="campus-grid relative overflow-hidden rounded-[2rem] p-5 text-paper shadow-[0_28px_90px_rgba(20,60,50,0.18)] sm:p-8 lg:p-10">
        <div className="absolute -right-12 -top-12 size-56 rounded-full border border-white/10" />
        <div className="relative max-w-4xl">
          <p className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-paper/55"><BrainCircuit size={16} />Connect intelligence</p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">说清想做的事，<span className="text-[#f47d54]">找到可以行动的人。</span></h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-paper/62 sm:text-base">DeepSeek 只解析意图与挑选解释证据；屏蔽、匹配开关、时间冲突和分数全部由数据库与确定性规则执行。</p>

          <form onSubmit={submit} className="mt-7 rounded-[1.5rem] border border-white/12 bg-white/9 p-2 backdrop-blur-sm sm:p-3">
            <label htmlFor="connect-intent" className="sr-only">连接需求</label>
            <textarea id="connect-intent" value={intent} onChange={(event) => setIntent(event.target.value)} minLength={2} maxLength={500} rows={3} placeholder="例如：今晚想找两个人随便踢足球……" className="min-h-28 w-full resize-none rounded-[1.1rem] bg-[#fffdf7] px-4 py-4 text-base leading-7 text-forest outline-none placeholder:text-forest/36 sm:px-5" />
            <div className="flex items-center justify-between gap-3 px-2 py-2">
              <span className="text-xs text-paper/50">不会读取私聊内容</span>
              <button type="submit" disabled={loading || intent.trim().length < 2} className="inline-flex items-center gap-2 rounded-full bg-signal px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40">
                {loading ? <LoaderCircle size={17} className="animate-spin" /> : <Sparkles size={17} />}
                {loading ? "正在理解…" : "开始推荐"}
              </button>
            </div>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {examples.map((example) => <button key={example} type="button" onClick={() => setIntent(example)} className="rounded-full border border-white/12 bg-white/6 px-3 py-2 text-xs text-paper/66 hover:bg-white/12">{example}</button>)}
          </div>
        </div>
      </section>

      {error ? (
        <section role="alert" className="rounded-[1.5rem] border border-signal/20 bg-signal/7 p-5">
          <p className="flex items-center gap-2 font-bold text-signal"><AlertTriangle size={18} />本次推荐没有完成</p>
          <p className="mt-2 text-sm leading-6 text-forest/60">{error} 普通 Profile、地图、活动与消息仍可继续使用。</p>
        </section>
      ) : null}

      {result ? (
        <>
          <section className="rounded-[1.6rem] border border-forest/10 bg-white/46 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-cobalt">Parsed intent</p><h2 className="mt-2 font-display text-2xl font-semibold text-forest">{result.intent.activity}</h2></div>
              <span className="rounded-full border border-forest/10 bg-paper px-3 py-2 text-xs font-bold text-forest/55">{result.ai.parsedByModel ? result.ai.model : "基础解析"}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              {result.intent.timeText ? <span className="rounded-full bg-cobalt/8 px-3 py-2 text-cobalt">时间 · {result.intent.timeText}</span> : null}
              {result.intent.desiredPeople ? <span className="rounded-full bg-forest/7 px-3 py-2 text-forest">人数 · {result.intent.desiredPeople}</span> : null}
              {result.intent.style ? <span className="rounded-full bg-forest/7 px-3 py-2 text-forest">风格 · {result.intent.style}</span> : null}
              {result.intent.place ? <span className="rounded-full bg-forest/7 px-3 py-2 text-forest">地点 · {result.intent.place}</span> : null}
              {result.intent.skillTerms.map((term) => <span key={term} className="rounded-full bg-signal/8 px-3 py-2 text-signal">{term}</span>)}
            </div>
            {result.ai.warning ? <p className="mt-4 text-xs leading-6 text-forest/48">{result.ai.warning} 候选过滤和排序仍由确定性规则完成。</p> : null}
          </section>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-signal">Eligible connections</p><h2 className="mt-2 font-display text-3xl font-semibold text-forest">推荐同学</h2></div><p className="text-xs text-forest/45">{result.candidates.length} 位通过权限与匹配规则</p></div>
            {result.candidates.length ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {result.candidates.map((candidate, index) => (
                  <article key={candidate.userId} className="rise-in rounded-[1.6rem] border border-forest/10 bg-white/52 p-5 shadow-[0_18px_50px_rgba(20,35,31,0.05)] sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-forest font-display text-sm font-semibold text-paper">{candidate.nickname.replace(/\s+/g, "").slice(0, 2).toUpperCase()}</span><div><p className="font-display text-xl font-semibold text-forest">{candidate.nickname}</p><p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-forest/38">Candidate {String(index + 1).padStart(2, "0")}</p></div></div>
                      <div className="text-right"><p className="font-display text-3xl font-semibold text-cobalt">{candidate.score}</p><p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-forest/38">match score</p></div>
                    </div>
                    {candidate.bio ? <p className="mt-4 line-clamp-2 text-sm leading-6 text-forest/58">{candidate.bio}</p> : null}
                    <ul className="mt-4 space-y-2">
                      {candidate.reasons.map((reason) => <li key={reason} className="flex gap-2 text-sm leading-6 text-forest/66"><Sparkles size={14} className="mt-1 shrink-0 text-signal" />{reason}</li>)}
                    </ul>
                    {candidate.hasTimeConflict ? <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-signal/9 px-3 py-2 text-xs font-bold text-signal"><CalendarClock size={14} />时间可能冲突 · 已降权但未排除</p> : null}
                    <div className="mt-5 flex flex-wrap gap-2 border-t border-forest/8 pt-4">
                      <Link href={`/profile/${candidate.userId}`} className="inline-flex items-center gap-2 rounded-full border border-forest/12 px-4 py-2.5 text-xs font-bold text-forest hover:bg-forest hover:text-paper"><UserRoundSearch size={15} />查看 Profile{candidate.personaIds.length ? " / Persona" : ""}</Link>
                      <Link href={`/activities/new?invitee=${encodeURIComponent(candidate.userId)}&intent=${encodeURIComponent(result.intent.activity)}`} className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2.5 text-xs font-bold text-paper hover:bg-forest-soft">创建活动并邀请<ArrowUpRight size={15} /></Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[1.6rem] border border-dashed border-forest/15 bg-white/30 p-10 text-center"><UserRoundSearch size={28} className="mx-auto text-forest/30" /><p className="mt-3 font-display text-2xl font-semibold text-forest">暂时没有符合条件的人</p><p className="mt-2 text-sm text-forest/50">可以换一组关键词，或稍后等更多同学公开可匹配 Skill。</p></div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
