// 檔案路徑: src/app/admin/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, BarChart3, RefreshCcw, LogOut, Activity, 
  PlusCircle, Image as ImageIcon, Trash2, Save, Calendar, Ticket, CheckCircle2, Loader2,
  ArrowUp, ArrowDown, UserPlus, Link2, Copy, X
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

  // ⭐️ 新增：派發票券 Modal 的狀態管理
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueEventId, setIssueEventId] = useState<string | null>(null);
  const [issueEventName, setIssueEventName] = useState("");
  const [issueSummonerName, setIssueSummonerName] = useState("");
  const [issueEmail, setIssueEmail] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [issueStatusMsg, setIssueStatusMsg] = useState<{ type: 'success'|'warning', text: string } | null>(null);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin === "admin123") { setIsAdminAuth(true); setLoginError(false); } 
    else { setLoginError(true); setAdminPin(""); }
  };

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select(`id, name, event_date, image_url, ticket_templates ( id, title, ticket_type, total_quantity, sort_order, player_tickets ( id, is_redeemed ) )`)
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
        stats = stats.sort((a, b) => a.sortOrder - b.sortOrder);
        return { id: ev.id, name: ev.name, event_date: ev.event_date, image_url: ev.image_url, ticketStats: stats };
      });

      setEventsData(formattedEvents);
      setLastUpdated(new Date().toLocaleTimeString('zh-TW', { hour12: false }));
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  useEffect(() => { if (isAdminAuth && activeTab === "dashboard") fetchDashboardData(); }, [isAdminAuth, activeTab]);

  const handleDeleteEvent = async (eventId: string, eventName: string) => {
    if (!window.confirm(`⚠️ 確定要永久刪除「${eventName}」嗎？此操作無法復原！`)) return;
    try {
      setIsLoading(true);
      const { error } = await supabase.from('events').delete().eq('id', eventId);
      if (error) throw new Error(error.message);
      fetchDashboardData();
    } catch (err: any) { alert(`刪除失敗：${err.message}`); setIsLoading(false); }
  };

  const handleMoveTicketOrder = async (eventId: string, index: number, direction: 'up' | 'down') => {
    const event = eventsData.find(e => e.id === eventId);
    if (!event) return;
    const newStats = [...event.ticketStats];
    if (direction === 'up' && index > 0) [newStats[index], newStats[index - 1]] = [newStats[index - 1], newStats[index]];
    else if (direction === 'down' && index < newStats.length - 1) [newStats[index], newStats[index + 1]] = [newStats[index + 1], newStats[index]];
    else return;

    try {
      setIsLoading(true);
      const promises = newStats.map((stat, i) => supabase.from('ticket_templates').update({ sort_order: i }).eq('id', stat.id));
      await Promise.all(promises);
      fetchDashboardData();
    } catch (err) { alert("排序更新失敗"); setIsLoading(false); }
  };

  // ⭐️ 開啟派發 Modal
  const openIssueModal = (eventId: string, eventName: string) => {
    setIssueEventId(eventId); setIssueEventName(eventName);
    setIssueSummonerName(""); setIssueEmail("");
    setGeneratedLink(null); setIssueStatusMsg(null);
    setIssueModalOpen(true);
  };

  // ⭐️ 執行真實派發邏輯 (呼叫 RPC)
  const handleIssueTicketToPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueEmail.includes('@')) return alert('請輸入有效的 Email！');
    setIsLoading(true);
    
    try {
      const { data: magicToken, error } = await supabase.rpc('issue_event_tickets_to_player', {
        p_event_id: issueEventId, p_summoner_name: issueSummonerName, p_email: issueEmail
      });

      if (error) throw error;

      if (magicToken) {
        // 產生專屬魔法連結 (自動獲取目前網域)
        const link = `${window.location.origin}/claim?token=${magicToken}`;
        setGeneratedLink(link);
        setIssueStatusMsg({ type: 'success', text: '✅ 魔法連結產生成功！請複製連結並傳送給玩家。' });
      } else {
        // 已綁定玩家
        setGeneratedLink(null);
        setIssueStatusMsg({ type: 'warning', text: '⚡ 此玩家之前已綁定過 Google 帳號。票券已自動匯入他的數位票夾，不需要傳送連結！' });
      }
      
      fetchDashboardData(); // 背景更新儀表板數字
    } catch (err: any) {
      alert("派發失敗：" + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      alert("魔法連結已複製到剪貼簿！");
    }
  };

  const handleAddTicket = () => setNewTickets([...newTickets, { title: "", type: "game", quantity: 50 }]);
  const handleRemoveTicket = (index: number) => { if (newTickets.length > 1) setNewTickets(newTickets.filter((_, i) => i !== index)); };
  const handleTicketChange = (index: number, field: keyof NewTicket, value: string | number) => {
    const updated = [...newTickets]; updated[index] = { ...updated[index], [field]: value }; setNewTickets(updated);
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

      const templatesToInsert = newTickets.map((t, index) => ({ 
        event_id: eventData.id, title: t.title, ticket_type: t.type, total_quantity: t.quantity, sort_order: index 
      }));
      const { error: ticketsError } = await supabase.from('ticket_templates').insert(templatesToInsert);
      if (ticketsError) throw new Error(`建立票券模板失敗: ${ticketsError.message}`);

      alert("🎉 活動創建成功！請到「戰情室」點擊【派發】按鈕發送票券。");
      setNewEventName(""); setNewEventDate(""); setVisualFile(null);
      setNewTickets([{ title: "派對入場卷", type: "admission", quantity: 500 }]);
      setActiveTab("dashboard");
    } catch (err: any) { alert(err.message || "發生未知錯誤"); } finally { setIsSubmitting(false); }
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

      <main className="p-4 md:p-8 max-w-6xl mx-auto relative z-10">
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
                
                {/* ⭐️ 新版發送票券與刪除按鈕 */}
                <div className="absolute top-4 right-4 z-30 flex gap-2">
                  <button onClick={() => openIssueModal(ev.id, ev.name)} className="p-2 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-xl shadow-lg border border-indigo-400/50 flex gap-2 transition-all active:scale-95">
                    <UserPlus className="w-5 h-5" /><span className="text-sm font-bold hidden md:inline">發送票券 / 產生連結</span>
                  </button>
                  <button onClick={() => handleDeleteEvent(ev.id, ev.name)} className="p-2 bg-rose-600/90 hover:bg-rose-500 text-white rounded-xl shadow-lg border border-rose-400/50 flex gap-2 transition-all active:scale-95">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {ev.image_url && (
                  <div className="w-full h-48 relative border-b border-slate-800">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent z-10" />
                    <img src={ev.image_url} alt={ev.name} className="w-full h-full object-cover object-center opacity-70" />
                  </div>
                )}
                
                <div className={`p-6 ${ev.image_url ? '-mt-16 relative z-20' : ''}`}>
                  <h3 className="text-3xl font-extrabold text-white mb-2 drop-shadow-lg pr-48">{ev.name}</h3>
                  <p className="text-emerald-400 font-mono text-sm mb-6 flex items-center gap-2"><Calendar className="w-4 h-4" /> {ev.event_date}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ev.ticketStats.map((stat, index) => {
                      const redeemRate = stat.issuedCount > 0 ? Math.round((stat.redeemedCount / stat.issuedCount) * 100) : 0;
                      return (
                        <div key={stat.id} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 relative group">
                          <div className="absolute top-4 right-4 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleMoveTicketOrder(ev.id, index, 'up')} disabled={index === 0} className="p-1 text-slate-400 hover:text-yellow-400 disabled:opacity-20"><ArrowUp className="w-4 h-4"/></button>
                            <button onClick={() => handleMoveTicketOrder(ev.id, index, 'down')} disabled={index === ev.ticketStats.length - 1} className="p-1 text-slate-400 hover:text-yellow-400 disabled:opacity-20"><ArrowDown className="w-4 h-4"/></button>
                          </div>
                          <div className="flex justify-between items-start mb-2 pr-8"><span className="text-white font-bold">{stat.title}</span></div>
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

        {/* ================= 建立活動分頁 ================= */}
        {activeTab === "create" && (
           <form onSubmit={handleSubmitEvent} className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* ...保持不變的建立表單... */}
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

      {/* ⭐️ 派發與產生魔法連結專屬 Modal */}
      {issueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl p-8 shadow-2xl relative">
            <button onClick={() => setIssueModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"><X className="w-6 h-6" /></button>
            
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2 mb-1"><UserPlus className="w-6 h-6 text-indigo-400" /> 發送數位票券</h3>
              <p className="text-slate-400 text-sm">將【{issueEventName}】的專屬票券發送給新舊玩家</p>
            </div>

            <form onSubmit={handleIssueTicketToPlayer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 tracking-wider">玩家註冊信箱 (必填)</label>
                <input type="email" required value={issueEmail} onChange={e => setIssueEmail(e.target.value)} placeholder="player@gmail.com" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none" />
                <p className="text-[10px] text-slate-500 mt-1">請務必填寫玩家用來登入的真實 Google 信箱</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 tracking-wider">召喚師暱稱 (選填)</label>
                <input type="text" value={issueSummonerName} onChange={e => setIssueSummonerName(e.target.value)} placeholder="例如：光暗神之手" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none" />
              </div>

              {!generatedLink && !issueStatusMsg && (
                <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center gap-2 py-4 mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} 確認派發
                </button>
              )}
            </form>

            {/* 產生結果顯示區塊 */}
            {issueStatusMsg && (
              <div className={`mt-6 p-4 rounded-xl border ${issueStatusMsg.type === 'success' ? 'bg-indigo-950/50 border-indigo-500/50' : 'bg-emerald-950/50 border-emerald-500/50'}`}>
                <p className={`text-sm font-bold mb-4 ${issueStatusMsg.type === 'success' ? 'text-indigo-300' : 'text-emerald-300'}`}>{issueStatusMsg.text}</p>
                
                {generatedLink && (
                  <div className="flex flex-col gap-2">
                    <div className="bg-black/50 border border-slate-800 p-3 rounded-lg overflow-hidden relative group">
                      <p className="text-xs text-slate-400 font-mono break-all line-clamp-2">{generatedLink}</p>
                    </div>
                    <button onClick={handleCopyLink} className="flex justify-center items-center gap-2 w-full py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg font-bold transition-all active:scale-95 shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                      <Copy className="w-4 h-4" /> 點擊複製連結
                    </button>
                  </div>
                )}

                <button onClick={() => setIssueModalOpen(false)} className="w-full py-3 mt-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-all active:scale-95">完成並關閉</button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}