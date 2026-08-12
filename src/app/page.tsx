// 檔案路徑: src/app/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { 
  Ticket, Utensils, Gamepad2, Camera, Gift, CheckCircle2, 
  X, RefreshCw, Loader2, UserCircle2, AlertTriangle, MapPin
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";

interface EventTicket {
  id: string; title: string; type: "admission" | "food" | "game" | "gift" | "photo";
  isRedeemed: boolean; redeemedAt?: string;
}

interface PlayerInfo { summonerName: string; email: string; }

// 定義分類後的活動結構
interface PlayerEventGroup {
  eventId: string;
  eventName: string;
  imageUrl: string;
  tickets: EventTicket[];
}

const TEST_PLAYER_ID = '33333333-3333-3333-3333-333333333333';

export default function PlayerTicketWallet() {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  
  // ⭐️ 存放分組後的活動資料，與目前選取的活動 ID
  const [eventGroups, setEventGroups] = useState<PlayerEventGroup[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  
  const [selectedTicket, setSelectedTicket] = useState<EventTicket | null>(null);
  const [qrRefreshTimer, setQrRefreshTimer] = useState(30);

  useEffect(() => {
    const fetchDynamicData = async () => {
      try {
        setIsLoading(true); setErrorMsg(null);
        const { data, error } = await supabase
          .from('players')
          .select(`
            summoner_name, email,
            player_tickets (
              id, is_redeemed, redeemed_at, created_at,
              ticket_templates ( title, ticket_type, events ( id, name, image_url ) )
            )
          `)
          .eq('id', TEST_PLAYER_ID)
          .single();

        if (error) throw error;
        if (!data) throw new Error("找不到玩家資料");

        setPlayerInfo({ summonerName: data.summoner_name, email: data.email });

        // ⭐️ 將所有票券依據 "活動 (events.id)" 進行分組 (Group By)
        const groupsMap = new Map<string, PlayerEventGroup>();
        const playerTickets = data.player_tickets || [];

        playerTickets.forEach((t: any) => {
          const ev = t.ticket_templates.events;
          if (!ev) return;
          
          if (!groupsMap.has(ev.id)) {
            groupsMap.set(ev.id, { eventId: ev.id, eventName: ev.name, imageUrl: ev.image_url, tickets: [] });
          }
          
          groupsMap.get(ev.id)!.tickets.push({
            id: t.id,
            title: t.ticket_templates.title,
            type: t.ticket_templates.ticket_type,
            isRedeemed: t.is_redeemed,
            redeemedAt: t.redeemed_at ? new Date(t.redeemed_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute:'2-digit' }) : undefined
          });
        });

        // 轉為陣列並排序票券建立時間
        const groupsArray = Array.from(groupsMap.values());
        groupsArray.forEach(group => group.tickets.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));

        setEventGroups(groupsArray);
        if (groupsArray.length > 0) setActiveEventId(groupsArray[0].eventId); // 預設顯示第一場活動

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error("連線失敗:", error);
        setErrorMsg("無法連線至伺服器，請確認網路設定。");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDynamicData();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (selectedTicket) {
      setQrRefreshTimer(30);
      timer = setInterval(() => setQrRefreshTimer((prev) => (prev <= 1 ? 30 : prev - 1)), 1000);
    }
    return () => clearInterval(timer);
  }, [selectedTicket]);

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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen z-50 bg-slate-950">
        <Loader2 className="w-12 h-12 text-yellow-500 animate-spin mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]" />
        <h2 className="text-xl font-bold text-yellow-400 tracking-widest animate-pulse">召喚陣載入中...</h2>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 z-50 text-center bg-slate-950">
        <AlertTriangle className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-rose-400 mb-2">系統異常</h2><p className="text-slate-400">{errorMsg}</p>
      </div>
    );
  }

  if (eventGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen z-50 bg-slate-950 text-center px-4">
         <Ticket className="w-16 h-16 text-slate-600 mb-4" />
         <h2 className="text-xl font-bold text-slate-300">目前您的票券夾是空的</h2>
         <p className="text-slate-500 text-sm mt-2">如果您已報名活動，請等待主辦單位派發票券。</p>
      </div>
    )
  }

  // 取得目前選取的活動資料
  const activeEvent = eventGroups.find(g => g.eventId === activeEventId);

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-8 text-slate-100 relative z-10 overflow-hidden">
      
      {/* 動態背景 */}
      <div 
        className="fixed inset-0 z-[-2] bg-cover bg-center bg-no-repeat transition-all duration-1000 ease-in-out opacity-60 scale-105"
        style={{ backgroundImage: activeEvent?.imageUrl ? `url('${activeEvent.imageUrl}')` : 'none' }}
      />
      <div className="fixed inset-0 z-[-1] bg-gradient-to-b from-slate-950/90 via-slate-900/80 to-slate-950/95 backdrop-blur-[4px]" />

      {/* ⭐️ 場次切換 Tabs (如果有兩場以上的活動才顯示) */}
      {eventGroups.length > 1 && (
        <div className="w-full max-w-md flex overflow-x-auto gap-3 pb-4 mb-6 scrollbar-hide snap-x">
          {eventGroups.map((group) => (
            <button
              key={group.eventId}
              onClick={() => setActiveEventId(group.eventId)}
              className={`snap-center shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all duration-300 border backdrop-blur-md
                ${activeEventId === group.eventId 
                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]' 
                  : 'bg-slate-900/50 text-slate-400 border-slate-700/50 hover:bg-slate-800'
                }
              `}
            >
              <MapPin className="w-4 h-4" /> {group.eventName.substring(0, 8)}...
            </button>
          ))}
        </div>
      )}

      {/* Header 區塊 */}
      <header className="text-center mb-8 w-full max-w-md animate-in fade-in slide-in-from-top-4 duration-700">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-yellow-300 via-yellow-100 to-yellow-500 text-transparent bg-clip-text drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mb-2 px-4 leading-tight">
          {activeEvent?.eventName}
        </h1>
        <div className="flex items-center justify-center gap-2 mt-4 px-5 py-2 glass-card rounded-full w-fit mx-auto epic-glow border-yellow-500/30">
          <UserCircle2 className="w-4 h-4 text-emerald-400" />
          <p className="text-slate-200 text-sm tracking-wide">召喚師：<span className="text-white font-bold">{playerInfo?.summonerName}</span></p>
        </div>
      </header>

      {/* 票券列表 (使用 key 強制 React 重新渲染動畫) */}
      <div key={activeEventId} className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-2xl pb-20">
        {activeEvent?.tickets.map((ticket, index) => (
          <button
            key={ticket.id}
            onClick={() => !ticket.isRedeemed && setSelectedTicket(ticket)}
            disabled={ticket.isRedeemed}
            className={`relative overflow-hidden flex flex-col items-center justify-center p-5 rounded-2xl transition-all duration-300 group animate-in zoom-in-95 fade-in
              ${ticket.isRedeemed ? "bg-slate-950/80 border border-slate-800/50 opacity-60 cursor-not-allowed grayscale" : "glass-card hover:border-yellow-500/50 hover:bg-white/10 active:scale-95 hover:shadow-[0_0_20px_rgba(234,179,8,0.2)]"}
            `}
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
          >
            {!ticket.isRedeemed && <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />}
            
            <div className={`mb-3 p-3 rounded-xl transition-colors ${ticket.isRedeemed ? 'bg-slate-800 text-slate-500' : 'bg-slate-800/80 text-yellow-400 group-hover:text-yellow-300 shadow-inner border border-white/5'}`}>
              {getIcon(ticket.type)}
            </div>
            <span className="text-sm font-bold text-center leading-snug text-slate-200 group-hover:text-white">{ticket.title}</span>

            {ticket.isRedeemed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-[2px]">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-1 drop-shadow-lg" />
                <span className="text-emerald-400 text-xs font-black tracking-widest border-2 border-emerald-500/50 bg-emerald-950/80 px-3 py-1 rounded-md rotate-[-12deg] shadow-lg">已核銷</span>
                <span className="text-[10px] text-slate-300 mt-2 font-mono bg-black/50 px-2 py-0.5 rounded">{ticket.redeemedAt}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* 動態 QR Code Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col items-center overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-yellow-500/20 blur-[50px] pointer-events-none" />
            <button onClick={() => setSelectedTicket(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors z-10"><X className="w-6 h-6" /></button>
            <div className="text-center mb-6 mt-4 relative z-10">
              <div className="mx-auto w-16 h-16 glass-card text-yellow-400 rounded-2xl flex items-center justify-center mb-4 epic-glow">{getIcon(selectedTicket.type, "w-8 h-8")}</div>
              <h2 className="text-2xl font-bold text-white mb-1">{selectedTicket.title}</h2>
              <p className="text-slate-400 text-sm">請將此畫面出示給關主掃描</p>
            </div>
            <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center relative mb-6 shadow-[0_0_30px_rgba(255,255,255,0.1)] overflow-hidden">
              <QRCodeSVG value={selectedTicket.id} size={180} bgColor={"#ffffff"} fgColor={"#0f172a"} level={"H"} className="relative z-10" />
              <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400/80 shadow-[0_0_15px_rgba(234,179,8,1)] z-20 animate-[scan_2s_ease-in-out_infinite] pointer-events-none" />
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm font-mono bg-slate-950 px-4 py-2 rounded-full border border-slate-800">
              <RefreshCw className={`w-4 h-4 ${qrRefreshTimer <= 5 ? 'text-rose-500 animate-spin' : 'text-slate-500'}`} />
              更新倒數：<span className={`font-bold w-6 text-center ${qrRefreshTimer <= 5 ? 'text-rose-500' : 'text-yellow-400'}`}>{qrRefreshTimer}s</span>
            </div>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `@keyframes scan { 0%, 100% { transform: translateY(-10px); opacity: 0; } 10% { opacity: 1; } 50% { transform: translateY(220px); } 90% { opacity: 1; } } /* 隱藏滾動條 */ .scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}} />
    </div>
  );
}