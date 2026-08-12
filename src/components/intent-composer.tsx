"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const suggestions = ["今晚想找人随便踢球", "AI 比赛缺设计和路演队友", "找两个人散步练英语"];

export function IntentComposer() {
  const router = useRouter();
  const [intent, setIntent] = useState("");

  function submitIntent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedIntent = intent.trim();

    if (!normalizedIntent) {
      return;
    }

    router.push(`/connect?intent=${encodeURIComponent(normalizedIntent)}`);
  }

  return (
    <form onSubmit={submitIntent} className="mt-7" aria-label="表达校园连接需求">
      <label htmlFor="campus-intent" className="sr-only">
        今天想一起做什么？
      </label>
      <div className="rounded-[1.6rem] border border-forest/12 bg-[#fffdf7] p-2 shadow-[0_20px_80px_rgba(20,60,50,0.1)] transition-shadow focus-within:shadow-[0_24px_90px_rgba(20,60,50,0.16)] sm:p-3">
        <textarea
          id="campus-intent"
          value={intent}
          onChange={(event) => setIntent(event.target.value)}
          placeholder="例如：今晚想找两三个人散步，顺便练英语……"
          rows={3}
          className="min-h-28 w-full resize-none rounded-[1.2rem] bg-transparent px-3 py-3 text-base leading-7 text-ink outline-none placeholder:text-forest/38 sm:min-h-32 sm:px-5 sm:py-4 sm:text-lg"
          aria-describedby="intent-help"
        />
        <div className="flex items-center justify-between gap-3 border-t border-forest/8 px-2 pb-1 pt-2 sm:px-3">
          <p id="intent-help" className="hidden items-center gap-2 text-xs text-forest/48 sm:flex">
            <Sparkles size={15} className="text-signal" aria-hidden="true" />
            后续由 AI 理解意图，程序执行规则
          </p>
          <button
            type="submit"
            disabled={!intent.trim()}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-sm font-bold text-paper transition-all hover:-translate-y-0.5 hover:bg-forest-soft disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0"
          >
            开始连接
            <ArrowUpRight size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="需求示例">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setIntent(suggestion)}
            className="rounded-full border border-forest/10 bg-white/35 px-3.5 py-2 text-xs font-medium text-forest/62 transition-colors hover:border-forest/20 hover:bg-white/70 hover:text-forest"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </form>
  );
}
