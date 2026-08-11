// 檔案路徑: src/app/admin/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  BarChart3, 
  RefreshCcw, 
  Users, 
  Ticket, 
  CheckCircle2, 
  Clock,
  LogOut,
  Activity
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { eventConfig } from "@/config/event";

// 戰情室數據結構
interface TicketStat {
  id: string;
  title: string;
  type: string;
  totalCapacity: number; // 預計總發行量
  issuedCount: number;   // 實際已發出幾張
  redeemedCount: number; // 已經被核銷幾張
}

interface DashboardData {
  totalIssued: number;
  totalRedeemed: number;
  ticketStats: TicketStat[];
}

export default function AdminDashboardPage() {
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [loginError, setLoginError] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");

  // 處理最高權限登入 (模擬)
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin === "admin123") { // 測試用最高權限密碼
      setIsAdminAuth(true);
      setLoginError(false);
    } else {
      setLoginError(true);
      setAdminPin("");
    }
  };

  // 拉取戰情室即時數據
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // 透過 Supabase 關聯查詢：抓取所有票券模板，以及關聯的玩家票券狀態
      const { data, error } = await supabase
        .from('ticket_templates')
        .select(`
          id,
          title,
          ticket_type,
          total_quantity,
          player_tickets ( id, is_redeemed )
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;

      let globalIssued = 0;
      let globalRedeemed = 0;

      const stats: TicketStat[] = (data || []).map((template: any) => {
        const issued = template.player_tickets ? template.player_tickets.length : 0;
        const redeemed = template.player_tickets ? template.player_tickets.filter((t: any) => t.is_redeemed).length : 0;
        
        globalIssued += issued;
        globalRedeemed += redeemed;

        return {
          id: template.id,
          title: template.title,
          type: template.ticket_type,
          totalCapacity: template.total_quantity,
          issuedCount: issued,
          redeemedCount: redeemed
        };
      });

      setDashboardData({
        totalIssued: globalIssued,
        totalRedeemed: globalRedeemed,
        ticketStats: stats
      });
      
      setLastUpdated(new Date().toLocaleTimeString('zh-TW', { hour12: false }));
      
    } catch (err) {
      console.error("無法獲取戰情室數據", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 登入成功後自動抓取資料
  useEffect(() => {
    if (isAdminAuth) {
      fetchDashboardData();
      // 設定每 15 秒自動刷新一次戰情面板
      const interval = setInterval(fetchDashboardData, 15000);
      return () => clearInterval(interval);
    }
  }, [isAdminAuth]);


  // ================= UI 1: 戰情室門禁 =================
  if (!isAdminAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-900/20 via-slate-950 to-slate-950 z-0" />
        
        <div className="z-10 w-full max-w-sm glass-card p-8 rounded-3xl flex flex-col items-center border border-slate-800 shadow-2xl epic-glow">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 border border-rose-900/50 shadow-inner">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-widest text-center">COMMAND CENTER</h1>
          <p className="text-slate-400 text-sm mb-8 text-center">
            最高權限戰情室解鎖<br/>(測試密碼: admin123)
          </p>

          <form onSubmit={handleAdminLogin} className="w-full flex flex-col gap-4">
            <input
              type="password"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              className={`w-full bg-slate-950/50 border-2 rounded-xl py-4 text-center text-xl font-mono tracking-widest text-white focus:outline-none transition-all
                ${loginError ? 'border-rose-500 text-rose-500' : 'border-slate-700 focus:border-rose-500 focus:bg-slate-900'}
              `}
              placeholder="ENTER SECURE KEY"
            />
            {loginError && <p className="text-rose-500 text-xs text-center animate-pulse">權限拒絕：安全碼錯誤</p>}
            
            <button 
              type="submit"
              className="w-full py-4 mt-2 rounded-xl font-bold text-white bg-gradient-to-r from-rose-600 to-rose-800 hover:to-rose-700 active:scale-95 transition-all shadow-[0_0_15px_rgba(225,29,72,0.4)]"
            >
              授權進入 (ACCESS)
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ================= UI 2: 戰情數據儀表板 =================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-rose-500/30 p-4 md:p-8">
      {/* 頂部裝飾光暈 */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[300px] bg-rose-600/10 blur-[150px] rounded-full pointer-events-none z-0" />

      <div className="max-w-5xl mx-auto relative z-10">
        
        {/* Header 區塊 */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-rose-500 animate-pulse" />
              <span className="text-rose-500 text-xs font-black tracking-widest uppercase bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
                LIVE DASHBOARD
              </span>
            </div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 text-transparent bg-clip-text">
              {eventConfig.title}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <Clock className="w-4 h-4" />
              最後更新: {lastUpdated}
            </div>
            <button 
              onClick={fetchDashboardData}
              disabled={isLoading}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 disabled:opacity-50"
              title="手動刷新"
            >
              <RefreshCcw className={`w-5 h-5 text-yellow-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={() => setIsAdminAuth(false)}
              className="p-2 bg-rose-900/30 hover:bg-rose-900/50 rounded-lg transition-colors border border-rose-900/50 text-rose-400"
              title="登出戰情室"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* 總覽卡片區塊 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="glass-card rounded-2xl p-6 border-l-4 border-l-yellow-500 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-bold tracking-wider mb-1">系統總發放票券數</p>
              <h3 className="text-4xl font-black text-white">{dashboardData?.totalIssued || 0}</h3>
            </div>
            <div className="w-14 h-14 bg-yellow-500/10 rounded-full flex items-center justify-center">
              <Ticket className="w-7 h-7 text-yellow-500" />
            </div>
          </div>
          
          <div className="glass-card rounded-2xl p-6 border-l-4 border-l-emerald-500 flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[30px]" />
            <div className="relative z-10">
              <p className="text-slate-400 text-sm font-bold tracking-wider mb-1">已成功核銷總數</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-black text-white">{dashboardData?.totalRedeemed || 0}</h3>
                <span className="text-emerald-400 font-bold">
                  ({ dashboardData?.totalIssued ? Math.round((dashboardData.totalRedeemed / dashboardData.totalIssued) * 100) : 0 }%)
                </span>
              </div>
            </div>
            <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center relative z-10">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
          </div>
        </div>

        {/* 各攤位/票券獨立進度條區塊 */}
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-400" /> 各項目兌換進度監控
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {dashboardData?.ticketStats.map((stat) => {
            // 計算百分比
            const redeemRate = stat.issuedCount > 0 
              ? Math.round((stat.redeemedCount / stat.issuedCount) * 100) 
              : 0;
            
            // 決定進度條顏色 (高於 80% 顯示熱點橘紅)
            const barColor = redeemRate > 80 ? 'bg-gradient-to-r from-orange-500 to-rose-500' : 'bg-gradient-to-r from-indigo-500 to-blue-400';

            return (
              <div key={stat.id} className="glass-card p-5 rounded-2xl">
                <div className="flex justify-between items-end mb-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 border border-slate-700 bg-slate-800 px-2 py-0.5 rounded-full mb-2 inline-block">
                      {stat.type}
                    </span>
                    <h3 className="text-lg font-bold text-white">{stat.title}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-white">{stat.redeemedCount} <span className="text-sm text-slate-500 font-normal">/ {stat.issuedCount}</span></p>
                  </div>
                </div>

                {/* 科幻感進度條 */}
                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-700 relative">
                  <div 
                    className={`h-full ${barColor} transition-all duration-1000 ease-out relative`}
                    style={{ width: `${redeemRate}%` }}
                  >
                    {/* 進度條上的發光點 */}
                    <div className="absolute top-0 right-0 w-3 h-full bg-white/50 blur-[2px]" />
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-2 text-xs font-mono">
                  <span className="text-slate-500">核銷達成率: <span className={redeemRate > 80 ? 'text-rose-400' : 'text-blue-400'}>{redeemRate}%</span></span>
                  <span className="text-slate-600">系統發行量: {stat.totalCapacity}</span>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}