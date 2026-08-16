// Phase 3-15: Social Performance Dashboard — 조회 전용 서비스.
// 이 서비스의 어떤 함수도 social_posts/metrics/comparisons 데이터를
// 변경하지 않는다(dashboard 조회는 상태를 바꾸지 않는다). 여기서 계산
// 되는 모든 점수/순위는 내부 비교용 참고 지표이며, metrics는 사람이
// 수동으로 입력한 값이다.

import {
  getSocialPerformanceDashboardSummary,
  listPlatformPerformanceSummaries,
  listTonePerformanceSummaries,
  listArticlePerformanceSummaries,
  listLowPerformanceSocialPosts,
  listMetricsMissingSocialPosts,
  listRewritePerformanceSummaries,
  listRecentMetrics,
  listRecentRewriteComparisons,
  listArticleContentBreakdowns,
} from "@/lib/repositories/social-performance-dashboard-repository";
import { logEvent } from "@/lib/harness/logger";
import {
  DEFAULT_DASHBOARD_FILTER,
  DEFAULT_DASHBOARD_SORT,
  type DashboardFilter,
  type DashboardSortOption,
  type SocialPerformanceDashboard,
  type ArticleContentBreakdown,
} from "./social-performance-dashboard-types";

function normalizeFilter(filter?: Partial<DashboardFilter>): DashboardFilter {
  return { ...DEFAULT_DASHBOARD_FILTER, ...filter };
}

function safeFilterDetails(filter: DashboardFilter): Record<string, unknown> {
  return {
    filterPlatform: filter.platform ?? null,
    filterToneStyle: filter.toneStyle ?? null,
    filterPerformanceStatus: filter.performanceStatus ?? null,
    contentGroup: filter.contentGroup ?? null,
    includeRewriteVersions: filter.includeRewriteVersions,
    onlyLowPerformance: filter.onlyLowPerformance,
    onlyMetricsMissing: filter.onlyMetricsMissing,
  };
}

/**
 * Social Performance Dashboard 전체 데이터를 조회/집계해 반환한다.
 * 읽기 전용이며, 어떤 social_posts row도 이 함수 호출로 인해 바뀌지
 * 않는다.
 */
export async function buildSocialPerformanceDashboard(
  filter?: Partial<DashboardFilter>,
  sort: DashboardSortOption = DEFAULT_DASHBOARD_SORT
): Promise<SocialPerformanceDashboard> {
  const normalized = normalizeFilter(filter);

  await logEvent({
    type: "social_performance_dashboard_build_started",
    status: "info",
    message: "Social Performance Dashboard 조회를 시작합니다.",
    ...(normalized.articleId ? { articleId: normalized.articleId, targetType: "article", targetId: normalized.articleId } : {}),
    details: safeFilterDetails(normalized),
  });

  try {
    const [
      summary,
      platformSummaries,
      toneSummaries,
      articleSummaries,
      lowPerformancePosts,
      metricsMissingPosts,
      rewritePerformanceSummary,
      recentMetrics,
      recentRewriteComparisons,
    ] = await Promise.all([
      getSocialPerformanceDashboardSummary(normalized),
      listPlatformPerformanceSummaries(normalized),
      listTonePerformanceSummaries(normalized),
      listArticlePerformanceSummaries(normalized),
      listLowPerformanceSocialPosts(normalized),
      listMetricsMissingSocialPosts(normalized),
      listRewritePerformanceSummaries(normalized),
      listRecentMetrics(normalized),
      listRecentRewriteComparisons(normalized),
    ]);

    const bestPlatform = platformSummaries.length > 0 ? platformSummaries[0].platform : null;
    const bestToneStyle = toneSummaries.length > 0 ? toneSummaries[0].toneStyle : null;

    await logEvent({
      type: "social_performance_dashboard_build_completed",
      status: "success",
      message: "Social Performance Dashboard 조회를 완료했습니다.",
      ...(normalized.articleId ? { articleId: normalized.articleId, targetType: "article", targetId: normalized.articleId } : {}),
      details: {
        ...safeFilterDetails(normalized),
        totalSocialPosts: summary.totalSocialPosts,
        measuredPosts: summary.metricsMeasuredPosts,
        metricsMissingPosts: summary.metricsMissingPosts,
        platformCount: platformSummaries.length,
        toneCount: toneSummaries.length,
        articleCount: articleSummaries.length,
        rewriteComparisonCount: summary.rewriteComparisonsCount,
        lowPerformanceCount: lowPerformancePosts.length,
      },
    });

    return {
      filter: normalized,
      sort,
      summary,
      platformSummaries,
      toneSummaries,
      articleSummaries,
      lowPerformancePosts,
      metricsMissingPosts,
      rewritePerformanceSummary,
      recentMetrics,
      recentRewriteComparisons,
      bestPlatform,
      bestToneStyle,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logEvent({
      type: "social_performance_dashboard_build_failed",
      status: "failed",
      message,
      ...(normalized.articleId ? { articleId: normalized.articleId, targetType: "article", targetId: normalized.articleId } : {}),
      details: { ...safeFilterDetails(normalized), reasonCode: "build_exception" },
    });
    throw error;
  }
}

/**
 * article 중심으로 blog/community/social/rewrite 글 개수와 게시/성과
 * 현황을 요약한다 (Phase 3-16 Content Dashboard). 읽기 전용이다.
 */
export async function buildContentDashboard(filter?: Partial<DashboardFilter>): Promise<ArticleContentBreakdown[]> {
  const normalized = normalizeFilter(filter);
  const breakdowns = await listArticleContentBreakdowns(normalized);

  await logEvent({
    type: "dashboard_information_architecture_loaded",
    status: "success",
    message: "Content Dashboard 조회를 완료했습니다.",
    details: { ...safeFilterDetails(normalized), articleCount: breakdowns.length },
  });

  return breakdowns;
}

/** blog/rewrite dashboard가 열릴 때 어떤 필터로 조회했는지만 가볍게 기록한다. */
export async function logDashboardInformationArchitectureLoaded(filter: DashboardFilter): Promise<void> {
  await logEvent({
    type: "dashboard_information_architecture_loaded",
    status: "success",
    message: "Dashboard Information Architecture 화면을 조회했습니다.",
    details: safeFilterDetails(filter),
  });
}
