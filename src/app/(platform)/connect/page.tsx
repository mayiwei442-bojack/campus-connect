import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConnectWorkspace } from "@/components/connect/connect-workspace";
import { getViewer } from "@/lib/auth/viewer";

export const metadata: Metadata = {
  title: "AI 共创",
  description: "将自然语言需求转换为可执行的校园连接。",
};

type ConnectPageProps = {
  searchParams: Promise<{ intent?: string | string[] }>;
};

export default async function ConnectPage({ searchParams }: ConnectPageProps) {
  const [parameters, viewer] = await Promise.all([searchParams, getViewer()]);
  if (!viewer) redirect("/login");
  const intent = Array.isArray(parameters.intent) ? parameters.intent[0] : parameters.intent;

  return <ConnectWorkspace initialIntent={intent ?? ""} />;
}
