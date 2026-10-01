// 檔案路徑: src/app/admin/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  LockKeyhole, Loader2, LogOut, BarChart3, RefreshCw, 
  CalendarDays, Ticket, CheckCircle2, TrendingUp 
} from "lucide-react";

export default function AdminDashboardPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pinCode, setPinCode] = useState("");
  const [loginError, setLoginError] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [eventsData, setEventsData] = useState<any[]>([]);

  // 從環境變數讀取後台登入密碼
  const CORRECT_ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "2024";

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinCode === CORRECT_ADMIN_PIN) {
      setIsLoggedIn(true);
      setLoginError(false);
      fetchDashboardData();
    } else {
      setLoginError(true);
      setPinCode("");
    }
  };

  // ⭐️ 核心資料抓取與結構整理
  const fetchDashboardData = useCallback(async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          id, name, event_date, image_url, is_active,
          ticket_templates (
            id, title, ticket_type, sort_order,
            player_tickets ( id, is_redeemed, redeemed_at )
          )
        `)
        .order('event_date', { ascending: false });

      if (error) {
        console.error("Dashboard Fetch Error:", error);
        return;
      }

      // 整理並排序票券模板
      const formattedData = (data || []).map(event => {
        const templates = (event.ticket_templates || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
        return { ...event, ticket_templates: templates };
      });

      setEventsData(formattedData);
    } catch (err) {
      console.error("System Error:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black z-0" />
        
        <div className="z-10 w-full max-w-sm glass-card p-8 rounded-3xl flex flex-col items-center border border-slate-800 shadow-2xl bg-black/40 backdrop-blur-xl">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(234,179,8,0.3)]">
            <BarChart3 className="w-8 h-8 text-slate-950" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2 tracking-widest uppercase">Admin 戰情室</h1>
          <p className="text-slate-400 text-xs mb-6">Com2uS 營運總部最高權限</p>
          
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
            <div className="relative">
              <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="password" 
                value={pinCode} 
                onChange={(e) => setPinCode(e.target.value)} 
                className={`w-full bg-slate-900 border-2 rounded-xl pl-12 pr-4 py-4 text-white font-mono tracking-[0.5em] focus:outline-none transition-all ${loginError ? 'border-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.3)]' : 'border-slate-800 focus:border-yellow-500'}`} 
                placeholder="密碼" 
              />
            </div>
            {loginError && <p className="text-rose-500 text-xs text-center animate-pulse">授權失敗，請重新輸入</p>}
            <button type="submit" className="w-full py-4 mt-2 rounded-xl font-bold text-slate-950 bg-yellow-500 hover:bg-yellow-400 active:scale-95 transition-all uppercase tracking-widest">
              登入系統
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-950"><Loader2 className="w-12 h-12 text-yellow-500 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-slate-200 pb-20">
      
      {/* ⭐️ 戰情室置頂導航列 */}
      <header className="sticky top-0 z-50 bg-[#0a0f1c]/90 backdrop-blur-xl border-b border-slate-800 px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-500 p-2 rounded-lg"><BarChart3 className="w-5 h-5 text-slate-950" /></div>
          <h1 className="font-bold text-lg text-white tracking-wide">營運數據監控</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => fetchDashboardData(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-sm text-yellow-400 transition-colors">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> 
            <span className="hidden md:inline">即時刷新</span>
          </button>
          <button onClick={() => setIsLoggedIn(false)} className="p-2 text-slate-400 hover:text-white bg-slate-900 rounded-lg border border-slate-800">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 space-y-12">
        {eventsData.map((event) => {
          
          // 計算該場次總體的核銷進度
          let totalEventTickets = 0;
          let totalRedeemedTickets = 0;
          event.ticket_templates.forEach((template: any) => {
            const tickets = template.player_tickets || [];
            totalEventTickets += tickets.length;
            totalRedeemedTickets += tickets.filter((t: any) => t.is_redeemed === true).length;
          });
          const eventProgress = totalEventTickets === 0 ? 0 : Math.round((totalRedeemedTickets / totalEventTickets) * 100);

          return (
            <section key={event.id} className="relative bg-slate-900/40 border border-slate-800/80 rounded-[32px] overflow-hidden shadow-2xl">
              
              {/* ⭐️️ 活動橫幅與場次標題 (史詩級整合) */}
              <div className="relative w-full h-48 md:h-64 overflow-hidden bg-slate-950">
                {event.image_url ? (
                  <>
                    <img src={event.image_url} alt={event.name} className="w-full h-full object-cover opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 to-slate-950" />
                )}
                
                <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-widest ${event.is_active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                        {event.is_active ? '進行中 ACTIVE' : '已結束 ENDED'}
                      </span>
                      <span className="flex items-center gap-1 text-slate-300 text-sm bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm border border-white/10"><CalendarDays className="w-3 h-3"/> {event.event_date}</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-white drop-shadow-lg tracking-wide">{event.name}</h2>
                  </div>
                  
                  {/* 場次總進度指示器 */}
                  <div className="flex items-center gap-4 bg-black/50 p-4 rounded-2xl backdrop-blur-md border border-white/10 w-full md:w-auto">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400 font-bold tracking-widest uppercase">場次總核銷率</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-yellow-400">{eventProgress}%</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-full border-[4px] border-slate-800 flex items-center justify-center relative">
                      <svg className="w-full h-full transform -rotate-90 absolute inset-0" viewBox="0 0 36 36">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#eab308" strokeWidth="4" strokeDasharray={`${eventProgress}, 100`} />
                      </svg>
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ⭐️ 完美還原：深色核銷數據網格 */}
              <div className="p-6 md:p-8 bg-[#0a0f1c]/50">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  
                  {event.ticket_templates.map((template: any) => {
                    const tickets = template.player_tickets || [];
                    const totalCount = tickets.length;
                    
                    // ⭐️ BUG 修復核心：嚴格使用 is_redeemed === true 來精準過濾
                    const redeemedCount = tickets.filter((t: any) => t.is_redeemed === true).length;
                    
                    const progressPercent = totalCount === 0 ? 0 : (redeemedCount / totalCount) * 100;

                    return (
                      <div key={template.id} className="bg-[#0f1526] border border-slate-800 rounded-2xl p-6 relative overflow-hidden group hover:border-slate-700 transition-colors">
                        
                        {/* 頂部：標題與票券類型 */}
                        <div className="flex justify-between items-start mb-6">
                          <h3 className="font-bold text-slate-200 text-base">{template.title}</h3>
                          <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 bg-slate-900 border border-slate-800 px-2 py-1 rounded-md">
                            {template.ticket_type}
                          </span>
                        </div>
                        
                        {/* 數據：核銷數 / 總發出 */}
                        <div className="flex items-baseline gap-2 mb-4">
                          <span className={`text-4xl font-black ${redeemedCount > 0 ? 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'text-slate-500'}`}>
                            {redeemedCount}
                          </span>
                          <span className="text-sm text-slate-500 font-medium">/ {totalCount} 已發出</span>
                        </div>

                        {/* 進度條 (高質感設計) */}
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-auto">
                          <div 
                            className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        
                        {/* 完成度滿百特效 */}
                        {totalCount > 0 && redeemedCount === totalCount && (
                          <div className="absolute top-4 right-4 bg-emerald-500/20 text-emerald-400 p-1.5 rounded-full border border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.3)] animate-in zoom-in">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                </div>
              </div>

            </section>
          );
        })}
        
        {eventsData.length === 0 && (
          <div className="text-center py-20 text-slate-500 border border-slate-800 border-dashed rounded-3xl bg-slate-900/20">
            <Ticket className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>目前系統中沒有任何活動資料</p>
          </div>
        )}
      </main>
    </div>
  );
}
