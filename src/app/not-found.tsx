import { ArrowLeft, MapPinned } from "lucide-react";
import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="paper-texture grid min-h-screen place-items-center px-5 py-12">
      <section className="max-w-xl text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-forest text-paper">
          <MapPinned size={27} aria-hidden="true" />
        </span>
        <p className="mt-7 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-signal">404 · Off campus</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-forest">这个地点还没有被标记</h1>
        <p className="mt-4 text-sm leading-7 text-forest/54">检查地址，或者回到首页看看校园里正在发生什么。</p>
        <Link href="/home" className="mt-7 inline-flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-sm font-bold text-paper">
          <ArrowLeft size={16} aria-hidden="true" />
          返回首页
        </Link>
      </section>
    </main>
  );
}
