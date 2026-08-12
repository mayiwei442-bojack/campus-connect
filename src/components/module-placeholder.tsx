import { ArrowLeft, Construction, type LucideIcon } from "lucide-react";
import Link from "next/link";

type ModulePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  nextMilestone: string;
  icon: LucideIcon;
  children?: React.ReactNode;
};

export function ModulePlaceholder({
  eyebrow,
  title,
  description,
  nextMilestone,
  icon: Icon,
  children,
}: ModulePlaceholderProps) {
  return (
    <section className="rise-in">
      <div className="flex max-w-4xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-signal">{eyebrow}</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-[1.18] tracking-[-0.04em] text-forest sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-forest/62">{description}</p>
        </div>
        <div className="grid size-20 shrink-0 place-items-center rounded-[1.6rem] border border-forest/10 bg-white/45 text-cobalt shadow-[0_16px_50px_rgba(39,91,131,0.1)]">
          <Icon size={34} strokeWidth={1.5} aria-hidden="true" />
        </div>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(17rem,0.7fr)]">
        <div className="min-h-80 rounded-[1.8rem] border border-forest/10 bg-white/48 p-6 shadow-[0_22px_70px_rgba(20,35,31,0.06)] sm:p-8">
          {children ?? (
            <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
              <div className="grid size-14 place-items-center rounded-full bg-forest/7 text-forest/55">
                <Construction size={24} aria-hidden="true" />
              </div>
              <h2 className="mt-5 font-display text-2xl font-semibold text-forest">模块边界已经就位</h2>
              <p className="mt-3 max-w-md text-sm leading-7 text-forest/52">
                此页目前只提供独立路由、导航状态和错误隔离边界，不展示虚假的业务完成状态。
              </p>
            </div>
          )}
        </div>

        <aside className="rounded-[1.8rem] bg-forest p-6 text-paper sm:p-7">
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-skyline">Next milestone</p>
          <p className="mt-4 font-display text-2xl font-semibold leading-snug">{nextMilestone}</p>
          <div className="my-6 h-px bg-white/12" />
          <p className="text-sm leading-7 text-paper/62">
            当前阶段没有数据库迁移、环境变量或外部服务依赖。
          </p>
          <Link
            href="/home"
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-white/10"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            返回首页
          </Link>
        </aside>
      </div>
    </section>
  );
}
