// 브라우저(Client Component)에서 사용하는 Supabase 클라이언트.
// publishable key는 공개되어도 안전한 키이므로 NEXT_PUBLIC_* 환경 변수를 사용한다.
// SUPABASE_SECRET_KEY는 절대 이 파일에서 사용하지 않는다.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function createBrowserSupabaseClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase 브라우저 클라이언트를 생성하려면 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 환경 변수가 필요합니다."
    );
  }

  return createClient<Database>(url, publishableKey);
}
