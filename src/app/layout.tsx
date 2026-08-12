// 檔案路徑: src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

// ⭐️ 核心修改：設定對外分享時的標題、描述與 Open Graph 資訊
export const metadata: Metadata = {
  title: 'Com2uS ｜數位票卷系統',
  description: '專屬遊戲玩家的線下活動數位兌換憑證',
  openGraph: {
    title: 'Com2uS ｜數位票卷系統',
    description: '專屬遊戲玩家的線下活動數位兌換憑證',
    type: 'website',
    locale: 'zh_TW',
    siteName: 'Com2uS 數位票卷系統',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Com2us ｜數位票卷系統',
    description: '專屬遊戲玩家的線下活動數位兌換憑證',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body className={inter.className}>{children}</body>
    </html>
  )
}