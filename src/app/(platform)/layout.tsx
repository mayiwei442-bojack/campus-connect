import { AppShell } from "@/components/app-shell";
import { getViewer } from "@/lib/auth/viewer";

export default async function PlatformLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await getViewer();

  return <AppShell viewer={viewer}>{children}</AppShell>;
}
