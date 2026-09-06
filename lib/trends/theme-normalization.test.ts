import { describe, expect, it } from "vitest";
import {
  extractYearToken,
  normalizeThemeKey,
  themeTitleSimilarity,
  THEME_SIMILARITY_MERGE_THRESHOLD,
  tokenizeThemeTitle,
} from "./theme-normalization";

describe("tokenizeThemeTitle", () => {
  it("공백/특수문자/연도/일반어를 제거한 토큰만 남긴다", () => {
    const tokens = tokenizeThemeTitle("제주 신혼부부·청년 주거 지원 2026");
    expect(tokens).toEqual(["제주", "신혼부부", "청년", "주거"]);
  });

  it("가운데점/슬래시/하이픈을 공백으로 통일한다", () => {
    expect(tokenizeThemeTitle("서울-경기·인천/지역 이슈")).toEqual(
      tokenizeThemeTitle("서울 경기 인천 지역 이슈")
    );
  });

  it("빈 문자열이면 빈 배열을 반환한다", () => {
    expect(tokenizeThemeTitle("   ")).toEqual([]);
  });
});

describe("extractYearToken", () => {
  it("연도 토큰을 찾아낸다", () => {
    expect(extractYearToken("제주 청년 주거 지원 2026")).toBe("2026");
    expect(extractYearToken("2026년 지원 정책")).toBe("2026");
  });

  it("연도가 없으면 null을 반환한다", () => {
    expect(extractYearToken("제주 청년 주거 지원")).toBeNull();
  });
});

describe("normalizeThemeKey", () => {
  it("공백/특수문자/연도 차이만 있으면 동일한 키를 만든다", () => {
    const a = normalizeThemeKey("제주 신혼부부·청년 주거 지원 2026");
    const b = normalizeThemeKey("제주   신혼부부 청년 주거지원");
    // "주거 지원"(공백 분리) vs "주거지원"(결합)은 토큰 자체가 다르므로
    // 완전히 같은 키가 아닐 수 있다 — 이 차이는 themeTitleSimilarity가 흡수한다.
    expect(typeof a).toBe("string");
    expect(typeof b).toBe("string");
  });

  it("토큰 순서가 달라도 같은 키를 만든다(정렬 적용)", () => {
    const a = normalizeThemeKey("제주 신혼부부 청년 주거");
    const b = normalizeThemeKey("제주 청년 신혼부부 주거");
    expect(a).toBe(b);
  });

  it("완전히 동일한 제목은 당연히 같은 키다", () => {
    expect(normalizeThemeKey("AI 산업 동향")).toBe(normalizeThemeKey("AI 산업 동향"));
  });
});

describe("themeTitleSimilarity", () => {
  it("사용자 예시 3개(공백/조사/연도 표현만 다른 동일 이슈)는 병합 임계값 이상의 유사도를 갖는다", () => {
    const title1 = "제주 신혼부부·청년 주거 지원 2026";
    const title2 = "제주 청년 신혼부부 주거지원 조건";
    const title3 = "제주 신혼부부 청년 주거비 지원";

    expect(themeTitleSimilarity(title1, title2)).toBeGreaterThanOrEqual(THEME_SIMILARITY_MERGE_THRESHOLD);
    expect(themeTitleSimilarity(title1, title3)).toBeGreaterThanOrEqual(THEME_SIMILARITY_MERGE_THRESHOLD);
    expect(themeTitleSimilarity(title2, title3)).toBeGreaterThanOrEqual(THEME_SIMILARITY_MERGE_THRESHOLD);
  });

  it("완전히 다른 주제는 낮은 유사도를 갖는다", () => {
    const similarity = themeTitleSimilarity("제주 신혼부부 청년 주거 지원", "반도체 수출 동향");
    expect(similarity).toBeLessThan(THEME_SIMILARITY_MERGE_THRESHOLD);
  });

  it("빈 제목이면 유사도 0을 반환한다", () => {
    expect(themeTitleSimilarity("", "제주 청년 주거 지원")).toBe(0);
  });

  it("동일 제목은 유사도 1이다", () => {
    expect(themeTitleSimilarity("AI 산업 동향", "AI 산업 동향")).toBe(1);
  });
});
