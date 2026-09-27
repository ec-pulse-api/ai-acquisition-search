import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Acquisition Search | AI集客検索エンジン",
  description: "商品・市場・顧客・競合・実績を分析し、次に取るべき集客アクションを判断するAIシステム。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}