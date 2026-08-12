// Phase 3-4: Social Post Review & Editing Workflow — 승인 서비스.
// social_posts의 승인 요청/승인/반려/승인취소를 담당한다. 실제 플랫폼
// 게시는 어떤 경우에도 수행하지 않으며, 이 단계에서 publish_status는
// not_published/dry_run/blocked까지만 사용한다. 협박/공포조장/허위단정/
// 광고클릭유도/과장수익표현이 quality gate에서 발견된 경우(blocked/fail
// checklist 항목) 승인을 차단한다.

import {
  getSocialPostById,
  requestSocialPostApproval,
  approveSocialPost as approveSocialPostInRepository,
  rejectSocialPost as rejectSocialPostInRepository,
  revokeSocialPostApproval as revokeSocialPostApprovalInRepository,
  SocialPostNotFoundError,
} from "@/lib/repositories/social-posts-repository";
import { isSocialPlatform, isToneStyle } from "./social-platform-types";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { SocialPost } from "./social-platform-types";

export interface SocialPostApprovalResult {
  success: boolean;
  message: string;
  socialPost?: SocialPost;
}

async function logApprovalEvent(
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
      (post.threadItems.length > 0 && post.threadItems.some((item) => item.text.trim().length > 0)) ||
      (post.cardItems.length > 0 && post.cardItems.some((item) => item.body.trim().length > 0))
  );
}

/** quality_summary.checklist에 blocked/fail 항목이 있는지 확인한다 (협박/광고클릭유도/과장수익 등). */
function hasBlockingChecklistItems(post: SocialPost): boolean {
  const checklist = post.qualitySummary?.checklist;
  if (!Array.isArray(checklist)) return false;
  return checklist.some((item) => {
    const status = (item as { status?: unknown }).status;
    return status === "blocked" || status === "fail";
  });
}

/** social post 승인을 위한 공통 조건을 검사한다. 통과하지 못하면 사유를 반환한다. */
function checkApprovable(post: SocialPost): string | null {
  if (!isSocialPlatform(post.platform)) return `지원하지 않는 platform입니다: ${post.platform}`;
  if (!isToneStyle(post.toneStyle)) return `지원하지 않는 tone_style입니다: ${post.toneStyle}`;
  if (post.publishStatus === "blocked") return "publish_status가 blocked 상태여서 승인할 수 없습니다.";
  if (post.publishStatus === "published") return "이미 게시된 social post는 다시 승인할 수 없습니다.";
  if (post.approvalStatus === "approved") return "이미 승인된 social post입니다.";
  if (post.qualityStatus === "blocked") return "quality_status가 blocked 상태여서 승인할 수 없습니다.";
  if (post.qualityStatus !== "ready") return `quality_status가 'ready'가 아니어서(${post.qualityStatus}) 승인할 수 없습니다.`;
  if (!hasAnyContent(post)) return "저장된 콘텐츠가 없어 승인할 수 없습니다.";
  if (hasBlockingChecklistItems(post)) {
    return "quality gate 결과에 협박/공포조장/광고클릭유도/과장수익 등 차단 사유가 남아 있어 승인할 수 없습니다.";
  }
  return null;
}

