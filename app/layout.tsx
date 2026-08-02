import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { CookingProvider } from "@/components/CookingProvider";

export const metadata: Metadata = {
  title: "CookingApp · 我的做菜知识库",
  description: "把做成功的视频菜谱，整理成真正属于自己的做菜知识库。",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <CookingProvider>
          <AppShell>{children}</AppShell>
        </CookingProvider>
      </body>
    </html>
  );
}
