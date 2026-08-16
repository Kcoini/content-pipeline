// Phase 3-19: Dashboard Charts & Trend Visualization — 차트 전용 조회
// repository. 새 SQL을 작성하지 않고 Phase 3-15의
// social-performance-dashboard-repository.ts가 이미 제공하는 select-only
// 함수를 그대로 위임(delegate)한다 — 이 파일의 어떤 함수도 social_posts/
// social_post_metrics/social_rewrite_performance_comparisons 데이터를
// 수정하지 않는다. 이름만 차트 용도에 맞게 다시 노출해 chart service가
// dashboard repository 내부 구조를 몰라도 되게 한다.

import {
  listSocialPostsForDashboard,
  listPlatformPerformanceSummaries,
  listTonePerformanceSummaries,
  listRecentMetrics,
  listRewritePerformanceSummaries,
} from "./social-performance-dashboard-repository";
import type { DashboardFilter, PlatformPerformanceSummary, TonePerformanceSummary, RewritePerformanceSummary } from "@/lib/social/social-performance-dashboard-types";
import type { SocialPost } from "@/lib/social/social-platform-types";
import type { SocialPostMetrics } from "@/lib/social/social-metrics-types";

/** 차트(low performance/metrics missing)에 쓸 social_post 목록을 조회한다. */
export async function listSocialPostsForChart(filter: DashboardFilter): Promise<SocialPost[]> {
  return listSocialPostsForDashboard(filter);
}

/** platform performance chart용 platform별 집계를 조회한다. */
export async function listPlatformChartRows(filter: DashboardFilter): Promise<PlatformPerformanceSummary[]> {
  return listPlatformPerformanceSummaries(filter);
}

/** tone performance chart용 tone_style별 집계를 조회한다. */
export async function listToneChartRows(filter: DashboardFilter): Promise<TonePerformanceSummary[]> {
  return listTonePerformanceSummaries(filter);
}

/**
 * metrics trend chart용 최근 metrics 목록을 조회한다(최대 20건, Phase
 * 3-15와 동일한 상한). "정확한 실시간 분석"이 아니라 dashboard summary용
 * trend이므로 이 상한을 그대로 따른다 — 자세한 배경은
 * docs/phase-3-19-dashboard-charts-trend-visualization.md 참고.
 */
export async function listMetricsForTrend(filter: DashboardFilter): Promise<SocialPostMetrics[]> {
  return listRecentMetrics(filter);
}

/** rewrite comparison chart용 전체(제한 없는) 비교 결과 집계를 조회한다. */
export async function listRewritePerformanceComparisonsForChart(filter: DashboardFilter): Promise<RewritePerformanceSummary> {
  return listRewritePerformanceSummaries(filter);
}
