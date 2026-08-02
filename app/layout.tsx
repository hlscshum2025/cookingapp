import "./globals.css";import {StoreProvider} from "@/lib/store";import {AppShell} from "@/components/AppShell";
export const metadata={title:"一餐一记 CookingApp",description:"属于自己的做菜知识库"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body><StoreProvider><AppShell>{children}</AppShell></StoreProvider></body></html>}
