// Phase 3-17: Navigation Return Flow & Deep Links.
// article 하위 페이지(overview/blog/social/rewrite/performance) URL과
// 표준 deep link query parameter(socialPostId/rewriteSuggestionId/
// rewriteVersionId/comparisonId/metricsTargetId/section/highlight/
// returnTo)를 한 곳에서 생성한다. 문자열 concat 대신 URLSearchParams를
// 사용해 인코딩 오류를 방지하며, 이 파일의 어떤 함수도 실제 redirect나
// DB 조회를 수행하지 않는다 — 순수하게 URL 문자열만 계산한다.

import { getPlatformGroup } from "@/lib/social/content-type-classifier";
import type { SocialPlatform } from "@/lib/social/social-platform-types";
import { isSafeInternalReturnTo } from "./return-to";

export interface ArticleDeepLinkOptions {
  socialPostId?: string;
  rewriteSuggestionId?: string;
  rewriteVersionId?: string;
  comparisonId?: string;
  metricsTargetId?: string;
  /** 페이지 내 특정 섹션으로 이동하기 위한 anchor 이름 (예: "suggestions", "versions"). */
  section?: string;
  /** 강조 표시할 카드의 id. 지정하지 않으면 위 id 필드 중 하나를 그대로 사용해도 된다. */
  highlight?: string;
  /** 안전한 내부 경로일 때만 query에 포함된다. */
  returnTo?: string;
}

function buildUrl(basePath: string, options: ArticleDeepLinkOptions = {}): string {
  const params = new URLSearchParams();
  if (options.socialPostId) params.set("socialPostId", options.socialPostId);
  if (options.rewriteSuggestionId) params.set("rewriteSuggestionId", options.rewriteSuggestionId);
  if (options.rewriteVersionId) params.set("rewriteVersionId", options.rewriteVersionId);
  if (options.comparisonId) params.set("comparisonId", options.comparisonId);
  if (options.metricsTargetId) params.set("metricsTargetId", options.metricsTargetId);
  if (options.section) params.set("section", options.section);
  if (options.highlight) params.set("highlight", options.highlight);
  if (options.returnTo && isSafeInternalReturnTo(options.returnTo)) params.set("returnTo", options.returnTo);

  const query = params.toString();
  return query.length > 0 ? `${basePath}?${query}` : basePath;
}

export function buildArticleOverviewUrl(articleId: string, options: ArticleDeepLinkOptions = {}): string {
  return buildUrl(`/articles/${articleId}`, options);
}

export function buildArticleBlogUrl(articleId: string, options: ArticleDeepLinkOptions = {}): string {
  return buildUrl(`/articles/${articleId}/blog`, options);
}

export function buildArticleSocialUrl(articleId: string, options: ArticleDeepLinkOptions = {}): string {
  return buildUrl(`/articles/${articleId}/social`, options);
}

export function buildArticleRewriteUrl(articleId: string, options: ArticleDeepLinkOptions = {}): string {
  return buildUrl(`/articles/${articleId}/rewrite`, options);
}

export function buildArticlePerformanceUrl(articleId: string, options: ArticleDeepLinkOptions = {}): string {
  return buildUrl(`/articles/${articleId}/performance`, options);
}

/**
 * social_post 하나로 이동하는 deep link를 만든다. platform이
 * wordpress_blog/naver_blog이면 /blog로, naver_cafe/x/threads/instagram
 * 이면(rewrite version 여부와 무관하게 원래 platform 기준) /social로
 * 보낸다. rewrite version은 /rewrite 페이지에서 별도로 다루므로 이
 * 함수는 원본 카드 기준 이동에만 사용한다.
 */
export function buildSocialPostDeepLink(
  articleId: string,
  platform: SocialPlatform,
  socialPostId: string,
  returnTo?: string
): string {
  const group = getPlatformGroup(platform);
  const options: ArticleDeepLinkOptions = { socialPostId, highlight: socialPostId, returnTo };
  return group === "blog" ? buildArticleBlogUrl(articleId, options) : buildArticleSocialUrl(articleId, options);
}

/** rewrite suggestion 카드로 이동하는 deep link (항상 /rewrite). */
export function buildRewriteSuggestionDeepLink(articleId: string, rewriteSuggestionId: string, returnTo?: string): string {
  return buildArticleRewriteUrl(articleId, { rewriteSuggestionId, highlight: rewriteSuggestionId, returnTo });
}

/** rewrite version 카드로 이동하는 deep link (항상 /rewrite). */
export function buildRewriteVersionDeepLink(articleId: string, rewriteVersionId: string, returnTo?: string): string {
  return buildArticleRewriteUrl(articleId, { rewriteVersionId, highlight: rewriteVersionId, returnTo });
}

/** 특정 social_post의 metrics 항목으로 이동하는 deep link (항상 /performance). */
export function buildMetricsDeepLink(articleId: string, socialPostId: string, returnTo?: string): string {
  return buildArticlePerformanceUrl(articleId, {
    metricsTargetId: socialPostId,
    socialPostId,
    highlight: socialPostId,
    returnTo,
  });
}

/** original vs rewrite 성과 비교 결과로 이동하는 deep link (항상 /performance). */
export function buildComparisonDeepLink(articleId: string, comparisonId: string, returnTo?: string): string {
  return buildArticlePerformanceUrl(articleId, { comparisonId, highlight: comparisonId, returnTo });
}

/**
 * Phase 3-18: social_post 하나의 전용 상세 페이지(`/social-posts/[id]`)로
 * 가는 링크를 만든다. articleId를 몰라도 되므로 다른 deep link 함수와
 * 달리 basePath에 articleId가 들어가지 않는다. returnTo가 안전한 내부
 * 경로일 때만 query에 포함된다.
 */
export function buildSocialPostDetailUrl(socialPostId: string, returnTo?: string): string {
  const params = new URLSearchParams();
  if (returnTo && isSafeInternalReturnTo(returnTo)) params.set("returnTo", returnTo);
  const query = params.toString();
  return query.length > 0 ? `/social-posts/${socialPostId}?${query}` : `/social-posts/${socialPostId}`;
}
