import { describe, expect, it } from "vitest";
import { PLATFORM_WRITING_CONFIGS } from "./platform-writing-config";
import { TONE_STYLE_CONFIGS, PROHIBITED_TONE_STYLES } from "./tone-style-config";
import { SOCIAL_PLATFORMS, TONE_STYLES, isSocialPlatform, isToneStyle } from "./social-platform-types";

describe("platform writing config", () => {
  it("모든 플랫폼이 allowAutoPublish=false다 (자동 게시 금지)", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(PLATFORM_WRITING_CONFIGS[platform].allowAutoPublish).toBe(false);
    }
  });

  it("모든 플랫폼이 requiresHumanApproval=true다 (사람 승인 필수)", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(PLATFORM_WRITING_CONFIGS[platform].requiresHumanApproval).toBe(true);
    }
  });

  it("정의된 6개 플랫폼 config가 모두 존재한다", () => {
    expect(Object.keys(PLATFORM_WRITING_CONFIGS).sort()).toEqual([...SOCIAL_PLATFORMS].sort());
  });

  it("isSocialPlatform이 허용되지 않은 값을 거부한다", () => {
    expect(isSocialPlatform("facebook")).toBe(false);
    expect(isSocialPlatform("wordpress_blog")).toBe(true);
  });
});

describe("tone style config", () => {
  it("정의된 8개 문체 config가 모두 존재한다", () => {
    expect(Object.keys(TONE_STYLE_CONFIGS).sort()).toEqual([...TONE_STYLES].sort());
  });

  it("협박형(threat) 문체는 지원 목록에 없다", () => {
    expect(TONE_STYLES).not.toContain("threat");
    expect(isToneStyle("threat")).toBe(false);
  });

  it("금지 문체 목록에 threat/fearmongering/harassment가 포함된다", () => {
    expect(PROHIBITED_TONE_STYLES).toContain("threat");
    expect(PROHIBITED_TONE_STYLES).toContain("fearmongering");
    expect(PROHIBITED_TONE_STYLES).toContain("harassment");
  });

  it("warning/loss_aversion에도 공통 금지 표현이 포함된다", () => {
    expect(TONE_STYLE_CONFIGS.warning.prohibitedPatterns.length).toBeGreaterThan(0);
    expect(TONE_STYLE_CONFIGS.loss_aversion.prohibitedPatterns.length).toBeGreaterThan(0);
  });
});
