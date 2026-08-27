import type { Metadata,Viewport } from "next";
import "./globals.css";
import "./card-layout.css";
import { AppShell } from "@/components/AppShell";
import { CookingProvider } from "@/components/CookingProvider";
import { ShoppingCartProvider } from "@/components/ShoppingCartProvider";
import { FloatingRecipeCart } from "@/components/FloatingRecipeCart";
import { LocaleProvider } from "@/lib/i18n";
import { PwaManager } from "@/components/PwaManager";

export const metadata: Metadata = {
  title: "CookingApp · 我的做菜知识库",
  description: "把做成功的视频菜谱，整理成真正属于自己的做菜知识库。",
  applicationName:"CookingApp",
  appleWebApp:{capable:true,statusBarStyle:"default",title:"CookingApp"},
  formatDetection:{telephone:false},
  icons:{
    icon:[{url:"/favicon.svg",type:"image/svg+xml"},{url:"/icons/icon-192.png",sizes:"192x192",type:"image/png"}],
    shortcut:"/favicon.svg",
    apple:[{url:"/icons/apple-touch-icon.png",sizes:"180x180",type:"image/png"}],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport:Viewport={themeColor:"#2f684f",width:"device-width",initialScale:1,viewportFit:"cover"};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <PwaManager/>
        <CookingProvider>
          <LocaleProvider>
            <ShoppingCartProvider>
              <AppShell>{children}</AppShell>
              <FloatingRecipeCart/>
            </ShoppingCartProvider>
          </LocaleProvider>
        </CookingProvider>
      </body>
    </html>
  );
}
