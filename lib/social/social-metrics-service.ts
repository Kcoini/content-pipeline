// Phase 3-9: Social Metrics Manual Input & Performance Tracking.
// 사람이 플랫폼에서 직접 확인한 성과 지표를 수동으로 입력한다. 실제
// 외부 플랫폼 Analytics/Insights API는 호출하지 않는다.
// manual_post_status='posted'인 social post를 우선 대상으로 하지만,
// 테스트 목적으로 그렇지 않은 경우도 입력은 허용하고 대신 warning을
// 남긴다.

import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import {
  createSocialPostMetrics,
  updateSocialPostLatestMetrics,
} from "@/lib/repositories/social-metrics-repository";
import { getPlatformMetricsConfig } from "./platform-metrics-config";
import {
  calculateEngagementRate,
  calculateClickThroughRate,
  calculateConversionRate,
  calculatePerformanceScore,
  classifyPerformanceStatus,
} from "./social-metrics-calculator";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { SocialMetricsInput, SocialPostMetrics } from "./social-metrics-types";
import type { SocialPost } from "./social-platform-types";

export interface RecordSocialPostMetricsResult {
  success: boolean;
  message: string;
  metrics?: SocialPostMetrics;
  socialPost?: SocialPost;
  warnings?: string[];
}

async function logMetricsEvent(
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

const NUMERIC_FIELDS: (keyof SocialMetricsInput)[] = [
  "views",
  "impressions",
  "likes",
  "comments",
  "shares",
  "saves",
  "clicks",
  "profileVisits",
  "follows",
  "reach",
  "conversionCount",
];

/** 음수 지표가 있으면 어떤 필드인지 메시지로 반환한다. 문제 없으면 null. */
function findNegativeMetric(input: SocialMetricsInput): string | null {
  for (const field of NUMERIC_FIELDS) {
    const value = input[field];
    if (typeof value === "number" && value < 0) {
      return `${field}은(는) 음수일 수 없습니다 (입력값: ${value}).`;
    }
  }
  return null;
}

/**
 * social post의 성과 지표를 수동으로 입력하고 저장한다. 저장 후
 * social_posts의 latest_ 및 performance_ 관련 컬럼도 함께 갱신한다.
 * 실제 외부 플랫폼 API는 호출하지 않는다.
 */
export async function recordSocialPostMetrics(
  socialPostId: string,
  input: SocialMetricsInput
): Promise<RecordSocialPostMetricsResult> {
  const existing = await getSocialPostById(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  await logMetricsEvent(
    "social_metrics_record_started",
    "info",
    `social post(${socialPostId})의 성과 지표 입력을 시작합니다.`,
    existing.articleId,
    { socialPostId, platform: existing.platform, toneStyle: existing.toneStyle, measuredAt: input.measuredAt ?? null }
  );

  const negativeReason = findNegativeMetric(input);
  if (negativeReason) {
    await logMetricsEvent("social_metrics_record_failed", "failed", negativeReason, existing.articleId, {
      socialPostId,
      platform: existing.platform,
      reasonCode: "negative_metric",
    });
    return { success: false, message: negativeReason };
  }

  const warnings: string[] = [];
  if (existing.manualPostStatus !== "posted") {
    warnings.push(`manual_post_status가 'posted'가 아닙니다(${existing.manualPostStatus}). 아직 게시되지 않았을 수 있습니다.`);
  }
  if (existing.publishStatus !== "published") {
    warnings.push(`publish_status가 'published'가 아닙니다(${existing.publishStatus}).`);
  }
  if (input.measuredAt && new Date(input.measuredAt).getTime() > Date.now()) {
    warnings.push("measured_at이 미래 시각입니다.");
  }
  const config = getPlatformMetricsConfig(existing.platform);
  const requiredAllZero = config.requiredMetrics.every((field) => (input[field] ?? 0) === 0);
  if (requiredAllZero) {
    warnings.push("필수 지표가 모두 0입니다 — 데이터가 충분하지 않을 수 있습니다.");
  }

  try {
    const engagementRate = calculateEngagementRate(input, config.engagementDenominatorPriority);
    const clickThroughRate = calculateClickThroughRate(input, config.engagementDenominatorPriority);
    const conversionRate = calculateConversionRate(input);
    const performanceScore = calculatePerformanceScore(input, existing.platform);
    const performanceStatus = classifyPerformanceStatus(performanceScore);

    const metrics = await createSocialPostMetrics({
      socialPostId,
      articleId: existing.articleId,
      platform: existing.platform,
      measuredAt: input.measuredAt,
      recordedBy: input.recordedBy ?? null,
      views: input.views,
      impressions: input.impressions,
      likes: input.likes,
      comments: input.comments,
      shares: input.shares,
      saves: input.saves,
      clicks: input.clicks,
      profileVisits: input.profileVisits,
      follows: input.follows,
      reach: input.reach,
      engagementRate,
      clickThroughRate,
      conversionCount: input.conversionCount,
      conversionRate,
      performanceScore,
      notes: input.notes ?? null,
      rawMetrics: {},
    });

    const updatedPost = await updateSocialPostLatestMetrics(socialPostId, {
      latestMetricsId: metrics.id,
      latestMetricsRecordedAt: metrics.measuredAt,
      latestViews: metrics.views,
      latestImpressions: metrics.impressions,
      latestLikes: metrics.likes,
      latestComments: metrics.comments,
      latestShares: metrics.shares,
      latestSaves: metrics.saves,
      latestClicks: metrics.clicks,
      latestEngagementRate: metrics.engagementRate,
      latestClickThroughRate: metrics.clickThroughRate,
      latestPerformanceScore: metrics.performanceScore,
      performanceStatus,
      performanceSummary: {
        lastMetricsId: metrics.id,
        engagementRate: metrics.engagementRate,
        clickThroughRate: metrics.clickThroughRate,
        conversionRate: metrics.conversionRate,
        performanceScore: metrics.performanceScore,
        warnings,
      },
    });

    const details = {
      socialPostId,
      articleId: existing.articleId,
      platform: existing.platform,
      toneStyle: existing.toneStyle,
      measuredAt: metrics.measuredAt,
      hasViews: (input.views ?? 0) > 0,
      hasImpressions: (input.impressions ?? 0) > 0,
      hasLikes: (input.likes ?? 0) > 0,
      hasComments: (input.comments ?? 0) > 0,
      hasShares: (input.shares ?? 0) > 0,
      hasSaves: (input.saves ?? 0) > 0,
      hasClicks: (input.clicks ?? 0) > 0,
      hasReach: (input.reach ?? 0) > 0,
      hasConversions: (input.conversionCount ?? 0) > 0,
      engagementRate,
      clickThroughRate,
      performanceScore,
      performanceStatus,
      warningCount: warnings.length,
    };

    if (warnings.length > 0) {
      await logMetricsEvent(
        "social_metrics_record_warning",
        "info",
        `social post(${socialPostId})의 성과 지표 입력에 경고가 있습니다: ${warnings.join(" / ")}`,
        existing.articleId,
        details
      );
    }

    await logMetricsEvent(
      "social_metrics_record_completed",
      "success",
      `social post(${socialPostId})의 성과 지표를 입력했습니다 (score: ${performanceScore}, status: ${performanceStatus}).`,
      existing.articleId,
      details
    );

    return {
      success: true,
      message: `성과 지표를 저장했습니다 (performance_status: ${performanceStatus}).`,
      metrics,
      socialPost: updatedPost,
      warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logMetricsEvent("social_metrics_record_failed", "failed", `성과 지표 저장 실패: ${message}`, existing.articleId, {
      socialPostId,
      platform: existing.platform,
    });
    return { success: false, message };
  }
}
