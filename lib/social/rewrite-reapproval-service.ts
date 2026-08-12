// Phase 3-13: Rewrite Re-approval & Re-export Workflow — 재승인 서비스.
// recommended_for_repost=true인 rewrite version도 새 글과 동일하게 다시
// 승인 절차를 거쳐야 한다. recommended_for_repost=true라고 해서 자동
// 승인/게시되지 않는다. 이 서비스는 rewrite_reapproval_status와
// (필요 시) 기존 approval_status를 함께 갱신할 뿐, 실제 게시는
// 어떤 경우에도 수행하지 않는다.

import {
  getRewriteVersionForReapproval,
  updateRewriteReapprovalStatus,
  updateRewriteRepublishWorkflowStatus,
} from "@/lib/repositories/social-posts-repository";
import { checkForbiddenPatterns } from "./platform-publishing-rules";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { SocialPost } from "./social-platform-types";

export interface RewriteReapprovalResult {
  success: boolean;
  message: string;
  socialPost?: SocialPost;
  warnings?: string[];
}

async function logReapprovalEvent(
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

function collectPostText(post: SocialPost): string {
  const threadText = post.threadItems.map((t) => t.text).join(" ");
  const cardText = post.cardItems.map((c) => `${c.heading} ${c.body}`).join(" ");
  return [post.postTitle, post.postBody, post.caption, post.excerpt, threadText, cardText].filter(Boolean).join(" ");
}

function baseDetails(post: SocialPost, extra?: Record<string, unknown>): Record<string, unknown> {
  return {
    socialPostId: post.id,
    articleId: post.articleId,
    platform: post.platform,
    toneStyle: post.toneStyle,
    rootSocialPostId: post.rootSocialPostId,
    parentSocialPostId: post.parentSocialPostId,
    versionNumber: post.versionNumber,
    recommendedForRepost: post.recommendedForRepost,
    versionComparisonStatus: post.versionComparisonStatus,
    qualityStatus: post.qualityStatus,
    approvalStatus: post.approvalStatus,
    rewriteReapprovalStatus: post.rewriteReapprovalStatus,
    ...extra,
  };
}

/** rewrite version의 재승인을 요청한다. is_rewrite_version=false/이미 게시됨/이미 수동 게시 기록됨이면 차단한다. */
export async function requestRewriteReapproval(
  socialPostId: string,
  requestedBy?: string,
  notes?: string
): Promise<RewriteReapprovalResult> {
  const post = await getRewriteVersionForReapproval(socialPostId);
  if (!post) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  const warnings: string[] = [];
  if (!post.recommendedForRepost) warnings.push("recommended_for_repost=false입니다 — 비교 결과가 아직 rewrite_better가 아닐 수 있습니다.");
  if (post.versionComparisonStatus !== "rewrite_better") warnings.push(`version_comparison_status가 'rewrite_better'가 아닙니다(${post.versionComparisonStatus}).`);
  if (post.qualityStatus !== "ready") warnings.push(`quality_status가 'ready'가 아닙니다(${post.qualityStatus}) — 먼저 Quality Recheck를 권장합니다.`);

  if (!post.isRewriteVersion) {
    const message = "is_rewrite_version=false인 social post는 재승인을 요청할 수 없습니다.";
    await logReapprovalEvent("social_rewrite_reapproval_blocked", "failed", message, post.articleId, baseDetails(post, { reasonCode: "not_rewrite_version" }));
    return { success: false, message };
  }
  if (post.publishStatus === "published") {
    const message = "이미 게시된 social post는 재승인을 요청할 필요가 없습니다.";
    await logReapprovalEvent("social_rewrite_reapproval_blocked", "failed", message, post.articleId, baseDetails(post, { reasonCode: "already_published" }));
    return { success: false, message };
  }
  if (post.manualPostStatus === "posted") {
    const message = "이미 수동 게시 기록이 있는 social post는 재승인을 요청할 필요가 없습니다.";
    await logReapprovalEvent("social_rewrite_reapproval_blocked", "failed", message, post.articleId, baseDetails(post, { reasonCode: "already_manual_posted" }));
    return { success: false, message };
  }

  try {
    const updated = await updateRewriteReapprovalStatus(socialPostId, {
      rewriteReapprovalStatus: "pending_review",
      requestedAt: new Date().toISOString(),
      requestedBy: requestedBy ?? null,
      notes: notes ?? null,
      approvalStatus: "pending_review",
    });
    await updateRewriteRepublishWorkflowStatus(socialPostId, { status: "reapproval_pending" });

    await logReapprovalEvent(
      "social_rewrite_reapproval_requested",
      "info",
      `social post(${socialPostId})의 재승인을 요청했습니다.`,
      post.articleId,
      baseDetails(post, { warningCount: warnings.length })
    );

    return { success: true, message: "재승인을 요청했습니다.", socialPost: updated, warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logReapprovalEvent("social_rewrite_reapproval_failed", "failed", message, post.articleId, baseDetails(post));
    return { success: false, message };
  }
}

/** rewrite version의 재승인을 승인한다. pending_review 상태이고 quality_status='ready'여야 한다. */
export async function approveRewriteReapproval(
  socialPostId: string,
  approvedBy?: string,
  notes?: string
): Promise<RewriteReapprovalResult> {
  const post = await getRewriteVersionForReapproval(socialPostId);
  if (!post) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  if (post.rewriteReapprovalStatus !== "pending_review") {
    const message = `rewrite_reapproval_status가 'pending_review'가 아니어서(${post.rewriteReapprovalStatus}) 승인할 수 없습니다.`;
    await logReapprovalEvent("social_rewrite_reapproval_blocked", "failed", message, post.articleId, baseDetails(post, { reasonCode: "not_pending_review" }));
    return { success: false, message };
  }
  if (!post.isRewriteVersion) {
    const message = "is_rewrite_version=false인 social post는 재승인할 수 없습니다.";
    await logReapprovalEvent("social_rewrite_reapproval_blocked", "failed", message, post.articleId, baseDetails(post, { reasonCode: "not_rewrite_version" }));
    return { success: false, message };
  }
  if (post.qualityStatus !== "ready") {
    const message = `quality_status가 'ready'가 아니어서(${post.qualityStatus}) 재승인할 수 없습니다.`;
    await logReapprovalEvent("social_rewrite_reapproval_blocked", "failed", message, post.articleId, baseDetails(post, { reasonCode: "quality_not_ready" }));
    return { success: false, message };
  }
  if (post.publishStatus === "published") {
    const message = "이미 게시된 social post는 재승인할 필요가 없습니다.";
    await logReapprovalEvent("social_rewrite_reapproval_blocked", "failed", message, post.articleId, baseDetails(post, { reasonCode: "already_published" }));
    return { success: false, message };
  }
  if (post.manualPostStatus === "posted") {
    const message = "이미 수동 게시 기록이 있는 social post는 재승인할 필요가 없습니다.";
    await logReapprovalEvent("social_rewrite_reapproval_blocked", "failed", message, post.articleId, baseDetails(post, { reasonCode: "already_manual_posted" }));
    return { success: false, message };
  }
  const forbidden = checkForbiddenPatterns(collectPostText(post));
  if (forbidden.blocked) {
    const message = `금지 표현이 발견되어 재승인할 수 없습니다: ${forbidden.found.join(", ")}`;
    await logReapprovalEvent("social_rewrite_reapproval_blocked", "failed", message, post.articleId, baseDetails(post, { reasonCode: "forbidden_pattern" }));
    return { success: false, message };
  }

  try {
    const now = new Date().toISOString();
    const updated = await updateRewriteReapprovalStatus(socialPostId, {
      rewriteReapprovalStatus: "approved",
      reapprovedAt: now,
      reapprovedBy: approvedBy ?? null,
      notes: notes ?? null,
      approvalStatus: "approved",
      approvedBy: approvedBy ?? null,
      approvedAt: now,
      rejectionReason: null,
    });
    await updateRewriteRepublishWorkflowStatus(socialPostId, { status: "reapproved" });

    await logReapprovalEvent(
      "social_rewrite_reapproval_approved",
      "success",
      `social post(${socialPostId})의 재승인이 완료되었습니다.`,
      post.articleId,
      baseDetails(post)
    );

    return { success: true, message: "재승인이 완료되었습니다.", socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logReapprovalEvent("social_rewrite_reapproval_failed", "failed", message, post.articleId, baseDetails(post));
    return { success: false, message };
  }
}

/** rewrite version의 재승인을 반려한다. */
export async function rejectRewriteReapproval(
  socialPostId: string,
  rejectedBy?: string,
  reason?: string
): Promise<RewriteReapprovalResult> {
  const post = await getRewriteVersionForReapproval(socialPostId);
  if (!post) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  try {
    const updated = await updateRewriteReapprovalStatus(socialPostId, {
      rewriteReapprovalStatus: "rejected",
      error: reason ?? null,
      approvalStatus: "rejected",
      rejectionReason: reason ?? null,
      approvedBy: null,
      approvedAt: null,
    });
    await updateRewriteRepublishWorkflowStatus(socialPostId, { status: "blocked" });

    await logReapprovalEvent(
      "social_rewrite_reapproval_rejected",
      "info",
      `social post(${socialPostId})의 재승인이 반려되었습니다.`,
      post.articleId,
      baseDetails(post, { rejectedBy: rejectedBy ?? null })
    );

    return { success: true, message: "재승인이 반려되었습니다.", socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logReapprovalEvent("social_rewrite_reapproval_failed", "failed", message, post.articleId, baseDetails(post));
    return { success: false, message };
  }
}

/** rewrite version의 재승인을 취소한다. approved 상태에만 적용된다. */
export async function revokeRewriteReapproval(
  socialPostId: string,
  revokedBy?: string,
  reason?: string
): Promise<RewriteReapprovalResult> {
  const post = await getRewriteVersionForReapproval(socialPostId);
  if (!post) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }
  if (post.rewriteReapprovalStatus !== "approved") {
    return { success: false, message: `rewrite_reapproval_status가 'approved'가 아니어서(${post.rewriteReapprovalStatus}) 승인을 취소할 수 없습니다.` };
  }

  try {
    const updated = await updateRewriteReapprovalStatus(socialPostId, {
      rewriteReapprovalStatus: "revoked",
      error: reason ?? null,
      approvalStatus: "revoked",
      approvedBy: null,
      approvedAt: null,
    });
    await updateRewriteRepublishWorkflowStatus(socialPostId, { status: "blocked" });

    await logReapprovalEvent(
      "social_rewrite_reapproval_revoked",
      "info",
      `social post(${socialPostId})의 재승인이 취소되었습니다.`,
      post.articleId,
      baseDetails(post, { revokedBy: revokedBy ?? null })
    );

    return { success: true, message: "재승인이 취소되었습니다.", socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logReapprovalEvent("social_rewrite_reapproval_failed", "failed", message, post.articleId, baseDetails(post));
    return { success: false, message };
  }
}
