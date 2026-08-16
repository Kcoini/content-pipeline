// Phase 3-16 (Article/Blog/Social/Rewrite/Performance Page Separation):
// /articles/[id] 개요 페이지에서만 쓰는 가벼운 요약. article 원본과
// 그 기사에서 파생된 콘텐츠(블로그/SNS·커뮤니티/rewrite/성과)의 개수만
// 계산한다 — 긴 본문/caption/export_payload는 다루지 않는다.

import { getArticleById } from "@/lib/repositories/article-repository";
import { getSourcesByArticleId } from "@/lib/repositories/source-repository";
import { groupSocialPostsForArticle } from "./social-post-display-grouping-service";
import type { Article } from "@/lib/types/domain";

export interface ArticleContentSummary {
  article: Article;
  sourceCount: number;
  blogPostCount: number;
  socialPostCount: number;
  communityPostCount: number;
  rewriteVersionCount: number;
  postedCount: number;
  metricsMeasuredCount: number;
  metricsMissingCount: number;
  lowPerformanceCount: number;
  recommendedRewriteCount: number;
  latestUpdatedAt: string;
}

/** articleId 기준으로 개요 페이지에 필요한 개수만 집계한다. article이 없으면 null을 반환한다. */
export async function buildArticleContentSummary(articleId: string): Promise<ArticleContentSummary | null> {
  const [article, sources] = await Promise.all([getArticleById(articleId), getSourcesByArticleId(articleId)]);
  if (!article) return null;

  const grouped = await groupSocialPostsForArticle(articleId);
  const allPosts = [...grouped.blogPosts, ...grouped.communityPosts, ...grouped.socialPosts, ...grouped.rewriteVersions];

  const postedCount = allPosts.filter((post) => post.manualPostStatus === "posted").length;
  const metricsMeasuredCount = allPosts.filter((post) => post.latestMetricsRecordedAt !== null).length;
  const recommendedRewriteCount = grouped.rewriteVersions.filter((post) => post.recommendedForRepost).length;

  const latestUpdatedAt = allPosts.reduce((latest, post) => (post.updatedAt > latest ? post.updatedAt : latest), article.updatedAt);

  return {
    article,
    sourceCount: sources.length,
    blogPostCount: grouped.blogPosts.length,
    socialPostCount: grouped.socialPosts.length,
    communityPostCount: grouped.communityPosts.length,
    rewriteVersionCount: grouped.rewriteVersions.length,
    postedCount,
    metricsMeasuredCount,
    metricsMissingCount: grouped.metricsMissingItems.length,
    lowPerformanceCount: grouped.lowPerformanceItems.length,
    recommendedRewriteCount,
    latestUpdatedAt,
  };
}
