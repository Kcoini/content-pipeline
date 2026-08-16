// Phase 3-16 (Article/Blog/Social/Rewrite/Performance Page Separation):
// /articles/[id]/performance 페이지 전용 데이터 조회. Phase 3-15의
// Social Performance Dashboard 서비스를 articleId로 필터링해 그대로
// 재사용한다 — 성과 계산 방식은 바꾸지 않는다.

import { getArticleById } from "@/lib/repositories/article-repository";
import { buildSocialPerformanceDashboard } from "./social-performance-dashboard-service";
import type { SocialPerformanceDashboard } from "./social-performance-dashboard-types";
import type { Article } from "@/lib/types/domain";

export interface ArticlePerformancePageData {
  article: Article | null;
  dashboard: SocialPerformanceDashboard;
}

/**
 * article 하나에 대한 성과 데이터를 조회한다. rewrite version도 항상
 * 포함해(includeRewriteVersions=true) 원본과 비교할 수 있게 한다.
 */
export async function buildArticlePerformancePageData(articleId: string): Promise<ArticlePerformancePageData> {
  const [article, dashboard] = await Promise.all([
    getArticleById(articleId),
    buildSocialPerformanceDashboard({ articleId, includeRewriteVersions: true, contentGroup: "all" }, "updated_at desc"),
  ]);

  return { article: article ?? null, dashboard };
}
