import { describe, expect, it } from "vitest";
import { describePlatformBadge, getPlatformBadgeClassName } from "./platform-badge";

describe("describePlatformBadge (Phase UX-03C)", () => {
  it("SocialPlatform 값은 기존 PLATFORM_LABELS와 동일한 한국어 라벨을 반환한다", () => {
    expect(describePlatformBadge("wordpress_blog")).toBe("WordPress 블로그");
    expect(describePlatformBadge("naver_blog")).toBe("네이버 블로그");
    expect(describePlatformBadge("naver_cafe")).toBe("네이버 카페");
    expect(describePlatformBadge("x")).toBe("X");
    expect(describePlatformBadge("threads")).toBe("Threads");
    expect(describePlatformBadge("instagram")).toBe("Instagram");
    expect(describePlatformBadge("news_article")).toBe("언론 기사");
    expect(describePlatformBadge("opinion_column")).toBe("칼럼");
  });

  it("트렌드 검색 출처(naver/daum/mock)는 한국어 라벨로 변환한다(raw 문자열을 그대로 노출하지 않는다)", () => {
    expect(describePlatformBadge("naver")).toBe("네이버");
    expect(describePlatformBadge("daum")).toBe("다음");
    expect(describePlatformBadge("mock")).toBe("테스트 데이터");
  });

  it("알 수 없는 값은 원문을 그대로 반환한다(화면이 비지 않게)", () => {
    expect(describePlatformBadge("unknown_platform")).toBe("unknown_platform");
  });
});

describe("getPlatformBadgeClassName (Phase UX-03C)", () => {
  it("트렌드 검색 출처는 기존 trends/themes 페이지의 색상 구분을 그대로 유지한다", () => {
    expect(getPlatformBadgeClassName("naver")).toContain("green");
    expect(getPlatformBadgeClassName("daum")).toContain("blue");
    expect(getPlatformBadgeClassName("mock")).toContain("zinc");
  });

  it("SocialPlatform은 공통 콘텐츠 배지 색상을 쓴다(페이지마다 다른 색상 매핑을 만들지 않는다)", () => {
    expect(getPlatformBadgeClassName("wordpress_blog")).toBe(getPlatformBadgeClassName("x"));
    expect(getPlatformBadgeClassName("naver_blog")).toBe(getPlatformBadgeClassName("instagram"));
  });
});
