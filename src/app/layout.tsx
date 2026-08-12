import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Campus Connect",
    template: "%s · Campus Connect",
  },
  description: "让校园里想做同一件事的人，在合适的场景真实连接。",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#143c32",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
