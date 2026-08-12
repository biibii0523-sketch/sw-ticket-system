// 檔案路徑: src/app/claim/page.tsx
"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, Mail, AlertTriangle, Loader2 } from "lucide-react";
import { eventConfig } from "@/config/event";
import { supabase } from "@/lib/supabase";

function ClaimGateway() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(true);
  const [expectedEmail, setExpectedEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError("無效的票券連結！請從主辦單位發送的官方信件/簡訊中點擊連結。");
        setIsLoading(false);
        return;
      }

      // 向資料庫查詢這張票是發給哪個 Email 的
      const { data, error } = await supabase
        .from('players')
        .select('email')
        .eq('magic_token', token)
        .single();

      if (error || !data) {
        setError("此魔法連結無效，或者您的票券已完成綁定。");
      } else {
        // 遮蔽 Email 保護隱私 (ex: sum********@gmail.com)
        const [name, domain] = data.email.split("@");
        const maskedEmail = name.length > 3 
          ? `${name.substring(0, 3)}********@${domain}`
          : `***@${domain}`;
        setExpectedEmail(maskedEmail);
        
        // 將 token 存入 localStorage，等 Google 登入跳轉回來後進行綁定
        localStorage.setItem('sw_magic_token', token);
      }
      setIsLoading(false);
    };

    verifyToken();
  }, [token]);

  const handleGoogleLogin = async () => {
    // 呼叫 Supabase 的 Google 登入，登入成功後自動跳回首頁 (/)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin mb-4" />
        <p className="text-slate-400 font-mono tracking-widest animate-pulse">正在驗證魔法陣...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 relative z-10">
      <div className="w-full max-w-md glass-card rounded-3xl p-8 relative overflow-hidden epic-glow animate-in zoom-in-95 duration-500 bg-slate-900/80 border-slate-700">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50" />
        
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 border border-white/5 shadow-inner">
            <ShieldCheck className="w-8 h-8 text-yellow-400" />
          </div>
          
          <h1 className="text-2xl font-extrabold text-white mb-2">數位票券認證</h1>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            為了保障您的權益，票券採實名綁定。<br/>請使用報名時登記的 Google 帳號進行綁定。
          </p>

          {error ? (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3 w-full">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-rose-400 text-sm text-left">{error}</p>
            </div>
          ) : (
            <>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 w-full mb-8 flex items-center justify-center gap-3">
                <Mail className="w-5 h-5 text-slate-500" />
                <span className="text-slate-300 font-mono text-sm">{expectedEmail}</span>
              </div>

              <button onClick={handleGoogleLogin} className="w-full relative group overflow-hidden rounded-xl p-[1px]">
                <span className="absolute inset-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative bg-slate-950 px-4 py-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 group-hover:bg-slate-900 group-active:scale-[0.98]">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="font-bold text-white tracking-wide">Google 帳號登入與綁定</span>
                </div>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClaimPage() {
  return (
    <div className="min-h-screen pt-12 pb-12 bg-slate-950 flex flex-col items-center">
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950" />
      <header className="text-center mb-8 relative z-10">
        <h2 className="text-xl font-bold bg-gradient-to-r from-yellow-300 to-yellow-500 text-transparent bg-clip-text drop-shadow-md">
          {eventConfig.title}
        </h2>
      </header>
      <Suspense fallback={<Loader2 className="w-8 h-8 text-yellow-500 animate-spin mt-20" />}>
        <ClaimGateway />
      </Suspense>
    </div>
  );
}