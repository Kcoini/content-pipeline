// Phase 2-16: Human Approval Before Public Publish.
// Phase 2-15 Publish Quality Gate를 통과한 article에 대해 사람이 최종
// 승인해야만 다음 단계(Phase 2-17)에서 WordPress public publish를 실행할 수
// 있도록 승인 상태만 저장한다. 이 서비스는 실제 공개(publish)를 어떤
// 경우에도 수행하지 않으며, WordPress post status를 변경하지 않는다.

import {
  getArticleById,
  savePublicPublishApprovalResult,
} from "@/lib/repositories/article-repository";
import { savePublishLog, getSuccessfulWordPressDraft } from "@/lib/repositories/publish-repository";
import { saveApprovalLog } from "@/lib/repositories/approval-repository";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { Article } from "@/lib/types/domain";

export const PUBLIC_PUBLISH_APPROVAL_TARGET = "public_publish_approval";

export type ApprovalOutcomeStatus = "approved" | "duplicate" | "blocked" | "failed";
export type RevokeOutcomeStatus = "revoked" | "not_approved" | "failed";

export interface ApprovePublicPublishResult {
  success: boolean;
  message: string;
  status: ApprovalOutcomeStatus;
  blockedReasons?: string[];
}

export interface RevokePublicPublishApprovalResult {
  success: boolean;
  message: string;
  status: RevokeOutcomeStatus;
}

async function logApprovalEvent(
  type: LogEventType,
  status: LogStatus,
  message: string,
  articleId: string,
  article: Article,
  details?: Record<string, unknown>
): Promise<void> {
  await logEvent({
    type,
    status,
    message,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
    ...(details ? { details } : {}),
  });
}

function collectBlockReasons(article: Article, hasWordPressDraft: boolean): string[] {
  const reasons: string[] = [];

  if (!(article.status === "reviewed" || article.status === "published")) {
    reasons.push(`article.status=${article.status} (reviewed 또는 published가 아닙니다).`);
  }
  if (article.publishQualityGateStatus !== "ready_to_publish") {
    reasons.push(`publish_quality_gate_status=${article.publishQualityGateStatus} (ready_to_publish가 아닙니다).`);
  }
  if (!article.publishReady) {
    reasons.push("publish_ready가 true가 아닙니다.");
  }
  if (article.publishBlockedReason) {
    reasons.push(`publish_blocked_reason이 존재합니다: ${article.publishBlockedReason}`);
  }
  if (!hasWordPressDraft) {
    reasons.push("WordPress draft post id가 존재하지 않습니다.");
  }
  if (!article.targetKeyword) {
    reasons.push("target_keyword가 존재하지 않습니다.");
  }
  if (article.citedSourceIds.length === 0) {
    reasons.push("인용된 출처가 존재하지 않습니다.");
  }

  return reasons;
}

/**
 * article의 public publish 승인을 시도한다. Publish Quality Gate 통과
 * (publish_ready=true, publish_quality_gate_status=ready_to_publish),
 * WordPress draft post 존재, target_keyword/출처 존재 등 조건을 만족해야만
 * 승인 상태가 저장된다. 실제 공개(publish)는 어떤 경우에도 수행하지 않는다.
 */
