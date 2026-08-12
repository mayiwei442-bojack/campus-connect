import { Bell, LogOut, Radio, School } from "lucide-react";
import Link from "next/link";

import { logoutAction } from "@/app/(auth)/actions";
import { BrandMark } from "@/components/brand-mark";
import { PrimaryNavigation } from "@/components/primary-navigation";
import type { Viewer } from "@/lib/auth/viewer";

type AppShellProps = Readonly<{
  children: React.ReactNode;
  viewer: Viewer | null;
}>;

export function AppShell({ children, viewer }: AppShellProps) {
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
            Auth foundation
          </div>
          <p className="mt-3 text-sm leading-6 text-paper/72">
            {viewer ? `已以「${viewer.nickname}」登录，身份由 Supabase Auth 验证。` : "认证服务正在连接，平台数据保持锁定。"}
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
              <div className="hidden text-right md:block">
                <p className="max-w-36 truncate text-xs font-bold text-forest">{viewer?.nickname ?? "认证中"}</p>
                <p className="mt-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-forest/38">Campus member</p>
              </div>
              <Link
                href="/profile/me"
                className="grid size-10 place-items-center rounded-full bg-cobalt text-sm font-bold text-white shadow-[0_8px_24px_rgba(39,91,131,0.2)]"
                aria-label="打开我的主页"
              >
                {viewer?.initials ?? "CC"}
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="grid size-10 place-items-center rounded-full border border-forest/10 bg-white/55 text-forest transition-colors hover:bg-white hover:text-signal"
                  aria-label="退出登录"
                >
                  <LogOut size={17} aria-hidden="true" />
                </button>
              </form>
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
