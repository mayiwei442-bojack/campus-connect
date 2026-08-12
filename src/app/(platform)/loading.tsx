export default function PlatformLoading() {
  return (
    <div className="animate-pulse" aria-label="页面加载中" role="status">
      <div className="h-3 w-32 rounded-full bg-forest/10" />
      <div className="mt-5 h-12 max-w-2xl rounded-2xl bg-forest/10" />
      <div className="mt-4 h-5 max-w-xl rounded-full bg-forest/8" />
      <div className="mt-10 grid gap-5 lg:grid-cols-[1.5fr_0.7fr]">
        <div className="h-80 rounded-[1.8rem] bg-white/48" />
        <div className="h-80 rounded-[1.8rem] bg-forest/12" />
      </div>
      <span className="sr-only">正在加载页面</span>
    </div>
  );
}