export async function approvePublicPublish(
  articleId: string,
  approvedBy?: string,
  notes?: string
): Promise<ApprovePublicPublishResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}`, status: "failed" };
  }

  try {
    await logApprovalEvent(
      "public_publish_approval_started",
      "info",
      `기사(${articleId})의 public publish 승인을 시작합니다.`,
      articleId,
      article
    );

    const existingDraft = await getSuccessfulWordPressDraft(articleId);
    const approvedByLabel = approvedBy && approvedBy.trim().length > 0 ? approvedBy : "unknown";

    if (article.publicPublishApprovalStatus === "approved" && article.publicPublishApproved) {
      await logApprovalEvent(
        "public_publish_approval_duplicate",
        "info",
        `기사(${articleId})는 이미 승인된 상태입니다 (중복 승인 시도).`,
        articleId,
        article
      );
      await savePublishLog({
        articleId,
        target: PUBLIC_PUBLISH_APPROVAL_TARGET,
        status: "skipped",
        externalPostId: existingDraft?.externalPostId ?? null,
        postUrl: existingDraft?.postUrl ?? null,
        details: { actual: false, publicPublishAction: false, approvalStatus: "duplicate" },
      });
      return {
        success: true,
        message: `기사(${articleId})는 이미 승인된 상태입니다.`,
        status: "duplicate",
      };
    }

    const blockReasons = collectBlockReasons(article, Boolean(existingDraft));
    if (blockReasons.length > 0) {
      const reasonSummary = blockReasons.join(" / ");

      await savePublicPublishApprovalResult(articleId, {
        status: "blocked",
        approved: false,
        errorMessage: reasonSummary,
        notes: notes ?? null,
      });

      await logApprovalEvent(
        "public_publish_approval_blocked",
        "failed",
        `기사(${articleId})의 public publish 승인이 차단되었습니다: ${reasonSummary}`,
        articleId,
        article,
        { reasons: blockReasons }
      );

      await savePublishLog({
        articleId,
        target: PUBLIC_PUBLISH_APPROVAL_TARGET,
        status: "failed",
        externalPostId: existingDraft?.externalPostId ?? null,
        postUrl: existingDraft?.postUrl ?? null,
        errorMessage: reasonSummary,
        details: {
          actual: false,
          publicPublishAction: false,
          approvalStatus: "blocked",
          reason: reasonSummary,
          publishReady: article.publishReady,
          qualityGateStatus: article.publishQualityGateStatus,
        },
      });

      return { success: false, message: reasonSummary, status: "blocked", blockedReasons: blockReasons };
    }

    const approvedAt = new Date().toISOString();

    await savePublicPublishApprovalResult(articleId, {
      status: "approved",
      approved: true,
      approvedAt,
      approvedBy: approvedByLabel,
      errorMessage: null,
      notes: notes ?? null,
    });

    await saveApprovalLog({
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
      action: "public_publish_approved",
      status: "approved",
      approvedBy: approvedByLabel,
      notes,
    });

    await logApprovalEvent(
      "public_publish_approval_completed",
      "success",
      `기사(${articleId})의 public publish 승인이 완료되었습니다.`,
      articleId,
      article,
      { approvedBy: approvedByLabel, hasNotes: Boolean(notes) }
    );

    await savePublishLog({
      articleId,
      target: PUBLIC_PUBLISH_APPROVAL_TARGET,
      status: "success",
      externalPostId: existingDraft?.externalPostId ?? null,
      postUrl: existingDraft?.postUrl ?? null,
      errorMessage: null,
      details: {
        actual: false,
        publicPublishAction: false,
        approvalStatus: "approved",
        publishReady: true,
        qualityGateStatus: article.publishQualityGateStatus,
        approvedBy: approvedByLabel,
        hasNotes: Boolean(notes),
      },
    });

    return {
      success: true,
      message: `기사(${articleId})의 public publish 승인이 완료되었습니다.`,
      status: "approved",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

    try {
      await savePublicPublishApprovalResult(articleId, { status: "failed", errorMessage: message });
    } catch {
      // 결과 저장 실패는 무시하고 원래 오류를 그대로 알린다.
    }

    await logApprovalEvent(
      "public_publish_approval_failed",
      "failed",
      `public publish 승인 실패: ${message}`,
      articleId,
      article
    );

    await savePublishLog({
      articleId,
      target: PUBLIC_PUBLISH_APPROVAL_TARGET,
      status: "failed",
      errorMessage: message,
      details: { actual: false, publicPublishAction: false },
    });

    return { success: false, message, status: "failed" };
  }
}

/**
 * article의 public publish 승인을 취소한다. 실제 공개(publish)는 어떤
 * 경우에도 수행하지 않으며, 승인 상태만 revoked로 되돌린다.
 */
export async function revokePublicPublishApproval(
  articleId: string,
  revokedBy?: string,
  reason?: string
): Promise<RevokePublicPublishApprovalResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}`, status: "failed" };
  }

  try {
    if (!(article.publicPublishApprovalStatus === "approved" && article.publicPublishApproved)) {
      const message = `기사(${articleId})는 승인된 상태가 아니어서 승인을 취소할 수 없습니다.`;

      await logApprovalEvent(
        "public_publish_approval_revoke_failed",
        "failed",
        message,
        articleId,
        article
      );

      await savePublishLog({
        articleId,
        target: PUBLIC_PUBLISH_APPROVAL_TARGET,
        status: "skipped",
        errorMessage: message,
        details: { actual: false, publicPublishAction: false, approvalStatus: "not_approved" },
      });

      return { success: false, message, status: "not_approved" };
    }

    const revokedByLabel = revokedBy && revokedBy.trim().length > 0 ? revokedBy : "unknown";

    await savePublicPublishApprovalResult(articleId, {
      status: "revoked",
      approved: false,
      errorMessage: null,
      notes: reason ?? null,
    });

    await saveApprovalLog({
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
      action: "public_publish_approval_revoked",
      status: "revoked",
      approvedBy: revokedByLabel,
      notes: reason,
    });

    await logApprovalEvent(
      "public_publish_approval_revoked",
      "success",
      `기사(${articleId})의 public publish 승인이 취소되었습니다.`,
      articleId,
      article,
      { revokedBy: revokedByLabel, hasReason: Boolean(reason) }
    );

    await savePublishLog({
      articleId,
      target: PUBLIC_PUBLISH_APPROVAL_TARGET,
      status: "success",
      errorMessage: null,
      details: {
        actual: false,
        publicPublishAction: false,
        approvalStatus: "revoked",
        revokedBy: revokedByLabel,
        hasReason: Boolean(reason),
      },
    });

    return {
      success: true,
      message: `기사(${articleId})의 public publish 승인이 취소되었습니다.`,
      status: "revoked",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

    try {
      await savePublicPublishApprovalResult(articleId, { status: "failed", errorMessage: message });
    } catch {
      // 결과 저장 실패는 무시하고 원래 오류를 그대로 알린다.
    }

    await logApprovalEvent(
      "public_publish_approval_revoke_failed",
      "failed",
      `public publish 승인 취소 실패: ${message}`,
      articleId,
      article
    );

    await savePublishLog({
      articleId,
      target: PUBLIC_PUBLISH_APPROVAL_TARGET,
      status: "failed",
      errorMessage: message,
      details: { actual: false, publicPublishAction: false },
    });

    return { success: false, message, status: "failed" };
  }
}
