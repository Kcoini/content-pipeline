// Phase 3-10: rewrite suggestion 승인/반려.
// 이 서비스는 suggestion_status만 바꾼다 — social_posts 본문에는 어떤
// 영향도 주지 않는다. "제안 적용(실제 반영)"은 이번 단계에서 구현하지
// 않는다.

import {
  getRewriteSuggestionById,
  updateRewriteSuggestionStatus,
} from "@/lib/repositories/social-rewrite-suggestions-repository";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { SocialPostRewriteSuggestion } from "./social-rewrite-types";

export interface RewriteSuggestionReviewResult {
  success: boolean;
  message: string;
  suggestion?: SocialPostRewriteSuggestion;
}

async function logReviewEvent(
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

/** rewrite suggestion을 승인한다. blocked 상태는 승인할 수 없다. */
export async function approveRewriteSuggestion(suggestionId: string, reviewedBy?: string): Promise<RewriteSuggestionReviewResult> {
  const existing = await getRewriteSuggestionById(suggestionId);
  if (!existing) {
    return { success: false, message: `rewrite suggestion을 찾을 수 없습니다: ${suggestionId}` };
  }
  if (existing.suggestionStatus === "blocked") {
    return { success: false, message: "blocked 상태의 제안은 승인할 수 없습니다." };
  }
  if (existing.suggestionStatus !== "ready" && existing.suggestionStatus !== "needs_review") {
    return { success: false, message: `suggestion_status가 'ready'/'needs_review'가 아니어서(${existing.suggestionStatus}) 승인할 수 없습니다.` };
  }

  try {
    const updated = await updateRewriteSuggestionStatus(suggestionId, "approved", { reviewedBy: reviewedBy ?? null });
    await logReviewEvent(
      "social_rewrite_suggestion_approved",
      "success",
      `rewrite suggestion(${suggestionId})이 승인되었습니다.`,
      existing.articleId,
      { socialPostId: existing.socialPostId, platform: existing.platform, suggestionStatus: "approved" }
    );
    return { success: true, message: "개선 제안이 승인되었습니다.", suggestion: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return { success: false, message };
  }
}

/** rewrite suggestion을 반려한다. */
export async function rejectRewriteSuggestion(
  suggestionId: string,
  reviewedBy?: string,
  reason?: string
): Promise<RewriteSuggestionReviewResult> {
  const existing = await getRewriteSuggestionById(suggestionId);
  if (!existing) {
    return { success: false, message: `rewrite suggestion을 찾을 수 없습니다: ${suggestionId}` };
  }

  try {
    const updated = await updateRewriteSuggestionStatus(suggestionId, "rejected", {
      reviewedBy: reviewedBy ?? null,
      rejectedReason: reason ?? null,
    });
    await logReviewEvent(
      "social_rewrite_suggestion_rejected",
      "info",
      `rewrite suggestion(${suggestionId})이 반려되었습니다.`,
      existing.articleId,
      { socialPostId: existing.socialPostId, platform: existing.platform, suggestionStatus: "rejected" }
    );
    return { success: true, message: "개선 제안이 반려되었습니다.", suggestion: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return { success: false, message };
  }
}
