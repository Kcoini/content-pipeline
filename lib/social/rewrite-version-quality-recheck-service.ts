// Phase 3-12: Rewrite Version Quality Recheck & Comparison — quality recheck.
// rewrite version(social_posts.is_rewrite_version=true)의 콘텐츠로
// quality gate를 다시 실행한다. 실제 게시나 원본 교체는 하지 않는다.

import { getSocialPostById, updateSocialPostQuality } from "@/lib/repositories/social-posts-repository";
import { runSocialPostQualityGate } from "./social-quality-gate";
import { isSocialPlatform, isToneStyle } from "./social-platform-types";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { SocialPost, SocialPostQualityResult } from "./social-platform-types";

export interface RecheckRewriteVersionQualityResult {
  success: boolean;
  message: string;
  socialPost?: SocialPost;
  qualityResult?: SocialPostQualityResult;
}

async function logRecheckEvent(
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
 * rewrite version social post의 quality gate를 다시 실행한다.
 * is_rewrite_version=false인 post에도 실행은 가능하지만 경고를 남긴다
 * (완전히 차단하지는 않음 — 일반 편집 후 재검수와 동일한 경로이기
 * 때문). 실제 게시는 수행하지 않는다.
 */
export async function recheckRewriteVersionQuality(
  socialPostId: string,
  checkedBy?: string
): Promise<RecheckRewriteVersionQualityResult> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  await logRecheckEvent(
    "social_rewrite_version_quality_recheck_started",
    "info",
    `social post(${socialPostId})의 rewrite version quality recheck를 시작합니다.`,
    post.articleId,
    { rewriteSocialPostId: socialPostId, platform: post.platform, toneStyle: post.toneStyle }
  );

  if (!isSocialPlatform(post.platform) || !isToneStyle(post.toneStyle)) {
    const message = "platform 또는 tone_style이 유효하지 않아 quality recheck를 실행할 수 없습니다.";
    await logRecheckEvent("social_rewrite_version_quality_recheck_blocked", "failed", message, post.articleId, {
      rewriteSocialPostId: socialPostId,
      reasonCode: "invalid_platform_or_tone",
    });
    return { success: false, message };
  }

  if (!post.isRewriteVersion) {
    await logRecheckEvent(
      "social_rewrite_version_quality_recheck_started",
      "info",
      `social post(${socialPostId})는 rewrite version이 아니지만(is_rewrite_version=false) quality recheck를 계속 진행합니다.`,
      post.articleId,
      { rewriteSocialPostId: socialPostId, reasonCode: "not_rewrite_version_warning" }
    );
  }

  try {
    const qualityResult = runSocialPostQualityGate({
      platform: post.platform,
      toneStyle: post.toneStyle,
      postTitle: post.postTitle,
      postBody: post.postBody,
      caption: post.caption,
      excerpt: post.excerpt,
      hashtags: post.hashtags,
      threadItems: post.threadItems,
      cardItems: post.cardItems,
      mediaRequirements: post.mediaRequirements,
    });

    const updated = await updateSocialPostQuality(socialPostId, qualityResult);

    const eventType: LogEventType =
      qualityResult.status === "blocked" ? "social_rewrite_version_quality_recheck_blocked" : "social_rewrite_version_quality_recheck_completed";
    await logRecheckEvent(
      eventType,
      qualityResult.status === "blocked" ? "failed" : "success",
      `social post(${socialPostId})의 rewrite version quality recheck가 완료되었습니다 (status: ${qualityResult.status}, score: ${qualityResult.score}).`,
      post.articleId,
      {
        rewriteSocialPostId: socialPostId,
        platform: post.platform,
        toneStyle: post.toneStyle,
        rewriteQualityStatus: qualityResult.status,
        rewriteQualityScore: qualityResult.score,
        warningCount: qualityResult.warnings.length,
        failureCount: qualityResult.failures.length,
        blockedCount: qualityResult.blockedReasons.length,
        checkedBy: checkedBy ?? null,
      }
    );

    return {
      success: true,
      message: `quality recheck 완료 (status: ${qualityResult.status}, score: ${qualityResult.score}).`,
      socialPost: updated,
      qualityResult,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logRecheckEvent("social_rewrite_version_quality_recheck_failed", "failed", `quality recheck 실패: ${message}`, post.articleId, {
      rewriteSocialPostId: socialPostId,
      platform: post.platform,
    });
    return { success: false, message };
  }
}
