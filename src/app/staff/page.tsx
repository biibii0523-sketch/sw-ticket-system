// 檔案路徑: src/app/staff/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { 
  ScanLine, LockKeyhole, CheckCircle2, XCircle, Loader2, LogOut, User, Ticket, MapPin, KeyRound, Fingerprint
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ScanStatus = "idle" | "processing" | "success" | "error";

interface ScanResultData {
  summonerName?: string;
  ticketTitle?: string;
  message: string;
}

interface ActiveEvent {
  id: string;
  name: string;
}

// ⭐️ 動態生成 20 組允許登入的關主帳號白名單 (com2us ~ com21us)
const ALLOWED_STAFF_ACCOUNTS = Array.from({ length: 20 }, (_, i) => `com${i + 2}us`);

export default function StaffScannerPage() {
  const [isFetchingEvents, setIsFetchingEvents] = useState(true);
  const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  
  // ⭐️ 登入狀態管理更新
  const [staffAccount, setStaffAccount] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [resultData, setResultData] = useState<ScanResultData | null>(null);

  // ⭐️ 核心防護：從環境變數讀取密碼，若未設定則使用預設值
  const CORRECT_STAFF_PASSWORD = process.env.NEXT_PUBLIC_STAFF_PASSWORD || "com2usno1";

  useEffect(() => {
    const fetchActiveEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, name')
          .eq('is_active', true)
          .order('event_date', { ascending: false });

        if (error) throw error;
        setActiveEvents(data || []);
        if (data && data.length > 0) setSelectedEventId(data[0].id);
      } catch (err) {
        console.error("無法取得活動列表", err);
      } finally {
        setIsFetchingEvents(false);
      }
    };
    fetchActiveEvents();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    setErrorMessage("");

    // 1. 檢查帳號是否在白名單內 (防呆：打錯字)
    if (!ALLOWED_STAFF_ACCOUNTS.includes(staffAccount)) {
      setLoginError(true);
      setErrorMessage("查無此關主帳號，請確認拼寫");
      return;
    }

    // 2. 檢查密碼與活動是否選擇
    if (staffPassword === CORRECT_STAFF_PASSWORD && selectedEventId) {
      setIsLoggedIn(true);
    } else {
      setLoginError(true);
      setErrorMessage("安全密碼錯誤，請重新輸入");
      setStaffPassword(""); // 只清空密碼，保留帳號不用重打
    }
  };

  const handleScan = async (scannedData: any) => {
    if (scanStatus !== "idle") return;
    setScanStatus("processing");

    try {
      let ticketId = "";
      if (typeof scannedData === "string") ticketId = scannedData;
      else if (Array.isArray(scannedData) && scannedData.length > 0) ticketId = scannedData[0].rawValue;
      else throw new Error("無法解析條碼內容");

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(ticketId)) throw new Error(`無效的票券格式`);

      // ⭐️ 掃描成功時，將手動輸入的關主帳號寫入資料庫作為追蹤
      const { data, error } = await supabase
        .from('player_tickets')
        .update({ 
          is_redeemed: true, 
          redeemed_at: new Date().toISOString(),
          redeemed_by: staffAccount 
        })
        .eq('id', ticketId)
        .eq('is_redeemed', false)
        .select(`
          id,
          ticket_templates!inner (
            title,
            event_id
          ),
          players (summoner_name)
        `)
        .single();

      if (error) throw new Error("資料庫拒絕存取或更新失敗");
      if (!data) throw new Error("此票券已兌換過，或非有效票券！");

      if ((data.ticket_templates as any).event_id !== selectedEventId) {
        // 如果場次不對，將狀態復原
        await supabase.from('player_tickets').update({ is_redeemed: false, redeemed_at: null, redeemed_by: null }).eq('id', ticketId);
        throw new Error("警告！這張票券不屬於目前的活動場次。");
      }

      setResultData({
        summonerName: data.players?.summoner_name,
        ticketTitle: (data.ticket_templates as any)?.title,
        message: "核銷成功！請發放贈品或放行。"
      });
      setScanStatus("success");

    } catch (err: any) {
      console.error("核銷錯誤詳細資訊:", err);
      setResultData({ message: err.message || "系統發生錯誤，請稍後再試。" });
      setScanStatus("error");
    }
  };

  const resetScanner = () => {
    setScanStatus("idle");
    setResultData(null);
  };

  const currentEventName = activeEvents.find(e => e.id === selectedEventId)?.name || "未知活動";

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-slate-950 z-0" />
        
        <div className="z-10 w-full max-w-sm glass-card p-8 rounded-3xl flex flex-col items-center border border-slate-800 shadow-2xl epic-glow">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 border border-slate-700 shadow-inner">
            <LockKeyhole className="w-8 h-8 text-yellow-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-widest">STAFF LOGIN</h1>
          
          {isFetchingEvents ? (
            <div className="flex items-center gap-2 text-slate-400 mb-6"><Loader2 className="w-4 h-4 animate-spin"/> 載入活動清單中...</div>
          ) : (
            <form onSubmit={handleLogin} className="w-full flex flex-col gap-4 mt-2">
              <div className="w-full">
                <label className="block text-[10px] text-slate-400 mb-1.5 font-bold tracking-widest uppercase">1. 選擇活動場次</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:border-indigo-500 focus:outline-none appearance-none" required>
                    {activeEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                  </select>
                </div>
              </div>

              {/* ⭐️ 新增：關主帳號手動輸入框 (帶自動小寫防呆) */}
              <div className="w-full">
                <label className="block text-[10px] text-slate-400 mb-1.5 font-bold tracking-widest uppercase">2. 關主登入帳號</label>
                <div className="relative">
                  <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                  <input 
                    type="text" 
                    required
                    placeholder="例如: com2us"
                    value={staffAccount}
                    onChange={(e) => setStaffAccount(e.target.value.toLowerCase().trim())} // 自動轉小寫去空白
                    className={`w-full bg-slate-900 border rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none transition-colors ${loginError && errorMessage.includes('帳號') ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-emerald-500'}`}
                  />
                </div>
              </div>

              {/* ⭐️ 新增：高質感密碼輸入框 */}
              <div className="w-full">
                <label className="block text-[10px] text-slate-400 mb-1.5 font-bold tracking-widest uppercase">3. 安全授權密碼</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-500" />
                  <input 
                    type="password" 
                    required
                    placeholder="••••••••"
                    value={staffPassword} 
                    onChange={(e) => setStaffPassword(e.target.value.trim())} 
                    className={`w-full bg-slate-950/50 border rounded-xl pl-10 pr-4 py-3 text-white text-sm tracking-[0.3em] focus:outline-none transition-all ${loginError && errorMessage.includes('密碼') ? 'border-rose-500' : 'border-slate-700 focus:border-yellow-500'}`} 
                  />
                </div>
              </div>
              
              {loginError && <p className="text-rose-500 text-xs text-center font-bold animate-pulse mt-1">{errorMessage}</p>}
              
              <button type="submit" className="w-full py-4 mt-2 rounded-xl font-bold text-slate-900 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:to-yellow-500 active:scale-95 transition-all shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                連線系統 (CONNECT)
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-black relative overflow-hidden">
      <header className="absolute top-0 left-0 w-full p-4 z-20 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pt-safe">
        <div className="flex flex-col gap-1">
          <span className="text-indigo-400 text-[10px] font-black tracking-widest uppercase border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 rounded w-fit">
            活動：{currentEventName}
          </span>
          <span className="text-emerald-400 text-[10px] font-black tracking-widest uppercase border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded w-fit">
            身分：{staffAccount}
          </span>
        </div>
        <button onClick={() => setIsLoggedIn(false)} className="p-2 bg-slate-900/80 rounded-full border border-slate-700 text-slate-400 hover:text-white backdrop-blur-md shadow-lg">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 relative w-full h-full flex items-center justify-center bg-slate-900">
        {scanStatus === "idle" && (
          <div className="absolute inset-0 z-10">
            <Scanner onScan={(result) => handleScan(result)} onError={(error) => console.error(error?.message)} options={{ delayBetweenScanAttempts: 800 }} styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' } }} />
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-64 h-64 border-2 border-yellow-500/50 rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-yellow-400 rounded-tl-3xl"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-yellow-400 rounded-tr-3xl"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-yellow-400 rounded-bl-3xl"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-yellow-400 rounded-br-3xl"></div>
                <div className="w-full h-1 bg-yellow-400 shadow-[0_0_20px_rgba(234,179,8,1)] absolute animate-[scan_2s_ease-in-out_infinite]" />
              </div>
              <p className="mt-8 bg-black/60 px-4 py-2 rounded-full text-yellow-400 text-sm font-mono tracking-widest backdrop-blur-md border border-yellow-500/30 flex items-center gap-2">
                <ScanLine className="w-4 h-4 animate-pulse" /> 請將玩家 QR Code 放入框內
              </p>
            </div>
          </div>
        )}

        {scanStatus === "processing" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md">
            <Loader2 className="w-16 h-16 text-yellow-500 animate-spin mb-4" />
            <p className="text-yellow-400 font-bold tracking-widest animate-pulse">連線資料庫驗證中...</p>
          </div>
        )}

        {(scanStatus === "success" || scanStatus === "error") && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
            <div className={`w-full max-w-sm rounded-3xl p-6 flex flex-col items-center border shadow-2xl relative overflow-hidden ${scanStatus === "success" ? 'bg-emerald-950/90 border-emerald-500/50' : 'bg-rose-950/90 border-rose-500/50'}`}>
              <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 blur-[60px] pointer-events-none ${scanStatus === "success" ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`} />
              {scanStatus === "success" ? <CheckCircle2 className="w-20 h-20 text-emerald-400 mb-4 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)] z-10" /> : <XCircle className="w-20 h-20 text-rose-400 mb-4 drop-shadow-[0_0_15px_rgba(251,113,133,0.5)] z-10" />}
              <h2 className="text-2xl font-bold text-white mb-2 z-10 text-center">{scanStatus === "success" ? "核銷成功" : "核銷失敗"}</h2>
              <p className={`text-center mb-6 z-10 font-medium ${scanStatus === "success" ? 'text-emerald-200' : 'text-rose-200'}`}>{resultData?.message}</p>
              
              {scanStatus === "success" && (
                <div className="w-full bg-black/40 rounded-2xl p-4 mb-6 z-10 border border-white/5 space-y-3">
                  <div className="flex items-center gap-3"><User className="w-5 h-5 text-slate-400" /><div className="flex flex-col"><span className="text-xs text-slate-500">召喚師暱稱</span><span className="text-white font-bold">{resultData?.summonerName}</span></div></div>
                  <div className="w-full h-px bg-white/10" />
                  <div className="flex items-center gap-3"><Ticket className="w-5 h-5 text-yellow-400" /><div className="flex flex-col"><span className="text-xs text-slate-500">兌換項目</span><span className="text-yellow-400 font-bold">{resultData?.ticketTitle}</span></div></div>
                </div>
              )}
              <button onClick={resetScanner} className={`w-full py-4 rounded-xl font-bold text-slate-900 transition-all active:scale-95 z-10 ${scanStatus === "success" ? 'bg-emerald-400 hover:bg-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.4)]' : 'bg-slate-300 hover:bg-white'}`}>繼續掃描下一位</button>
            </div>
          </div>
        )}
      </main>
      <style dangerouslySetInnerHTML={{__html: `@keyframes scan { 0%, 100% { top: 0%; opacity: 0; } 10% { opacity: 1; } 50% { top: 100%; } 90% { opacity: 1; } } .pt-safe { padding-top: env(safe-area-inset-top, 1rem); }`}} />
    </div>
  );
}