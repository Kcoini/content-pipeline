import { describe, expect, it } from "vitest";
import {
  calculateEngagementRate,
  calculateClickThroughRate,
  calculateConversionRate,
  calculatePerformanceScore,
  classifyPerformanceStatus,
} from "./social-metrics-calculator";

describe("calculateEngagementRate", () => {
  it("impressions 기준으로 engagement_rate를 계산한다", () => {
    const rate = calculateEngagementRate({ impressions: 1000, likes: 50, comments: 30, shares: 10, saves: 10 });
    expect(rate).toBeCloseTo(100 / 1000);
  });

  it("impressions가 없으면 views로 fallback한다", () => {
    const rate = calculateEngagementRate({ views: 500, likes: 25 });
    expect(rate).toBeCloseTo(25 / 500);
  });

  it("분모가 모두 0/없으면 null을 반환한다", () => {
    expect(calculateEngagementRate({ likes: 10 })).toBeNull();
    expect(calculateEngagementRate({ views: 0, likes: 10 })).toBeNull();
  });
});

describe("calculateClickThroughRate", () => {
  it("impressions 기준으로 CTR을 계산한다", () => {
    const ctr = calculateClickThroughRate({ impressions: 2000, clicks: 40 });
    expect(ctr).toBeCloseTo(40 / 2000);
  });

  it("분모가 없으면 null을 반환한다", () => {
    expect(calculateClickThroughRate({ clicks: 5 })).toBeNull();
  });
});

describe("calculateConversionRate", () => {
  it("clicks 기준으로 conversion_rate를 계산한다", () => {
    const rate = calculateConversionRate({ clicks: 100, conversionCount: 5 });
    expect(rate).toBeCloseTo(0.05);
  });

  it("clicks가 0이면 null을 반환한다", () => {
    expect(calculateConversionRate({ clicks: 0, conversionCount: 5 })).toBeNull();
  });
});

describe("calculatePerformanceScore", () => {
  it("0~100 범위 내의 점수를 반환한다", () => {
    const score = calculatePerformanceScore({ views: 100000, likes: 100000, comments: 100000, shares: 100000, saves: 100000 }, "naver_blog");
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("데이터가 전혀 없으면 0점이다", () => {
    expect(calculatePerformanceScore({}, "x")).toBe(0);
  });

  it("충분히 높은 지표는 높은 점수를 받는다", () => {
    const score = calculatePerformanceScore(
      { impressions: 10000, likes: 500, comments: 200, shares: 200, clicks: 200 },
      "x"
    );
    expect(score).toBeGreaterThan(80);
  });
});

describe("classifyPerformanceStatus", () => {
  it("80 이상이면 excellent", () => {
    expect(classifyPerformanceStatus(85)).toBe("excellent");
    expect(classifyPerformanceStatus(80)).toBe("excellent");
  });

  it("65 이상이면 good", () => {
    expect(classifyPerformanceStatus(70)).toBe("good");
    expect(classifyPerformanceStatus(65)).toBe("good");
  });

  it("40 이상이면 average", () => {
    expect(classifyPerformanceStatus(50)).toBe("average");
    expect(classifyPerformanceStatus(40)).toBe("average");
  });

  it("1 이상이면 low", () => {
    expect(classifyPerformanceStatus(10)).toBe("low");
    expect(classifyPerformanceStatus(1)).toBe("low");
  });

  it("0이면 needs_review", () => {
    expect(classifyPerformanceStatus(0)).toBe("needs_review");
  });
});
