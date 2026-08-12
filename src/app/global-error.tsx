"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="grid min-h-screen place-items-center bg-[#f4f0e6] px-5 text-[#143c32]">
          <section className="max-w-lg text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#e3572d]">Campus Connect</p>
            <h1 className="mt-4 text-4xl font-bold">应用外壳暂时无法加载</h1>
            <p className="mt-4 leading-7 opacity-60">请重试；后续模块错误会被隔离，不影响整个应用。</p>
            <button
              type="button"
              onClick={reset}
              className="mt-7 rounded-full bg-[#143c32] px-5 py-3 font-bold text-[#f4f0e6]"
            >
              重新加载
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
