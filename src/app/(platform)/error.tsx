"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

export default function PlatformError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-xl rounded-[2rem] border border-signal/18 bg-white/52 p-8 text-center shadow-[0_24px_80px_rgba(20,35,31,0.08)]">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-signal/10 text-signal">
          <TriangleAlert size={24} aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-display text-3xl font-semibold text-forest">这个模块暂时没有回应</h1>
        <p className="mt-3 text-sm leading-7 text-forest/54">
          错误被限制在当前区域，其他 Campus Connect 页面仍然可以继续使用。
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-sm font-bold text-paper hover:bg-forest-soft"
        >
          <RotateCcw size={16} aria-hidden="true" />
          重试当前模块
        </button>
      </div>
    </section>
  );
}
