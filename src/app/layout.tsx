// 檔案路徑: src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { eventConfig } from "@/config/event";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${eventConfig.title} | 數位票券系統`,
  description: "專屬遊戲玩家的線下活動數位兌換憑證",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0", // 防止手機端雙擊放大，維持 App 體驗
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="dark">
      <body className={`${inter.className} antialiased relative min-h-screen selection:bg-yellow-500/30`}>
        
        {/* 全局動態主視覺背景 */}
        <div 
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
          style={{ backgroundImage: `url('${eventConfig.visuals.backgroundImage}')` }}
        />
        
        {/* 暗夜漸層遮罩 (確保任何主視覺背景下，文字與 UI 都能清晰辨識) */}
        <div className="fixed inset-0 z-0 bg-gradient-to-b from-slate-950/80 via-slate-900/60 to-slate-950/95 backdrop-blur-[2px]" />

        {/* 頂部史詩光暈裝飾 */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none z-0" />

        {/* 應用程式主要內容區 */}
        <main className="relative z-10 w-full mx-auto min-h-screen">
          {children}
        </main>
        
      </body>
    </html>
  );
}