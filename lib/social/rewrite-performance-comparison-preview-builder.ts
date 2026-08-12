// Phase 3-14: 실제 비교를 실행하기 전에 원본/rewrite의 현재 metrics
// 상태를 미리 보여주는 preview builder. 이 파일은 어떤 데이터도
// 저장하지 않으며(읽기 전용), 실제 비교 실행은 rewrite-performance-
// comparison-service.compareRewritePerformance()가 담당한다.

import { getSocialPostForRewritePerformanceComparison, getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { getLatestMetricsBySocialPost } from "@/lib/repositories/social-metrics-repository";
import { logEvent } from "@/lib/harness/logger";
import type { SocialPlatform, ManualPostStatus, SocialPerformanceStatus } from "./social-platform-types";

export interface RewritePerformanceComparisonPreviewSide {
  socialPostId: string;
  versionNumber: number;
  platform: SocialPlatform;
  manualPostStatus: ManualPostStatus;
  postUrl: string | null;
  latestMetricsRecordedAt: string | null;
  performanceStatus: SocialPerformanceStatus;
  performanceScore: number | null;
  views: number;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  engagementRate: number | null;
  clickThroughRate: number | null;
}

export interface RewritePerformanceComparisonPreview {
  original: RewritePerformanceComparisonPreviewSide | null;
  rewrite: RewritePerformanceComparisonPreviewSide | null;
  expectedDeltas: Record<string, unknown>;
  warnings: Record<string, unknown>[];
  missingData: Record<string, unknown>[];
  canCompare: boolean;
}

/**
 * rewriteSocialPostId를 기준으로 원본/rewrite 양쪽의 현재 metrics
 * 상태를 미리보기용으로 조립한다. 실제 비교 실행 가능 여부(canCompare)는
 * 두 쪽 모두 metrics가 있어야 true가 된다 — 하나만 있어도 비교 자체는
 * 실행할 수 있지만(needs_more_data로 저장됨), 미리보기에서는 사용자에게
 * 명확히 안내하기 위해 별도로 표시한다.
 */
export async function buildRewritePerformanceComparisonPreview(
  rewriteSocialPostId: string
): Promise<RewritePerformanceComparisonPreview> {
  const warnings: Record<string, unknown>[] = [];
  const missingData: Record<string, unknown>[] = [];

  const rewritePost = await getSocialPostForRewritePerformanceComparison(rewriteSocialPostId);
  if (!rewritePost) {
    missingData.push({ reasonCode: "rewrite_social_post_not_found" });
    return { original: null, rewrite: null, expectedDeltas: {}, warnings, missingData, canCompare: false };
  }

  await logEvent({
    type: "social_rewrite_performance_comparison_preview_started",
    status: "info",
    message: `social post(${rewriteSocialPostId})의 성과 비교 preview를 생성합니다.`,
    articleId: rewritePost.articleId,
    targetType: "article",
    targetId: rewritePost.articleId,
    details: { rewriteSocialPostId, platform: rewritePost.platform, rewriteVersionNumber: rewritePost.versionNumber },
  });
  if (!rewritePost.isRewriteVersion) {
    warnings.push({ reasonCode: "not_rewrite_version" });
  }

  const originalId = rewritePost.rewriteAppliedFromSocialPostId ?? rewritePost.parentSocialPostId;
  if (!originalId) {
    missingData.push({ reasonCode: "no_original_social_post_id" });
    return { original: null, rewrite: null, expectedDeltas: {}, warnings, missingData, canCompare: false };
  }

  const originalPost = await getSocialPostById(originalId);
  if (!originalPost) {
    missingData.push({ reasonCode: "original_social_post_not_found", originalSocialPostId: originalId });
    return { original: null, rewrite: null, expectedDeltas: {}, warnings, missingData, canCompare: false };
  }

  if (originalPost.platform !== rewritePost.platform) {
    warnings.push({ reasonCode: "platform_mismatch" });
  }

  const [originalMetrics, rewriteMetrics] = await Promise.all([
    getLatestMetricsBySocialPost(originalId),
    getLatestMetricsBySocialPost(rewriteSocialPostId),
  ]);

  if (!originalMetrics) missingData.push({ reasonCode: "missing_original_metrics", socialPostId: originalId });
  if (!rewriteMetrics) missingData.push({ reasonCode: "missing_rewrite_metrics", socialPostId: rewriteSocialPostId });

  const original: RewritePerformanceComparisonPreviewSide = {
    socialPostId: originalPost.id,
    versionNumber: originalPost.versionNumber,
    platform: originalPost.platform,
    manualPostStatus: originalPost.manualPostStatus,
    postUrl: originalPost.postUrl,
    latestMetricsRecordedAt: originalMetrics?.measuredAt ?? null,
    performanceStatus: originalPost.performanceStatus,
    performanceScore: originalMetrics?.performanceScore ?? originalPost.latestPerformanceScore,
    views: originalMetrics?.views ?? 0,
    impressions: originalMetrics?.impressions ?? 0,
    reach: originalMetrics?.reach ?? 0,
    likes: originalMetrics?.likes ?? 0,
    comments: originalMetrics?.comments ?? 0,
    shares: originalMetrics?.shares ?? 0,
    saves: originalMetrics?.saves ?? 0,
    clicks: originalMetrics?.clicks ?? 0,
    engagementRate: originalMetrics?.engagementRate ?? originalPost.latestEngagementRate,
    clickThroughRate: originalMetrics?.clickThroughRate ?? originalPost.latestClickThroughRate,
  };

  const rewrite: RewritePerformanceComparisonPreviewSide = {
    socialPostId: rewritePost.id,
    versionNumber: rewritePost.versionNumber,
    platform: rewritePost.platform,
    manualPostStatus: rewritePost.manualPostStatus,
    postUrl: rewritePost.postUrl,
    latestMetricsRecordedAt: rewriteMetrics?.measuredAt ?? null,
    performanceStatus: rewritePost.performanceStatus,
    performanceScore: rewriteMetrics?.performanceScore ?? rewritePost.latestPerformanceScore,
    views: rewriteMetrics?.views ?? 0,
    impressions: rewriteMetrics?.impressions ?? 0,
    reach: rewriteMetrics?.reach ?? 0,
    likes: rewriteMetrics?.likes ?? 0,
    comments: rewriteMetrics?.comments ?? 0,
    shares: rewriteMetrics?.shares ?? 0,
    saves: rewriteMetrics?.saves ?? 0,
    clicks: rewriteMetrics?.clicks ?? 0,
    engagementRate: rewriteMetrics?.engagementRate ?? rewritePost.latestEngagementRate,
    clickThroughRate: rewriteMetrics?.clickThroughRate ?? rewritePost.latestClickThroughRate,
  };

  const canCompare = !!originalMetrics && !!rewriteMetrics;
  if (!canCompare && originalMetrics && rewriteMetrics === null) {
    warnings.push({ reasonCode: "needs_more_data", detail: "rewrite metrics만 없어 needs_more_data로 처리됩니다." });
  } else if (!canCompare && rewriteMetrics && originalMetrics === null) {
    warnings.push({ reasonCode: "needs_more_data", detail: "원본 metrics만 없어 needs_more_data로 처리됩니다." });
  } else if (!canCompare) {
    warnings.push({ reasonCode: "needs_more_data", detail: "원본/rewrite 모두 metrics가 없어 needs_more_data로 처리됩니다." });
  }

  const expectedDeltas: Record<string, unknown> = canCompare
    ? {
        viewsDelta: rewrite.views - original.views,
        impressionsDelta: rewrite.impressions - original.impressions,
        likesDelta: rewrite.likes - original.likes,
        commentsDelta: rewrite.comments - original.comments,
        sharesDelta: rewrite.shares - original.shares,
        savesDelta: rewrite.saves - original.saves,
        clicksDelta: rewrite.clicks - original.clicks,
        performanceScoreDelta:
          original.performanceScore !== null && rewrite.performanceScore !== null
            ? rewrite.performanceScore - original.performanceScore
            : null,
      }
    : {};

  await logEvent({
    type: "social_rewrite_performance_comparison_preview_completed",
    status: "success",
    message: `social post(${rewriteSocialPostId})의 성과 비교 preview 생성을 완료했습니다.`,
    articleId: rewritePost.articleId,
    targetType: "article",
    targetId: rewritePost.articleId,
    details: {
      rewriteSocialPostId,
      platform: rewritePost.platform,
      rewriteVersionNumber: rewritePost.versionNumber,
      hasOriginalMetrics: !!originalMetrics,
      hasRewriteMetrics: !!rewriteMetrics,
      canCompare,
      warningCount: warnings.length,
      missingDataCount: missingData.length,
    },
  });

  return { original, rewrite, expectedDeltas, warnings, missingData, canCompare };
}
