// Phase 3-7: Platform Publish Dry-run & Export Handoff — handoff 서비스.
// handoff completed는 "사람이 플랫폼에 게시할 수 있는 최종 payload를
// 확인했다"는 뜻이며, 실제 외부 게시 완료를 의미하지 않는다.
// publish_status는 이 서비스에서 어떤 경우에도 'published'로 바뀌지 않는다.

import { getSocialPostForDryRun, updatePlatformHandoffResult } from "@/lib/repositories/social-posts-repository";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { SocialPost } from "./social-platform-types";

export interface CompletePlatformExportHandoffResult {
  success: boolean;
  message: string;
  socialPost?: SocialPost;
}

async function logHandoffEvent(
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

/** handoff를 완료 처리할 수 없는 이유를 반환한다. 가능하면 null. */
function checkHandoffCompletable(post: SocialPost): string | null {
  if (post.platformPublishDryRunStatus !== "ready") {
    return `platform_publish_dry_run_status가 'ready'가 아니어서(${post.platformPublishDryRunStatus}) handoff를 완료할 수 없습니다.`;
  }
  if (post.handoffStatus !== "ready") {
    return `handoff_status가 'ready'가 아니어서(${post.handoffStatus}) handoff를 완료할 수 없습니다.`;
  }
  if (Object.keys(post.handoffPayload ?? {}).length === 0) return "handoff_payload가 비어 있어 handoff를 완료할 수 없습니다.";
  if (post.publishStatus === "published") return "이미 게시된 social post는 handoff를 완료할 필요가 없습니다.";
  if (post.approvalStatus !== "approved") return `approval_status가 'approved'가 아니어서(${post.approvalStatus}) handoff를 완료할 수 없습니다.`;
  if (!post.platformPublishReady) return "platform_publish_ready=false여서 handoff를 완료할 수 없습니다.";
  return null;
}

/**
 * social post의 export handoff를 완료 처리한다. 사람이 dry-run 결과를
 * 최종 확인하고 수동 게시할 준비를 마쳤다는 뜻일 뿐, 실제 외부 게시
 * 완료가 아니다. publish_status는 이 함수에서 절대 'published'로 바뀌지
 * 않는다.
 */
export async function completePlatformExportHandoff(
  socialPostId: string,
  completedBy?: string,
  notes?: string
): Promise<CompletePlatformExportHandoffResult> {
  const existing = await getSocialPostForDryRun(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  await logHandoffEvent(
    "social_platform_handoff_started",
    "info",
    `social post(${socialPostId})의 export handoff를 시작합니다.`,
    existing.articleId,
    { socialPostId, platform: existing.platform, dryRunStatus: existing.platformPublishDryRunStatus, handoffStatus: existing.handoffStatus }
  );

  const blockReason = checkHandoffCompletable(existing);
  if (blockReason) {
    const updated = await updatePlatformHandoffResult(socialPostId, { status: "blocked", error: blockReason });
    await logHandoffEvent("social_platform_handoff_blocked", "failed", blockReason, existing.articleId, {
      socialPostId,
      platform: existing.platform,
      reasonCode: "not_handoff_completable",
    });
    return { success: false, message: blockReason, socialPost: updated };
  }

  try {
    const updated = await updatePlatformHandoffResult(socialPostId, {
      status: "completed",
      completedBy: completedBy ?? null,
      notes: notes ?? null,
      error: null,
    });

    await logHandoffEvent(
      "social_platform_handoff_completed",
      "success",
      `social post(${socialPostId})의 export handoff를 완료했습니다 (실제 게시 완료 아님).`,
      existing.articleId,
      {
        socialPostId,
        platform: existing.platform,
        toneStyle: existing.toneStyle,
        handoffStatus: "completed",
        publishStatus: updated.publishStatus,
      }
    );

    return { success: true, message: "export handoff를 완료 처리했습니다 (실제 게시 완료가 아닙니다).", socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await updatePlatformHandoffResult(socialPostId, { status: "failed", error: message }).catch(() => undefined);
    await logHandoffEvent("social_platform_handoff_failed", "failed", `export handoff 실패: ${message}`, existing.articleId, {
      socialPostId,
      platform: existing.platform,
    });
    return { success: false, message };
  }
}