/** social post의 승인을 요청한다 (approval_status='pending_review'). */
export async function requestApproval(socialPostId: string, notes?: string): Promise<SocialPostApprovalResult> {
  const existing = await getSocialPostById(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  try {
    if (existing.publishStatus === "blocked" || existing.publishStatus === "published") {
      const message = `publish_status(${existing.publishStatus})가 승인 요청을 허용하지 않습니다.`;
      await logApprovalEvent("social_approval_failed", "failed", message, existing.articleId, {
        socialPostId,
        platform: existing.platform,
        reasonCode: "publish_status_not_allowed",
      });
      return { success: false, message };
    }

    const updated = await requestSocialPostApproval(socialPostId, notes ?? null);

    await logApprovalEvent(
      "social_approval_requested",
      "info",
      `social post(${socialPostId})의 승인을 요청했습니다.`,
      existing.articleId,
      { socialPostId, platform: existing.platform, hasNotes: Boolean(notes) }
    );

    return { success: true, message: "승인을 요청했습니다.", socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logApprovalEvent("social_approval_failed", "failed", message, existing.articleId, {
      socialPostId,
      platform: existing.platform,
    });
    return { success: false, message };
  }
}

/**
 * social post를 승인한다. quality_status='ready', publish_status가
 * blocked/published가 아님, approval_status가 approved가 아님, 콘텐츠
 * 존재, platform/tone_style 유효, quality gate에 blocked/fail 항목이
 * 없어야 승인할 수 있다.
 */
export async function approveSocialPost(
  socialPostId: string,
  approvedBy: string,
  notes?: string
): Promise<SocialPostApprovalResult> {
  const existing = await getSocialPostById(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  await logApprovalEvent(
    "social_approval_started",
    "info",
    `social post(${socialPostId})의 승인 절차를 시작합니다.`,
    existing.articleId,
    { socialPostId, platform: existing.platform }
  );

  const reason = checkApprovable(existing);
  if (reason) {
    await logApprovalEvent("social_approval_failed", "failed", reason, existing.articleId, {
      socialPostId,
      platform: existing.platform,
      qualityStatus: existing.qualityStatus,
      approvalStatus: existing.approvalStatus,
      publishStatus: existing.publishStatus,
    });
    return { success: false, message: reason };
  }

  try {
    const updated = await approveSocialPostInRepository(socialPostId, approvedBy, notes ?? null);

    await logApprovalEvent(
      "social_approval_completed",
      "success",
      `social post(${socialPostId})가 승인되었습니다.`,
      existing.articleId,
      { socialPostId, platform: existing.platform, approvedBy, hasNotes: Boolean(notes) }
    );

    return { success: true, message: "social post가 승인되었습니다.", socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logApprovalEvent("social_approval_failed", "failed", message, existing.articleId, {
      socialPostId,
      platform: existing.platform,
    });
    return { success: false, message };
  }
}

/** social post를 반려한다. 반려 사유(reason)는 필수다. */
export async function rejectSocialPost(
  socialPostId: string,
  rejectedBy: string,
  reason: string
): Promise<SocialPostApprovalResult> {
  const existing = await getSocialPostById(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }
  if (!reason || reason.trim().length === 0) {
    return { success: false, message: "반려 사유(reason)를 입력해야 합니다." };
  }

  try {
    const updated = await rejectSocialPostInRepository(socialPostId, rejectedBy, reason);

    await logApprovalEvent(
      "social_approval_rejected",
      "info",
      `social post(${socialPostId})가 반려되었습니다.`,
      existing.articleId,
      { socialPostId, platform: existing.platform, rejectedBy, reasonCode: "manual_rejection" }
    );

    return { success: true, message: "social post가 반려되었습니다.", socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logApprovalEvent("social_approval_failed", "failed", message, existing.articleId, {
      socialPostId,
      platform: existing.platform,
    });
    return { success: false, message };
  }
}

/** social post의 승인을 취소한다. 이미 승인된(approval_status='approved') post에만 적용된다. */
export async function revokeApproval(
  socialPostId: string,
  revokedBy: string,
  reason: string
): Promise<SocialPostApprovalResult> {
  const existing = await getSocialPostById(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }
  if (existing.approvalStatus !== "approved") {
    return { success: false, message: `승인된 social post만 승인을 취소할 수 있습니다 (approval_status: ${existing.approvalStatus}).` };
  }
  if (existing.publishStatus === "published") {
    return { success: false, message: "이미 게시된 social post는 승인을 취소할 수 없습니다." };
  }
  if (!reason || reason.trim().length === 0) {
    return { success: false, message: "승인 취소 사유(reason)를 입력해야 합니다." };
  }

  try {
    const updated = await revokeSocialPostApprovalInRepository(socialPostId, revokedBy, reason);

    await logApprovalEvent(
      "social_approval_revoked",
      "info",
      `social post(${socialPostId})의 승인이 취소되었습니다.`,
      existing.articleId,
      { socialPostId, platform: existing.platform, revokedBy }
    );

    return { success: true, message: "승인이 취소되었습니다.", socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logApprovalEvent("social_approval_failed", "failed", message, existing.articleId, {
      socialPostId,
      platform: existing.platform,
    });
    return { success: false, message };
  }
}

export { SocialPostNotFoundError };
