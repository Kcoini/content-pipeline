// Phase 3-19: Dashboard Charts & Trend Visualization — 조회 전용 차트
// 서비스. 이 서비스의 어떤 함수도 social_posts/metrics/comparisons
// 데이터를 변경하지 않는다. Phase 3-15 dashboard repository를
// social-performance-chart-repository.ts를 통해 그대로 재사용하며,
// 성과 계산 방식(performance_score 등)은 전혀 바꾸지 않는다 — 이미
// 계산된 값을 차트가 읽기 좋은 모양으로 다시 묶을 뿐이다.

import {
  listSocialPostsForChart,
  listPlatformChartRows,
  listToneChartRows,
  listMetricsForTrend,
  listRewritePerformanceComparisonsForChart,
} from "@/lib/repositories/social-performance-chart-repository";
import { logEvent } from "@/lib/harness/logger";
import type { DashboardFilter } from "./social-performance-dashboard-types";
import type { SocialPost } from "./social-platform-types";
import type { SocialPostMetrics } from "./social-metrics-types";
import {
  DEFAULT_DASHBOARD_CHART_FILTER,
  type DashboardChartFilter,
  type SocialPerformanceCharts,
  type PlatformPerformanceChartData,
  type TonePerformanceChartData,
  type MetricsTrendChartData,
  type TimeSeriesDataPoint,
  type RewriteComparisonChartData,
  type LowPerformanceChartData,
  type MetricsMissingChartData,
} from "./social-performance-chart-types";

function normalizeFilter(filter?: Partial<DashboardChartFilter>): DashboardChartFilter {
  return { ...DEFAULT_DASHBOARD_CHART_FILTER, ...filter };
}

/** DashboardChartFilter를 기존 repository가 기대하는 DashboardFilter로 변환한다. */
function toDashboardFilter(filter: DashboardChartFilter): DashboardFilter {
  return {
    articleId: filter.articleId,
    platform: filter.platform,
    toneStyle: filter.toneStyle,
    contentGroup: "all",
    dateFrom: filter.dateFrom,
    dateTo: filter.dateTo,
    includeRewriteVersions: filter.includeRewriteVersions,
    onlyRewriteVersions: false,
    onlyRecommendedForRepost: false,
    onlyMetricsMissing: false,
    onlyLowPerformance: false,
  };
}

function safeFilterDetails(filter: DashboardChartFilter): Record<string, unknown> {
  return {
    filterPlatform: filter.platform ?? null,
    filterToneStyle: filter.toneStyle ?? null,
    includeRewriteVersions: filter.includeRewriteVersions,
    onlyPublished: filter.onlyPublished,
    onlyMeasured: filter.onlyMeasured,
  };
}

/** onlyPublished/onlyMeasured는 DashboardFilter에 없는 차트 전용 필터라 조회 후 JS에서 적용한다. */
function applyChartOnlyFilters(posts: SocialPost[], filter: DashboardChartFilter): SocialPost[] {
  return posts.filter((post) => {
    if (filter.onlyPublished && post.publishStatus !== "published") return false;
    if (filter.onlyMeasured && post.latestMetricsRecordedAt === null) return false;
    return true;
  });
}

function buildPlatformPerformanceChart(rows: Awaited<ReturnType<typeof listPlatformChartRows>>): PlatformPerformanceChartData[] {
  return rows.map((row) => ({
    platform: row.platform,
    averagePerformanceScore: row.averagePerformanceScore,
    totalViews: row.totalViews,
    totalClicks: row.totalClicks,
    totalEngagement: row.totalLikes + row.totalComments + row.totalShares + row.totalSaves,
    measuredCount: row.metricsMeasuredCount,
  }));
}

function buildTonePerformanceChart(rows: Awaited<ReturnType<typeof listToneChartRows>>): TonePerformanceChartData[] {
  return rows.map((row) => ({
    toneStyle: row.toneStyle,
    averagePerformanceScore: row.averagePerformanceScore,
    totalViews: row.totalViews,
    totalClicks: row.totalClicks,
    // TonePerformanceSummary에는 metricsMeasuredCount가 없어 postCount로 대체한다(Phase 3-15 집계 그대로 재사용).
    measuredCount: row.postCount,
  }));
}

/** measuredAt을 "YYYY-MM"(월) 또는 "YYYY-MM-DD"(일) 문자열로 자른다. */
function periodKey(measuredAt: string, granularity: "month" | "day"): string {
  return granularity === "month" ? measuredAt.slice(0, 7) : measuredAt.slice(0, 10);
}

/**
 * metrics를 월별로 묶어 추세를 만든다. 서로 다른 월이 2개 이상이면
 * "month" 단위로, 그렇지 않으면(짧은 기간에 데이터가 몰려있으면) "day"
 * 단위로 묶는다 — 스펙 안내("월별 집계를 우선 사용, 데이터가 적으면
 * 일별 또는 최근 metrics 기준")를 따른다.
 */
