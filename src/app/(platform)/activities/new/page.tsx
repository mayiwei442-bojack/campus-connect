import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ActivityComposer } from "@/components/activity/activity-composer";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "创建活动", description: "在校园地点发起可参与的真实活动。" };

export default async function NewActivityPage({ searchParams }: { searchParams: Promise<{ place?: string }> }) {
  const [viewer, params, supabase] = await Promise.all([getViewer(), searchParams, createClient()]);
  if (!viewer) redirect("/login");
  const { data: places } = await supabase.from("places").select("id, display_name").order("display_name");
  return (
    <section className="mx-auto max-w-4xl rise-in">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-signal">Activity studio</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-forest sm:text-5xl">把意图放进校园现场</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-forest/58">活动会绑定一个 GLB Place，并在地图 Anchor 上形成动态 Beacon。创建者会计入人数上限。</p>
      <div className="mt-8"><ActivityComposer places={(places ?? []).map((place) => ({ id: place.id, displayName: place.display_name }))} initialPlaceId={params.place} /></div>
    </section>
  );
}
