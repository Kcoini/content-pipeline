// Phase 3-7: Platform Publish Dry-run & Export Handoff — dry-run 서비스.
// platform_publish_ready=true이고 platform_publish_guard_status='ready'인
// social post만 dry-run을 생성한다. 실제 외부 플랫폼 게시 API는
// 호출하지 않으며, publish_status를 'published'로 바꾸지 않는다.

import {
  getSocialPostForDryRun,
  updatePlatformPublishDryRunResult,
  SocialPostNotFoundError,
} from "@/lib/repositories/social-posts-repository";
import { buildPlatformPublishDryRunPayload, type PlatformPublishDryRunResult } from "./platform-publish-dry-run-builder";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { SocialPost } from "./social-platform-types";

export interface CreatePlatformPublishDryRunResult {
  success: boolean;
  message: string;
  socialPost?: SocialPost;
  dryRun?: PlatformPublishDryRunResult;
}

async function logDryRunEvent(
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

function hasAnyContent(post: SocialPost): boolean {
  return Boolean(
    (post.postTitle && post.postTitle.trim().length > 0) ||
      (post.postBody && post.postBody.trim().length > 0) ||
      (post.caption && post.caption.trim().length > 0) ||
      (post.threadItems.length > 0 && post.threadItems.some((t) => t.text.trim().length > 0)) ||
      (post.cardItems.length > 0 && post.cardItems.some((c) => c.body.trim().length > 0))
  );
}

/** dry-run을 생성할 수 없는 이유를 반환한다. 가능하면 null. */
function checkDryRunnable(post: SocialPost): string | null {
  if (post.qualityStatus !== "ready") return `quality_status가 'ready'가 아니어서(${post.qualityStatus}) dry-run을 생성할 수 없습니다.`;
  if (post.approvalStatus !== "approved") return `approval_status가 'approved'가 아니어서(${post.approvalStatus}) dry-run을 생성할 수 없습니다.`;
  if (post.exportStatus !== "ready" && post.exportStatus !== "exported") {
    return `export_status가 ready/exported가 아니어서(${post.exportStatus}) dry-run을 생성할 수 없습니다.`;
  }
  if (post.platformPublishGuardStatus !== "ready") {
    return `platform_publish_guard_status가 'ready'가 아니어서(${post.platformPublishGuardStatus}) dry-run을 생성할 수 없습니다.`;
  }
  if (!post.platformPublishReady) return "platform_publish_ready=false여서 dry-run을 생성할 수 없습니다.";
  if (post.publishStatus === "published") return "이미 게시된 social post는 dry-run을 생성할 필요가 없습니다.";
  if (post.publishStatus === "blocked") return "publish_status가 blocked 상태여서 dry-run을 생성할 수 없습니다.";
  if (!hasAnyContent(post)) return "저장된 콘텐츠가 없어 dry-run을 생성할 수 없습니다.";
  if (Object.keys(post.exportPayload ?? {}).length === 0) return "export_payload가 비어 있어 dry-run을 생성할 수 없습니다.";
  return null;
}

/**
 * social post의 플랫폼별 게시 직전 dry-run payload를 생성하고 저장한다.
 * 성공 시 handoff_status도 'ready'로 함께 갱신한다. 실제 외부 플랫폼
 * 게시는 어떤 경우에도 수행하지 않는다.
 */
export async function createPlatformPublishDryRun(
  socialPostId: string,
  createdBy?: string
): Promise<CreatePlatformPublishDryRunResult> {
  const existing = await getSocialPostForDryRun(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  await logDryRunEvent(
    "social_platform_publish_dry_run_started",
    "info",
    `social post(${socialPostId})의 platform publish dry-run을 시작합니다.`,
    existing.articleId,
    {
      socialPostId,
      platform: existing.platform,
      qualityStatus: existing.qualityStatus,
      approvalStatus: existing.approvalStatus,
      exportStatus: existing.exportStatus,
      platformPublishGuardStatus: existing.platformPublishGuardStatus,
      platformPublishReady: existing.platformPublishReady,
    }
  );

  const blockReason = checkDryRunnable(existing);
  if (blockReason) {
    const updated = await updatePlatformPublishDryRunResult(socialPostId, {
      status: "blocked",
      error: blockReason,
      handoffStatus: "blocked",
    });
    await logDryRunEvent("social_platform_publish_dry_run_blocked", "failed", blockReason, existing.articleId, {
      socialPostId,
      platform: existing.platform,
      reasonCode: "not_dry_runnable",
    });
    return { success: false, message: blockReason, socialPost: updated };
  }

  try {
    const dryRun = buildPlatformPublishDryRunPayload(existing);

    if (!dryRun.ok) {
      const reason = dryRun.error ?? "dry-run payload 생성에 실패했습니다.";
      const updated = await updatePlatformPublishDryRunResult(socialPostId, {
        status: "blocked",
        error: reason,
        handoffStatus: "blocked",
      });
      await logDryRunEvent("social_platform_publish_dry_run_blocked", "failed", reason, existing.articleId, {
        socialPostId,
        platform: existing.platform,
        reasonCode: "dry_run_build_failed",
      });
      return { success: false, message: reason, socialPost: updated, dryRun };
    }

    const updated = await updatePlatformPublishDryRunResult(socialPostId, {
      status: "ready",
      dryRunPayload: dryRun.dryRunPayload,
      handoffPayload: dryRun.handoffPayload,
      createdBy: createdBy ?? null,
      handoffStatus: "ready",
    });

    await logDryRunEvent(
      "social_platform_publish_dry_run_completed",
      "success",
      `social post(${socialPostId})의 platform publish dry-run을 완료했습니다.`,
      existing.articleId,
      {
        socialPostId,
        platform: existing.platform,
        toneStyle: existing.toneStyle,
        dryRunStatus: "ready",
        handoffStatus: "ready",
        checklistCount: dryRun.checklist.length,
        warningCount: dryRun.warnings.length,
        threadItemCount: existing.threadItems.length,
        hashtagCount: existing.hashtags.length,
        cardItemCount: existing.cardItems.length,
        postBodyLength: existing.postBody?.length ?? 0,
        captionLength: existing.caption?.length ?? 0,
      }
    );

    return { success: true, message: "platform publish dry-run을 생성했습니다.", socialPost: updated, dryRun };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await updatePlatformPublishDryRunResult(socialPostId, { status: "failed", error: message }).catch(() => undefined);
    await logDryRunEvent(
      "social_platform_publish_dry_run_failed",
      "failed",
      `platform publish dry-run 실패: ${message}`,
      existing.articleId,
      { socialPostId, platform: existing.platform }
    );
    return { success: false, message };
  }
}

export { SocialPostNotFoundError };
