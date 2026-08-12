// 檔案路徑: src/app/admin/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, BarChart3, RefreshCcw, LogOut, Activity, 
  PlusCircle, Image as ImageIcon, Trash2, Save, Calendar, Ticket, CheckCircle2, Loader2, Send,
  ArrowUp, ArrowDown // ⭐️ 引入上下箭頭
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface TicketStat {
  id: string; title: string; type: string;
  totalCapacity: number; issuedCount: number; redeemedCount: number; sortOrder: number;
}

interface EventData {
  id: string; name: string; event_date: string; image_url: string;
  ticketStats: TicketStat[];
}

interface NewTicket {
  title: string; type: "admission" | "food" | "game" | "gift" | "photo"; quantity: number;
}

const TEST_PLAYER_ID = '33333333-3333-3333-3333-333333333333';

export default function AdminDashboardPage() {
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [loginError, setLoginError] = useState(false);
  
  const [activeTab, setActiveTab] = useState<"dashboard" | "create">("dashboard");
  const [isLoading, setIsLoading] = useState(true);
  
  const [eventsData, setEventsData] = useState<EventData[]>([]);
  const [lastUpdated, setLastUpdated] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [visualFile, setVisualFile] = useState<File | null>(null);
  const [newTickets, setNewTickets] = useState<NewTicket[]>([
    { title: "派對入場卷", type: "admission", quantity: 500 }
  ]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin === "admin123") {
      setIsAdminAuth(true); setLoginError(false);
    } else {
      setLoginError(true); setAdminPin("");
    }
  };

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select(`
          id, name, event_date, image_url,
          ticket_templates ( id, title, ticket_type, total_quantity, sort_order, player_tickets ( id, is_redeemed ) )
        `)
        .order('event_date', { ascending: false });

      if (error) throw error;

      const formattedEvents: EventData[] = (data || []).map((ev: any) => {
        let stats: TicketStat[] = (ev.ticket_templates || []).map((template: any) => {
          const issued = template.player_tickets ? template.player_tickets.length : 0;
          const redeemed = template.player_tickets ? template.player_tickets.filter((t: any) => t.is_redeemed).length : 0;
          return {
            id: template.id, title: template.title, type: template.ticket_type,
            totalCapacity: template.total_quantity, issuedCount: issued, redeemedCount: redeemed,
            sortOrder: template.sort_order || 0
          };
        });
        
        // 依據資料庫的 sortOrder 排序
        stats = stats.sort((a, b) => a.sortOrder - b.sortOrder);
        
        return { id: ev.id, name: ev.name, event_date: ev.event_date, image_url: ev.image_url, ticketStats: stats };
      });

      setEventsData(formattedEvents);
      setLastUpdated(new Date().toLocaleTimeString('zh-TW', { hour12: false }));
    } catch (err) {
      console.error("無法獲取數據", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminAuth && activeTab === "dashboard") fetchDashboardData();
  }, [isAdminAuth, activeTab]);

  const handleDeleteEvent = async (eventId: string, eventName: string) => {
    const confirmDelete = window.confirm(`⚠️ 危險操作 ⚠️\n\n確定要永久刪除「${eventName}」嗎？此操作無法復原！`);
    if (!confirmDelete) return;
    try {
      setIsLoading(true);
      const { error } = await supabase.from('events').delete().eq('id', eventId);
      if (error) throw new Error(error.message);
      alert(`活動「${eventName}」已徹底刪除。`);
      fetchDashboardData();
    } catch (err: any) {
      alert(`刪除失敗：${err.message}`);
      setIsLoading(false);
    }
  };

  // ⭐️ 核心新增功能：調整票券排序
  const handleMoveTicketOrder = async (eventId: string, index: number, direction: 'up' | 'down') => {
    const event = eventsData.find(e => e.id === eventId);
    if (!event) return;
    
    const newStats = [...event.ticketStats];

    // 陣列元素位置對調
    if (direction === 'up' && index > 0) {
      [newStats[index], newStats[index - 1]] = [newStats[index - 1], newStats[index]];
    } else if (direction === 'down' && index < newStats.length - 1) {
      [newStats[index], newStats[index + 1]] = [newStats[index + 1], newStats[index]];
    } else {
      return;
    }

    try {
      setIsLoading(true);
      // 將對調後的新順序 (Index) 批量寫回資料庫
      const promises = newStats.map((stat, i) =>
        supabase.from('ticket_templates').update({ sort_order: i }).eq('id', stat.id)
      );
      await Promise.all(promises);
      
      fetchDashboardData(); // 重整畫面
    } catch (err) {
      console.error("排序更新失敗", err);
      alert("排序更新失敗，請稍後再試");
      setIsLoading(false);
    }
  };

  const handleAirdropToTestPlayer = async (eventId: string, eventName: string) => {
    try {
      setIsLoading(true);
      const { data: templates, error: fetchError } = await supabase.from('ticket_templates').select('id').eq('event_id', eventId);
      if (fetchError || !templates) throw new Error("無法獲取該活動的票券模板");

      const ticketsToIssue = templates.map(t => ({ player_id: TEST_PLAYER_ID, ticket_template_id: t.id, is_redeemed: false }));
      const { error: insertError } = await supabase.from('player_tickets').insert(ticketsToIssue);
      
      if (insertError) {
        if (insertError.code === '23505') throw new Error("這名玩家已經領取過這場活動的票券了，無法重複派發！");
        throw new Error(insertError.message);
      }
      alert(`🎉 成功將「${eventName}」的票券派發給測試玩家！`);
      fetchDashboardData();
    } catch (err: any) {
      alert(`派發失敗：${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTicket = () => setNewTickets([...newTickets, { title: "", type: "game", quantity: 50 }]);
  const handleRemoveTicket = (index: number) => {
    if (newTickets.length > 1) setNewTickets(newTickets.filter((_, i) => i !== index));
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
    for (const t of newTickets) if (!t.title || t.quantity <= 0) return alert("請確認票券名稱與數量！");

    try {
      setIsSubmitting(true);
      const fileExt = visualFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('event-visuals').upload(fileName, visualFile);
      if (uploadError) throw new Error("圖片上傳失敗：" + uploadError.message);
      const { data: publicUrlData } = supabase.storage.from('event-visuals').getPublicUrl(fileName);
      
      const { data: eventData, error: eventError } = await supabase
        .from('events').insert([{ name: newEventName, event_date: newEventDate, image_url: publicUrlData.publicUrl, is_active: true }]).select('id').single();
      if (eventError || !eventData) throw new Error(`建立活動寫入失敗: ${eventError?.message}`);

      // ⭐️ 建立時，直接賦予 sort_order
      const templatesToInsert = newTickets.map((t, index) => ({ 
        event_id: eventData.id, 
        title: t.title, 
        ticket_type: t.type, 
        total_quantity: t.quantity,
        sort_order: index 
      }));
      
      const { error: ticketsError } = await supabase.from('ticket_templates').insert(templatesToInsert);
      if (ticketsError) throw new Error(`建立票券模板失敗: ${ticketsError.message}`);

      alert("🎉 活動創建成功！請到「戰情室」點擊【派發】按鈕發送票券。");
      setNewEventName(""); setNewEventDate(""); setVisualFile(null);
      setNewTickets([{ title: "派對入場卷", type: "admission", quantity: 500 }]);
      setActiveTab("dashboard");
    } catch (err: any) {
      alert(err.message || "發生未知錯誤");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdminAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-slate-950">
        <div className="z-10 w-full max-w-sm glass-card p-8 rounded-3xl flex flex-col items-center border border-slate-800 shadow-2xl epic-glow">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 border border-rose-900/50 shadow-inner"><ShieldAlert className="w-8 h-8 text-rose-500" /></div>
          <h1 className="text-2xl font-bold text-white mb-2">COMMAND CENTER</h1>
          <form onSubmit={handleAdminLogin} className="w-full flex flex-col gap-4 mt-6">
            <input type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)} className="w-full bg-slate-950/50 border-2 rounded-xl py-4 text-center text-xl text-white focus:outline-none border-slate-700" placeholder="ENTER SECURE KEY" />
            <button type="submit" className="w-full py-4 mt-2 rounded-xl font-bold text-white bg-gradient-to-r from-rose-600 to-rose-800 hover:to-rose-700 active:scale-95 shadow-[0_0_15px_rgba(225,29,72,0.4)]">授權進入</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-rose-500/30">
      <nav className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 md:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2"><ShieldAlert className="w-6 h-6 text-rose-500" /><h1 className="text-xl font-black text-white">ADMIN HUD</h1></div>
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 hidden md:flex">
          <button onClick={() => setActiveTab("dashboard")} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm ${activeTab === "dashboard" ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}><Activity className="w-4 h-4" /> 即時戰情室</button>
          <button onClick={() => setActiveTab("create")} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm ${activeTab === "create" ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><PlusCircle className="w-4 h-4" /> 建立新活動</button>
        </div>
        <button onClick={() => setIsAdminAuth(false)} className="flex items-center gap-2 text-rose-400 font-bold"><LogOut className="w-4 h-4" /> 登出</button>
      </nav>

      <div className="md:hidden flex justify-center gap-2 mt-4 px-4">
          <button onClick={() => setActiveTab("dashboard")} className={`flex-1 py-3 rounded-lg font-bold text-sm ${activeTab === "dashboard" ? 'bg-rose-600 text-white' : 'bg-slate-900 text-slate-400'}`}>戰情室</button>
          <button onClick={() => setActiveTab("create")} className={`flex-1 py-3 rounded-lg font-bold text-sm ${activeTab === "create" ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>新活動</button>
      </div>

      <main className="p-4 md:p-8 max-w-6xl mx-auto">
        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-end">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2"><BarChart3 className="w-6 h-6 text-rose-500" /> 活動兌換統計</h2>
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm hidden md:inline">更新於: {lastUpdated}</span>
                <button onClick={fetchDashboardData} className={`p-2 bg-slate-800 rounded-lg hover:bg-slate-700 ${isLoading ? 'animate-spin text-yellow-400' : 'text-slate-300'}`}><RefreshCcw className="w-4 h-4" /></button>
              </div>
            </div>

            {eventsData.length === 0 && !isLoading && <div className="text-center py-20 text-slate-500 border border-slate-800 border-dashed rounded-2xl">目前沒有資料，請建立新活動</div>}

            {eventsData.map((ev) => (
              <div key={ev.id} className="glass-card rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative">
                
                <div className="absolute top-4 right-4 z-30 flex gap-2">
                  <button onClick={() => handleAirdropToTestPlayer(ev.id, ev.name)} className="p-2 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-xl shadow-lg border border-indigo-400/50 flex gap-2"><Send className="w-5 h-5" /><span className="text-sm font-bold hidden md:inline">派發票券</span></button>
                  <button onClick={() => handleDeleteEvent(ev.id, ev.name)} className="p-2 bg-rose-600/90 hover:bg-rose-500 text-white rounded-xl shadow-lg border border-rose-400/50 flex gap-2"><Trash2 className="w-5 h-5" /></button>
                </div>

                {ev.image_url && (
                  <div className="w-full h-48 relative border-b border-slate-800">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent z-10" />
                    <img src={ev.image_url} alt={ev.name} className="w-full h-full object-cover object-center opacity-70" />
                  </div>
                )}
                
                <div className={`p-6 ${ev.image_url ? '-mt-16 relative z-20' : ''}`}>
                  <h3 className="text-3xl font-extrabold text-white mb-2 drop-shadow-lg pr-32">{ev.name}</h3>
                  <p className="text-emerald-400 font-mono text-sm mb-6 flex items-center gap-2"><Calendar className="w-4 h-4" /> {ev.event_date}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ev.ticketStats.map((stat, index) => {
                      const redeemRate = stat.issuedCount > 0 ? Math.round((stat.redeemedCount / stat.issuedCount) * 100) : 0;
                      return (
                        <div key={stat.id} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 relative group">
                          
                          {/* ⭐️ 排序調整按鈕 */}
                          <div className="absolute top-4 right-4 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleMoveTicketOrder(ev.id, index, 'up')} disabled={index === 0} className="p-1 text-slate-400 hover:text-yellow-400 disabled:opacity-20"><ArrowUp className="w-4 h-4"/></button>
                            <button onClick={() => handleMoveTicketOrder(ev.id, index, 'down')} disabled={index === ev.ticketStats.length - 1} className="p-1 text-slate-400 hover:text-yellow-400 disabled:opacity-20"><ArrowDown className="w-4 h-4"/></button>
                          </div>

                          <div className="flex justify-between items-start mb-2 pr-8">
                            <span className="text-white font-bold">{stat.title}</span>
                          </div>
                          
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-[10px] text-slate-400 bg-slate-900 px-2 rounded border border-slate-700">{stat.type}</span>
                             <div className="flex items-end gap-2"><span className="text-3xl font-black text-white">{stat.redeemedCount}</span><span className="text-slate-500 text-sm mb-1">/ {stat.issuedCount}</span></div>
                          </div>
                          
                          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                            <div className={`h-full bg-gradient-to-r ${redeemRate > 80 ? 'from-orange-500 to-rose-500' : 'from-indigo-500 to-blue-400'} transition-all`} style={{ width: `${redeemRate}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "create" && (
           <form onSubmit={handleSubmitEvent} className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="glass-card p-6 md:p-8 rounded-3xl border border-slate-800">
             <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Calendar className="w-6 h-6 text-indigo-400" /> 1. 活動資訊</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
               <div><label className="block text-sm font-bold text-slate-400 mb-2">活動標題</label><input type="text" required value={newEventName} onChange={e => setNewEventName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none" /></div>
               <div><label className="block text-sm font-bold text-slate-400 mb-2">活動日期</label><input type="date" required value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none [color-scheme:dark]" /></div>
             </div>
             <div>
               <label className="block text-sm font-bold text-slate-400 mb-2">主視覺上傳 (比例 21:9，如 1024x440)</label>
               <div className="border-2 border-dashed border-slate-700 bg-slate-950/50 rounded-2xl p-8 flex flex-col items-center justify-center relative cursor-pointer" onClick={() => document.getElementById('visual-upload')?.click()}>
                 <input id="visual-upload" type="file" accept="image/*" className="hidden" onChange={(e) => setVisualFile(e.target.files?.[0] || null)} />
                 {visualFile ? <div className="text-emerald-400 font-bold flex gap-2"><CheckCircle2/> {visualFile.name}</div> : <><ImageIcon className="w-12 h-12 text-slate-500 mb-3" /><p className="text-slate-300 font-bold">點擊上傳圖片</p></>}
               </div>
             </div>
           </div>

           <div className="glass-card p-6 md:p-8 rounded-3xl border border-slate-800">
             <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-bold text-white flex gap-2"><Ticket className="w-6 h-6 text-yellow-500" /> 2. 票券設定 (建立時的順序即為顯示順序)</h2>
               <button type="button" onClick={handleAddTicket} className="text-sm font-bold text-yellow-400 flex gap-1 border border-yellow-500/30 px-3 py-1.5 rounded-lg bg-yellow-500/10"><PlusCircle className="w-4 h-4" /> 新增種類</button>
             </div>
             <div className="space-y-4">
               {newTickets.map((ticket, index) => (
                 <div key={index} className="flex flex-col md:flex-row gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                   <div className="w-full md:w-5/12"><label className="block text-xs text-slate-500 mb-1">票券名稱</label><input type="text" required value={ticket.title} onChange={e => handleTicketChange(index, 'title', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none" /></div>
                   <div className="w-full md:w-3/12"><label className="block text-xs text-slate-500 mb-1">種類</label><select value={ticket.type} onChange={e => handleTicketChange(index, 'type', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none"><option value="admission">入場 (Admission)</option><option value="food">餐飲 (Food)</option><option value="game">遊戲 (Game)</option><option value="photo">拍照 (Photo)</option><option value="gift">贈品 (Gift)</option></select></div>
                   <div className="w-full md:w-3/12"><label className="block text-xs text-slate-500 mb-1">發行數量</label><input type="number" required min="1" value={ticket.quantity} onChange={e => handleTicketChange(index, 'quantity', parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none" /></div>
                   <div className="w-full md:w-1/12 flex justify-end md:justify-center md:pt-5"><button type="button" onClick={() => handleRemoveTicket(index)} disabled={newTickets.length === 1} className="p-2 text-slate-500 hover:text-rose-500 disabled:opacity-30"><Trash2 className="w-5 h-5" /></button></div>
                 </div>
               ))}
             </div>
           </div>

           <div className="flex justify-end">
             <button type="submit" disabled={isSubmitting} className="flex gap-2 px-8 py-4 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-bold rounded-xl active:scale-95 disabled:opacity-50">
               {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} {isSubmitting ? "正在建立..." : "確認創建活動與發行票券"}
             </button>
           </div>
         </form>
        )}
      </main>
    </div>
  );
}