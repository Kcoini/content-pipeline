import { describe, expect, it } from "vitest";
import { SOCIAL_PLATFORMS } from "./social-platform-types";
import {
  DEFAULT_RECOMMENDED_PLATFORMS,
  PLATFORM_COST_LEVELS,
  getRecommendedPlatforms,
  getRecommendedToneForPlatform,
  NAVER_CAFE_DISCOURAGED_TONE_STYLES,
} from "./platform-generation-recommendations";

describe("getRecommendedPlatforms (Phase 3-21: 추천 플랫폼 선택)", () => {
  it("topicType이 없으면 기본 추천(WordPress 블로그/네이버 블로그/네이버 카페)을 반환한다", () => {
    expect(getRecommendedPlatforms()).toEqual(["wordpress_blog", "naver_blog", "naver_cafe"]);
    expect(getRecommendedPlatforms(null)).toEqual([...DEFAULT_RECOMMENDED_PLATFORMS]);
  });

  it("Instagram은 기본 추천에서 제외된다", () => {
    expect(getRecommendedPlatforms()).not.toContain("instagram");
  });

  it("X/Threads는 기본 추천에서 제외된다", () => {
    expect(getRecommendedPlatforms()).not.toContain("x");
    expect(getRecommendedPlatforms()).not.toContain("threads");
  });

  it("경제/생활 정보는 X를 추가로 추천할 수 있다", () => {
    const result = getRecommendedPlatforms("economic_daily_life");
    expect(result).toContain("x");
    expect(result).toContain("wordpress_blog");
  });

  it("정책/지원금/복지 제도는 WordPress/네이버 블로그/네이버 카페만 추천한다", () => {
    expect(getRecommendedPlatforms("policy_support")).toEqual(["wordpress_blog", "naver_blog", "naver_cafe"]);
  });

  it("빠른 이슈성 뉴스는 X/Threads/네이버 카페를 우선 추천한다", () => {
    const result = getRecommendedPlatforms("breaking_news");
    expect(result[0]).toBe("x");
    expect(result).toContain("threads");
  });

  it("시각적 정보/체크리스트/생활 팁은 Instagram을 추천에 포함한다", () => {
    expect(getRecommendedPlatforms("visual_checklist_tip")).toContain("instagram");
  });

  it("news_article은 언론사 모드 설정이 없으면 어떤 topicType 추천에도 기본 포함되지 않는다 (Phase 4-3, 선택은 가능하되 기본 선택은 하지 않는다)", () => {
    expect(getRecommendedPlatforms()).not.toContain("news_article");
    expect(getRecommendedPlatforms("economic_daily_life")).not.toContain("news_article");
    expect(getRecommendedPlatforms("policy_support")).not.toContain("news_article");
    expect(getRecommendedPlatforms("breaking_news")).not.toContain("news_article");
    expect(getRecommendedPlatforms("visual_checklist_tip")).not.toContain("news_article");
  });
});

describe("getRecommendedToneForPlatform (Phase 3-21: 플랫폼별 추천 문체)", () => {
  it("모든 플랫폼에 대해 유효한 tone_style을 반환한다", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const tone = getRecommendedToneForPlatform(platform);
      expect(typeof tone).toBe("string");
    }
  });

  it("naver_cafe의 기본 추천 문체는 강한 설득형/손실 회피형이 아니다(광고글처럼 보이지 않게)", () => {
    const tone = getRecommendedToneForPlatform("naver_cafe");
    expect(NAVER_CAFE_DISCOURAGED_TONE_STYLES).not.toContain(tone);
  });

  it("x는 curiosity(호기심 유도형)를 추천한다", () => {
    expect(getRecommendedToneForPlatform("x")).toBe("curiosity");
  });

  it("wordpress_blog는 explanatory(설명형)를 추천한다", () => {
    expect(getRecommendedToneForPlatform("wordpress_blog")).toBe("explanatory");
  });

  it("news_article은 informational(정보형)을 추천한다 (Phase 4-3)", () => {
    expect(getRecommendedToneForPlatform("news_article")).toBe("informational");
  });
});

describe("PLATFORM_COST_LEVELS (Phase 3-21: 예상 비용 수준)", () => {
  it("wordpress_blog는 높음, naver_cafe/x/threads는 낮음이다", () => {
    expect(PLATFORM_COST_LEVELS.wordpress_blog).toBe("high");
    expect(PLATFORM_COST_LEVELS.naver_cafe).toBe("low");
    expect(PLATFORM_COST_LEVELS.x).toBe("low");
    expect(PLATFORM_COST_LEVELS.threads).toBe("low");
  });

  it("모든 플랫폼에 비용 수준이 정의되어 있다", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(PLATFORM_COST_LEVELS[platform]).toBeDefined();
    }
  });
});
