// Phase 3-12: Rewrite Version Quality Recheck & Comparison — 비교 서비스.
// rewrite version과 원본을 비교해 보조 지표(comparison_status/score/
// 추천 버전)만 계산·저장한다. 실제 게시나 원본 교체는 하지 않는다.

import { getSocialPostForVersionComparison } from "@/lib/repositories/social-posts-repository";
import {
  createVersionComparison,
  updateSocialPostVersionComparisonSummary,
} from "@/lib/repositories/social-version-comparisons-repository";
import {
  compareVersionQuality,
  comparePlatformFit,
  compareToneFit,
  compareStructure,
  calculateVersionComparisonScore,
  decideRecommendedVersion,
} from "./rewrite-version-comparison-rules";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { SocialPostVersionComparison } from "./social-rewrite-types";

export interface CompareRewriteVersionResult {
  success: boolean;
  message: string;
  comparison?: SocialPostVersionComparison;
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

/**
 * rewrite version social post를 원본과 비교한다.
 * `rewrite_applied_from_social_post_id`(없으면 `parent_social_post_id`)로
 * 원본을 찾으며, 둘 다 없으면 비교할 수 없다(blocked). performance
 * data가 없어도(rewrite가 아직 게시 전이어도) quality 중심으로 비교를
 * 계속 진행한다.
 */
export async function compareRewriteVersion(rewriteSocialPostId: string, comparedBy?: string): Promise<CompareRewriteVersionResult> {
  const rewrite = await getSocialPostForVersionComparison(rewriteSocialPostId);
  if (!rewrite) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${rewriteSocialPostId}` };
  }

  await logComparisonEvent(
    "social_rewrite_version_comparison_started",
    "info",
    `social post(${rewriteSocialPostId})의 버전 비교를 시작합니다.`,
    rewrite.articleId,
    { rewriteSocialPostId, platform: rewrite.platform, toneStyle: rewrite.toneStyle }
  );

  const originalId = rewrite.rewriteAppliedFromSocialPostId ?? rewrite.parentSocialPostId;
  if (!originalId) {
    const message = "parent_social_post_id(원본)가 없어 비교할 수 없습니다.";
    await logComparisonEvent("social_rewrite_version_comparison_blocked", "failed", message, rewrite.articleId, {
      rewriteSocialPostId,
      reasonCode: "no_original",
    });
    return { success: false, message };
  }

  const original = await getSocialPostForVersionComparison(originalId);
  if (!original) {
    const message = `원본 social post를 찾을 수 없습니다: ${originalId}`;
    await logComparisonEvent("social_rewrite_version_comparison_blocked", "failed", message, rewrite.articleId, {
      rewriteSocialPostId,
      originalSocialPostId: originalId,
      reasonCode: "original_not_found",
    });
    return { success: false, message };
  }

  try {
    const checklist = [
      ...compareVersionQuality(original, rewrite),
      ...comparePlatformFit(original, rewrite),
      ...compareToneFit(original, rewrite),
      ...compareStructure(original, rewrite),
    ];
    const score = calculateVersionComparisonScore({ checklist });
    const decision = decideRecommendedVersion({ original, rewrite, checklist });

    const warnings = checklist.filter((c) => c.status === "warning").map((c) => c.message);
    const failures = checklist.filter((c) => c.status === "fail").map((c) => c.message);

    const comparison = await createVersionComparison({
      articleId: rewrite.articleId,
      rootSocialPostId: rewrite.rootSocialPostId ?? original.id,
      originalSocialPostId: original.id,
      rewriteSocialPostId: rewrite.id,
      rewriteSourceSuggestionId: rewrite.rewriteSourceSuggestionId,
      platform: rewrite.platform,
      originalVersionNumber: original.versionNumber,
      rewriteVersionNumber: rewrite.versionNumber,
      originalQualityStatus: original.qualityStatus,
      originalQualityScore: original.qualityScore,
      rewriteQualityStatus: rewrite.qualityStatus,
      rewriteQualityScore: rewrite.qualityScore,
      originalPerformanceStatus: original.performanceStatus,
      originalPerformanceScore: original.latestPerformanceScore,
      rewritePerformanceStatus: rewrite.performanceStatus,
      rewritePerformanceScore: rewrite.latestPerformanceScore,
      comparisonStatus: decision.comparisonStatus,
      comparisonScore: score,
      recommendedSocialPostId: decision.recommendedSocialPostId,
      recommendationReason: decision.recommendationReason,
      comparisonSummary: { checklistCount: checklist.length, warningCount: warnings.length, failureCount: failures.length },
      checklist,
      warnings,
      failures,
      comparedBy: comparedBy ?? null,
    });

    await updateSocialPostVersionComparisonSummary(rewriteSocialPostId, comparison);

    await logComparisonEvent(
      "social_rewrite_version_comparison_completed",
      decision.comparisonStatus === "blocked" ? "failed" : "success",
      `social post(${rewriteSocialPostId})의 버전 비교가 완료되었습니다 (status: ${decision.comparisonStatus}).`,
      rewrite.articleId,
      {
        articleId: rewrite.articleId,
        rootSocialPostId: rewrite.rootSocialPostId,
        originalSocialPostId: original.id,
        rewriteSocialPostId: rewrite.id,
        platform: rewrite.platform,
        toneStyle: rewrite.toneStyle,
        originalVersionNumber: original.versionNumber,
        rewriteVersionNumber: rewrite.versionNumber,
        originalQualityStatus: original.qualityStatus,
        originalQualityScore: original.qualityScore,
        rewriteQualityStatus: rewrite.qualityStatus,
        rewriteQualityScore: rewrite.qualityScore,
        originalPerformanceStatus: original.performanceStatus,
        originalPerformanceScore: original.latestPerformanceScore,
        rewritePerformanceStatus: rewrite.performanceStatus,
        rewritePerformanceScore: rewrite.latestPerformanceScore,
        comparisonStatus: decision.comparisonStatus,
        comparisonScore: score,
        recommendedSocialPostId: decision.recommendedSocialPostId,
        recommendedForRepost: decision.recommendedForRepost,
        warningCount: warnings.length,
        failureCount: failures.length,
        blockedCount: checklist.filter((c) => c.status === "blocked").length,
      }
    );

    return { success: true, message: `버전 비교가 완료되었습니다 (status: ${decision.comparisonStatus}).`, comparison };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logComparisonEvent("social_rewrite_version_comparison_failed", "failed", `버전 비교 실패: ${message}`, rewrite.articleId, {
      rewriteSocialPostId,
      originalSocialPostId: originalId,
    });
    return { success: false, message };
  }
}
