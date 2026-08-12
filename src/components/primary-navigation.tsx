"use client";

import {
  Compass,
  Home,
  Map,
  MessageCircle,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

const navigationItems: NavigationItem[] = [
  { href: "/home", label: "首页", shortLabel: "首页", icon: Home },
  { href: "/map", label: "校园地图", shortLabel: "地图", icon: Map },
  { href: "/connect", label: "AI 共创", shortLabel: "共创", icon: Sparkles },
  { href: "/messages", label: "消息", shortLabel: "消息", icon: MessageCircle },
  { href: "/profile/me", label: "我的主页", shortLabel: "我的", icon: UserRound },
];

type PrimaryNavigationProps = {
  mode: "sidebar" | "mobile";
};

function isActivePath(pathname: string, href: string) {
  if (href === "/home") {
    return pathname === href;
  }

  const routeRoot = href.split("/").slice(0, 2).join("/");
  return pathname === href || pathname.startsWith(`${routeRoot}/`);
}

export function PrimaryNavigation({ mode }: PrimaryNavigationProps) {
  const pathname = usePathname();

  if (mode === "mobile") {
    return (
      <nav
        aria-label="主要导航"
        className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 rounded-[1.35rem] border border-forest/10 bg-[#fffdf7]/94 p-1.5 shadow-[0_18px_60px_rgba(20,35,31,0.2)] backdrop-blur-xl lg:hidden"
      >
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-[1rem] px-1 py-2 text-[0.66rem] font-semibold transition-colors ${
                active ? "bg-forest text-paper" : "text-forest/58 hover:bg-forest/5 hover:text-forest"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.3 : 1.8} aria-hidden="true" />
              <span className="truncate">{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="主要导航" className="mt-10 space-y-1.5">
      {navigationItems.map((item, index) => {
        const Icon = item.icon;
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-all duration-200 ${
              active
                ? "bg-paper text-forest shadow-[0_8px_22px_rgba(7,25,20,0.18)]"
                : "text-paper/64 hover:bg-white/8 hover:text-paper"
            }`}
          >
            <span
              className={`grid size-9 place-items-center rounded-xl border transition-colors ${
                active ? "border-forest/8 bg-forest/8" : "border-white/10 bg-white/5 group-hover:bg-white/10"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
            </span>
            <span>{item.label}</span>
            <span className="ml-auto font-mono text-[0.62rem] tracking-[0.18em] opacity-35">
              0{index + 1}
            </span>
          </Link>
        );
      })}

      <div className="mx-3 my-5 h-px bg-white/10" />
      <div className="flex items-center gap-3 px-3.5 py-2 text-xs leading-relaxed text-paper/45">
        <Compass size={17} aria-hidden="true" />
        <span>一个校园 · 手动选择场景</span>
      </div>
    </nav>
  );
}