function buildMetricsTrendChart(metrics: SocialPostMetrics[], dateFrom?: string, dateTo?: string): MetricsTrendChartData {
  const filtered = metrics.filter((m) => {
    if (dateFrom && m.measuredAt < dateFrom) return false;
    if (dateTo && m.measuredAt > dateTo) return false;
    return true;
  });

  if (filtered.length === 0) return { granularity: "month", points: [] };

  const distinctMonths = new Set(filtered.map((m) => m.measuredAt.slice(0, 7)));
  const granularity: "month" | "day" = distinctMonths.size >= 2 ? "month" : "day";

  const buckets = new Map<string, { views: number; impressions: number; likes: number; comments: number; shares: number; clicks: number; scores: number[] }>();

  for (const m of filtered) {
    const key = periodKey(m.measuredAt, granularity);
    const bucket = buckets.get(key) ?? { views: 0, impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0, scores: [] };
    bucket.views += m.views;
    bucket.impressions += m.impressions;
    bucket.likes += m.likes;
    bucket.comments += m.comments;
    bucket.shares += m.shares;
    bucket.clicks += m.clicks;
    if (m.performanceScore !== null) bucket.scores.push(m.performanceScore);
    buckets.set(key, bucket);
  }

  const points: TimeSeriesDataPoint[] = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, bucket]) => ({
      period,
      views: bucket.views,
      impressions: bucket.impressions,
      likes: bucket.likes,
      comments: bucket.comments,
      shares: bucket.shares,
      clicks: bucket.clicks,
      averagePerformanceScore: bucket.scores.length > 0 ? bucket.scores.reduce((sum, s) => sum + s, 0) / bucket.scores.length : null,
    }));

  return { granularity, points };
}

function buildRewriteComparisonChart(summary: Awaited<ReturnType<typeof listRewritePerformanceComparisonsForChart>>): RewriteComparisonChartData {
  return {
    rewriteWonCount: summary.rewriteWonCount,
    originalWonCount: summary.originalWonCount,
    similarCount: summary.similarCount,
    needsMoreDataCount: summary.needsMoreDataCount,
  };
}

function buildLowPerformanceChart(posts: SocialPost[]): LowPerformanceChartData {
  return {
    low: posts.filter((p) => p.performanceStatus === "low").length,
    needsReview: posts.filter((p) => p.performanceStatus === "needs_review").length,
    notMeasured: posts.filter((p) => p.performanceStatus === "not_measured").length,
    average: posts.filter((p) => p.performanceStatus === "average").length,
    good: posts.filter((p) => p.performanceStatus === "good").length,
    excellent: posts.filter((p) => p.performanceStatus === "excellent").length,
  };
}

function buildMetricsMissingChart(posts: SocialPost[]): MetricsMissingChartData {
  return {
    measured: posts.filter((p) => p.latestMetricsRecordedAt !== null).length,
    missing: posts.filter((p) => p.latestMetricsRecordedAt === null).length,
  };
}

/**
 * Social Performance Dashboard용 차트 데이터를 조회/집계해 반환한다.
 * 읽기 전용이며, 어떤 social_posts/metrics/comparisons row도 이 함수
 * 호출로 인해 바뀌지 않는다.
 */
export async function buildSocialPerformanceCharts(filter?: Partial<DashboardChartFilter>): Promise<SocialPerformanceCharts> {
  const normalized = normalizeFilter(filter);
  const dashboardFilter = toDashboardFilter(normalized);

  await logEvent({
    type: "social_performance_charts_build_started",
    status: "info",
    message: "Social Performance 차트 조회를 시작합니다.",
    ...(normalized.articleId ? { articleId: normalized.articleId, targetType: "article", targetId: normalized.articleId } : {}),
    details: safeFilterDetails(normalized),
  });

  try {
    const [platformRows, toneRows, posts, metrics, rewriteSummary] = await Promise.all([
      listPlatformChartRows(dashboardFilter),
      listToneChartRows(dashboardFilter),
      listSocialPostsForChart(dashboardFilter),
      listMetricsForTrend(dashboardFilter),
      listRewritePerformanceComparisonsForChart(dashboardFilter),
    ]);

    const chartPosts = applyChartOnlyFilters(posts, normalized);

    const platformPerformanceChart = buildPlatformPerformanceChart(platformRows);
    const tonePerformanceChart = buildTonePerformanceChart(toneRows);
    const metricsTrendChart = buildMetricsTrendChart(metrics, normalized.dateFrom, normalized.dateTo);
    const rewriteComparisonChart = buildRewriteComparisonChart(rewriteSummary);
    const lowPerformanceChart = buildLowPerformanceChart(chartPosts);
    const metricsMissingChart = buildMetricsMissingChart(chartPosts);

    await logEvent({
      type: "social_performance_charts_build_completed",
      status: "success",
      message: "Social Performance 차트 조회를 완료했습니다.",
      ...(normalized.articleId ? { articleId: normalized.articleId, targetType: "article", targetId: normalized.articleId } : {}),
      details: {
        ...safeFilterDetails(normalized),
        platformChartCount: platformPerformanceChart.length,
        toneChartCount: tonePerformanceChart.length,
        trendPointCount: metricsTrendChart.points.length,
        rewriteComparisonCount:
          rewriteComparisonChart.rewriteWonCount +
          rewriteComparisonChart.originalWonCount +
          rewriteComparisonChart.similarCount +
          rewriteComparisonChart.needsMoreDataCount,
        lowPerformanceCount: lowPerformanceChart.low + lowPerformanceChart.needsReview,
        metricsMissingCount: metricsMissingChart.missing,
      },
    });

    return {
      filter: normalized,
      platformPerformanceChart,
      tonePerformanceChart,
      metricsTrendChart,
      rewriteComparisonChart,
      lowPerformanceChart,
      metricsMissingChart,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logEvent({
      type: "social_performance_charts_build_failed",
      status: "failed",
      message,
      ...(normalized.articleId ? { articleId: normalized.articleId, targetType: "article", targetId: normalized.articleId } : {}),
      details: { ...safeFilterDetails(normalized), reasonCode: "build_exception" },
    });
    throw error;
  }
}
