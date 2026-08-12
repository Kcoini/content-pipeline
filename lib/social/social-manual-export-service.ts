// Phase 3-5: Manual Export & Copy Workflow — export 서비스.
// quality_status='ready'이고 approval_status='approved'인 social post만
// manual export를 생성한다. 실제 외부 플랫폼 게시 API는 호출하지 않으며,
// publish_status를 'published'로 바꾸지 않는다. 로그에는 export 전문을
// 남기지 않는다(길이/개수/상태만 기록).

import {
  getSocialPostById,
  updateSocialPostExport,
  SocialPostNotFoundError,
} from "@/lib/repositories/social-posts-repository";
import { buildManualExportPayload, type ManualExportResult } from "./social-export-builder";
import { validateManualExportPayload } from "./social-export-validator";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { SocialPost } from "./social-platform-types";

export interface GenerateManualExportResult {
  success: boolean;
  message: string;
  socialPost?: SocialPost;
  exportPayload?: ManualExportResult;
}

async function logExportEvent(
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

/** manual export를 생성할 수 없는 이유를 반환한다. 가능하면 null. */
function checkExportable(post: SocialPost): string | null {
  if (post.approvalStatus === "rejected") return "반려된(rejected) social post는 export할 수 없습니다.";
  if (post.approvalStatus === "revoked") return "승인이 취소된(revoked) social post는 export할 수 없습니다.";
  if (post.approvalStatus !== "approved") return `approval_status가 'approved'가 아니어서(${post.approvalStatus}) export할 수 없습니다.`;
  if (post.qualityStatus === "blocked") return "quality_status가 blocked 상태여서 export할 수 없습니다.";
  if (post.qualityStatus !== "ready") return `quality_status가 'ready'가 아니어서(${post.qualityStatus}) export할 수 없습니다.`;
  if (post.publishStatus === "blocked") return "publish_status가 blocked 상태여서 export할 수 없습니다.";
  if (post.publishStatus === "published") return "이미 게시된 social post는 다시 export할 필요가 없습니다.";
  if (!hasAnyContent(post)) return "저장된 콘텐츠가 없어 export할 수 없습니다.";
  return null;
}

/**
 * social post의 manual export payload를 생성하고 저장한다. 실제 외부
 * 플랫폼 게시는 수행하지 않는다. export 가능 조건을 만족하지 못하면
 * export_status='blocked'로 저장하고 실패를 반환한다.
 */
export async function generateManualExport(
  socialPostId: string,
  exportedBy?: string
): Promise<GenerateManualExportResult> {
  const existing = await getSocialPostById(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  await logExportEvent(
    "social_manual_export_started",
    "info",
    `social post(${socialPostId})의 manual export를 시작합니다.`,
    existing.articleId,
    { socialPostId, platform: existing.platform, qualityStatus: existing.qualityStatus, approvalStatus: existing.approvalStatus }
  );

  const blockReason = checkExportable(existing);
  if (blockReason) {
    const updated = await updateSocialPostExport(socialPostId, {
      exportStatus: "blocked",
      exportError: blockReason,
    });
    await logExportEvent("social_manual_export_blocked", "failed", blockReason, existing.articleId, {
      socialPostId,
      platform: existing.platform,
      qualityStatus: existing.qualityStatus,
      approvalStatus: existing.approvalStatus,
      publishStatus: existing.publishStatus,
      reasonCode: "not_exportable",
    });
    return { success: false, message: blockReason, socialPost: updated };
  }

  try {
    const exportPayload = buildManualExportPayload(existing);
    const validation = validateManualExportPayload(existing, exportPayload);

    if (validation.blocked || !validation.valid) {
      const reason = validation.errors.join(" / ") || "export payload 검증에 실패했습니다.";
      const status = validation.blocked ? "blocked" : "failed";
      const updated = await updateSocialPostExport(socialPostId, {
        exportStatus: status,
        exportFormat: exportPayload.exportFormat,
        exportError: reason,
      });
      const eventType: LogEventType = validation.blocked ? "social_manual_export_blocked" : "social_manual_export_failed";
      await logExportEvent(eventType, "failed", reason, existing.articleId, {
        socialPostId,
        platform: existing.platform,
        exportFormat: exportPayload.exportFormat,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length,
        reasonCode: validation.blocked ? "prohibited_expression" : "export_validation_failed",
      });
      return { success: false, message: reason, socialPost: updated, exportPayload };
    }

    const updated = await updateSocialPostExport(socialPostId, {
      exportStatus: "exported",
      exportFormat: exportPayload.exportFormat,
      exportPayload: exportPayload as unknown as Record<string, unknown>,
      exportedBy: exportedBy ?? null,
      exportError: null,
      markPublishStatusExported: true,
    });

    await logExportEvent(
      "social_manual_export_completed",
      "success",
      `social post(${socialPostId})의 manual export를 완료했습니다 (format: ${exportPayload.exportFormat}).`,
      existing.articleId,
      {
        socialPostId,
        platform: existing.platform,
        toneStyle: existing.toneStyle,
        exportFormat: exportPayload.exportFormat,
        exportStatus: "exported",
        warningCount: validation.warnings.length,
        threadItemCount: exportPayload.exportThreadItems?.length ?? 0,
        hashtagCount: exportPayload.exportHashtags?.length ?? 0,
        cardItemCount: exportPayload.exportCardItems?.length ?? 0,
        exportTextLength: exportPayload.exportText?.length ?? 0,
        captionLength: exportPayload.exportCaption?.length ?? 0,
        postBodyLength: exportPayload.exportBody?.length ?? 0,
      }
    );

    return { success: true, message: "manual export를 생성했습니다.", socialPost: updated, exportPayload };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await updateSocialPostExport(socialPostId, { exportStatus: "failed", exportError: message }).catch(() => undefined);
    await logExportEvent("social_manual_export_failed", "failed", `manual export 실패: ${message}`, existing.articleId, {
      socialPostId,
      platform: existing.platform,
    });
    return { success: false, message };
  }
}

export { SocialPostNotFoundError };
