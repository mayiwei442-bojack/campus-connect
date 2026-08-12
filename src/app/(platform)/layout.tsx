import { AppShell } from "@/components/app-shell";

export default function PlatformLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
