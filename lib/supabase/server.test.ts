import { afterEach, describe, expect, it, vi } from "vitest";
import { createServerSupabaseClient } from "./server";

describe("createServerSupabaseClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SECRET_KEY가 없으면 에러를 던진다", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");

    expect(() => createServerSupabaseClient()).toThrow(/SUPABASE_SECRET_KEY/);
  });

  it("필요한 환경 변수가 있으면 클라이언트를 생성한다", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret-key");

    expect(() => createServerSupabaseClient()).not.toThrow();
  });
});
