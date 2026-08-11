// 檔案路徑: src/config/event.ts

export const eventConfig = {
  // 活動基本資訊
  id: "sw-12th-anniversary",
  title: "12周年 競逐巔峰 極速派對",
  subTitle: "Summoners War 12th Anniversary",
  
  // 視覺設定 (未來辦新活動只需更改這裡的圖片路徑)
  visuals: {
    // 預設背景圖 (建議放在 public 資料夾下，或使用外部 URL)
    // 這裡我們暫時用一個高質感的深色星空佔位圖，你可以替換成設計師給的 1315414_0.jpg 主視覺
    backgroundImage: "https://images.unsplash.com/photo-1538370965046-79c0d6907d47?q=80&w=2069&auto=format&fit=crop", 
    // 主題色系 (對應 Tailwind 的顏色，例如 'yellow' 代表黃金史詩感)
    themeColor: "yellow", 
  },
  
  // 系統狀態
  isActive: true,
};

export default eventConfig;