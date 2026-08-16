// Phase 3-16: Content Type Separation & Dashboard Information Architecture.
// article 상세/대시보드 화면에서 social_posts를 content group별로 묶어
// 보여주기 위한 조회 전용 서비스. 이 서비스의 어떤 함수도 social_posts/
// articles 데이터를 변경하지 않는다(select만 수행).

import { listSocialPostsByArticle } from "@/lib/repositories/social-posts-repository";
import { getArticleById } from "@/lib/repositories/article-repository";
import { logEvent } from "@/lib/harness/logger";
import { getPlatformGroup } from "./content-type-classifier";
import type { SocialPost } from "./social-platform-types";
import type { Article } from "@/lib/types/domain";

export interface GroupedSocialPosts {
  originalArticle: Article | null;
  blogPosts: SocialPost[];
  communityPosts: SocialPost[];
  socialPosts: SocialPost[];
  rewriteVersions: SocialPost[];
  performanceItems: SocialPost[];
  metricsMissingItems: SocialPost[];
  lowPerformanceItems: SocialPost[];
}

function groupPosts(posts: SocialPost[]): Omit<GroupedSocialPosts, "originalArticle"> {
  const blogPosts: SocialPost[] = [];
  const communityPosts: SocialPost[] = [];
  const socialPosts: SocialPost[] = [];
  const rewriteVersions: SocialPost[] = [];
  const performanceItems: SocialPost[] = [];
  const metricsMissingItems: SocialPost[] = [];
  const lowPerformanceItems: SocialPost[] = [];

  for (const post of posts) {
    if (post.isRewriteVersion) {
      rewriteVersions.push(post);
    } else {
      const group = getPlatformGroup(post.platform);
      if (group === "blog") blogPosts.push(post);
      else if (group === "community") communityPosts.push(post);
      else if (group === "social") socialPosts.push(post);
    }

    if (post.latestMetricsRecordedAt !== null || post.manualPostStatus === "posted") {
      performanceItems.push(post);
    }
    if (post.manualPostStatus === "posted" && post.latestMetricsRecordedAt === null) {
      metricsMissingItems.push(post);
    }
    if (post.performanceStatus === "low" || post.performanceStatus === "needs_review") {
      lowPerformanceItems.push(post);
    }
  }

  return { blogPosts, communityPosts, socialPosts, rewriteVersions, performanceItems, metricsMissingItems, lowPerformanceItems };
}

/**
 * social_posts를 content group(블로그/커뮤니티/SNS/rewrite/성과)별로
 * 묶는다. articleId(string)를 넘기면 article과 social_posts를 함께
 * 조회하고 로그를 남긴다. 이미 조회한 SocialPost[]가 있으면 그대로
 * 넘겨 중복 조회 없이 그룹만 계산할 수 있다(이 경우 originalArticle은
 * null이고 로그도 남기지 않는다).
 */
export async function groupSocialPostsForArticle(input: string | SocialPost[]): Promise<GroupedSocialPosts> {
  if (typeof input !== "string") {
    return { originalArticle: null, ...groupPosts(input) };
  }

  const articleId = input;

  await logEvent({
    type: "content_grouping_started",
    status: "info",
    message: `article(${articleId})의 콘텐츠 그룹 분류를 시작합니다.`,
    articleId,
    targetType: "article",
    targetId: articleId,
    details: { articleId },
  });

  try {
    const [article, posts] = await Promise.all([getArticleById(articleId), listSocialPostsByArticle(articleId)]);
    const grouped = groupPosts(posts);

    await logEvent({
      type: "content_grouping_completed",
      status: "success",
      message: `article(${articleId})의 콘텐츠 그룹 분류를 완료했습니다.`,
      articleId,
      targetType: "article",
      targetId: articleId,
      details: {
        articleId,
        blogPostCount: grouped.blogPosts.length,
        communityPostCount: grouped.communityPosts.length,
        socialPostCount: grouped.socialPosts.length,
        rewriteVersionCount: grouped.rewriteVersions.length,
        metricsMissingCount: grouped.metricsMissingItems.length,
        lowPerformanceCount: grouped.lowPerformanceItems.length,
      },
    });

    return { originalArticle: article ?? null, ...grouped };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logEvent({
      type: "content_grouping_failed",
      status: "failed",
      message,
      articleId,
      targetType: "article",
      targetId: articleId,
      details: { articleId },
    });
    throw error;
  }
}
