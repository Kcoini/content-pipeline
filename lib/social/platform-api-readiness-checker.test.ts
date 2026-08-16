import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkPlatformApiReadiness } from "./platform-api-readiness-checker";

const ENV_KEYS = [
  "PLATFORM_API_PUBLISHING_ENABLED",
  "PLATFORM_API_DRY_RUN_ONLY",
  "WORDPRESS_API_PUBLISH_ENABLED",
  "WORDPRESS_BASE_URL",
  "WORDPRESS_USERNAME",
  "WORDPRESS_APP_PASSWORD",
  "X_API_PUBLISH_ENABLED",
  "X_API_BEARER_TOKEN",
] as const;

let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  originalEnv = {};
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

describe("checkPlatformApiReadiness", () => {
  it("feature flag가 비활성화되어 있으면 status가 disabled다", () => {
    const result = checkPlatformApiReadiness("wordpress_blog");
    expect(result.status).toBe("disabled");
    expect(result.publishEnabled).toBe(false);
  });

  it("공통 flag만 켜져 있고 platform flag가 꺼져 있으면 여전히 disabled다", () => {
    process.env.PLATFORM_API_PUBLISHING_ENABLED = "true";
    const result = checkPlatformApiReadiness("wordpress_blog");
    expect(result.status).toBe("disabled");
  });

  it("flag가 켜져 있어도 필요한 환경변수가 없으면 missing_config다", () => {
    process.env.PLATFORM_API_PUBLISHING_ENABLED = "true";
    process.env.WORDPRESS_API_PUBLISH_ENABLED = "true";
    const result = checkPlatformApiReadiness("wordpress_blog");
    expect(result.status).toBe("missing_config");
    expect(result.missingEnvVars).toContain("WORDPRESS_BASE_URL");
  });

  it("flag가 켜져 있고 환경변수가 모두 있으면(OAuth 불필요 platform) dry_run_ready다 — dry-run only가 기본값이므로", () => {
    process.env.PLATFORM_API_PUBLISHING_ENABLED = "true";
    process.env.WORDPRESS_API_PUBLISH_ENABLED = "true";
    process.env.WORDPRESS_BASE_URL = "https://example.com";
    process.env.WORDPRESS_USERNAME = "user";
    process.env.WORDPRESS_APP_PASSWORD = "pass";
    const result = checkPlatformApiReadiness("wordpress_blog");
    expect(result.status).toBe("dry_run_ready");
    expect(result.dryRunOnly).toBe(true);
  });

  it("PLATFORM_API_DRY_RUN_ONLY=false이면 actual publish 조건에서 dry-run 제한이 풀린다(ready_for_future_test)", () => {
    process.env.PLATFORM_API_PUBLISHING_ENABLED = "true";
    process.env.WORDPRESS_API_PUBLISH_ENABLED = "true";
    process.env.WORDPRESS_BASE_URL = "https://example.com";
    process.env.WORDPRESS_USERNAME = "user";
    process.env.WORDPRESS_APP_PASSWORD = "pass";
    process.env.PLATFORM_API_DRY_RUN_ONLY = "false";
    const result = checkPlatformApiReadiness("wordpress_blog");
    expect(result.status).toBe("ready_for_future_test");
    expect(result.dryRunOnly).toBe(false);
  });

  it("OAuth가 필요한 platform(x)은 flag/env가 모두 준비돼도 blocked다", () => {
    process.env.PLATFORM_API_PUBLISHING_ENABLED = "true";
    process.env.X_API_PUBLISH_ENABLED = "true";
    process.env.X_API_BEARER_TOKEN = "token-value";
    const result = checkPlatformApiReadiness("x");
    expect(result.status).toBe("blocked");
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it("환경변수 '값' 자체가 결과 어디에도 포함되지 않는다", () => {
    process.env.PLATFORM_API_PUBLISHING_ENABLED = "true";
    process.env.WORDPRESS_API_PUBLISH_ENABLED = "true";
    process.env.WORDPRESS_BASE_URL = "https://secret-site.example.com";
    process.env.WORDPRESS_USERNAME = "super-secret-user";
    process.env.WORDPRESS_APP_PASSWORD = "super-secret-password-value";

    const result = checkPlatformApiReadiness("wordpress_blog");
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("secret-site.example.com");
    expect(serialized).not.toContain("super-secret-user");
    expect(serialized).not.toContain("super-secret-password-value");
  });
});
