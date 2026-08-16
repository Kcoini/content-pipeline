import { beforeEach, describe, expect, it, vi } from "vitest";

const getSocialPerformanceDashboardSummary = vi.fn();
const listPlatformPerformanceSummaries = vi.fn();
const listTonePerformanceSummaries = vi.fn();
const listArticlePerformanceSummaries = vi.fn();
const listLowPerformanceSocialPosts = vi.fn();
const listMetricsMissingSocialPosts = vi.fn();
const listRewritePerformanceSummaries = vi.fn();
const listRecentMetrics = vi.fn();
const listRecentRewriteComparisons = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-performance-dashboard-repository", () => ({
  getSocialPerformanceDashboardSummary: (...args: unknown[]) => getSocialPerformanceDashboardSummary(...args),
  listPlatformPerformanceSummaries: (...args: unknown[]) => listPlatformPerformanceSummaries(...args),
  listTonePerformanceSummaries: (...args: unknown[]) => listTonePerformanceSummaries(...args),
  listArticlePerformanceSummaries: (...args: unknown[]) => listArticlePerformanceSummaries(...args),
  listLowPerformanceSocialPosts: (...args: unknown[]) => listLowPerformanceSocialPosts(...args),
  listMetricsMissingSocialPosts: (...args: unknown[]) => listMetricsMissingSocialPosts(...args),
  listRewritePerformanceSummaries: (...args: unknown[]) => listRewritePerformanceSummaries(...args),
  listRecentMetrics: (...args: unknown[]) => listRecentMetrics(...args),
  listRecentRewriteComparisons: (...args: unknown[]) => listRecentRewriteComparisons(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { buildSocialPerformanceDashboard } = await import("./social-performance-dashboard-service");

const emptySummary = {
  totalSocialPosts: 0,
  publishedPosts: 0,
  manualPostedPosts: 0,
  metricsMeasuredPosts: 0,
  metricsMissingPosts: 0,
  averagePerformanceScore: null,
  bestPerformanceScore: null,
  worstPerformanceScore: null,
  totalViews: 0,
  totalImpressions: 0,
  totalLikes: 0,
  totalComments: 0,
  totalShares: 0,
  totalSaves: 0,
  totalClicks: 0,
  averageEngagementRate: null,
  averageClickThroughRate: null,
  rewriteVersionsCount: 0,
  rewriteComparisonsCount: 0,
  rewriteWonCount: 0,
  originalWonCount: 0,
  similarCount: 0,
  needsMoreDataCount: 0,
};

const emptyRewriteSummary = {
  rewriteWonCount: 0,
  originalWonCount: 0,
  similarCount: 0,
  needsMoreDataCount: 0,
  averagePerformanceScoreDelta: null,
  bestRewriteSocialPostId: null,
  worstRewriteSocialPostId: null,
  bestPlatforms: [],
  bestToneStyles: [],
};

beforeEach(() => {
  getSocialPerformanceDashboardSummary.mockReset();
  listPlatformPerformanceSummaries.mockReset();
  listTonePerformanceSummaries.mockReset();
  listArticlePerformanceSummaries.mockReset();
  listLowPerformanceSocialPosts.mockReset();
  listMetricsMissingSocialPosts.mockReset();
  listRewritePerformanceSummaries.mockReset();
  listRecentMetrics.mockReset();
  listRecentRewriteComparisons.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});

  getSocialPerformanceDashboardSummary.mockResolvedValue(emptySummary);
  listPlatformPerformanceSummaries.mockResolvedValue([]);
  listTonePerformanceSummaries.mockResolvedValue([]);
  listArticlePerformanceSummaries.mockResolvedValue([]);
  listLowPerformanceSocialPosts.mockResolvedValue([]);
  listMetricsMissingSocialPosts.mockResolvedValue([]);
  listRewritePerformanceSummaries.mockResolvedValue(emptyRewriteSummary);
  listRecentMetrics.mockResolvedValue([]);
  listRecentRewriteComparisons.mockResolvedValue([]);
});

describe("buildSocialPerformanceDashboard", () => {
  it("모든 repository 함수를 호출해 dashboard를 조립한다", async () => {
    getSocialPerformanceDashboardSummary.mockResolvedValue({ ...emptySummary, totalSocialPosts: 5 });
    listPlatformPerformanceSummaries.mockResolvedValue([{ platform: "naver_blog", postCount: 5 }]);
    listTonePerformanceSummaries.mockResolvedValue([{ toneStyle: "story", postCount: 5 }]);

    const dashboard = await buildSocialPerformanceDashboard();

    expect(dashboard.summary.totalSocialPosts).toBe(5);
    expect(dashboard.bestPlatform).toBe("naver_blog");
    expect(dashboard.bestToneStyle).toBe("story");
    expect(getSocialPerformanceDashboardSummary).toHaveBeenCalled();
    expect(listRecentMetrics).toHaveBeenCalled();
    expect(listRecentRewriteComparisons).toHaveBeenCalled();
  });

  it("filter를 정규화해서 repository에 전달한다(Phase 3-16 기본값 적용: includeRewriteVersions=false)", async () => {
    await buildSocialPerformanceDashboard({ platform: "x" });

    expect(getSocialPerformanceDashboardSummary).toHaveBeenCalledWith(
      expect.objectContaining({ platform: "x", includeRewriteVersions: false, onlyLowPerformance: false, contentGroup: "all" })
    );
  });

  it("platform/tone summary가 비어 있으면 bestPlatform/bestToneStyle은 null이다", async () => {
    const dashboard = await buildSocialPerformanceDashboard();

    expect(dashboard.bestPlatform).toBeNull();
    expect(dashboard.bestToneStyle).toBeNull();
  });

  it("build_started/build_completed 로그를 남긴다", async () => {
    await buildSocialPerformanceDashboard();

    const types = logEvent.mock.calls.map((call) => call[0].type);
    expect(types).toContain("social_performance_dashboard_build_started");
    expect(types).toContain("social_performance_dashboard_build_completed");
  });

  it("repository 호출 중 오류가 나면 build_failed 로그를 남기고 다시 throw한다", async () => {
    getSocialPerformanceDashboardSummary.mockRejectedValue(new Error("boom"));

    await expect(buildSocialPerformanceDashboard()).rejects.toThrow("boom");

    const types = logEvent.mock.calls.map((call) => call[0].type);
    expect(types).toContain("social_performance_dashboard_build_failed");
  });
});

describe("보안 요구사항", () => {
  it("logs에 full content/API key/auth token이 저장되지 않는다", async () => {
    await buildSocialPerformanceDashboard({ platform: "naver_blog" });

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("post_body");
  });
});
