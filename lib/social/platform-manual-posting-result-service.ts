// Phase 3-8: Platform Manual Posting Checklist & Result Recording.
// handoff_status='completed'인 social post에 대해, 사람이 실제 플랫폼에
// 수동으로 게시한 결과를 기록한다. 이 서비스는 어떤 경우에도 실제 외부
// 플랫폼 게시 API를 호출하지 않는다. manual_post_status='posted'는
// 사람이 직접 게시했다는 기록일 뿐 자동 게시 완료가 아니다.

import {
  getSocialPostForManualPosting,
  updateManualPostingChecklist,
  updateManualPostingResult,
  SocialPostNotFoundError,
} from "@/lib/repositories/social-posts-repository";
import { buildManualPostingChecklist } from "./platform-manual-posting-checklist-builder";
import { validateManualPostUrl } from "./manual-posting-url-validator";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { SocialPost } from "./social-platform-types";

export interface ManualPostingResult {
  success: boolean;
  message: string;
  socialPost?: SocialPost;
}

async function logManualPostingEvent(
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

function urlDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** 수동 게시 결과를 기록할 수 없는 이유를 반환한다. 가능하면 null. */
function checkRecordable(post: SocialPost): string | null {
  if (post.qualityStatus !== "ready") return `quality_status가 'ready'가 아니어서(${post.qualityStatus}) 기록할 수 없습니다.`;
  if (post.approvalStatus !== "approved") return `approval_status가 'approved'가 아니어서(${post.approvalStatus}) 기록할 수 없습니다.`;
  if (post.exportStatus !== "ready" && post.exportStatus !== "exported") {
    return `export_status가 ready/exported가 아니어서(${post.exportStatus}) 기록할 수 없습니다.`;
  }
  if (post.platformPublishGuardStatus !== "ready") {
    return `platform_publish_guard_status가 'ready'가 아니어서(${post.platformPublishGuardStatus}) 기록할 수 없습니다.`;
  }
  if (!post.platformPublishReady) return "platform_publish_ready=false여서 기록할 수 없습니다.";
  if (post.platformPublishDryRunStatus !== "ready") {
    return `platform_publish_dry_run_status가 'ready'가 아니어서(${post.platformPublishDryRunStatus}) 기록할 수 없습니다.`;
  }
  if (post.handoffStatus !== "completed") {
    return `handoff_status가 'completed'가 아니어서(${post.handoffStatus}) 기록할 수 없습니다.`;
  }
  if (post.publishStatus === "blocked") return "publish_status가 blocked 상태여서 기록할 수 없습니다.";
  if (post.publishStatus === "failed") return "publish_status가 failed 상태여서 기록할 수 없습니다.";
  return null;
}

/**
 * manual posting checklist를 준비한다. handoff_status='completed'이고
 * 나머지 조건도 모두 만족해야 준비할 수 있다.
 */
export async function prepareManualPostingRecord(socialPostId: string): Promise<ManualPostingResult> {
  const existing = await getSocialPostForManualPosting(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  await logManualPostingEvent(
    "social_manual_posting_prepare_started",
    "info",
    `social post(${socialPostId})의 manual posting 준비를 시작합니다.`,
    existing.articleId,
    { socialPostId, platform: existing.platform, handoffStatus: existing.handoffStatus }
  );

  const blockReason = checkRecordable(existing);
  if (blockReason) {
    const updated = await updateManualPostingResult(socialPostId, { status: "blocked", error: blockReason });
    await logManualPostingEvent("social_manual_posting_prepare_blocked", "failed", blockReason, existing.articleId, {
      socialPostId,
      platform: existing.platform,
      reasonCode: "not_recordable",
    });
    return { success: false, message: blockReason, socialPost: updated };
  }

  try {
    const built = buildManualPostingChecklist(existing);
    const checklist = built.checklist.map((item) => ({ ...item, status: "pending" as const }));
    const updated = await updateManualPostingChecklist(socialPostId, checklist);

    await logManualPostingEvent(
      "social_manual_posting_prepare_completed",
      "success",
      `social post(${socialPostId})의 manual posting 준비를 완료했습니다.`,
      existing.articleId,
      { socialPostId, platform: existing.platform, checklistCount: checklist.length }
    );

    return { success: true, message: "manual posting checklist를 준비했습니다.", socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logManualPostingEvent("social_manual_posting_prepare_failed", "failed", `준비 실패: ${message}`, existing.articleId, {
      socialPostId,
      platform: existing.platform,
    });
    return { success: false, message };
  }
}

export interface RecordManualPostingResultInput {
  manualPostUrl: string;
  manualPostedAt?: string;
  manualPostedBy?: string;
  notes?: string;
}

/**
 * 사람이 실제로 플랫폼에 게시한 결과를 기록한다. 성공 시
 * manual_post_status='posted'이며 publish_status='published'로
 * 전환된다 — 이는 API 자동 게시가 아니라 사람이 직접 게시했다는 기록
 * 이다.
 */
export async function recordManualPostingResult(
  socialPostId: string,
  input: RecordManualPostingResultInput
): Promise<ManualPostingResult> {
  const existing = await getSocialPostForManualPosting(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  await logManualPostingEvent(
    "social_manual_posting_record_started",
    "info",
    `social post(${socialPostId})의 수동 게시 결과 기록을 시작합니다.`,
    existing.articleId,
    { socialPostId, platform: existing.platform, hasManualPostUrl: Boolean(input.manualPostUrl) }
  );

  const blockReason = checkRecordable(existing);
  if (blockReason) {
    const updated = await updateManualPostingResult(socialPostId, { status: "blocked", error: blockReason });
    await logManualPostingEvent("social_manual_posting_record_blocked", "failed", blockReason, existing.articleId, {
      socialPostId,
      platform: existing.platform,
      reasonCode: "not_recordable",
    });
    return { success: false, message: blockReason, socialPost: updated };
  }

  if (!input.manualPostUrl || input.manualPostUrl.trim().length === 0) {
    const reason = "게시 완료로 기록하려면 게시 URL이 필요합니다.";
    const updated = await updateManualPostingResult(socialPostId, { status: "blocked", error: reason });
    await logManualPostingEvent("social_manual_posting_record_blocked", "failed", reason, existing.articleId, {
      socialPostId,
      platform: existing.platform,
      reasonCode: "missing_url",
    });
    return { success: false, message: reason, socialPost: updated };
  }

  const wordpressBaseUrl = process.env.WORDPRESS_BASE_URL ?? null;
  const urlValidation = validateManualPostUrl(existing.platform, input.manualPostUrl, wordpressBaseUrl);
  if (urlValidation.blocked) {
    const reason = urlValidation.errors.join(" / ") || "게시 URL이 올바르지 않습니다.";
    const updated = await updateManualPostingResult(socialPostId, { status: "blocked", error: reason });
    await logManualPostingEvent("social_manual_posting_record_blocked", "failed", reason, existing.articleId, {
      socialPostId,
      platform: existing.platform,
      reasonCode: "invalid_url",
    });
    return { success: false, message: reason, socialPost: updated };
  }

  try {
    const manualPostedAt = input.manualPostedAt ?? new Date().toISOString();
    const updated = await updateManualPostingResult(socialPostId, {
      status: "posted",
      manualPostUrl: input.manualPostUrl,
      manualPostedAt,
      manualPostedBy: input.manualPostedBy ?? null,
      notes: input.notes ?? null,
      error: null,
      recordedBy: input.manualPostedBy ?? null,
      markPublished: true,
    });

    await logManualPostingEvent(
      "social_manual_posting_record_completed",
      "success",
      `social post(${socialPostId})의 수동 게시 결과를 기록했습니다 (manual_post_status: posted).`,
      existing.articleId,
      {
        socialPostId,
        platform: existing.platform,
        toneStyle: existing.toneStyle,
        manualPostStatus: "posted",
        publishStatus: updated.publishStatus,
        hasManualPostUrl: true,
        urlDomain: urlDomain(input.manualPostUrl),
        warningCount: urlValidation.warnings.length,
      }
    );

    return { success: true, message: "수동 게시 결과를 기록했습니다 (실제 API 게시가 아닌 수동 게시 기록입니다).", socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logManualPostingEvent("social_manual_posting_record_failed", "failed", `기록 실패: ${message}`, existing.articleId, {
      socialPostId,
      platform: existing.platform,
    });
    return { success: false, message };
  }
}

export interface MarkManualPostingOutcomeInput {
  reason?: string;
  recordedBy?: string;
}

/** 사람이 게시를 시도하지 않기로 했거나 보류한 경우를 기록한다 (publish_status는 바뀌지 않는다). */
export async function markManualPostingSkipped(
  socialPostId: string,
  input: MarkManualPostingOutcomeInput = {}
): Promise<ManualPostingResult> {
  const existing = await getSocialPostForManualPosting(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  try {
    const updated = await updateManualPostingResult(socialPostId, {
      status: "skipped",
      notes: input.reason ?? null,
      error: null,
      recordedBy: input.recordedBy ?? null,
    });

    await logManualPostingEvent(
      "social_manual_posting_skipped",
      "info",
      `social post(${socialPostId})의 수동 게시를 보류/스킵으로 기록했습니다.`,
      existing.articleId,
      { socialPostId, platform: existing.platform, manualPostStatus: "skipped" }
    );

    return { success: true, message: "수동 게시를 보류/스킵으로 기록했습니다.", socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return { success: false, message };
  }
}

/** 사람이 게시를 시도했지만 실패한 경우를 기록한다 (publish_status는 바뀌지 않는다). */
export async function markManualPostingFailed(
  socialPostId: string,
  input: MarkManualPostingOutcomeInput = {}
): Promise<ManualPostingResult> {
  const existing = await getSocialPostForManualPosting(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  try {
    const updated = await updateManualPostingResult(socialPostId, {
      status: "failed",
      error: input.reason ?? null,
      recordedBy: input.recordedBy ?? null,
    });

    await logManualPostingEvent(
      "social_manual_posting_failed_recorded",
      "info",
      `social post(${socialPostId})의 수동 게시 실패를 기록했습니다.`,
      existing.articleId,
      { socialPostId, platform: existing.platform, manualPostStatus: "failed" }
    );

    return { success: true, message: "수동 게시 실패를 기록했습니다.", socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return { success: false, message };
  }
}

export { SocialPostNotFoundError };
