// 檔案路徑: src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 檢查環境變數是否設定，避免系統崩潰
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ 尚未設定 Supabase 環境變數，請確認 .env.local 檔案");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);