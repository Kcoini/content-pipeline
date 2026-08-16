import { beforeEach, describe, expect, it, vi } from "vitest";

const listSocialPostsForChart = vi.fn();
const listPlatformChartRows = vi.fn();
const listToneChartRows = vi.fn();
const listMetricsForTrend = vi.fn();
const listRewritePerformanceComparisonsForChart = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-performance-chart-repository", () => ({
  listSocialPostsForChart: (...args: unknown[]) => listSocialPostsForChart(...args),
  listPlatformChartRows: (...args: unknown[]) => listPlatformChartRows(...args),
  listToneChartRows: (...args: unknown[]) => listToneChartRows(...args),
  listMetricsForTrend: (...args: unknown[]) => listMetricsForTrend(...args),
  listRewritePerformanceComparisonsForChart: (...args: unknown[]) => listRewritePerformanceComparisonsForChart(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { buildSocialPerformanceCharts } = await import("./social-performance-chart-service");

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    publishStatus: "not_published",
    latestMetricsRecordedAt: null,
    performanceStatus: "not_measured",
    ...overrides,
  };
}

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
  listSocialPostsForChart.mockReset();
  listPlatformChartRows.mockReset();
  listToneChartRows.mockReset();
  listMetricsForTrend.mockReset();
  listRewritePerformanceComparisonsForChart.mockReset();
  logEvent.mockReset();

  listSocialPostsForChart.mockResolvedValue([]);
  listPlatformChartRows.mockResolvedValue([]);
  listToneChartRows.mockResolvedValue([]);
  listMetricsForTrend.mockResolvedValue([]);
  listRewritePerformanceComparisonsForChart.mockResolvedValue(emptyRewriteSummary);
});

