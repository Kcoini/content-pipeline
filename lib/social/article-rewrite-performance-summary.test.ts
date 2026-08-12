import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RewritePerformanceComparison } from "./social-platform-types";

const listRewritePerformanceComparisonsByArticle = vi.fn();

vi.mock("@/lib/repositories/social-rewrite-performance-comparisons-repository", () => ({
  listRewritePerformanceComparisonsByArticle: (...args: unknown[]) => listRewritePerformanceComparisonsByArticle(...args),
}));

const { buildArticleRewritePerformanceSummary } = await import("./article-rewrite-performance-summary");

function makeComparison(overrides: Partial<RewritePerformanceComparison> = {}): RewritePerformanceComparison {
  return {
    id: "perf-comparison-1",
    articleId: "article-1",
    rootSocialPostId: "social-post-1",
    originalSocialPostId: "social-post-1",
    rewriteSocialPostId: "social-post-2",
    rewriteSourceSuggestionId: null,
    versionComparisonId: null,
    platform: "naver_blog",
    toneStyle: "informational",
    originalVersionNumber: 1,
    rewriteVersionNumber: 2,

    originalMetricsId: "metrics-1",
    originalMeasuredAt: "2026-01-10T00:00:00.000Z",
    originalViews: 100,
    originalImpressions: 200,
    originalReach: 150,
    originalLikes: 10,
    originalComments: 2,
    originalShares: 1,
    originalSaves: 0,
    originalClicks: 5,
    originalProfileVisits: 0,
    originalFollows: 0,
    originalConversionCount: 0,
    originalEngagementRate: 0.05,
    originalClickThroughRate: 0.02,
    originalConversionRate: null,
    originalPerformanceScore: 50,
    originalPerformanceStatus: "average",

    rewriteMetricsId: "metrics-2",
    rewriteMeasuredAt: "2026-01-20T00:00:00.000Z",
    rewriteViews: 150,
    rewriteImpressions: 250,
    rewriteReach: 200,
    rewriteLikes: 20,
    rewriteComments: 5,
    rewriteShares: 3,
    rewriteSaves: 1,
    rewriteClicks: 10,
    rewriteProfileVisits: 0,
    rewriteFollows: 0,
    rewriteConversionCount: 0,
    rewriteEngagementRate: 0.08,
    rewriteClickThroughRate: 0.04,
    rewriteConversionRate: null,
    rewritePerformanceScore: 65,
    rewritePerformanceStatus: "good",

    comparisonStatus: "rewrite_won",
    winner: "rewrite",
    performanceScoreDelta: 15,
    performanceScoreDeltaRate: 0.3,
    viewsDelta: 50,
    viewsDeltaRate: 0.5,
    impressionsDelta: 50,
    impressionsDeltaRate: 0.25,
    engagementRateDelta: 0.03,
    clickThroughRateDelta: 0.02,
    clicksDelta: 5,
    clicksDeltaRate: 1,
    commentsDelta: 3,
    commentsDeltaRate: 1.5,
    sharesDelta: 2,
    sharesDeltaRate: 2,
    savesDelta: 1,
    savesDeltaRate: null,
    improvementSummary: {},
    platformSpecificSummary: {},
    warnings: [],
    failures: [],
    comparedBy: "editor",
    comparedAt: "2026-01-20T00:00:00.000Z",
    createdAt: "2026-01-20T00:00:00.000Z",
    updatedAt: "2026-01-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  listRewritePerformanceComparisonsByArticle.mockReset();
});

describe("buildArticleRewritePerformanceSummary", () => {
  it("comparisonStatus별 카운트를 집계한다", async () => {
    listRewritePerformanceComparisonsByArticle.mockResolvedValue([
      makeComparison({ comparisonStatus: "rewrite_won" }),
      makeComparison({ id: "perf-comparison-2", comparisonStatus: "original_won", performanceScoreDelta: -12 }),
      makeComparison({ id: "perf-comparison-3", comparisonStatus: "similar", performanceScoreDelta: 2 }),
      makeComparison({ id: "perf-comparison-4", comparisonStatus: "needs_more_data", performanceScoreDelta: null, performanceScoreDeltaRate: null }),
    ]);

    const summary = await buildArticleRewritePerformanceSummary("article-1");

    expect(summary.totalComparisons).toBe(4);
    expect(summary.rewriteWonCount).toBe(1);
    expect(summary.originalWonCount).toBe(1);
    expect(summary.similarCount).toBe(1);
    expect(summary.needsMoreDataCount).toBe(1);
  });

  it("평균 performance_score_delta / 개선율을 계산한다", async () => {
    listRewritePerformanceComparisonsByArticle.mockResolvedValue([
      makeComparison({ performanceScoreDelta: 10, performanceScoreDeltaRate: 0.2 }),
      makeComparison({ id: "perf-comparison-2", performanceScoreDelta: 20, performanceScoreDeltaRate: 0.4 }),
    ]);

    const summary = await buildArticleRewritePerformanceSummary("article-1");

    expect(summary.averagePerformanceScoreDelta).toBeCloseTo(15);
    expect(summary.averageImprovementRate).toBeCloseTo(0.3);
  });

  it("performance_score_delta가 가장 높은 rewrite version을 best로 선택한다", async () => {
    listRewritePerformanceComparisonsByArticle.mockResolvedValue([
      makeComparison({ rewriteSocialPostId: "social-post-2", performanceScoreDelta: 10 }),
      makeComparison({ id: "perf-comparison-2", rewriteSocialPostId: "social-post-3", performanceScoreDelta: 25 }),
    ]);

    const summary = await buildArticleRewritePerformanceSummary("article-1");

    expect(summary.bestRewriteSocialPostId).toBe("social-post-3");
    expect(summary.bestPerformanceScoreDelta).toBe(25);
  });

  it("비교 결과가 없으면 0/null 요약을 반환한다", async () => {
    listRewritePerformanceComparisonsByArticle.mockResolvedValue([]);

    const summary = await buildArticleRewritePerformanceSummary("article-1");

    expect(summary.totalComparisons).toBe(0);
    expect(summary.averagePerformanceScoreDelta).toBeNull();
    expect(summary.bestRewriteSocialPostId).toBeNull();
  });
});
