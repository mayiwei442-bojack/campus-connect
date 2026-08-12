import Link from "next/link";

type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <Link
      href="/home"
      className="group inline-flex items-center gap-3 rounded-full text-current"
      aria-label="Campus Connect 首页"
    >
      <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-white/20 bg-white/10 transition-transform duration-300 group-hover:-rotate-6">
        <svg viewBox="0 0 44 44" className="size-9" aria-hidden="true">
          <path
            d="M10.5 31V18.5L22 12l11.5 6.5V31"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M15.5 31v-9.5h13V31M8 31h28"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="32" cy="12" r="3.6" className="fill-signal stroke-none" />
        </svg>
      </span>
      {compact ? null : (
        <span className="leading-none">
          <span className="block font-display text-[1.22rem] font-semibold tracking-[-0.03em]">
            Campus Connect
          </span>
          <span className="mt-1 block text-[0.62rem] font-medium uppercase tracking-[0.21em] text-current/55">
            Campus in motion
          </span>
        </span>
      )}
    </Link>
  );
}
