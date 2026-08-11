// 檔案路徑: src/app/staff/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { 
  ScanLine, 
  LockKeyhole, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  LogOut,
  User,
  Ticket
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { eventConfig } from "@/config/event";

// 掃描結果的狀態型別
type ScanStatus = "idle" | "processing" | "success" | "error";

interface ScanResultData {
  summonerName?: string;
  ticketTitle?: string;
  message: string;
}

export default function StaffScannerPage() {
  // 系統與認證狀態
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pinCode, setPinCode] = useState("");
  const [loginError, setLoginError] = useState(false);

  // 掃描與核銷狀態
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [resultData, setResultData] = useState<ScanResultData | null>(null);

  // 處理工作人員登入 (模擬簡單 PIN 碼防護)
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinCode === "8888") { // 實戰中可對應 Supabase staff table
      setIsLoggedIn(true);
      setLoginError(false);
    } else {
      setLoginError(true);
      setPinCode("");
    }
  };

  // 處理 QR Code 掃描結果
  const handleScan = async (scannedValue: string) => {
    // 如果正在處理中，忽略其他連續的掃描輸入 (防連點/防連掃)
    if (scanStatus !== "idle") return;

    setScanStatus("processing");

    try {
      // 1. 驗證掃描到的內容是否為有效的 UUID 格式 (防止亂掃其他 QR Code)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(scannedValue)) {
        throw new Error("無效的票券條碼格式");
      }

      const ticketId = scannedValue;

      // 2. 向 Supabase 發起核銷請求，使用樂觀鎖 (.eq('is_redeemed', false)) 避免重複扣款
      const { data, error } = await supabase
        .from('player_tickets')
        .update({ 
          is_redeemed: true, 
          redeemed_at: new Date().toISOString() 
        })
        .eq('id', ticketId)
        .eq('is_redeemed', false)
        .select(`
          id,
          ticket_templates (title),
          players (summoner_name)
        `)
        .single(); // 只預期回傳一筆

      if (error || !data) {
        // 如果找不到資料，代表已經被核銷過，或是偽造的票券
        throw new Error("此票券已兌換過，或不存在於系統中！");
      }

      // 3. 核銷成功，設定畫面顯示資訊
      setResultData({
        summonerName: data.players?.summoner_name,
        ticketTitle: data.ticket_templates?.title,
        message: "核銷成功！請發放贈品/放行。"
      });
      setScanStatus("success");

    } catch (err: any) {
      console.error("核銷錯誤:", err);
      setResultData({
        message: err.message || "系統發生錯誤，請稍後再試。"
      });
      setScanStatus("error");
    }
  };

  // 重置掃描器，準備掃下一個
  const resetScanner = () => {
    setScanStatus("idle");
    setResultData(null);
  };

  // ==========================================
  // UI 視圖 1：登入鎖屏介面 (Mobile-First)
  // ==========================================
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-slate-950 z-0" />
        
        <div className="z-10 w-full max-w-sm glass-card p-8 rounded-3xl flex flex-col items-center border border-slate-800 shadow-2xl epic-glow">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 border border-slate-700 shadow-inner">
            <LockKeyhole className="w-8 h-8 text-yellow-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-widest">STAFF LOGIN</h1>
          <p className="text-slate-400 text-sm mb-8 text-center">
            輸入工作人員授權碼以解鎖掃描器<br/>(測試請輸入: 8888)
          </p>

          <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
            <input
              type="password"
              pattern="[0-9]*"
              inputMode="numeric"
              maxLength={4}
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              className={`w-full bg-slate-950/50 border-2 rounded-xl py-4 text-center text-3xl font-mono tracking-[1em] text-white focus:outline-none transition-all
                ${loginError ? 'border-rose-500 text-rose-500' : 'border-slate-700 focus:border-yellow-500 focus:bg-slate-900'}
              `}
              placeholder="••••"
            />
            {loginError && <p className="text-rose-500 text-xs text-center animate-pulse">授權碼錯誤，請重新輸入</p>}
            
            <button 
              type="submit"
              className="w-full py-4 mt-2 rounded-xl font-bold text-slate-900 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:to-yellow-500 active:scale-95 transition-all shadow-[0_0_15px_rgba(234,179,8,0.4)]"
            >
              解鎖系統 (UNLOCK)
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // UI 視圖 2：主掃描介面 (Mobile-First HUD 風格)
  // ==========================================
  return (
    <div className="flex flex-col h-[100dvh] bg-black relative overflow-hidden">
      
      {/* 頂部控制列 */}
      <header className="absolute top-0 left-0 w-full p-4 z-20 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pt-safe">
        <div className="flex flex-col">
          <span className="text-yellow-500 text-xs font-black tracking-widest uppercase">
            {eventConfig.id}
          </span>
          <span className="text-white font-bold drop-shadow-md">工作人員核銷終端</span>
        </div>
        <button 
          onClick={() => setIsLoggedIn(false)}
          className="p-2 bg-slate-900/80 rounded-full border border-slate-700 text-slate-400 hover:text-white backdrop-blur-md"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* 相機視窗區塊 */}
      <main className="flex-1 relative w-full h-full flex items-center justify-center bg-slate-900">
        
        {scanStatus === "idle" && (
          <div className="absolute inset-0 z-10">
            <Scanner
              onResult={(text) => handleScan(text)}
              onError={(error) => console.error(error?.message)}
              options={{
                delayBetweenScanAttempts: 500, // 降低掃描頻率省電
              }}
              styles={{
                container: { width: '100%', height: '100%' },
                video: { objectFit: 'cover' }
              }}
            />
            {/* 掃描儀 HUD 準星設計 */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-64 h-64 border-2 border-yellow-500/50 rounded-3xl relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-yellow-400 rounded-tl-3xl"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-yellow-400 rounded-tr-3xl"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-yellow-400 rounded-bl-3xl"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-yellow-400 rounded-br-3xl"></div>
                {/* 掃描線動畫 */}
                <div className="w-full h-0.5 bg-yellow-400 shadow-[0_0_15px_rgba(234,179,8,1)] absolute animate-[scan_2s_ease-in-out_infinite]" />
              </div>
              <p className="mt-8 bg-black/60 px-4 py-2 rounded-full text-yellow-400 text-sm font-mono tracking-widest backdrop-blur-md border border-yellow-500/30 flex items-center gap-2">
                <ScanLine className="w-4 h-4 animate-pulse" /> 請將玩家 QR Code 放入框內
              </p>
            </div>
          </div>
        )}

        {/* 處理中遮罩 */}
        {scanStatus === "processing" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md">
            <Loader2 className="w-16 h-16 text-yellow-500 animate-spin mb-4" />
            <p className="text-yellow-400 font-bold tracking-widest animate-pulse">連線資料庫驗證中...</p>
          </div>
        )}

        {/* 成功 / 失敗 結果提示 Modal */}
        {(scanStatus === "success" || scanStatus === "error") && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
            <div className={`w-full max-w-sm rounded-3xl p-6 flex flex-col items-center border shadow-2xl relative overflow-hidden
              ${scanStatus === "success" ? 'bg-emerald-950/80 border-emerald-500/50' : 'bg-rose-950/80 border-rose-500/50'}
            `}>
              
              {/* 背景光暈 */}
              <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 blur-[60px] pointer-events-none
                ${scanStatus === "success" ? 'bg-emerald-500/20' : 'bg-rose-500/20'}
              `} />

              {scanStatus === "success" ? (
                <CheckCircle2 className="w-20 h-20 text-emerald-400 mb-4 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)] z-10" />
              ) : (
                <XCircle className="w-20 h-20 text-rose-400 mb-4 drop-shadow-[0_0_15px_rgba(251,113,133,0.5)] z-10" />
              )}
              
              <h2 className="text-2xl font-bold text-white mb-2 z-10 text-center">
                {scanStatus === "success" ? "核銷成功" : "核銷失敗"}
              </h2>
              
              <p className={`text-center mb-6 z-10 font-medium ${scanStatus === "success" ? 'text-emerald-200' : 'text-rose-200'}`}>
                {resultData?.message}
              </p>

              {/* 成功時顯示玩家與票券詳細資訊 (防呆再確認) */}
              {scanStatus === "success" && (
                <div className="w-full bg-black/40 rounded-2xl p-4 mb-6 z-10 border border-white/5 space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-slate-400" />
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500">召喚師暱稱</span>
                      <span className="text-white font-bold">{resultData?.summonerName}</span>
                    </div>
                  </div>
                  <div className="w-full h-px bg-white/10" />
                  <div className="flex items-center gap-3">
                    <Ticket className="w-5 h-5 text-yellow-400" />
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500">兌換項目</span>
                      <span className="text-yellow-400 font-bold">{resultData?.ticketTitle}</span>
                    </div>
                  </div>
                </div>
              )}

              <button 
                onClick={resetScanner}
                className={`w-full py-4 rounded-xl font-bold text-slate-900 transition-all active:scale-95 z-10
                  ${scanStatus === "success" 
                    ? 'bg-emerald-400 hover:bg-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.4)]' 
                    : 'bg-slate-300 hover:bg-white'}
                `}
              >
                繼續掃描下一位
              </button>
            </div>
          </div>
        )}

      </main>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0%, 100% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          50% { top: 100%; }
          90% { opacity: 1; }
        }
        /* PWA 與手機瀏覽器安全區域適配 */
        .pt-safe { padding-top: env(safe-area-inset-top, 1rem); }
      `}} />
    </div>
  );
}