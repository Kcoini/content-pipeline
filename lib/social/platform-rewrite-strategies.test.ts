import { describe, expect, it } from "vitest";
import { getPlatformRewriteStrategy } from "./platform-rewrite-strategies";
import { SOCIAL_PLATFORMS } from "./social-platform-types";

describe("getPlatformRewriteStrategy", () => {
  it("모든 플랫폼에 대해 개선 영역을 반환한다", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const strategy = getPlatformRewriteStrategy(platform);
      expect(strategy.improvementAreas.length).toBeGreaterThan(0);
    }
  });

  it("naver_blog는 title/hook/hashtag 관련 개선을 포함한다", () => {
    const strategy = getPlatformRewriteStrategy("naver_blog");
    expect(strategy.improvementAreas.some((a) => a.includes("제목"))).toBe(true);
    expect(strategy.improvementAreas.some((a) => a.includes("태그"))).toBe(true);
  });

  it("naver_cafe는 질문/토론 유도 개선을 포함한다", () => {
    const strategy = getPlatformRewriteStrategy("naver_cafe");
    expect(strategy.improvementAreas.some((a) => a.includes("질문") || a.includes("토론"))).toBe(true);
  });

  it("x는 thread/hook 개선을 포함한다", () => {
    const strategy = getPlatformRewriteStrategy("x");
    expect(strategy.improvementAreas.some((a) => a.includes("hook"))).toBe(true);
    expect(strategy.improvementAreas.some((a) => a.includes("thread"))).toBe(true);
  });

  it("instagram은 caption/card_items 관련 개선을 포함한다", () => {
    const strategy = getPlatformRewriteStrategy("instagram");
    expect(strategy.improvementAreas.some((a) => a.includes("caption"))).toBe(true);
    expect(strategy.improvementAreas.some((a) => a.includes("카드뉴스"))).toBe(true);
  });
});
