// Phase 3-10: Performance-based Rewrite Suggestion — 성과 진단.
// social_post_metrics/social_posts.latest_* 데이터를 바탕으로 어떤
// 부분이 약한지 진단한다. 실제 글을 수정하지 않으며, 외부 API를
// 호출하지 않는다.

import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { getLatestMetricsBySocialPost } from "@/lib/repositories/social-metrics-repository";
import { getPlatformMetricsConfig } from "./platform-metrics-config";
import { getPlatformWritingConfig } from "./platform-writing-config";
import { getToneTransformerRule } from "./tone-transformer-rules";
import { isSocialPlatform, isToneStyle } from "./social-platform-types";
import type { PerformanceDiagnosisResult } from "./social-rewrite-types";
import type { SocialPost } from "./social-platform-types";
import type { SocialPostMetrics } from "./social-metrics-types";

const LOW_ENGAGEMENT_RATE = 0.02;
const CTA_KEYWORDS = ["확인하세요", "확인해보세요", "댓글", "공유", "저장", "링크", "방문", "클릭"];

function collectPostText(post: SocialPost): string {
  const threadText = post.threadItems.map((item) => item.text).join(" ");
  const cardText = post.cardItems.map((item) => `${item.heading} ${item.body}`).join(" ");
  return [post.postTitle, post.postBody, post.caption, post.excerpt, threadText, cardText].filter(Boolean).join(" ");
}

function hasWeakHook(post: SocialPost): boolean {
  if (post.platform === "x") {
    const first = post.threadItems[0]?.text ?? "";
    return first.trim().length < 10;
  }
  const body = post.postBody ?? post.caption ?? "";
  const firstSentence = body.split(/[.!?\n]/)[0] ?? "";
  return firstSentence.trim().length < 8;
}

function hasWeakCta(post: SocialPost): boolean {
  const text = collectPostText(post);
  return !CTA_KEYWORDS.some((keyword) => text.includes(keyword));
}

function hasPlatformPrimaryField(post: SocialPost): boolean {
  switch (post.platform) {
    case "wordpress_blog":
    case "naver_blog":
    case "naver_cafe":
      return Boolean(post.postTitle?.trim() && post.postBody?.trim());
    case "x":
      return post.threadItems.length > 0;
    case "threads":
      return Boolean(post.postBody?.trim());
    case "instagram":
      return Boolean(post.caption?.trim());
    default:
      return true;
  }
}

/**
 * social post 하나의 성과를 진단한다. metrics가 없으면 blocked가 아닌
 * needs_review로 처리한다(개선 제안 자체는 계속 생성할 수 있게 하기
 * 위함). 실제 글 수정이나 외부 API 호출은 하지 않는다.
 */
export async function diagnoseSocialPostPerformance(socialPostId: string): Promise<PerformanceDiagnosisResult> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return {
      status: "blocked",
      diagnosis: {},
      improvementTargets: [],
      warnings: [],
      blockedReasons: [`social post를 찾을 수 없습니다: ${socialPostId}`],
    };
  }

  const blockedReasons: string[] = [];
  if (!isSocialPlatform(post.platform)) blockedReasons.push(`지원하지 않는 platform입니다: ${post.platform}`);
  if (!isToneStyle(post.toneStyle)) blockedReasons.push(`지원하지 않는 tone_style입니다: ${post.toneStyle}`);

  if (blockedReasons.length > 0) {
    return { status: "blocked", diagnosis: {}, improvementTargets: [], warnings: [], blockedReasons };
  }

  const metrics: SocialPostMetrics | null = await getLatestMetricsBySocialPost(socialPostId);
  const hasMetrics = metrics !== null;

  const warnings: string[] = [];
  if (post.manualPostStatus !== "posted") {
    warnings.push(`manual_post_status가 'posted'가 아닙니다(${post.manualPostStatus}).`);
  }
  if (post.publishStatus !== "published") {
    warnings.push(`publish_status가 'published'가 아닙니다(${post.publishStatus}).`);
  }

  const platformConfig = getPlatformWritingConfig(post.platform);
  const metricsConfig = getPlatformMetricsConfig(post.platform);
  const toneRule = getToneTransformerRule(post.toneStyle);

  const improvementTargets: string[] = [];
  const diagnosis: Record<string, unknown> = {
    performanceScore: post.latestPerformanceScore,
    performanceStatus: post.performanceStatus,
    hasMetrics,
  };

  if (hasMetrics && metrics) {
    const viewsOrImpressions = Math.max(metrics.views, metrics.impressions, metrics.reach);
    if (viewsOrImpressions < 100) {
      improvementTargets.push("views_impressions_low");
      diagnosis.viewsImpressionsLow = true;
    }
    if (metrics.engagementRate !== null && metrics.engagementRate < LOW_ENGAGEMENT_RATE) {
      improvementTargets.push("engagement_low");
      diagnosis.engagementLow = true;
    }
    if (metricsConfig.optionalMetrics.includes("clicks") && metrics.clicks === 0) {
      improvementTargets.push("clicks_low");
      diagnosis.clicksLow = true;
    }
    if (metrics.comments === 0) {
      improvementTargets.push("comments_low");
      diagnosis.commentsLow = true;
    }
    if (metrics.shares + metrics.saves === 0) {
      improvementTargets.push("shares_saves_low");
      diagnosis.sharesSavesLow = true;
    }
  } else {
    improvementTargets.push("metrics_missing");
    diagnosis.metricsMissing = true;
  }

  if (!hasPlatformPrimaryField(post)) {
    improvementTargets.push("platform_fit_weak");
    diagnosis.platformFitWeak = true;
  }

  const text = collectPostText(post);
  const toneMismatch = toneRule.bannedPhrases.some((phrase) => text.includes(phrase));
  if (toneMismatch) {
    improvementTargets.push("tone_mismatch");
    diagnosis.toneMismatch = true;
  }

  if (hasWeakHook(post)) {
    improvementTargets.push("hook_weak");
    diagnosis.hookWeak = true;
  }
  if (hasWeakCta(post)) {
    improvementTargets.push("cta_weak");
    diagnosis.ctaWeak = true;
  }

  if (platformConfig.supportsHashtags) {
    const hashtagCount = post.hashtags.length;
    if (hashtagCount === 0 || hashtagCount > platformConfig.recommendedHashtagCount * 2) {
      improvementTargets.push("hashtag_count");
      diagnosis.hashtagCountIssue = hashtagCount === 0 ? "missing" : "excessive";
    }
  }

  if (post.platform === "x") {
    const count = post.threadItems.length;
    if (count < 3 || count > 7) {
      improvementTargets.push("thread_structure_weak");
      diagnosis.threadStructureWeak = true;
    }
  }

  if (post.platform === "instagram") {
    const captionLen = post.caption?.length ?? 0;
    if (captionLen < platformConfig.minLength) {
      improvementTargets.push("caption_weak");
      diagnosis.captionWeak = true;
    }
    if (post.cardItems.length === 0) {
      improvementTargets.push("card_items_missing");
      diagnosis.cardItemsMissing = true;
    }
  }

  if (!post.postUrl && !post.manualPostUrl) {
    improvementTargets.push("missing_post_url");
    diagnosis.missingPostUrl = true;
  }

  const status: PerformanceDiagnosisResult["status"] = hasMetrics ? "ok" : "needs_review";

  return { status, diagnosis, improvementTargets, warnings, blockedReasons: [] };
}
