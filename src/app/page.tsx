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

  const fetchDynamicData = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setAuthError("未登入。請透過主辦單位發送的「專屬魔法連結」進入系統！");
        setIsLoading(false);
        return;
      }

      const pendingToken = localStorage.getItem('sw_magic_token');
      if (pendingToken) {
        const { error: bindError } = await supabase.rpc('bind_player_account', { p_magic_token: pendingToken });
        if (bindError) {
          await supabase.auth.signOut();
          localStorage.removeItem('sw_magic_token');
          setAuthError(`身分綁定失敗：${bindError.message}`);
          setIsLoading(false);
          return;
        }
        localStorage.removeItem('sw_magic_token');
      }

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
      {authError.includes('尚未綁定') && <button onClick={handleSignOut} className="px-6 py-2 bg-slate-800 text-white rounded-xl shadow-lg">重新登入</button>}
    </div>
  );

  const activeEvent = eventGroups.find(g => g.eventId === activeEventId);

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6 text-slate-100 relative z-10 overflow-hidden">
      
      {/* ================= 背景材質與環境光暈 ================= */}
      <div className="fixed inset-0 z-[-3] bg-[#0a0f1c]" /> 
      
      <div className="fixed inset-0 z-[-2] overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px]" />
        <div className="absolute top-3/4 -right-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="fixed inset-0 z-[-1] opacity-[0.03] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />

      {/* ================= 頂部功能列 ================= */}
      <div className="w-full max-w-md flex justify-end mb-3">
        <button onClick={handleSignOut} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 transition-colors bg-slate-900/40 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700/50 shadow-sm">
          <LogOut className="w-3 h-3" /> 登出帳號
        </button>
      </div>

      {/* ================= 場次切換 Tabs (保留原樣) ================= */}
      {eventGroups.length > 1 && (
        <div className="w-full max-w-md flex overflow-x-auto gap-3 pb-2 mb-5 scrollbar-hide snap-x">
          {eventGroups.map((group) => (
            <button key={group.eventId} onClick={() => setActiveEventId(group.eventId)} 
              className={`snap-center shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-300 backdrop-blur-xl
                ${activeEventId === group.eventId 
                  ? 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/5 text-yellow-400 border border-yellow-500/50 shadow-[0_4px_20px_rgba(234,179,8,0.15)] border-t-yellow-400/60' 
                  : 'bg-white/[0.03] text-slate-400 border border-white/5 hover:bg-white/[0.06] hover:text-slate-200'
                }
              `}>
              <MapPin className="w-4 h-4" /> {group.eventName.substring(0, 8)}...
            </button>
          ))}
        </div>
      )}

      {/* ================= Header 區塊 ================= */}
      <header className="text-center mb-8 w-full max-w-md flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-700">
        
        {/* ⭐️ 動態活動主視覺橫幅 (乾淨無標籤版) */}
        {activeEvent?.imageUrl && (
          <div className="w-full relative mb-5 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/10 bg-slate-900 flex items-center justify-center group">
            <img src={activeEvent.imageUrl} alt={activeEvent.eventName} className="w-full aspect-[4/1] object-cover object-center" />
            <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#0a0f1c] to-transparent pointer-events-none opacity-80" />
            {/* 標籤已俐落移除 */}
          </div>
        )}
        
        {/* 召喚師暱稱底框 (保留原樣) */}
        <div className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-b from-white/[0.08] to-transparent backdrop-blur-xl rounded-full w-fit mx-auto border border-white/[0.12] border-t-white/[0.2] shadow-lg">
          <UserCircle2 className="w-4 h-4 text-emerald-400" />
          <p className="text-slate-200 text-sm tracking-wide">召喚師：<span className="text-white font-bold drop-shadow-md">{playerInfo?.summonerName}</span></p>
        </div>
      </header>

      {/* ================= ⭐️ 票券列表 (新增底部螢光透視質感) ================= */}
      <div key={activeEventId} className="grid grid-cols-2 gap-4 w-full max-w-md pb-24">
        {activeEvent?.tickets.map((ticket, index) => (
          <button 
            key={ticket.id} 
            onClick={() => !ticket.isRedeemed && setSelectedTicket(ticket)} 
            disabled={ticket.isRedeemed} 
            // ⭐️ 核心渲染修改：bg-gradient 漸層到底部加上 to-yellow-500/[0.06]，並用 border-b 強化底部反射線條
            className={`relative overflow-hidden flex flex-col items-center justify-center p-6 rounded-[20px] transition-all duration-300 group animate-in zoom-in-95 fade-in
              ${ticket.isRedeemed 
                ? "bg-slate-900/40 border border-slate-800/50 opacity-50 cursor-not-allowed grayscale shadow-none" 
                : "bg-gradient-to-b from-white/[0.08] via-white/[0.02] to-yellow-500/[0.06] backdrop-blur-xl border border-white/[0.08] border-t-white/[0.25] border-b-yellow-500/[0.25] shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:to-yellow-500/[0.12] hover:border-b-yellow-500/[0.5] active:scale-[0.97] hover:shadow-[0_0_25px_rgba(234,179,8,0.2)]"
              }
            `} 
            style={{ animationDelay: `${index * 75}ms`, animationFillMode: "both" }}
          >
            {!ticket.isRedeemed && <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />}
            
            <div className={`mb-4 p-4 rounded-[14px] transition-all duration-500 
              ${ticket.isRedeemed 
                ? 'bg-slate-900 text-slate-600 shadow-inner' 
                : 'bg-black/40 text-yellow-400 group-hover:text-yellow-300 group-hover:bg-black/60 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] border border-white/5 group-hover:scale-110 group-hover:shadow-[inset_0_2px_15px_rgba(234,179,8,0.2)]'
              }`}
            >
              {getIcon(ticket.type, "w-7 h-7")}
            </div>
            
            <span className={`text-[13px] font-bold text-center leading-snug tracking-wide transition-colors
              ${ticket.isRedeemed ? 'text-slate-500' : 'text-slate-200 group-hover:text-white drop-shadow-md'}
            `}>
              {ticket.title}
            </span>

            {ticket.isRedeemed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] rounded-[20px]">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/80 mb-1 drop-shadow-lg" />
                <span className="text-emerald-400/90 text-xs font-black tracking-widest border-2 border-emerald-500/40 bg-emerald-950/60 px-3 py-1 rounded-md rotate-[-12deg] shadow-lg">已兌換</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* ================= 動態 QR Code 與 成功動畫 Modal ================= */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-[#0a0f1c]/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className={`w-full max-w-sm rounded-[32px] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative flex flex-col items-center overflow-hidden transition-colors duration-500 
            ${isJustRedeemed ? 'bg-gradient-to-b from-emerald-950 to-slate-950 border border-emerald-500/50' : 'bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700'}
          `}>
            
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-40 blur-[60px] pointer-events-none transition-colors duration-500 ${isJustRedeemed ? 'bg-emerald-500/30' : 'bg-yellow-500/20'}`} />
            
            <button onClick={handleCloseModal} className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-10"><X className="w-6 h-6" /></button>

            {isJustRedeemed ? (
              <div className="flex flex-col items-center justify-center py-10 animate-in zoom-in-95 duration-500 z-10 w-full text-center">
                <PartyPopper className="w-24 h-24 text-emerald-400 mb-6 drop-shadow-[0_0_25px_rgba(52,211,153,0.6)] animate-bounce" />
                <h2 className="text-3xl font-black text-white mb-2 tracking-widest drop-shadow-lg">兌換成功</h2>
                <p className="text-emerald-300 font-bold mb-6 text-lg">{selectedTicket.title}</p>
                <div className="bg-emerald-900/40 border border-emerald-500/30 rounded-2xl px-5 py-4 w-full backdrop-blur-sm shadow-inner">
                  <p className="text-emerald-100 text-sm leading-relaxed">請依照現場工作人員指示<br/>領取您的專屬物品</p>
                </div>
                <button onClick={handleCloseModal} className="w-full py-4 mt-8 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 text-white font-bold rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all active:scale-95 text-lg">完成並關閉</button>
              </div>
            ) : (
              <>
                <div className="text-center mb-8 mt-4 relative z-10 w-full">
                  <div className="mx-auto w-16 h-16 bg-black/40 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] border border-white/10 text-yellow-400 rounded-[18px] flex items-center justify-center mb-5 relative">
                     <div className="absolute inset-0 bg-yellow-500/20 blur-md rounded-[18px] z-[-1]" />
                     {getIcon(selectedTicket.type, "w-8 h-8 relative z-10")}
                  </div>
                  <h2 className="text-2xl font-black text-white mb-2 drop-shadow-md tracking-wide">{selectedTicket.title}</h2>
                  <p className="text-slate-400 text-sm">請將此畫面出示給關主掃描</p>
                </div>
                
                <div className="relative mb-8 w-full max-w-[240px]">
                  <div className="absolute -inset-3 border-2 border-yellow-500/20 rounded-[28px] z-0 overflow-hidden pointer-events-none">
                     <div className="w-full h-[6px] bg-yellow-400/90 shadow-[0_0_25px_rgba(234,179,8,1)] absolute animate-[scan_2s_ease-in-out_infinite]" />
                  </div>
                  <div className="bg-white p-4 rounded-3xl flex flex-col items-center justify-center relative z-10 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                    <QRCodeSVG value={selectedTicket.id} size={210} level={"M"} includeMargin={true} bgColor={"#ffffff"} fgColor={"#000000"} className="rounded-xl" />
                  </div>
                </div>
                
                <div className="flex items-center justify-center gap-2 text-slate-400 text-sm font-mono bg-black/40 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 w-full max-w-[240px] shadow-inner">
                  <RefreshCw className={`w-4 h-4 ${qrRefreshTimer <= 5 ? 'text-rose-500 animate-spin' : 'text-slate-500'}`} />
                  更新倒數：<span className={`font-bold w-6 text-center text-lg ${qrRefreshTimer <= 5 ? 'text-rose-500' : 'text-yellow-400'}`}>{qrRefreshTimer}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `@keyframes scan { 0%, 100% { transform: translateY(-10px); opacity: 0; } 10% { opacity: 1; } 50% { transform: translateY(280px); } 90% { opacity: 1; } } .scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}} />
    </div>
  );
}