import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { runProductionPreflight } from "./production-preflight";

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
  "PLATFORM_API_PUBLISHING_ENABLED",
  "PLATFORM_API_DRY_RUN_ONLY",
  "X_API_PUBLISH_ENABLED",
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

describe("runProductionPreflight — required env", () => {
  it("Supabase 필수 변수가 없으면 fail이다", () => {
    const result = runProductionPreflight();
    const supabase = result.checks.find((c) => c.name === "Supabase");
    expect(supabase?.status).toBe("fail");
    expect(result.overall).toBe("fail");
  });

  it("Supabase 필수 변수가 모두 있으면 pass다", () => {
    setBaseValidSupabase();
    const result = runProductionPreflight();
    expect(result.checks.find((c) => c.name === "Supabase")?.status).toBe("pass");
  });

  it("AI_GENERATION_ENABLED=true인데 ANTHROPIC_API_KEY가 없으면 fail이다", () => {
    setBaseValidSupabase();
    process.env.AI_GENERATION_ENABLED = "true";
    const result = runProductionPreflight();
    expect(result.checks.find((c) => c.name === "Anthropic")?.status).toBe("fail");
  });

  it("AI_GENERATION_ENABLED=false면 ANTHROPIC_API_KEY가 없어도 pass다(선택 기능)", () => {
    setBaseValidSupabase();
    process.env.AI_GENERATION_ENABLED = "false";
    const result = runProductionPreflight();
    expect(result.checks.find((c) => c.name === "Anthropic")?.status).toBe("pass");
  });

  it("WORDPRESS_PUBLISH_ENABLED=true인데 WordPress 설정이 없으면 fail이다", () => {
    setBaseValidSupabase();
    process.env.WORDPRESS_PUBLISH_ENABLED = "true";
    const result = runProductionPreflight();
    expect(result.checks.find((c) => c.name === "WordPress Draft")?.status).toBe("fail");
  });

  it("WORDPRESS_PUBLISH_ENABLED=false면 WordPress 설정이 없어도 pass다(dry-run)", () => {
    setBaseValidSupabase();
    process.env.WORDPRESS_PUBLISH_ENABLED = "false";
    const result = runProductionPreflight();
    expect(result.checks.find((c) => c.name === "WordPress Draft")?.status).toBe("pass");
  });
});

describe("runProductionPreflight — optional env는 warning이지 fail이 아니다", () => {
  it("TREND_COLLECTION_ENABLED=true인데 Daum key만 없으면 warning이다(fail 아님)", () => {
    setBaseValidSupabase();
    process.env.TREND_COLLECTION_ENABLED = "true";
    process.env.NAVER_CLIENT_ID = "id";
    process.env.NAVER_CLIENT_SECRET = "secret";
    const result = runProductionPreflight();
    const check = result.checks.find((c) => c.name === "Search providers");
    expect(check?.status).toBe("warning");
    expect(result.overall).not.toBe("fail");
  });

  it("TREND_COLLECTION_ENABLED=true인데 Naver/Daum 둘 다 없으면 fail이다", () => {
    setBaseValidSupabase();
    process.env.TREND_COLLECTION_ENABLED = "true";
    const result = runProductionPreflight();
    expect(result.checks.find((c) => c.name === "Search providers")?.status).toBe("fail");
  });
});

describe("runProductionPreflight — 위험 flag 감지", () => {
  it("PLATFORM_API_PUBLISHING_ENABLED=true면 overall이 fail이다", () => {
    setBaseValidSupabase();
    process.env.PLATFORM_API_PUBLISHING_ENABLED = "true";
    const result = runProductionPreflight();
    expect(result.checks.find((c) => c.name === "Mock mode / dangerous flags")?.status).toBe("fail");
    expect(result.overall).toBe("fail");
  });

  it("PLATFORM_API_DRY_RUN_ONLY=false면(dry-run 해제) fail이다", () => {
    setBaseValidSupabase();
    process.env.PLATFORM_API_DRY_RUN_ONLY = "false";
    const result = runProductionPreflight();
    expect(result.checks.find((c) => c.name === "Mock mode / dangerous flags")?.status).toBe("fail");
  });

  it("모든 flag가 안전값이면 pass다", () => {
    setBaseValidSupabase();
    const result = runProductionPreflight();
    expect(result.checks.find((c) => c.name === "Mock mode / dangerous flags")?.status).toBe("pass");
  });
});

describe("runProductionPreflight — secret 값 비노출", () => {
  it("실제 secret 같은 값을 env에 넣어도 결과 어디에도 그 값이 그대로 나타나지 않는다", () => {
    setBaseValidSupabase();
    const secretLookingValue = "sk-ant-api03-super-secret-do-not-leak-1234567890";
    process.env.ANTHROPIC_API_KEY = secretLookingValue;
    process.env.WORDPRESS_APP_PASSWORD = "xxxx xxxx xxxx xxxx xxxx xxxx";
    process.env.NAVER_CLIENT_SECRET = "naver-secret-value";
    process.env.AI_GENERATION_ENABLED = "true";
    process.env.WORDPRESS_PUBLISH_ENABLED = "true";
    process.env.WORDPRESS_BASE_URL = "https://example.com";
    process.env.WORDPRESS_USERNAME = "admin";

    const result = runProductionPreflight();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(secretLookingValue);
    expect(serialized).not.toContain("xxxx xxxx xxxx xxxx xxxx xxxx");
    expect(serialized).not.toContain("naver-secret-value");
    expect(serialized).not.toContain(process.env.SUPABASE_SECRET_KEY);
  });
});
