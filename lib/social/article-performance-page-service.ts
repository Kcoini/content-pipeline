// Phase 3-16 (Article/Blog/Social/Rewrite/Performance Page Separation):
// /articles/[id]/performance 페이지 전용 데이터 조회. Phase 3-15의
// Social Performance Dashboard 서비스를 articleId로 필터링해 그대로
// 재사용한다 — 성과 계산 방식은 바꾸지 않는다.
//
// Phase 3-18: dashboard.recentMetrics에만 pagination을 적용했다(가장
// 길어질 수 있는 목록). lowPerformancePosts/metricsMissingPosts는
// 우선 최근 N개만 보여주고(스펙 안내) 별도 pagination은 다음 단계로
// 남겨둔다. dashboard 객체 자체(Phase 3-15 로직)는 전혀 바꾸지 않았다
// — 이 서비스가 추가로 반환하는 필드는 dashboard 위에 얹은 파생값이다.

import { getArticleById } from "@/lib/repositories/article-repository";
import { buildSocialPerformanceDashboard } from "./social-performance-dashboard-service";
import { paginateItems, findItemPage, DEFAULT_PAGE, DEFAULT_PER_PAGE, type PaginationInfo } from "@/lib/navigation/pagination";
import type { SocialPerformanceDashboard } from "./social-performance-dashboard-types";
import type { SocialPostMetrics } from "./social-metrics-types";
import type { Article } from "@/lib/types/domain";

/** lowPerformancePosts/metricsMissingPosts처럼 별도 pagination 없이 우선 보여줄 최근 개수. */
const RECENT_ITEMS_LIMIT = 10;

export interface ArticlePerformancePageData {
  article: Article | null;
  dashboard: SocialPerformanceDashboard;
  /** dashboard.recentMetrics를 page로 자른 결과 (없으면 빈 배열). */
  recentMetricsPage: SocialPostMetrics[];
  recentMetricsPagination: PaginationInfo;
  /** targetSocialPostId를 지정했고 recentMetrics에 존재하면 그 항목이 속한 page 번호. */
  metricsTargetPage: number | null;
}

export interface ArticlePerformancePageOptions {
  page?: number;
  perPage?: number;
  /** metricsTargetId/socialPostId deep link — recentMetrics 중 몇 번째 page에 있는지 계산하는 데만 쓰인다. */
  targetSocialPostId?: string;
}

/**
 * article 하나에 대한 성과 데이터를 조회한다. rewrite version도 항상
 * 포함해(includeRewriteVersions=true) 원본과 비교할 수 있게 한다.
 */
export async function buildArticlePerformancePageData(
  articleId: string,
  options: ArticlePerformancePageOptions = {}
): Promise<ArticlePerformancePageData> {
  const page = options.page ?? DEFAULT_PAGE;
  const perPage = options.perPage ?? DEFAULT_PER_PAGE;

  const [article, dashboard] = await Promise.all([
    getArticleById(articleId),
    buildSocialPerformanceDashboard({ articleId, includeRewriteVersions: true, contentGroup: "all" }, "updated_at desc"),
  ]);

  const recentMetricsAll = dashboard.recentMetrics ?? [];
  const { items: recentMetricsPage, pagination: recentMetricsPagination } = paginateItems(recentMetricsAll, page, perPage);
  const metricsTargetPage = options.targetSocialPostId
    ? findItemPage(recentMetricsAll, (m) => m.socialPostId === options.targetSocialPostId, perPage)
    : null;

  return { article: article ?? null, dashboard, recentMetricsPage, recentMetricsPagination, metricsTargetPage };
}

export { RECENT_ITEMS_LIMIT };
