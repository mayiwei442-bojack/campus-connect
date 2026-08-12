import { MapPinned, MessagesSquare, Radio, Sparkles } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";

const connectionSteps = [
  { icon: Sparkles, label: "说出今天真正想做的事" },
  { icon: MapPinned, label: "在校园场景中发现活动与同伴" },
  { icon: MessagesSquare, label: "进入真实对话，一起把事情做成" },
];

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="paper-texture min-h-screen bg-paper p-3 sm:p-5 lg:p-7">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[96rem] overflow-hidden rounded-[2rem] border border-forest/10 bg-white/36 shadow-[0_30px_100px_rgba(20,35,31,0.1)] sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[minmax(28rem,0.92fr)_minmax(32rem,1.08fr)]">
        <section className="campus-grid relative hidden overflow-hidden bg-forest p-10 text-paper lg:flex lg:flex-col xl:p-14">
          <div className="absolute -right-24 -top-24 size-80 rounded-full border border-white/10" />
          <div className="absolute -right-8 -top-8 size-48 rounded-full border border-white/10" />
          <div className="absolute bottom-[20%] right-[16%] h-24 w-36 rotate-6 border border-white/12 bg-white/[0.045] shadow-[18px_20px_0_rgba(5,25,20,0.2)]" />
          <div className="absolute bottom-[31%] left-[12%] h-20 w-28 -rotate-6 border border-white/12 bg-white/[0.045] shadow-[-14px_18px_0_rgba(5,25,20,0.18)]" />
          <div className="relative z-10">
            <BrandMark />
          </div>

          <div className="relative z-10 my-auto max-w-xl py-14">
            <div className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.24em] text-signal">
              <Radio size={15} aria-hidden="true" />
              One intent, real people
            </div>
            <h1 className="mt-6 font-display text-6xl font-semibold leading-[1.02] tracking-[-0.055em] xl:text-7xl">
              先说想做什么，
              <span className="text-skyline">再遇见对的人。</span>
            </h1>
            <p className="mt-7 max-w-lg text-base leading-8 text-paper/62">
              Campus Connect 不从“加好友”开始。它从一个真实意图出发，把人、Skill、活动和校园地点连接起来。
            </p>

            <ol className="mt-10 grid gap-3">
              {connectionSteps.map(({ icon: Icon, label }, index) => (
                <li key={label} className="flex items-center gap-4 border-t border-white/10 py-4 text-sm text-paper/72">
                  <span className="text-[0.68rem] font-bold text-signal">0{index + 1}</span>
                  <Icon size={17} className="text-skyline" aria-hidden="true" />
                  <span>{label}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className="relative z-10 text-xs leading-6 text-paper/42">单校园 · PC first · 无 GPS 定位</p>
        </section>

        <section className="relative flex min-h-full items-center justify-center px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
          <div className="absolute left-6 top-6 text-forest lg:hidden">
            <BrandMark />
          </div>
          <div className="w-full max-w-[31rem] pt-20 lg:pt-0">{children}</div>
        </section>
      </div>
    </main>
  );
}
