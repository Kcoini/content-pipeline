import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { auditPublishingFeatureFlags } from "./feature-flag-safety-auditor";

const ENV_KEYS = [
  "PLATFORM_API_PUBLISHING_ENABLED",
  "PLATFORM_API_DRY_RUN_ONLY",
  "X_API_PUBLISH_ENABLED",
  "THREADS_API_PUBLISH_ENABLED",
  "INSTAGRAM_API_PUBLISH_ENABLED",
  "NAVER_BLOG_API_PUBLISH_ENABLED",
  "NAVER_CAFE_API_PUBLISH_ENABLED",
  "WORDPRESS_API_PUBLISH_ENABLED",
  "SOCIAL_PUBLISH_ENABLED",
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

describe("auditPublishingFeatureFlags", () => {
  it("flag가 설정되지 않은 경우 모두 safe로 판단한다", () => {
    const result = auditPublishingFeatureFlags();
    for (const item of result) {
      expect(item.status).toBe("safe");
      expect(item.severity).toBe("info");
    }
  });

  it("실제 게시 flag가 true면 critical 경고를 반환한다", () => {
    process.env.PLATFORM_API_PUBLISHING_ENABLED = "true";
    const result = auditPublishingFeatureFlags();
    const flag = result.find((f) => f.flagName === "PLATFORM_API_PUBLISHING_ENABLED");
    expect(flag?.status).toBe("critical");
    expect(flag?.severity).toBe("critical");
  });

  it("dry-run 전용 flag가 false면 critical 경고를 반환한다", () => {
    process.env.PLATFORM_API_DRY_RUN_ONLY = "false";
    const result = auditPublishingFeatureFlags();
    const flag = result.find((f) => f.flagName === "PLATFORM_API_DRY_RUN_ONLY");
    expect(flag?.status).toBe("critical");
  });

  it("결과에 환경변수 값 자체는 포함되지 않는다", () => {
    process.env.WORDPRESS_API_PUBLISH_ENABLED = "true";
    const result = auditPublishingFeatureFlags();
    const serialized = JSON.stringify(result);
    // configured/status/severity/message만 있어야 하며 실제 "true" 문자열 값 자체가
    // 필드로 노출되지 않는지(문구 설명에는 flag 이름만 등장) 확인한다.
    expect(result.every((f) => typeof f.configured === "boolean")).toBe(true);
    expect(serialized).not.toContain("process.env");
  });
});
