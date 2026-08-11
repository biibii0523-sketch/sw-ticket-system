// 檔案路徑: src/app/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { 
  Ticket, 
  Utensils, 
  Gamepad2, 
  Camera, 
  Gift, 
  CheckCircle2, 
  X,
  RefreshCw,
  Loader2,
  UserCircle2,
  AlertTriangle
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react"; // ⭐️ 新增真實的 QR Code 產生器套件
import { eventConfig } from "@/config/event";
import { supabase } from "@/lib/supabase";

interface EventTicket {
  id: string;
  title: string;
  type: "food" | "game" | "gift" | "photo";
  isRedeemed: boolean;
  redeemedAt?: string;
}

interface PlayerInfo {
  summonerName: string;
  email: string;
}

// 測試用固定玩家 ID (請確保資料庫中有這筆資料)
const TEST_PLAYER_ID = '33333333-3333-3333-3333-333333333333';

export default function PlayerTicketWallet() {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  
  const [selectedTicket, setSelectedTicket] = useState<EventTicket | null>(null);
  const [qrRefreshTimer, setQrRefreshTimer] = useState(30);

  // 核心功能：向 Supabase 請求真實資料
  useEffect(() => {
    const fetchPlayerData = async () => {
      try {
        setIsLoading(true);
        setErrorMsg(null);

        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('summoner_name, email')
          .eq('id', TEST_PLAYER_ID)
          .single();

        if (playerError) throw playerError;

        setPlayerInfo({
          summonerName: playerData.summoner_name,
          email: playerData.email
        });

        const { data: ticketData, error: ticketError } = await supabase
          .from('player_tickets')
          .select(`
            id,
            is_redeemed,
            redeemed_at,
            ticket_templates (
              title,
              ticket_type
            )
          `)
          .eq('player_id', TEST_PLAYER_ID)
          .order('created_at', { ascending: true });

        if (ticketError) throw ticketError;

        const formattedTickets: EventTicket[] = (ticketData || []).map((t: any) => ({
          id: t.id,
          title: t.ticket_templates.title,
          type: t.ticket_templates.ticket_type,
          isRedeemed: t.is_redeemed,
          redeemedAt: t.redeemed_at 
            ? new Date(t.redeemed_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute:'2-digit' }) 
            : undefined
        }));

        setTickets(formattedTickets);

        // 刻意延遲 0.5 秒，保留高質感 Loading 動畫體驗
        await new Promise((resolve) => setTimeout(resolve, 500));

      } catch (error: any) {
        console.error("Supabase 連線失敗:", error);
        setErrorMsg("無法連線至魔法伺服器，請確認網路或環境變數設定。");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayerData();
  }, []);

  // 動態 QR Code 倒數計時器 (未來可進一步實作 TOTP 動態加密)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (selectedTicket) {
      setQrRefreshTimer(30);
      timer = setInterval(() => {
        setQrRefreshTimer((prev) => (prev <= 1 ? 30 : prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [selectedTicket]);

  const getIcon = (type: string, className = "w-6 h-6") => {
    switch (type) {
      case "food": return <Utensils className={className} />;
      case "game": return <Gamepad2 className={className} />;
      case "photo": return <Camera className={className} />;
      case "gift": return <Gift className={className} />;
      default: return <Ticket className={className} />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen z-50">
        <Loader2 className="w-12 h-12 text-yellow-500 animate-spin mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]" />
        <h2 className="text-xl font-bold text-yellow-400 tracking-widest animate-pulse">
          召喚陣載入中...
        </h2>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 z-50 text-center">
        <AlertTriangle className="w-16 h-16 text-rose-500 mb-4 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]" />
        <h2 className="text-xl font-bold text-rose-400 mb-2">系統異常</h2>
        <p className="text-slate-400">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-12 text-slate-100 relative z-10">
      
      {/* ================= Header 區塊 ================= */}
      <header className="text-center mb-10 w-full max-w-md animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="inline-block px-4 py-1.5 mb-4 rounded-full border border-yellow-500/40 bg-yellow-500/10 text-yellow-400 text-xs font-bold tracking-widest uppercase backdrop-blur-md">
          {eventConfig.subTitle}
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-yellow-300 via-yellow-100 to-yellow-500 text-transparent bg-clip-text drop-shadow-lg mb-2">
          {eventConfig.title}
        </h1>
        
        <div className="flex items-center justify-center gap-2 mt-5 px-5 py-2 glass-card rounded-full w-fit mx-auto epic-glow border-yellow-500/30">
          <UserCircle2 className="w-4 h-4 text-emerald-400" />
          <p className="text-slate-200 text-sm tracking-wide">
            召喚師：<span className="text-white font-bold">{playerInfo?.summonerName}</span>
          </p>
        </div>
      </header>

      {/* ================= 票券列表 ================= */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-2xl pb-20">
        {tickets.map((ticket, index) => (
          <button
            key={ticket.id}
            onClick={() => !ticket.isRedeemed && setSelectedTicket(ticket)}
            disabled={ticket.isRedeemed}
            className={`relative overflow-hidden flex flex-col items-center justify-center p-5 rounded-2xl transition-all duration-300 group animate-in fade-in slide-in-from-bottom-4
              ${
                ticket.isRedeemed
                  ? "bg-slate-950/80 border border-slate-800/50 opacity-60 cursor-not-allowed grayscale"
                  : "glass-card hover:border-yellow-500/50 hover:bg-white/10 active:scale-95 hover:shadow-[0_0_20px_rgba(234,179,8,0.2)]"
              }
            `}
            style={{ animationDelay: `${index * 150}ms`, animationFillMode: "both" }}
          >
            {!ticket.isRedeemed && (
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            )}
            
            <div className={`mb-3 p-3 rounded-xl transition-colors ${ticket.isRedeemed ? 'bg-slate-800 text-slate-500' : 'bg-slate-800/80 text-yellow-400 group-hover:text-yellow-300 shadow-inner border border-white/5'}`}>
              {getIcon(ticket.type)}
            </div>
            
            <span className="text-sm font-bold text-center leading-snug text-slate-200 group-hover:text-white">
              {ticket.title}
            </span>

            {ticket.isRedeemed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px]">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-1 drop-shadow-lg" />
                <span className="text-emerald-400 text-xs font-black tracking-widest border-2 border-emerald-500/50 bg-emerald-950/80 px-3 py-1 rounded-md rotate-[-12deg] shadow-lg">
                  已核銷
                </span>
                <span className="text-[10px] text-slate-300 mt-2 font-mono bg-black/50 px-2 py-0.5 rounded">
                  {ticket.redeemedAt}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* ================= 真實動態 QR Code 核銷 Modal ================= */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col items-center overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-yellow-500/20 blur-[50px] pointer-events-none" />
            
            <button 
              onClick={() => setSelectedTicket(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="text-center mb-6 mt-4 relative z-10">
              <div className="mx-auto w-16 h-16 glass-card text-yellow-400 rounded-2xl flex items-center justify-center mb-4 epic-glow">
                {getIcon(selectedTicket.type, "w-8 h-8")}
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">{selectedTicket.title}</h2>
              <p className="text-slate-400 text-sm">請將此畫面出示給關主掃描</p>
            </div>

            {/* ⭐️ 真實的 QR Code 產生區塊 */}
            <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center relative mb-6 shadow-[0_0_30px_rgba(255,255,255,0.1)] overflow-hidden">
              <QRCodeSVG 
                value={selectedTicket.id} // 注入真實的票券 UUID，交給 Scanner 核銷
                size={180}
                bgColor={"#ffffff"} // 確保掃描儀高對比讀取
                fgColor={"#0f172a"} // 深色模塊
                level={"H"}         // 最高容錯等級
                className="relative z-10"
              />
              
              {/* 帥氣的黃金掃描線動畫 (仍保留在真實 QR 上方增加沉浸感) */}
              <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400/80 shadow-[0_0_15px_rgba(234,179,8,1)] z-20 animate-[scan_2s_ease-in-out_infinite] pointer-events-none" />
            </div>

            <div className="flex items-center gap-2 text-slate-400 text-sm font-mono bg-slate-950 px-4 py-2 rounded-full border border-slate-800">
              <RefreshCw className={`w-4 h-4 ${qrRefreshTimer <= 5 ? 'text-rose-500 animate-spin' : 'text-slate-500'}`} />
              驗證碼更新倒數：
              <span className={`font-bold w-6 text-center ${qrRefreshTimer <= 5 ? 'text-rose-500' : 'text-yellow-400'}`}>
                {qrRefreshTimer}s
              </span>
            </div>
            
            {/* 防偽與排錯提示 */}
            <p className="text-[10px] text-slate-600 mt-4 font-mono">ID: {selectedTicket.id.split('-')[0]}... (動態加密保護中)</p>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0%, 100% { transform: translateY(-10px); opacity: 0; }
          10% { opacity: 1; }
          50% { transform: translateY(220px); }
          90% { opacity: 1; }
        }
      `}} />
    </div>
  );
}