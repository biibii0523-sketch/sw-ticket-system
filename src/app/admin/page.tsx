// 檔案路徑: src/app/admin/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, BarChart3, RefreshCcw, LogOut, Activity, 
  PlusCircle, Image as ImageIcon, Trash2, Save, Calendar, Ticket, CheckCircle2, Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// --- 型別定義 ---
interface TicketStat {
  id: string;
  title: string;
  type: string;
  totalCapacity: number;
  issuedCount: number;
  redeemedCount: number;
}

interface EventData {
  id: string;
  name: string;
  event_date: string;
  image_url: string;
  ticketStats: TicketStat[];
}

interface NewTicket {
  title: string;
  type: "admission" | "food" | "game" | "gift" | "photo"; 
  quantity: number;
}

export default function AdminDashboardPage() {
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [loginError, setLoginError] = useState(false);
  
  // UI 狀態
  const [activeTab, setActiveTab] = useState<"dashboard" | "create">("dashboard");
  const [isLoading, setIsLoading] = useState(true);
  
  // 戰情室數據
  const [eventsData, setEventsData] = useState<EventData[]>([]);
  const [lastUpdated, setLastUpdated] = useState("");

  // 創建活動表單狀態
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [visualFile, setVisualFile] = useState<File | null>(null);
  const [newTickets, setNewTickets] = useState<NewTicket[]>([
    { title: "12週年派對入場卷", type: "admission", quantity: 500 }
  ]);

  // --- 登入邏輯 ---
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin === "admin123") {
      setIsAdminAuth(true);
      setLoginError(false);
    } else {
      setLoginError(true);
      setAdminPin("");
    }
  };

  // --- 拉取戰情室數據 (依活動分組) ---
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select(`
          id, name, event_date, image_url,
          ticket_templates (
            id, title, ticket_type, total_quantity,
            player_tickets ( id, is_redeemed )
          )
        `)
        .order('event_date', { ascending: false });

      if (error) throw error;

      const formattedEvents: EventData[] = (data || []).map((ev: any) => {
        const stats: TicketStat[] = (ev.ticket_templates || []).map((template: any) => {
          const issued = template.player_tickets ? template.player_tickets.length : 0;
          const redeemed = template.player_tickets ? template.player_tickets.filter((t: any) => t.is_redeemed).length : 0;
          return {
            id: template.id,
            title: template.title,
            type: template.ticket_type,
            totalCapacity: template.total_quantity,
            issuedCount: issued,
            redeemedCount: redeemed
          };
        });

        return {
          id: ev.id,
          name: ev.name,
          event_date: ev.event_date,
          image_url: ev.image_url,
          ticketStats: stats
        };
      });

      setEventsData(formattedEvents);
      setLastUpdated(new Date().toLocaleTimeString('zh-TW', { hour12: false }));
    } catch (err) {
      console.error("無法獲取數據", err);
      alert("數據載入失敗，請確認網路或資料庫狀態");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminAuth && activeTab === "dashboard") {
      fetchDashboardData();
    }
  }, [isAdminAuth, activeTab]);

  // --- 創建活動與票券邏輯 ---
  const handleAddTicket = () => {
    setNewTickets([...newTickets, { title: "", type: "game", quantity: 50 }]);
  };

  const handleRemoveTicket = (index: number) => {
    if (newTickets.length <= 1) return;
    setNewTickets(newTickets.filter((_, i) => i !== index));
  };

  const handleTicketChange = (index: number, field: keyof NewTicket, value: string | number) => {
    const updated = [...newTickets];
    updated[index] = { ...updated[index], [field]: value };
    setNewTickets(updated);
  };

  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName || !newEventDate) return alert("請填寫活動名稱與日期！");
    if (!visualFile) return alert("請上傳活動主視覺！");
    
    // 檢查票券資料是否完整
    for (const t of newTickets) {
      if (!t.title || t.quantity <= 0) return alert("請確認票券名稱與數量皆已正確填寫！");
    }

    try {
      setIsSubmitting(true);

      // 1. 上傳圖片至 Supabase Storage
      const fileExt = visualFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('event-visuals')
        .upload(fileName, visualFile);
        
      if (uploadError) throw new Error("圖片上傳失敗：" + uploadError.message);

      // 取得圖片公開網址
      const { data: publicUrlData } = supabase.storage.from('event-visuals').getPublicUrl(fileName);
      const imageUrl = publicUrlData.publicUrl;

      // 2. 新增活動至 events 表 (⭐️ 強化錯誤捕捉，印出真實報錯原因)
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert([{ 
          name: newEventName, 
          event_date: newEventDate,
          image_url: imageUrl,
          is_active: true
        }])
        .select('id')
        .single();

      if (eventError) {
        throw new Error(`建立活動寫入失敗 (Supabase 拒絕): ${eventError.message}`);
      }
      if (!eventData) {
        throw new Error("建立活動失敗：系統未回傳新活動的 ID");
      }

      // 3. 批量新增票券至 ticket_templates 表
      const templatesToInsert = newTickets.map(t => ({
        event_id: eventData.id,
        title: t.title,
        ticket_type: t.type,
        total_quantity: t.quantity
      }));

      const { error: ticketsError } = await supabase
        .from('ticket_templates')
        .insert(templatesToInsert);

      if (ticketsError) {
        throw new Error(`建立票券模板失敗 (Supabase 拒絕): ${ticketsError.message}`);
      }

      // 4. 完成並重置表單
      alert("🎉 活動創建成功！");
      setNewEventName("");
      setNewEventDate("");
      setVisualFile(null);
      setNewTickets([{ title: "12週年派對入場卷", type: "admission", quantity: 500 }]);
      setActiveTab("dashboard");

    } catch (err: any) {
      console.error("創建活動過程發生錯誤:", err);
      // 將精準的錯誤訊息彈跳出來讓主辦方看到
      alert(err.message || "發生未知錯誤");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ================= UI: 戰情室門禁 =================
  if (!isAdminAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-900/20 via-slate-950 to-slate-950 z-0" />
        <div className="z-10 w-full max-w-sm glass-card p-8 rounded-3xl flex flex-col items-center border border-slate-800 shadow-2xl epic-glow">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 border border-rose-900/50 shadow-inner">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-widest text-center">COMMAND CENTER</h1>
          <form onSubmit={handleAdminLogin} className="w-full flex flex-col gap-4 mt-6">
            <input
              type="password"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              className={`w-full bg-slate-950/50 border-2 rounded-xl py-4 text-center text-xl font-mono tracking-widest text-white focus:outline-none transition-all
                ${loginError ? 'border-rose-500 text-rose-500' : 'border-slate-700 focus:border-rose-500'}
              `}
              placeholder="ENTER SECURE KEY"
            />
            <button type="submit" className="w-full py-4 mt-2 rounded-xl font-bold text-white bg-gradient-to-r from-rose-600 to-rose-800 hover:to-rose-700 active:scale-95 transition-all shadow-[0_0_15px_rgba(225,29,72,0.4)]">
              授權進入 (ACCESS)
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ================= UI: 戰情室主畫面 =================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-rose-500/30">
      
      {/* 頂部導航列 (Tab 切換) */}
      <nav className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-rose-500" />
          <h1 className="text-xl font-black tracking-widest text-white">ADMIN HUD</h1>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button 
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === "dashboard" ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            <Activity className="w-4 h-4" /> 即時戰情室
          </button>
          <button 
            onClick={() => setActiveTab("create")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === "create" ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            <PlusCircle className="w-4 h-4" /> 建立新活動
          </button>
        </div>

        <button onClick={() => setIsAdminAuth(false)} className="flex items-center gap-2 text-rose-400 hover:text-rose-300 text-sm font-bold">
          <LogOut className="w-4 h-4" /> 登出
        </button>
      </nav>

      <main className="p-4 md:p-8 max-w-6xl mx-auto relative z-10">
        
        {/* ================= 分頁 1: 即時戰情室 ================= */}
        {activeTab === "dashboard" && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-rose-500" /> 活動兌換統計
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm font-mono">更新於: {lastUpdated}</span>
                <button onClick={fetchDashboardData} className={`p-2 bg-slate-800 rounded-lg border border-slate-700 hover:bg-slate-700 ${isLoading ? 'animate-spin text-yellow-400' : 'text-slate-300'}`}>
                  <RefreshCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {eventsData.length === 0 && !isLoading && (
              <div className="text-center py-20 text-slate-500 border border-slate-800 border-dashed rounded-2xl">
                目前沒有任何活動資料，請前往「建立新活動」
              </div>
            )}

            {eventsData.map((ev) => (
              <div key={ev.id} className="glass-card rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative">
                {/* 橫幅主視覺 (做為每個活動的 Header) */}
                {ev.image_url && (
                  <div className="w-full h-48 relative border-b border-slate-800">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent z-10" />
                    <img src={ev.image_url} alt={ev.name} className="w-full h-full object-cover object-center opacity-70" />
                  </div>
                )}
                
                <div className={`p-6 ${ev.image_url ? '-mt-16 relative z-20' : ''}`}>
                  <h3 className="text-3xl font-extrabold text-white mb-2 drop-shadow-lg">{ev.name}</h3>
                  <p className="text-emerald-400 font-mono text-sm mb-6 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> {ev.event_date}
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ev.ticketStats.map((stat) => {
                      const redeemRate = stat.issuedCount > 0 ? Math.round((stat.redeemedCount / stat.issuedCount) * 100) : 0;
                      const barColor = redeemRate > 80 ? 'from-orange-500 to-rose-500' : 'from-indigo-500 to-blue-400';

                      return (
                        <div key={stat.id} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-white font-bold">{stat.title}</span>
                            <span className="text-[10px] uppercase text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">{stat.type}</span>
                          </div>
                          
                          <div className="flex items-end gap-2 mb-2">
                            <span className="text-3xl font-black text-white">{stat.redeemedCount}</span>
                            <span className="text-slate-500 text-sm mb-1">/ {stat.issuedCount} 發出</span>
                          </div>

                          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                            <div className={`h-full bg-gradient-to-r ${barColor} transition-all duration-1000`} style={{ width: `${redeemRate}%` }} />
                          </div>
                          <p className="text-right text-[10px] text-slate-500 mt-1 font-mono">系統發行量: {stat.totalCapacity}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= 分頁 2: 建立新活動 ================= */}
        {activeTab === "create" && (
          <form onSubmit={handleSubmitEvent} className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* 區塊 1: 基礎設定 */}
            <div className="glass-card p-6 md:p-8 rounded-3xl border border-slate-800">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-indigo-400" /> 1. 活動基礎資訊
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">活動標題 (Event Name)</label>
                  <input type="text" required value={newEventName} onChange={e => setNewEventName(e.target.value)} placeholder="例如：2026 召喚師世界盃總決賽" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">活動日期 (Event Date)</label>
                  <input type="date" required value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none transition-colors [color-scheme:dark]" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">活動主視覺 (Main Visual)</label>
                <div className="border-2 border-dashed border-slate-700 bg-slate-950/50 rounded-2xl p-8 flex flex-col items-center justify-center relative hover:border-indigo-500 transition-colors cursor-pointer" onClick={() => document.getElementById('visual-upload')?.click()}>
                  <input id="visual-upload" type="file" accept="image/*" className="hidden" onChange={(e) => setVisualFile(e.target.files?.[0] || null)} />
                  {visualFile ? (
                     <div className="text-center text-emerald-400 font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/> 已選擇圖片：{visualFile.name}</div>
                  ) : (
                    <>
                      <ImageIcon className="w-12 h-12 text-slate-500 mb-3" />
                      <p className="text-slate-300 font-bold">點擊上傳圖片 (JPG, PNG)</p>
                      <p className="text-xs text-slate-500 mt-2 text-center">
                        推薦尺寸: 1920x1080 (16:9)<br/>
                        此視覺將自動套用於玩家票券背景與戰情室橫幅
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 區塊 2: 票券建置 */}
            <div className="glass-card p-6 md:p-8 rounded-3xl border border-slate-800">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Ticket className="w-6 h-6 text-yellow-500" /> 2. 發行票券設定
                </h2>
                <button type="button" onClick={handleAddTicket} className="text-sm font-bold text-yellow-400 hover:text-yellow-300 flex items-center gap-1 border border-yellow-500/30 px-3 py-1.5 rounded-lg bg-yellow-500/10 transition-colors">
                  <PlusCircle className="w-4 h-4" /> 新增票券種類
                </button>
              </div>

              <div className="space-y-4">
                {newTickets.map((ticket, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800 items-start md:items-center">
                    <div className="w-full md:w-5/12">
                      <label className="block text-xs text-slate-500 mb-1">票券名稱</label>
                      <input type="text" required value={ticket.title} onChange={e => handleTicketChange(index, 'title', e.target.value)} placeholder="例如: 12週年派對入場卷" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none" />
                    </div>
                    <div className="w-full md:w-3/12">
                      <label className="block text-xs text-slate-500 mb-1">種類</label>
                      <select value={ticket.type} onChange={e => handleTicketChange(index, 'type', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none">
                        <option value="admission">入場 (Admission)</option>
                        <option value="food">餐飲 (Food)</option>
                        <option value="game">遊戲 (Game)</option>
                        <option value="photo">拍照 (Photo)</option>
                        <option value="gift">贈品 (Gift)</option>
                      </select>
                    </div>
                    <div className="w-full md:w-3/12">
                      <label className="block text-xs text-slate-500 mb-1">總發行數量</label>
                      <input type="number" required min="1" value={ticket.quantity} onChange={e => handleTicketChange(index, 'quantity', parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none" />
                    </div>
                    <div className="w-full md:w-1/12 flex justify-end md:justify-center md:pt-5">
                      <button type="button" onClick={() => handleRemoveTicket(index)} disabled={newTickets.length === 1} className="p-2 text-slate-500 hover:text-rose-500 disabled:opacity-30 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 送出按鈕 */}
            <div className="flex justify-end">
              <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all active:scale-95 disabled:opacity-50">
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {isSubmitting ? "正在建立並上傳主視覺..." : "確認創建活動與發行票券"}
              </button>
            </div>
          </form>
        )}

      </main>
    </div>
  );
}