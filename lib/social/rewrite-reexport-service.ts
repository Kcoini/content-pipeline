// Phase 3-13: Rewrite Re-approval & Re-export Workflow — 재export 서비스.
// rewrite_reapproval_status='approved'인 rewrite version만 재export할
// 수 있다. 기존 Phase 3-5 manual export builder/validator를 재사용하며,
// 이 서비스의 어떤 함수도 원본 social_post의 export_payload를 수정하지
// 않는다 — 항상 rewrite version 자신의 필드만 갱신한다.

import { getRewriteVersionForReapproval, updateRewriteReexportStatus, updateRewriteRepublishWorkflowStatus } from "@/lib/repositories/social-posts-repository";
import { buildManualExportPayload } from "./social-export-builder";
import { validateManualExportPayload } from "./social-export-validator";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { SocialPost } from "./social-platform-types";

export interface RewriteReexportResult {
  success: boolean;
  message: string;
  socialPost?: SocialPost;
}

async function logReexportEvent(
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

function baseDetails(post: SocialPost, extra?: Record<string, unknown>): Record<string, unknown> {
  return {
    socialPostId: post.id,
    articleId: post.articleId,
    platform: post.platform,
    toneStyle: post.toneStyle,
    versionNumber: post.versionNumber,
    rewriteReapprovalStatus: post.rewriteReapprovalStatus,
    rewriteReexportStatus: post.rewriteReexportStatus,
    exportStatus: post.exportStatus,
    ...extra,
  };
}

/** rewrite version이 재export 가능한 상태인지 확인한다. 가능하면 null. */
function checkReexportable(post: SocialPost): string | null {
  if (!post.isRewriteVersion) return "is_rewrite_version=false인 social post는 재export할 수 없습니다.";
  if (post.rewriteReapprovalStatus !== "approved") return `rewrite_reapproval_status가 'approved'가 아니어서(${post.rewriteReapprovalStatus}) 재export할 수 없습니다.`;
  if (post.approvalStatus !== "approved") return `approval_status가 'approved'가 아니어서(${post.approvalStatus}) 재export할 수 없습니다.`;
  if (post.qualityStatus !== "ready") return `quality_status가 'ready'가 아니어서(${post.qualityStatus}) 재export할 수 없습니다.`;
  if (post.publishStatus === "published") return "이미 게시된 social post는 재export할 필요가 없습니다.";
  if (post.manualPostStatus === "posted") return "이미 수동 게시 기록이 있는 social post는 재export할 필요가 없습니다.";
  return null;
}

/** rewrite version의 재export를 준비 상태로 표시한다 (실제 payload는 아직 만들지 않음). */
export async function prepareRewriteReexport(socialPostId: string, exportedBy?: string, notes?: string): Promise<RewriteReexportResult> {
  const post = await getRewriteVersionForReapproval(socialPostId);
  if (!post) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  await logReexportEvent("social_rewrite_reexport_prepare_started", "info", `social post(${socialPostId})의 재export 준비를 시작합니다.`, post.articleId, baseDetails(post));

  const blockReason = checkReexportable(post);
  if (blockReason) {
    await updateRewriteReexportStatus(socialPostId, { rewriteReexportStatus: "blocked", error: blockReason });
    await updateRewriteRepublishWorkflowStatus(socialPostId, { status: "blocked" });
    await logReexportEvent("social_rewrite_reexport_blocked", "failed", blockReason, post.articleId, baseDetails(post, { reasonCode: "not_reexportable" }));
    return { success: false, message: blockReason };
  }

  try {
    const updated = await updateRewriteReexportStatus(socialPostId, { rewriteReexportStatus: "ready", error: null });
    await updateRewriteRepublishWorkflowStatus(socialPostId, { status: "reexport_ready" });

    await logReexportEvent(
      "social_rewrite_reexport_prepare_completed",
      "success",
      `social post(${socialPostId})의 재export 준비를 완료했습니다.`,
      post.articleId,
      baseDetails(post, { notes: notes ? "provided" : "none" })
    );

    return { success: true, message: "재export 준비를 완료했습니다.", socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logReexportEvent("social_rewrite_reexport_failed", "failed", message, post.articleId, baseDetails(post));
    return { success: false, message };
  }
}

/** rewrite version의 export_payload를 다시 생성한다. 원본의 export_payload는 수정하지 않는다. */
export async function generateRewriteReexportPayload(
  socialPostId: string,
  exportedBy?: string,
  notes?: string
): Promise<RewriteReexportResult> {
  const post = await getRewriteVersionForReapproval(socialPostId);
  if (!post) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  await logReexportEvent("social_rewrite_reexport_started", "info", `social post(${socialPostId})의 재export payload 생성을 시작합니다.`, post.articleId, baseDetails(post));

  const blockReason = checkReexportable(post);
  if (blockReason) {
    await updateRewriteReexportStatus(socialPostId, { rewriteReexportStatus: "blocked", error: blockReason });
    await updateRewriteRepublishWorkflowStatus(socialPostId, { status: "blocked" });
    await logReexportEvent("social_rewrite_reexport_blocked", "failed", blockReason, post.articleId, baseDetails(post, { reasonCode: "not_reexportable" }));
    return { success: false, message: blockReason };
  }

  try {
    const exportPayload = buildManualExportPayload(post);
    const validation = validateManualExportPayload(post, exportPayload);

    if (validation.blocked || !validation.valid) {
      const reason = validation.errors.join(" / ") || "재export payload 검증에 실패했습니다.";
      await updateRewriteReexportStatus(socialPostId, {
        rewriteReexportStatus: validation.blocked ? "blocked" : "failed",
        error: reason,
      });
      await updateRewriteRepublishWorkflowStatus(socialPostId, { status: "blocked" });
      const eventType: LogEventType = validation.blocked ? "social_rewrite_reexport_blocked" : "social_rewrite_reexport_failed";
      await logReexportEvent(eventType, "failed", reason, post.articleId, baseDetails(post, { reasonCode: "validation_failed" }));
      return { success: false, message: reason };
    }

    const now = new Date().toISOString();
    const updated = await updateRewriteReexportStatus(socialPostId, {
      rewriteReexportStatus: "exported",
      reexportedAt: now,
      reexportedBy: exportedBy ?? null,
      exportStatus: "exported",
      exportPayload: exportPayload as unknown as Record<string, unknown>,
      exportFormat: exportPayload.exportFormat,
      exportedAt: now,
      exportedBy: exportedBy ?? null,
    });
    await updateRewriteRepublishWorkflowStatus(socialPostId, { status: "reexported" });

    await logReexportEvent(
      "social_rewrite_reexport_completed",
      "success",
      `social post(${socialPostId})의 재export가 완료되었습니다 (format: ${exportPayload.exportFormat}).`,
      post.articleId,
      baseDetails(post, {
        exportFormat: exportPayload.exportFormat,
        warningCount: validation.warnings.length,
        hasNotes: Boolean(notes),
      })
    );

    return { success: true, message: "재export payload를 생성했습니다.", socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logReexportEvent("social_rewrite_reexport_failed", "failed", message, post.articleId, baseDetails(post));
    return { success: false, message };
  }
}
