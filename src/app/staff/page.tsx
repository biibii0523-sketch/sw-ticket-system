// 檔案路徑: src/app/staff/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { 
  ScanLine, LockKeyhole, CheckCircle2, XCircle, Loader2, LogOut, User, Ticket, MapPin
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ScanStatus = "idle" | "processing" | "success" | "error";

interface ScanResultData {
  summonerName?: string;
  ticketTitle?: string;
  message: string;
}

// 定義活動清單型別
interface ActiveEvent {
  id: string;
  name: string;
}

export default function StaffScannerPage() {
  const [isFetchingEvents, setIsFetchingEvents] = useState(true);
  const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pinCode, setPinCode] = useState("");
  const [loginError, setLoginError] = useState(false);

  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [resultData, setResultData] = useState<ScanResultData | null>(null);

  // ⭐️ 載入時，抓取目前所有建立好的活動供工作人員選擇
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
        if (data && data.length > 0) setSelectedEventId(data[0].id); // 預設選擇第一個
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
    if (pinCode === "8888" && selectedEventId) {
      setIsLoggedIn(true);
      setLoginError(false);
    } else {
      setLoginError(true);
      setPinCode("");
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

      // 核銷邏輯：同時檢查這張票是否屬於「目前工作人員選擇的活動」
      const { data, error } = await supabase
        .from('player_tickets')
        .update({ is_redeemed: true, redeemed_at: new Date().toISOString() })
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

      // ⭐️ 核心防呆：防止掃到香港場的票 (Cross-event protection)
      if ((data.ticket_templates as any).event_id !== selectedEventId) {
        // 如果發現掃錯場，緊急把票券狀態改回未核銷 (Rollback)
        await supabase.from('player_tickets').update({ is_redeemed: false, redeemed_at: null }).eq('id', ticketId);
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

  // 取得目前選擇的活動名稱
  const currentEventName = activeEvents.find(e => e.id === selectedEventId)?.name || "未知活動";

  // ================= UI 1: 登入鎖屏 =================
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
              
              {/* ⭐️ 動態活動選擇器 */}
              <div className="w-full">
                <label className="block text-xs text-slate-400 mb-2 font-bold tracking-widest uppercase">1. 選擇所在活動場次</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <select 
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:border-indigo-500 focus:outline-none appearance-none"
                    required
                  >
                    {activeEvents.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="w-full mt-2">
                <label className="block text-xs text-slate-400 mb-2 font-bold tracking-widest uppercase">2. 輸入安全授權碼</label>
                <input
                  type="password" pattern="[0-9]*" inputMode="numeric" maxLength={4}
                  value={pinCode} onChange={(e) => setPinCode(e.target.value)}
                  className={`w-full bg-slate-950/50 border-2 rounded-xl py-3 text-center text-2xl font-mono tracking-[1em] text-white focus:outline-none transition-all
                    ${loginError ? 'border-rose-500 text-rose-500' : 'border-slate-700 focus:border-yellow-500'}
                  `}
                  placeholder="••••"
                />
              </div>
              
              {loginError && <p className="text-rose-500 text-xs text-center animate-pulse">授權碼錯誤，請重新輸入</p>}
              <button type="submit" className="w-full py-4 mt-4 rounded-xl font-bold text-slate-900 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:to-yellow-500 active:scale-95 transition-all shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                連線系統 (CONNECT)
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ================= UI 2: 掃描介面 =================
  return (
    <div className="flex flex-col h-[100dvh] bg-black relative overflow-hidden">
      <header className="absolute top-0 left-0 w-full p-4 z-20 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pt-safe">
        <div className="flex flex-col">
          {/* ⭐️ 顯示目前工作人員正在哪場活動 */}
          <span className="text-indigo-400 text-[10px] font-black tracking-widest uppercase border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 rounded w-fit mb-1">
            當前活動：{currentEventName}
          </span>
          <span className="text-white font-bold drop-shadow-md">核銷掃描終端</span>
        </div>
        <button onClick={() => setIsLoggedIn(false)} className="p-2 bg-slate-900/80 rounded-full border border-slate-700 text-slate-400 hover:text-white backdrop-blur-md">
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