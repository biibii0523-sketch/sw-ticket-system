// 檔案路徑: src/app/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Ticket, Utensils, Gamepad2, Camera, Gift, CheckCircle2, 
  X, RefreshCw, Loader2, UserCircle2, AlertTriangle, MapPin, PartyPopper, LogOut
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface EventTicket {
  id: string; title: string; type: "admission" | "food" | "game" | "gift" | "photo";
  isRedeemed: boolean; redeemedAt?: string; sortOrder: number;
}
interface PlayerInfo { summonerName: string; email: string; }
interface PlayerEventGroup {
  eventId: string; eventName: string; imageUrl: string; tickets: EventTicket[];
}

export default function PlayerTicketWallet() {
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [eventGroups, setEventGroups] = useState<PlayerEventGroup[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  
  const [selectedTicket, setSelectedTicket] = useState<EventTicket | null>(null);
  const [qrRefreshTimer, setQrRefreshTimer] = useState(30);
  const [isJustRedeemed, setIsJustRedeemed] = useState(false);

  // ⭐️ 核心認證與資料拉取邏輯
  const fetchDynamicData = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      
      // 1. 檢查 Google 登入 Session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setAuthError("未登入。請透過主辦單位發送的「專屬魔法連結」進入系統！");
        setIsLoading(false);
        return;
      }

      // 2. 檢查是否有從 /claim 帶過來的未綁定 Token
      const pendingToken = localStorage.getItem('sw_magic_token');
      if (pendingToken) {
        // 呼叫後端 RPC 進行安全綁定
        const { error: bindError } = await supabase.rpc('bind_player_account', { p_magic_token: pendingToken });
        
        if (bindError) {
          // 綁定失敗 (例如信箱不符)，強制登出並報錯
          await supabase.auth.signOut();
          localStorage.removeItem('sw_magic_token');
          setAuthError(`身分綁定失敗：${bindError.message}`);
          setIsLoading(false);
          return;
        }
        // 綁定成功，清除 Token
        localStorage.removeItem('sw_magic_token');
      }

      // 3. 獲取當前登入玩家的真實票券 (取代寫死的 TEST_PLAYER_ID)
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select(`
          id, summoner_name, email,
          player_tickets (
            id, is_redeemed, redeemed_at, created_at,
            ticket_templates ( title, ticket_type, sort_order, events ( id, name, image_url ) )
          )
        `)
        .eq('auth_user_id', session.user.id)
        .single();

      if (playerError || !playerData) {
        setAuthError("您的 Google 帳號尚未綁定任何活動票券。請從官方魔法連結重新登入。");
        setIsLoading(false);
        return;
      }

      setAuthError(null);
      setPlayerInfo({ summonerName: playerData.summoner_name, email: playerData.email });

      const groupsMap = new Map<string, PlayerEventGroup>();
      const playerTickets = playerData.player_tickets || [];

      playerTickets.forEach((t: any) => {
        const ev = t.ticket_templates.events;
        if (!ev) return;
        if (!groupsMap.has(ev.id)) groupsMap.set(ev.id, { eventId: ev.id, eventName: ev.name, imageUrl: ev.image_url, tickets: [] });
        
        groupsMap.get(ev.id)!.tickets.push({
          id: t.id, title: t.ticket_templates.title, type: t.ticket_templates.ticket_type,
          isRedeemed: t.is_redeemed,
          redeemedAt: t.redeemed_at ? new Date(t.redeemed_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute:'2-digit' }) : undefined,
          sortOrder: t.ticket_templates.sort_order || 0
        });
      });

      const groupsArray = Array.from(groupsMap.values());
      groupsArray.forEach(group => group.tickets.sort((a, b) => a.sortOrder - b.sortOrder));
      setEventGroups(groupsArray);
      
      if (groupsArray.length > 0 && !activeEventId) setActiveEventId(groupsArray[0].eventId);

      if (!silent) await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error("連線失敗:", error);
      setAuthError("無法連線至伺服器，請確認網路設定。");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [activeEventId]);

  useEffect(() => { fetchDynamicData(); }, [fetchDynamicData]);

  // 登出功能
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (selectedTicket && !isJustRedeemed) {
      setQrRefreshTimer(30);
      timer = setInterval(() => setQrRefreshTimer((prev) => (prev <= 1 ? 30 : prev - 1)), 1000);
    }
    return () => clearInterval(timer);
  }, [selectedTicket, isJustRedeemed]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    const checkRedemptionStatus = async () => {
      if (!selectedTicket || isJustRedeemed || !isMounted) return;
      try {
        const { data } = await supabase.from('player_tickets').select('is_redeemed').eq('id', selectedTicket.id).single();
        if (data && data.is_redeemed) {
          setIsJustRedeemed(true); fetchDynamicData(true); return; 
        }
      } catch (err) {}
      if (isMounted && !isJustRedeemed) timeoutId = setTimeout(checkRedemptionStatus, 2000);
    };
    if (selectedTicket && !isJustRedeemed) checkRedemptionStatus();
    return () => { isMounted = false; clearTimeout(timeoutId); };
  }, [selectedTicket, isJustRedeemed, fetchDynamicData]);

  const handleCloseModal = () => { setSelectedTicket(null); setIsJustRedeemed(false); };

  const getIcon = (type: string, className = "w-6 h-6") => {
    switch (type) {
      case "admission": return <Ticket className={className} />;
      case "food": return <Utensils className={className} />;
      case "game": return <Gamepad2 className={className} />;
      case "photo": return <Camera className={className} />;
      case "gift": return <Gift className={className} />;
      default: return <Ticket className={className} />;
    }
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center min-h-screen z-50 bg-slate-950"><Loader2 className="w-12 h-12 text-yellow-500 animate-spin mb-6" /><h2 className="text-xl font-bold text-yellow-400 animate-pulse">身分驗證中...</h2></div>;

  if (authError) return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 z-50 text-center bg-slate-950">
      <AlertTriangle className="w-16 h-16 text-rose-500 mb-4" />
      <h2 className="text-xl font-bold text-rose-400 mb-4">存取拒絕</h2>
      <p className="text-slate-400 mb-8">{authError}</p>
      {authError.includes('尚未綁定') && <button onClick={handleSignOut} className="px-6 py-2 bg-slate-800 text-white rounded-xl">重新登入</button>}
    </div>
  );

  const activeEvent = eventGroups.find(g => g.eventId === activeEventId);

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6 text-slate-100 relative z-10 overflow-hidden">
      <div className="fixed inset-0 z-[-2] bg-slate-950" />
      <div className="fixed inset-0 z-[-1] bg-gradient-to-b from-slate-950 via-slate-900/80 to-slate-950 backdrop-blur-[4px]" />

      <div className="w-full max-w-md flex justify-end mb-2">
        <button onClick={handleSignOut} className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-400 transition-colors bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800">
          <LogOut className="w-3 h-3" /> 登出帳號
        </button>
      </div>

      {eventGroups.length > 1 && (
        <div className="w-full max-w-md flex overflow-x-auto gap-3 pb-2 mb-4 scrollbar-hide snap-x">
          {eventGroups.map((group) => (
            <button key={group.eventId} onClick={() => setActiveEventId(group.eventId)} className={`snap-center shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all duration-300 border backdrop-blur-md ${activeEventId === group.eventId ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'bg-slate-900/50 text-slate-400 border-slate-700/50 hover:bg-slate-800'}`}>
              <MapPin className="w-4 h-4" /> {group.eventName.substring(0, 8)}...
            </button>
          ))}
        </div>
      )}

      <header className="text-center mb-6 w-full max-w-md flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-700">
        {activeEvent?.imageUrl && (
          <div className="w-full relative mb-5 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(234,179,8,0.2)] border border-yellow-500/20">
            <img src={activeEvent.imageUrl} alt={activeEvent.eventName} className="w-full aspect-[4/1] object-cover object-center" />
            <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
          </div>
        )}
        <div className="flex items-center justify-center gap-2 px-5 py-2 glass-card rounded-full w-fit mx-auto epic-glow border-yellow-500/30">
          <UserCircle2 className="w-4 h-4 text-emerald-400" />
          <p className="text-slate-200 text-sm tracking-wide">召喚師：<span className="text-white font-bold">{playerInfo?.summonerName}</span></p>
        </div>
      </header>

      <div key={activeEventId} className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-2xl pb-20">
        {activeEvent?.tickets.map((ticket, index) => (
          <button key={ticket.id} onClick={() => !ticket.isRedeemed && setSelectedTicket(ticket)} disabled={ticket.isRedeemed} className={`relative overflow-hidden flex flex-col items-center justify-center p-5 rounded-2xl transition-all duration-300 group animate-in zoom-in-95 fade-in ${ticket.isRedeemed ? "bg-slate-950/80 border border-slate-800/50 opacity-60 cursor-not-allowed grayscale" : "glass-card hover:border-yellow-500/50 hover:bg-white/10 active:scale-95 hover:shadow-[0_0_20px_rgba(234,179,8,0.2)]"}`} style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}>
            {!ticket.isRedeemed && <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />}
            <div className={`mb-3 p-3 rounded-xl transition-colors ${ticket.isRedeemed ? 'bg-slate-800 text-slate-500' : 'bg-slate-800/80 text-yellow-400 group-hover:text-yellow-300 shadow-inner border border-white/5'}`}>{getIcon(ticket.type)}</div>
            <span className="text-sm font-bold text-center leading-snug text-slate-200 group-hover:text-white">{ticket.title}</span>
            {ticket.isRedeemed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-[2px]">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-1 drop-shadow-lg" />
                <span className="text-emerald-400 text-xs font-black tracking-widest border-2 border-emerald-500/50 bg-emerald-950/80 px-3 py-1 rounded-md rotate-[-12deg] shadow-lg">已核銷</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col items-center overflow-hidden transition-colors duration-500 ${isJustRedeemed ? 'bg-emerald-950 border border-emerald-500/50' : 'bg-slate-900 border border-slate-700'}`}>
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 blur-[50px] pointer-events-none transition-colors duration-500 ${isJustRedeemed ? 'bg-emerald-500/30' : 'bg-yellow-500/20'}`} />
            <button onClick={handleCloseModal} className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors z-10"><X className="w-6 h-6" /></button>

            {isJustRedeemed ? (
              <div className="flex flex-col items-center justify-center py-8 animate-in zoom-in-95 duration-500 z-10 w-full text-center">
                <PartyPopper className="w-24 h-24 text-emerald-400 mb-6 drop-shadow-[0_0_20px_rgba(52,211,153,0.8)] animate-bounce" />
                <h2 className="text-3xl font-black text-white mb-2 tracking-widest drop-shadow-md">兌換成功</h2>
                <p className="text-emerald-200 font-bold mb-4">{selectedTicket.title}</p>
                <div className="bg-emerald-900/50 border border-emerald-500/30 rounded-xl px-4 py-3 mt-2 mb-6 w-full"><p className="text-emerald-100 text-sm">請依照工作人員指示領取物品</p></div>
                <button onClick={handleCloseModal} className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all active:scale-95">關閉視窗</button>
              </div>
            ) : (
              <>
                <div className="text-center mb-6 mt-4 relative z-10">
                  <div className="mx-auto w-16 h-16 glass-card text-yellow-400 rounded-2xl flex items-center justify-center mb-4 epic-glow">{getIcon(selectedTicket.type, "w-8 h-8")}</div>
                  <h2 className="text-2xl font-bold text-white mb-1">{selectedTicket.title}</h2>
                </div>
                <div className="relative mb-6">
                  <div className="absolute -inset-2 border-2 border-yellow-500/30 rounded-3xl z-0 overflow-hidden pointer-events-none"><div className="w-full h-1 bg-yellow-400/80 shadow-[0_0_15px_rgba(234,179,8,1)] absolute animate-[scan_2s_ease-in-out_infinite]" /></div>
                  <div className="bg-white p-3 rounded-2xl flex flex-col items-center justify-center relative z-10 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                    <QRCodeSVG value={selectedTicket.id} size={220} level={"M"} includeMargin={true} bgColor={"#ffffff"} fgColor={"#000000"} className="rounded-lg" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-sm font-mono bg-slate-950 px-4 py-2 rounded-full border border-slate-800">
                  <RefreshCw className={`w-4 h-4 ${qrRefreshTimer <= 5 ? 'text-rose-500 animate-spin' : 'text-slate-500'}`} />更新倒數：<span className={`font-bold w-6 text-center ${qrRefreshTimer <= 5 ? 'text-rose-500' : 'text-yellow-400'}`}>{qrRefreshTimer}s</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `@keyframes scan { 0%, 100% { transform: translateY(-10px); opacity: 0; } 10% { opacity: 1; } 50% { transform: translateY(260px); } 90% { opacity: 1; } } .scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}} />
    </div>
  );
}