describe("buildSocialPerformanceCharts", () => {
  it("platform performance chart 데이터를 생성한다", async () => {
    listPlatformChartRows.mockResolvedValue([
      {
        platform: "wordpress_blog",
        postCount: 3,
        manualPostedCount: 3,
        metricsMeasuredCount: 2,
        averagePerformanceScore: 60,
        averageEngagementRate: 0.1,
        totalViews: 100,
        totalImpressions: 200,
        totalLikes: 10,
        totalComments: 2,
        totalShares: 1,
        totalSaves: 3,
        totalClicks: 5,
        bestSocialPostId: null,
        worstSocialPostId: null,
      },
    ]);

    const result = await buildSocialPerformanceCharts();

    expect(result.platformPerformanceChart).toEqual([
      { platform: "wordpress_blog", averagePerformanceScore: 60, totalViews: 100, totalClicks: 5, totalEngagement: 16, measuredCount: 2 },
    ]);
  });

  it("tone performance chart 데이터를 생성한다", async () => {
    listToneChartRows.mockResolvedValue([
      {
        toneStyle: "informational",
        postCount: 4,
        averagePerformanceScore: 55,
        averageEngagementRate: 0.2,
        totalViews: 40,
        totalImpressions: 80,
        totalLikes: 4,
        totalComments: 1,
        totalShares: 0,
        totalClicks: 2,
        bestSocialPostId: null,
      },
    ]);

    const result = await buildSocialPerformanceCharts();

    expect(result.tonePerformanceChart).toEqual([
      { toneStyle: "informational", averagePerformanceScore: 55, totalViews: 40, totalClicks: 2, measuredCount: 4 },
    ]);
  });

  it("metrics trend chart 데이터를 월별로 집계한다", async () => {
    listMetricsForTrend.mockResolvedValue([
      { measuredAt: "2026-01-05", views: 10, impressions: 20, likes: 1, comments: 0, shares: 0, clicks: 1, performanceScore: 50 },
      { measuredAt: "2026-01-20", views: 5, impressions: 10, likes: 0, comments: 1, shares: 0, clicks: 0, performanceScore: 70 },
      { measuredAt: "2026-02-01", views: 8, impressions: 15, likes: 2, comments: 0, shares: 1, clicks: 2, performanceScore: null },
    ]);

    const result = await buildSocialPerformanceCharts();

    expect(result.metricsTrendChart.granularity).toBe("month");
    expect(result.metricsTrendChart.points).toEqual([
      { period: "2026-01", views: 15, impressions: 30, likes: 1, comments: 1, shares: 0, clicks: 1, averagePerformanceScore: 60 },
      { period: "2026-02", views: 8, impressions: 15, likes: 2, comments: 0, shares: 1, clicks: 2, averagePerformanceScore: null },
    ]);
  });

  it("같은 달에만 데이터가 있으면 day 단위로 집계한다", async () => {
    listMetricsForTrend.mockResolvedValue([
      { measuredAt: "2026-01-05", views: 10, impressions: 20, likes: 1, comments: 0, shares: 0, clicks: 1, performanceScore: 50 },
      { measuredAt: "2026-01-06", views: 5, impressions: 10, likes: 0, comments: 1, shares: 0, clicks: 0, performanceScore: 70 },
    ]);

    const result = await buildSocialPerformanceCharts();

    expect(result.metricsTrendChart.granularity).toBe("day");
    expect(result.metricsTrendChart.points.map((p) => p.period)).toEqual(["2026-01-05", "2026-01-06"]);
  });

  it("rewrite comparison chart 데이터를 생성한다", async () => {
    listRewritePerformanceComparisonsForChart.mockResolvedValue({
      ...emptyRewriteSummary,
      rewriteWonCount: 3,
      originalWonCount: 1,
      similarCount: 2,
      needsMoreDataCount: 1,
    });

    const result = await buildSocialPerformanceCharts();

    expect(result.rewriteComparisonChart).toEqual({ rewriteWonCount: 3, originalWonCount: 1, similarCount: 2, needsMoreDataCount: 1 });
  });

  it("low performance chart 데이터를 performance_status별로 집계한다", async () => {
    listSocialPostsForChart.mockResolvedValue([
      makePost({ id: "p1", performanceStatus: "low" }),
      makePost({ id: "p2", performanceStatus: "needs_review" }),
      makePost({ id: "p3", performanceStatus: "excellent" }),
      makePost({ id: "p4", performanceStatus: "excellent" }),
    ]);

    const result = await buildSocialPerformanceCharts();

    expect(result.lowPerformanceChart).toEqual({ low: 1, needsReview: 1, notMeasured: 0, average: 0, good: 0, excellent: 2 });
  });

  it("metrics missing chart 데이터를 measured/missing으로 집계한다", async () => {
    listSocialPostsForChart.mockResolvedValue([
      makePost({ id: "p1", latestMetricsRecordedAt: "2026-01-01T00:00:00.000Z" }),
      makePost({ id: "p2", latestMetricsRecordedAt: null }),
      makePost({ id: "p3", latestMetricsRecordedAt: null }),
    ]);

    const result = await buildSocialPerformanceCharts();

    expect(result.metricsMissingChart).toEqual({ measured: 1, missing: 2 });
  });

  it("원본 데이터가 없으면 빈 차트를 안전하게 반환한다", async () => {
    const result = await buildSocialPerformanceCharts();

    expect(result.platformPerformanceChart).toEqual([]);
    expect(result.tonePerformanceChart).toEqual([]);
    expect(result.metricsTrendChart).toEqual({ granularity: "month", points: [] });
    expect(result.rewriteComparisonChart).toEqual({ rewriteWonCount: 0, originalWonCount: 0, similarCount: 0, needsMoreDataCount: 0 });
    expect(result.lowPerformanceChart).toEqual({ low: 0, needsReview: 0, notMeasured: 0, average: 0, good: 0, excellent: 0 });
    expect(result.metricsMissingChart).toEqual({ measured: 0, missing: 0 });
  });

  it("platform 필터를 repository 호출에 전달한다", async () => {
    await buildSocialPerformanceCharts({ platform: "x", includeRewriteVersions: false, onlyPublished: false, onlyMeasured: false });

    expect(listPlatformChartRows).toHaveBeenCalledWith(expect.objectContaining({ platform: "x" }));
    expect(listSocialPostsForChart).toHaveBeenCalledWith(expect.objectContaining({ platform: "x" }));
  });

  it("toneStyle 필터를 repository 호출에 전달한다", async () => {
    await buildSocialPerformanceCharts({ toneStyle: "informational", includeRewriteVersions: false, onlyPublished: false, onlyMeasured: false });

    expect(listToneChartRows).toHaveBeenCalledWith(expect.objectContaining({ toneStyle: "informational" }));
  });

  it("includeRewriteVersions=false를 repository 호출에 전달한다", async () => {
    await buildSocialPerformanceCharts({ includeRewriteVersions: false, onlyPublished: false, onlyMeasured: false });

    expect(listSocialPostsForChart).toHaveBeenCalledWith(expect.objectContaining({ includeRewriteVersions: false }));
  });

  it("dateFrom/dateTo 필터를 repository 호출과 trend 집계에 전달한다", async () => {
    listMetricsForTrend.mockResolvedValue([
      { measuredAt: "2026-01-01", views: 1, impressions: 1, likes: 0, comments: 0, shares: 0, clicks: 0, performanceScore: null },
      { measuredAt: "2026-03-01", views: 2, impressions: 2, likes: 0, comments: 0, shares: 0, clicks: 0, performanceScore: null },
    ]);

    const result = await buildSocialPerformanceCharts({
      dateFrom: "2026-02-01",
      dateTo: "2026-12-31",
      includeRewriteVersions: false,
      onlyPublished: false,
      onlyMeasured: false,
    });

    expect(listSocialPostsForChart).toHaveBeenCalledWith(expect.objectContaining({ dateFrom: "2026-02-01", dateTo: "2026-12-31" }));
    // 2026-01-01은 dateFrom 이전이라 제외되어야 한다.
    expect(result.metricsTrendChart.points.map((p) => p.period)).toEqual(["2026-03-01"]);
  });

  it("onlyPublished/onlyMeasured는 조회 후 JS에서 적용된다(low/missing chart에만 영향)", async () => {
    listSocialPostsForChart.mockResolvedValue([
      makePost({ id: "p1", publishStatus: "published", latestMetricsRecordedAt: "2026-01-01T00:00:00.000Z", performanceStatus: "good" }),
      makePost({ id: "p2", publishStatus: "not_published", latestMetricsRecordedAt: null, performanceStatus: "low" }),
    ]);

    const result = await buildSocialPerformanceCharts({
      includeRewriteVersions: false,
      onlyPublished: true,
      onlyMeasured: true,
    });

    expect(result.lowPerformanceChart).toEqual({ low: 0, needsReview: 0, notMeasured: 0, average: 0, good: 1, excellent: 0 });
    expect(result.metricsMissingChart).toEqual({ measured: 1, missing: 0 });
  });
});
