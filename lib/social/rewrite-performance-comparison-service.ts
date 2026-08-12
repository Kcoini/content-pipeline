// Phase 3-14: Rewrite Performance Tracking & Original-vs-Rewrite Result
// Comparison — 원본 social_post와 rewrite version의 수동 입력 metrics를
// 비교하는 서비스. 실제 플랫폼 Analytics API 호출/자동 A/B 테스트/자동
// 재게시/자동 원본 수정은 어디에도 없다. 비교 결과는 사람이 판단하기
// 위한 참고 자료일 뿐이다.

import {
  getSocialPostForRewritePerformanceComparison,
  getSocialPostById,
} from "@/lib/repositories/social-posts-repository";
import { getLatestMetricsBySocialPost } from "@/lib/repositories/social-metrics-repository";
import {
  createRewritePerformanceComparison,
  updateSocialPostRewritePerformanceSummary,
} from "@/lib/repositories/social-rewrite-performance-comparisons-repository";
import {
  calculateOverallRewriteImprovement,
  type RewritePerformanceMetricsInput,
} from "./rewrite-performance-comparison-calculator";
import { classifyRewritePerformanceComparison } from "./rewrite-performance-comparison-rules";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { SocialPost, RewritePerformanceComparison } from "./social-platform-types";
import type { SocialPostMetrics } from "./social-metrics-types";

export interface CompareRewritePerformanceResult {
  success: boolean;
  message: string;
  comparison?: RewritePerformanceComparison;
  socialPost?: SocialPost;
  warnings?: string[];
}

async function logComparisonEvent(
  type: LogEventType,
  status: LogStatus,
  message: string,
  articleId: string,
  details?: Record<string, unknown>
): Promise<void> {
  await logEvent({
    type,
    status,
    message,
    articleId,
    targetType: "article",
    targetId: articleId,
    ...(details ? { details } : {}),
  });
}

function baseDetails(rewrite: SocialPost, extra?: Record<string, unknown>): Record<string, unknown> {
  return {
    articleId: rewrite.articleId,
    rewriteSocialPostId: rewrite.id,
    platform: rewrite.platform,
    toneStyle: rewrite.toneStyle,
    rewriteVersionNumber: rewrite.versionNumber,
    ...extra,
  };
}

function toMetricsInput(metrics: SocialPostMetrics | null): RewritePerformanceMetricsInput {
  if (!metrics) {
    return {
      views: 0,
      impressions: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      clicks: 0,
      profileVisits: 0,
      follows: 0,
      conversionCount: 0,
      engagementRate: null,
      clickThroughRate: null,
      conversionRate: null,
      performanceScore: null,
    };
  }
  return {
    views: metrics.views,
    impressions: metrics.impressions,
    reach: metrics.reach,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
    saves: metrics.saves,
    clicks: metrics.clicks,
    profileVisits: metrics.profileVisits,
    follows: metrics.follows,
    conversionCount: metrics.conversionCount,
    engagementRate: metrics.engagementRate,
    clickThroughRate: metrics.clickThroughRate,
    conversionRate: metrics.conversionRate,
    performanceScore: metrics.performanceScore,
  };
}

/**
 * 원본 social_post와 rewrite version의 최신 수동 입력 metrics를 비교해
 * social_rewrite_performance_comparisons에 저장하고, rewrite social_post의
 * 요약 컬럼을 갱신한다. metrics가 하나라도 없으면 blocked가 아니라
 * needs_more_data로 처리한다.
 */
