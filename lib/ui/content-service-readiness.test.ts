import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getContentServiceReadiness } from "./content-service-readiness";

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "AI_GENERATION_ENABLED",
  "ANTHROPIC_API_KEY",
  "WORDPRESS_PUBLISH_ENABLED",
  "WORDPRESS_BASE_URL",
  "WORDPRESS_USERNAME",
  "WORDPRESS_APP_PASSWORD",
  "TREND_COLLECTION_ENABLED",
  "NAVER_CLIENT_ID",
  "NAVER_CLIENT_SECRET",
  "KAKAO_REST_API_KEY",
] as const;

const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function setBaseValidSupabase() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
  process.env.SUPABASE_SECRET_KEY = "secret-key-value";
}

describe("getContentServiceReadiness — WordPress", () => {
  it("WORDPRESS_PUBLISH_ENABLED=true + 필수 env 설정됨이면 '연결됨'이다", () => {
    setBaseValidSupabase();
    process.env.WORDPRESS_PUBLISH_ENABLED = "true";
    process.env.WORDPRESS_BASE_URL = "https://example.com";
    process.env.WORDPRESS_USERNAME = "admin";
    process.env.WORDPRESS_APP_PASSWORD = "app-password";

    const readiness = getContentServiceReadiness();
    expect(readiness.wordpressAvailable.status).toBe("available");
    expect(readiness.wordpressAvailable.message).toBe("연결됨");
  });

  it("WORDPRESS_PUBLISH_ENABLED=true인데 필수 env가 없으면 'needs_attention'(연결 안 됨으로 단정하지 않되, 사용 가능이라고도 하지 않는다)", () => {
    setBaseValidSupabase();
    process.env.WORDPRESS_PUBLISH_ENABLED = "true";
    // BASE_URL/USERNAME/APP_PASSWORD 미설정

    const readiness = getContentServiceReadiness();
    expect(readiness.wordpressAvailable.status).toBe("needs_attention");
    expect(readiness.wordpressAvailable.message).toContain("확인해 주세요");
  });

  it("사용자에게 보이는 문구에 env var 이름/raw 값이 전혀 포함되지 않는다", () => {
    setBaseValidSupabase();
    const readiness = getContentServiceReadiness();
    const allText = JSON.stringify(readiness);
    expect(allText).not.toContain("WORDPRESS_BASE_URL");
    expect(allText).not.toContain("WORDPRESS_PUBLISH_ENABLED");
    expect(allText).not.toContain("ANTHROPIC_API_KEY");
    expect(allText).not.toContain("SUPABASE");
    expect(allText).not.toContain("provider");
  });
});

describe("getContentServiceReadiness — 콘텐츠 생성(Anthropic)", () => {
  it("AI_GENERATION_ENABLED=true + ANTHROPIC_API_KEY 설정되면 '사용 가능'이다", () => {
    setBaseValidSupabase();
    process.env.AI_GENERATION_ENABLED = "true";
    process.env.ANTHROPIC_API_KEY = "sk-test-key";

    const readiness = getContentServiceReadiness();
    expect(readiness.canCreateContent.status).toBe("available");
    expect(readiness.canCreateContent.message).toBe("사용 가능");
  });

  it("AI_GENERATION_ENABLED=true인데 API key가 없으면 확인이 필요하다고 안내한다(실패를 숨기지 않는다)", () => {
    setBaseValidSupabase();
    process.env.AI_GENERATION_ENABLED = "true";

    const readiness = getContentServiceReadiness();
    expect(readiness.canCreateContent.status).toBe("needs_attention");
    expect(readiness.canCreateContent.message).toContain("관리자에게 문의");
  });
});

describe("getContentServiceReadiness — 안전 관련 값은 설정으로 변경 불가", () => {
  it("requiresHumanApproval은 항상 true다(toggle 없음)", () => {
    setBaseValidSupabase();
    const readiness = getContentServiceReadiness();
    expect(readiness.requiresHumanApproval).toBe(true);
  });
});
