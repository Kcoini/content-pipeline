import { describe, expect, it } from "vitest";
import {
  getPlatformPerformanceComparisonRules,
  getPrimaryMetricsForPlatform,
  getSecondaryMetricsForPlatform,
  classifyRewritePerformanceComparison,
} from "./rewrite-performance-comparison-rules";
import { SOCIAL_PLATFORMS } from "./social-platform-types";
import type { RewritePerformanceMetricsInput } from "./rewrite-performance-comparison-calculator";

function makeMetrics(overrides: Partial<RewritePerformanceMetricsInput> = {}): RewritePerformanceMetricsInput {
  return {
    views: 100,
    impressions: 200,
    reach: 150,
    likes: 10,
    comments: 2,
    shares: 1,
    saves: 0,
    clicks: 5,
    profileVisits: 0,
    follows: 0,
    conversionCount: 0,
    engagementRate: 0.05,
    clickThroughRate: 0.02,
    conversionRate: null,
    performanceScore: null,
    ...overrides,
  };
}

describe("getPlatformPerformanceComparisonRules / getPrimaryMetricsForPlatform", () => {
  it("모든 지원 플랫폼에 대해 규칙이 정의되어 있다", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const rules = getPlatformPerformanceComparisonRules(platform);
      expect(rules.primaryMetrics.length).toBeGreaterThan(0);
    }
  });

  it("wordpress_blog는 clicks/views/conversionCount/comments를 primary metrics로 본다", () => {
    const metrics = getPrimaryMetricsForPlatform("wordpress_blog");
    expect(metrics).toEqual(["clicks", "views", "conversionCount", "comments"]);
  });

  it("instagram은 reach/impressions/likes/comments/saves/shares/profileVisits를 primary metrics로 본다", () => {
    const metrics = getPrimaryMetricsForPlatform("instagram");
    expect(metrics).toContain("reach");
    expect(metrics).toContain("profileVisits");
  });

  it("secondaryMetrics는 primaryMetrics와 겹치지 않는다", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const primary = new Set(getPrimaryMetricsForPlatform(platform));
      const secondary = getSecondaryMetricsForPlatform(platform);
      for (const metric of secondary) {
        expect(primary.has(metric)).toBe(false);
      }
    }
  });
});

describe("classifyRewritePerformanceComparison", () => {
  it("둘 다 metrics가 없으면 needs_more_data를 반환한다", () => {
    const result = classifyRewritePerformanceComparison({
      platform: "naver_blog",
      original: makeMetrics(),
      rewrite: makeMetrics(),
      hasOriginalMetrics: false,
      hasRewriteMetrics: false,
    });
    expect(result.comparisonStatus).toBe("needs_more_data");
    expect(result.winner).toBeNull();
  });

  it("원본 metrics만 없으면 needs_more_data를 반환한다", () => {
    const result = classifyRewritePerformanceComparison({
      platform: "naver_blog",
      original: makeMetrics(),
      rewrite: makeMetrics(),
      hasOriginalMetrics: false,
      hasRewriteMetrics: true,
    });
    expect(result.comparisonStatus).toBe("needs_more_data");
    expect(result.reasonCode).toBe("missing_original_metrics");
  });

  it("rewrite metrics만 없으면 needs_more_data를 반환한다", () => {
    const result = classifyRewritePerformanceComparison({
      platform: "naver_blog",
      original: makeMetrics(),
      rewrite: makeMetrics(),
      hasOriginalMetrics: true,
      hasRewriteMetrics: false,
    });
    expect(result.comparisonStatus).toBe("needs_more_data");
    expect(result.reasonCode).toBe("missing_rewrite_metrics");
  });

  it("performance_score가 없어도 플랫폼별 primary metrics로 승자를 판단한다", () => {
    const result = classifyRewritePerformanceComparison({
      platform: "naver_blog",
      original: makeMetrics({ views: 100, likes: 10, comments: 2, saves: 0, shares: 1 }),
      rewrite: makeMetrics({ views: 150, likes: 20, comments: 5, saves: 1, shares: 3 }),
      hasOriginalMetrics: true,
      hasRewriteMetrics: true,
    });
    expect(result.winner).toBe("rewrite");
    expect(result.comparisonStatus).toBe("rewrite_won");
    expect(result.platformSpecificSummary.primaryMetrics).toEqual(getPrimaryMetricsForPlatform("naver_blog"));
  });

  it("performance_score가 있으면 그것을 우선 사용한다", () => {
    const result = classifyRewritePerformanceComparison({
      platform: "x",
      original: makeMetrics({ performanceScore: 50 }),
      rewrite: makeMetrics({ performanceScore: 52 }),
      hasOriginalMetrics: true,
      hasRewriteMetrics: true,
    });
    expect(result.comparisonStatus).toBe("similar");
  });
});