export async function compareRewritePerformance(
  rewriteSocialPostId: string,
  comparedBy?: string
): Promise<CompareRewritePerformanceResult> {
  const rewrite = await getSocialPostForRewritePerformanceComparison(rewriteSocialPostId);
  if (!rewrite) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${rewriteSocialPostId}` };
  }

  await logComparisonEvent(
    "social_rewrite_performance_comparison_started",
    "info",
    `social post(${rewriteSocialPostId})의 원본 대비 rewrite 성과 비교를 시작합니다.`,
    rewrite.articleId,
    baseDetails(rewrite)
  );

  if (!rewrite.isRewriteVersion) {
    const message = "is_rewrite_version=false인 social post는 성과를 비교할 수 없습니다.";
    await logComparisonEvent(
      "social_rewrite_performance_comparison_blocked",
      "failed",
      message,
      rewrite.articleId,
      baseDetails(rewrite, { reasonCode: "not_rewrite_version" })
    );
    return { success: false, message };
  }

  const originalId = rewrite.rewriteAppliedFromSocialPostId ?? rewrite.parentSocialPostId;
  if (!originalId) {
    const message = "원본 social post를 특정할 수 없어 성과를 비교할 수 없습니다.";
    await logComparisonEvent(
      "social_rewrite_performance_comparison_blocked",
      "failed",
      message,
      rewrite.articleId,
      baseDetails(rewrite, { reasonCode: "no_original_social_post_id" })
    );
    return { success: false, message };
  }

  const original = await getSocialPostById(originalId);
  if (!original) {
    const message = "원본 social post를 찾을 수 없습니다.";
    await logComparisonEvent(
      "social_rewrite_performance_comparison_blocked",
      "failed",
      message,
      rewrite.articleId,
      baseDetails(rewrite, { reasonCode: "original_social_post_not_found", originalSocialPostId: originalId })
    );
    return { success: false, message };
  }

  if (original.platform !== rewrite.platform) {
    const message = "원본과 rewrite의 platform이 달라 성과를 비교할 수 없습니다.";
    await logComparisonEvent(
      "social_rewrite_performance_comparison_blocked",
      "failed",
      message,
      rewrite.articleId,
      baseDetails(rewrite, { reasonCode: "platform_mismatch", originalSocialPostId: originalId })
    );
    return { success: false, message };
  }

  const warnings: string[] = [];
  if (rewrite.manualPostStatus !== "posted") warnings.push("rewrite manual_post_status가 'posted'가 아닙니다 — 참고용으로만 비교합니다.");
  if (original.manualPostStatus !== "posted") warnings.push("원본 manual_post_status가 'posted'가 아닙니다 — 참고용으로만 비교합니다.");
  if (rewrite.publishStatus !== "published") warnings.push("rewrite publish_status가 'published'가 아닙니다.");
  if (original.publishStatus !== "published") warnings.push("원본 publish_status가 'published'가 아닙니다.");

  try {
    const originalMetrics = await getLatestMetricsBySocialPost(originalId);
    const rewriteMetrics = await getLatestMetricsBySocialPost(rewriteSocialPostId);
    const hasOriginalMetrics = originalMetrics !== null;
    const hasRewriteMetrics = rewriteMetrics !== null;

    if (!hasOriginalMetrics) warnings.push("원본의 metrics가 아직 입력되지 않았습니다.");
    if (!hasRewriteMetrics) warnings.push("rewrite의 metrics가 아직 입력되지 않았습니다.");

    const originalInput = toMetricsInput(originalMetrics);
    const rewriteInput = toMetricsInput(rewriteMetrics);

    const classification = classifyRewritePerformanceComparison({
      platform: rewrite.platform,
      original: originalInput,
      rewrite: rewriteInput,
      hasOriginalMetrics,
      hasRewriteMetrics,
    });

    const overall =
      hasOriginalMetrics && hasRewriteMetrics
        ? calculateOverallRewriteImprovement(originalInput, rewriteInput, rewrite.platform)
        : null;
    if (overall) warnings.push(...overall.warnings);

    const comparison = await createRewritePerformanceComparison({
      articleId: rewrite.articleId,
      rootSocialPostId: rewrite.rootSocialPostId ?? rewrite.id,
      originalSocialPostId: originalId,
      rewriteSocialPostId: rewrite.id,
      rewriteSourceSuggestionId: rewrite.rewriteSourceSuggestionId,
      versionComparisonId: rewrite.latestVersionComparisonId,
      platform: rewrite.platform,
      toneStyle: rewrite.toneStyle,
      originalVersionNumber: original.versionNumber,
      rewriteVersionNumber: rewrite.versionNumber,

      originalMetricsId: originalMetrics?.id ?? null,
      originalMeasuredAt: originalMetrics?.measuredAt ?? null,
      originalViews: originalInput.views,
      originalImpressions: originalInput.impressions,
      originalReach: originalInput.reach,
      originalLikes: originalInput.likes,
      originalComments: originalInput.comments,
      originalShares: originalInput.shares,
      originalSaves: originalInput.saves,
      originalClicks: originalInput.clicks,
      originalProfileVisits: originalInput.profileVisits,
      originalFollows: originalInput.follows,
      originalConversionCount: originalInput.conversionCount,
      originalEngagementRate: originalInput.engagementRate,
      originalClickThroughRate: originalInput.clickThroughRate,
      originalConversionRate: originalInput.conversionRate,
      originalPerformanceScore: originalInput.performanceScore,
      originalPerformanceStatus: original.performanceStatus,

      rewriteMetricsId: rewriteMetrics?.id ?? null,
      rewriteMeasuredAt: rewriteMetrics?.measuredAt ?? null,
      rewriteViews: rewriteInput.views,
      rewriteImpressions: rewriteInput.impressions,
      rewriteReach: rewriteInput.reach,
      rewriteLikes: rewriteInput.likes,
      rewriteComments: rewriteInput.comments,
      rewriteShares: rewriteInput.shares,
      rewriteSaves: rewriteInput.saves,
      rewriteClicks: rewriteInput.clicks,
      rewriteProfileVisits: rewriteInput.profileVisits,
      rewriteFollows: rewriteInput.follows,
      rewriteConversionCount: rewriteInput.conversionCount,
      rewriteEngagementRate: rewriteInput.engagementRate,
      rewriteClickThroughRate: rewriteInput.clickThroughRate,
      rewriteConversionRate: rewriteInput.conversionRate,
      rewritePerformanceScore: rewriteInput.performanceScore,
      rewritePerformanceStatus: rewrite.performanceStatus,

      comparisonStatus: classification.comparisonStatus,
      winner: classification.winner,
      performanceScoreDelta: overall?.performanceScoreDelta ?? null,
      performanceScoreDeltaRate: overall?.performanceScoreDeltaRate ?? null,
      viewsDelta: overall?.viewsDelta ?? null,
      viewsDeltaRate: overall?.viewsDeltaRate ?? null,
      impressionsDelta: overall?.impressionsDelta ?? null,
      impressionsDeltaRate: overall?.impressionsDeltaRate ?? null,
      engagementRateDelta: overall?.engagementRateDelta ?? null,
      clickThroughRateDelta: overall?.clickThroughRateDelta ?? null,
      clicksDelta: overall?.clicksDelta ?? null,
      clicksDeltaRate: overall?.clicksDeltaRate ?? null,
      commentsDelta: overall?.commentsDelta ?? null,
      commentsDeltaRate: overall?.commentsDeltaRate ?? null,
      sharesDelta: overall?.sharesDelta ?? null,
      sharesDeltaRate: overall?.sharesDeltaRate ?? null,
      savesDelta: overall?.savesDelta ?? null,
      savesDeltaRate: overall?.savesDeltaRate ?? null,
      improvementSummary: overall?.improvementSummary ?? {},
      platformSpecificSummary: classification.platformSpecificSummary,
      warnings: warnings.map((message) => ({ message })),
      failures: [],
      comparedBy: comparedBy ?? null,
      comparedAt: new Date().toISOString(),
    });

    const socialPost = await updateSocialPostRewritePerformanceSummary(rewrite.id, comparison);

    const eventType: LogEventType =
      classification.comparisonStatus === "needs_more_data"
        ? "social_rewrite_performance_comparison_needs_more_data"
        : "social_rewrite_performance_comparison_completed";
    await logComparisonEvent(
      eventType,
      "success",
      `social post(${rewriteSocialPostId})의 원본 대비 rewrite 성과 비교가 완료되었습니다 (${classification.comparisonStatus}).`,
      rewrite.articleId,
      baseDetails(rewrite, {
        originalSocialPostId: originalId,
        originalVersionNumber: original.versionNumber,
        originalMetricsId: originalMetrics?.id ?? null,
        rewriteMetricsId: rewriteMetrics?.id ?? null,
        originalPerformanceStatus: original.performanceStatus,
        rewritePerformanceStatus: rewrite.performanceStatus,
        originalPerformanceScore: originalInput.performanceScore,
        rewritePerformanceScore: rewriteInput.performanceScore,
        performanceScoreDelta: comparison.performanceScoreDelta,
        improvementRate: comparison.performanceScoreDeltaRate,
        comparisonStatus: classification.comparisonStatus,
        winner: classification.winner,
        hasOriginalMetrics,
        hasRewriteMetrics,
        missingDataCount: (hasOriginalMetrics ? 0 : 1) + (hasRewriteMetrics ? 0 : 1),
        warningCount: warnings.length,
        reasonCode: classification.reasonCode,
      })
    );

    return {
      success: true,
      message:
        classification.comparisonStatus === "needs_more_data"
          ? "metrics가 충분하지 않아 참고용 비교만 저장했습니다(needs_more_data)."
          : "원본 대비 rewrite 성과 비교를 완료했습니다.",
      comparison,
      socialPost,
      warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logComparisonEvent(
      "social_rewrite_performance_comparison_failed",
      "failed",
      message,
      rewrite.articleId,
      baseDetails(rewrite, { originalSocialPostId: originalId })
    );
    return { success: false, message };
  }
}
