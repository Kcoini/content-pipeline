import { describe, expect, it } from "vitest";
import {
  calculateDelta,
  calculateDeltaRate,
  comparePerformanceScores,
  compareEngagement,
  compareClicks,
  calculateOverallRewriteImprovement,
  decideRewritePerformanceWinner,
  type RewritePerformanceMetricsInput,
} from "./rewrite-performance-comparison-calculator";

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
    performanceScore: 50,
    ...overrides,
  };
}

describe("calculateDelta / calculateDeltaRate", () => {
  it("delta = rewrite - original", () => {
    expect(calculateDelta(100, 150)).toBe(50);
    expect(calculateDelta(100, 80)).toBe(-20);
  });

  it("delta_rate = delta / original (original > 0)", () => {
    expect(calculateDeltaRate(100, 150)).toBeCloseTo(0.5);
  });

  it("original이 0이면 delta_rate는 null이다 (rewrite가 0보다 커도)", () => {
    expect(calculateDeltaRate(0, 50)).toBeNull();
  });

  it("original과 rewrite가 모두 0이면 delta_rate는 null이다", () => {
    expect(calculateDeltaRate(0, 0)).toBeNull();
  });
});

describe("comparePerformanceScores", () => {
  it("performance_score_delta를 계산한다", () => {
    const result = comparePerformanceScores(50, 65);
    expect(result.performanceScoreDelta).toBe(15);
    expect(result.performanceScoreDeltaRate).toBeCloseTo(0.3);
  });

  it("둘 중 하나라도 없으면 null을 반환한다", () => {
    expect(comparePerformanceScores(null, 65)).toEqual({ performanceScoreDelta: null, performanceScoreDeltaRate: null });
    expect(comparePerformanceScores(50, null)).toEqual({ performanceScoreDelta: null, performanceScoreDeltaRate: null });
  });
});

describe("compareEngagement / compareClicks", () => {
  it("engagement_rate_delta / click_through_rate_delta를 계산한다", () => {
    const result = compareEngagement({ engagementRate: 0.05, clickThroughRate: 0.02 }, { engagementRate: 0.08, clickThroughRate: 0.04 });
    expect(result.engagementRateDelta).toBeCloseTo(0.03);
    expect(result.clickThroughRateDelta).toBeCloseTo(0.02);
  });

  it("clicks delta/delta_rate를 계산한다", () => {
    const result = compareClicks(5, 10);
    expect(result.delta).toBe(5);
    expect(result.deltaRate).toBeCloseTo(1);
  });
});

describe("calculateOverallRewriteImprovement", () => {
  it("모든 delta를 계산하고 improvementSummary를 만든다", () => {
    const original = makeMetrics();
    const rewrite = makeMetrics({ views: 150, impressions: 250, likes: 20, comments: 5, shares: 3, saves: 1, clicks: 10, performanceScore: 65 });

    const result = calculateOverallRewriteImprovement(original, rewrite, "naver_blog");

    expect(result.viewsDelta).toBe(50);
    expect(result.commentsDelta).toBe(3);
    expect(result.sharesDelta).toBe(2);
    expect(result.savesDelta).toBe(1);
    expect(result.performanceScoreDelta).toBe(15);
    expect(result.improvementSummary.viewsImproved).toBe(true);
    expect(result.improvementSummary.platform).toBe("naver_blog");
  });

  it("original 값이 0이고 rewrite가 0보다 크면 warning을 추가한다", () => {
    const original = makeMetrics({ saves: 0 });
    const rewrite = makeMetrics({ saves: 3 });

    const result = calculateOverallRewriteImprovement(original, rewrite, "instagram");

    expect(result.warnings.some((w) => w.includes("saves"))).toBe(true);
  });
});

describe("decideRewritePerformanceWinner", () => {
  it("rewrite score가 10점 이상 높으면 rewrite_won", () => {
    const result = decideRewritePerformanceWinner({
      performanceScoreDelta: 15,
      originalPerformanceScore: 50,
      rewritePerformanceScore: 65,
    });
    expect(result.winner).toBe("rewrite");
    expect(result.comparisonStatus).toBe("rewrite_won");
  });

  it("original score가 10점 이상 높으면 original_won", () => {
    const result = decideRewritePerformanceWinner({
      performanceScoreDelta: -15,
      originalPerformanceScore: 65,
      rewritePerformanceScore: 50,
    });
    expect(result.winner).toBe("original");
    expect(result.comparisonStatus).toBe("original_won");
  });

  it("차이가 10점 미만이면 similar(tie)를 반환한다", () => {
    const result = decideRewritePerformanceWinner({
      performanceScoreDelta: 5,
      originalPerformanceScore: 50,
      rewritePerformanceScore: 55,
    });
    expect(result.winner).toBe("tie");
    expect(result.comparisonStatus).toBe("similar");
  });

  it("performance_score가 없으면 주요 지표 다수결로 판단한다", () => {
    const result = decideRewritePerformanceWinner({
      performanceScoreDelta: null,
      originalPerformanceScore: null,
      rewritePerformanceScore: null,
      primaryMetricComparisons: [
        { metric: "views", originalValue: 100, rewriteValue: 150 },
        { metric: "likes", originalValue: 10, rewriteValue: 20 },
        { metric: "comments", originalValue: 5, rewriteValue: 3 },
      ],
    });
    expect(result.winner).toBe("rewrite");
    expect(result.comparisonStatus).toBe("rewrite_won");
  });

  it("performance_score와 주요 지표가 모두 없으면 needs_more_data를 반환한다", () => {
    const result = decideRewritePerformanceWinner({
      performanceScoreDelta: null,
      originalPerformanceScore: null,
      rewritePerformanceScore: null,
    });
    expect(result.winner).toBe("none");
    expect(result.comparisonStatus).toBe("needs_more_data");
  });
});
