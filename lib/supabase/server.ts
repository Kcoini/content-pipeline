// 서버 전용 Supabase 클라이언트.
// SUPABASE_SECRET_KEY는 NEXT_PUBLIC_* 접두사가 없으므로 브라우저 번들에 포함되지 않는다.
// Server Component / Server Action / Route Handler에서만 import한다.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function createServerSupabaseClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Supabase 서버 클라이언트를 생성하려면 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY 환경 변수가 필요합니다."
    );
  }

  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false },
  });
}
