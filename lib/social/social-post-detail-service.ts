// Phase 3-18: Social Post Detail Route & Pagination.
// /social-posts/[id] 상세 페이지 전용 데이터 조회. 이 파일의 어떤
// 함수도 데이터를 변경하지 않는다(read-only) — action 실행은 기존
// app/articles/[id]/actions.ts를 그대로 재사용한다.

import { getArticleById } from "@/lib/repositories/article-repository";
import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { listMetricsBySocialPost } from "@/lib/repositories/social-metrics-repository";
import { listRewriteSuggestionsBySocialPost } from "@/lib/repositories/social-rewrite-suggestions-repository";
import { getVersionChain } from "@/lib/repositories/social-post-versions-repository";
import { getVersionComparisonById } from "@/lib/repositories/social-version-comparisons-repository";
import { getRewritePerformanceComparisonById } from "@/lib/repositories/social-rewrite-performance-comparisons-repository";
import { classifyContentGroup, classifyContentType, type ContentGroup, type ContentType } from "./content-type-classifier";
import {
  buildArticleOverviewUrl,
  buildArticleBlogUrl,
  buildArticleSocialUrl,
  buildArticleRewriteUrl,
  buildArticlePerformanceUrl,
  buildSocialPostDetailUrl,
  buildMetricsDeepLink,
  buildRewriteVersionDeepLink,
} from "@/lib/navigation/article-deep-links";
import type { SocialPost, RewritePerformanceComparison } from "./social-platform-types";
import type { SocialPostMetrics } from "./social-metrics-types";
import type { SocialPostRewriteSuggestion, SocialPostVersion, SocialPostVersionComparison } from "./social-rewrite-types";
import type { Article } from "@/lib/types/domain";

const RECENT_METRICS_LIMIT = 10;

export interface SocialPostDetailRelatedLinks {
  articleOverview: string;
  articleBlog: string;
  articleSocial: string;
  articleRewrite: string;
  articlePerformance: string;
  /** rewrite version이 실제로 적용된 원본 social_post 상세 (없으면 null). */
  originalSocialPostDetail: string | null;
  /** 바로 위 parent version 상세 (없으면 null). */
  parentSocialPostDetail: string | null;
  /** 버전 체인의 root social_post 상세 (자기 자신이 root면 null). */
  rootSocialPostDetail: string | null;
  performanceDeepLink: string;
  rewriteDeepLink: string;
}

export interface SocialPostDetailData {
  socialPost: SocialPost;
  article: Article | null;
  contentGroup: ContentGroup;
  contentType: ContentType;
  latestMetrics: SocialPostMetrics | null;
  /** 최근 측정 시각 기준 최근 10개. */
  recentMetrics: SocialPostMetrics[];
  versionChain: SocialPostVersion[];
  rewriteSuggestions: SocialPostRewriteSuggestion[];
  latestVersionComparison: SocialPostVersionComparison | null;
  latestRewritePerformanceComparison: RewritePerformanceComparison | null;
  relatedLinks: SocialPostDetailRelatedLinks;
}

/** social_post 하나의 상세 조회 데이터를 만든다. 존재하지 않으면 null을 반환한다. */
export async function getSocialPostDetail(socialPostId: string): Promise<SocialPostDetailData | null> {
  const socialPost = await getSocialPostById(socialPostId);
  if (!socialPost) return null;

  const [article, allMetrics, versionChain, rewriteSuggestions, latestVersionComparison, latestRewritePerformanceComparison] = await Promise.all([
    getArticleById(socialPost.articleId),
    listMetricsBySocialPost(socialPostId),
    getVersionChain(socialPostId),
    listRewriteSuggestionsBySocialPost(socialPostId),
    socialPost.latestVersionComparisonId ? getVersionComparisonById(socialPost.latestVersionComparisonId) : Promise.resolve(null),
    socialPost.latestRewritePerformanceComparisonId
      ? getRewritePerformanceComparisonById(socialPost.latestRewritePerformanceComparisonId)
      : Promise.resolve(null),
  ]);

  const recentMetrics = [...allMetrics]
    .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())
    .slice(0, RECENT_METRICS_LIMIT);
  const latestMetrics = recentMetrics[0] ?? null;

  const contentGroup = classifyContentGroup({
    kind: "social_post",
    platform: socialPost.platform,
    isRewriteVersion: socialPost.isRewriteVersion,
  });
  const contentType = classifyContentType({
    kind: "social_post",
    platform: socialPost.platform,
    isRewriteVersion: socialPost.isRewriteVersion,
  });

  const relatedLinks: SocialPostDetailRelatedLinks = {
    articleOverview: buildArticleOverviewUrl(socialPost.articleId),
    articleBlog: buildArticleBlogUrl(socialPost.articleId),
    articleSocial: buildArticleSocialUrl(socialPost.articleId),
    articleRewrite: buildArticleRewriteUrl(socialPost.articleId),
    articlePerformance: buildArticlePerformanceUrl(socialPost.articleId),
    originalSocialPostDetail: socialPost.rewriteAppliedFromSocialPostId
      ? buildSocialPostDetailUrl(socialPost.rewriteAppliedFromSocialPostId)
      : null,
    parentSocialPostDetail: socialPost.parentSocialPostId ? buildSocialPostDetailUrl(socialPost.parentSocialPostId) : null,
    rootSocialPostDetail:
      socialPost.rootSocialPostId && socialPost.rootSocialPostId !== socialPost.id
        ? buildSocialPostDetailUrl(socialPost.rootSocialPostId)
        : null,
    performanceDeepLink: buildMetricsDeepLink(socialPost.articleId, socialPost.id),
    rewriteDeepLink: buildRewriteVersionDeepLink(socialPost.articleId, socialPost.id),
  };

  return {
    socialPost,
    article: article ?? null,
    contentGroup,
    contentType,
    latestMetrics,
    recentMetrics,
    versionChain,
    rewriteSuggestions,
    latestVersionComparison,
    latestRewritePerformanceComparison,
    relatedLinks,
  };
}
