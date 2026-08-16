import { describe, expect, it } from "vitest";
import { getPlatformApiCapability, listPlatformApiCapabilities, getPlatformApiModeLabel } from "./platform-api-capabilities";

describe("getPlatformApiCapability", () => {
  it("wordpress_blog capability를 반환한다", () => {
    const capability = getPlatformApiCapability("wordpress_blog");
    expect(capability.platform).toBe("wordpress_blog");
    expect(capability.supportsApiPublishing).toBe(true);
    expect(capability.supportsDryRun).toBe(true);
    expect(capability.currentMode).toBe("draft_or_manual_existing");
    expect(capability.publishEnabledFlagName).toBe("WORDPRESS_API_PUBLISH_ENABLED");
  });

  it("naver_blog는 manual fallback(currentMode='manual_export')을 반환한다", () => {
    const capability = getPlatformApiCapability("naver_blog");
    expect(capability.supportsApiPublishing).toBe(false);
    expect(capability.supportsDryRun).toBe(true);
    expect(capability.currentMode).toBe("manual_export");
  });

  it("naver_cafe는 manual fallback(currentMode='manual_export')을 반환한다", () => {
    const capability = getPlatformApiCapability("naver_cafe");
    expect(capability.supportsApiPublishing).toBe(false);
    expect(capability.supportsDryRun).toBe(true);
    expect(capability.currentMode).toBe("manual_export");
  });

  it("x는 preparation_only capability를 반환한다", () => {
    const capability = getPlatformApiCapability("x");
    expect(capability.supportsApiPublishing).toBe(true);
    expect(capability.currentMode).toBe("preparation_only");
    expect(capability.requiresOAuth).toBe(true);
  });

  it("threads는 preparation_only capability를 반환한다", () => {
    const capability = getPlatformApiCapability("threads");
    expect(capability.supportsApiPublishing).toBe(true);
    expect(capability.currentMode).toBe("preparation_only");
    expect(capability.requiresOAuth).toBe(true);
  });

  it("instagram은 preparation_only capability를 반환한다 (media upload 지원)", () => {
    const capability = getPlatformApiCapability("instagram");
    expect(capability.supportsApiPublishing).toBe(true);
    expect(capability.supportsMediaUpload).toBe(true);
    expect(capability.currentMode).toBe("preparation_only");
  });

  it("모든 플랫폼이 dry-run을 지원한다", () => {
    for (const capability of listPlatformApiCapabilities()) {
      expect(capability.supportsDryRun).toBe(true);
    }
  });
});

describe("getPlatformApiModeLabel", () => {
  it("각 mode에 한글 라벨을 반환한다", () => {
    expect(getPlatformApiModeLabel("draft_or_manual_existing")).toContain("준비 가능");
    expect(getPlatformApiModeLabel("manual_export")).toContain("수동 export");
    expect(getPlatformApiModeLabel("preparation_only")).toContain("비활성화");
  });
});
