import { Bell, Radio, School } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { PrimaryNavigation } from "@/components/primary-navigation";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="paper-texture min-h-screen lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col overflow-hidden bg-forest px-5 py-6 text-paper lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full border border-white/8" />
        <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full border border-white/8" />
        <BrandMark />
        <PrimaryNavigation mode="sidebar" />

        <div className="mt-auto rounded-[1.35rem] border border-white/10 bg-white/[0.055] p-4">
          <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-paper/48">
            <Radio size={14} className="text-signal" aria-hidden="true" />
            Foundation mode
          </div>
          <p className="mt-3 text-sm leading-6 text-paper/72">
            当前建立页面骨架与视觉语言，实时数据将在后续板块接入。
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-forest/10 bg-paper/86 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[94rem] items-center justify-between gap-4">
            <div className="lg:hidden">
              <BrandMark compact />
            </div>
            <div className="hidden items-center gap-2 text-xs font-semibold text-forest/58 lg:flex">
              <School size={16} aria-hidden="true" />
              <span>Campus Connect · 单校园演示空间</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-forest/10 bg-white/45 px-3 py-2 text-[0.7rem] font-semibold text-forest/58 sm:flex">
                <span className="relative flex size-2">
                  <span className="signal-ring absolute inset-0 rounded-full bg-signal" />
                  <span className="relative size-2 rounded-full bg-signal" />
                </span>
                基础骨架预览
              </div>
              <Link
                href="/notifications"
                className="relative grid size-10 place-items-center rounded-full border border-forest/10 bg-white/55 text-forest transition-colors hover:bg-white"
                aria-label="查看站内通知"
              >
                <Bell size={18} aria-hidden="true" />
              </Link>
              <Link
                href="/profile/me"
                className="grid size-10 place-items-center rounded-full bg-cobalt text-sm font-bold text-white shadow-[0_8px_24px_rgba(39,91,131,0.2)]"
                aria-label="打开我的主页"
              >
                CC
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto min-h-[calc(100vh-65px)] max-w-[94rem] px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-12 lg:pt-10">
          {children}
        </main>
      </div>

      <PrimaryNavigation mode="mobile" />
    </div>
  );
}
