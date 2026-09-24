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

/**
 * QA-01-FIX1과 동일한 이유(platform-publishing-guard-service.ts의
 * requiresManualExportPrecondition 참고): export_status/
 * platformPublishGuardStatus/platformPublishReady/
 * platformPublishDryRunStatus/handoffStatus는 전부 "manual export/
 * handoff"(social-manual-export-service.ts → platform-publish-dry-run-
 * service.ts → platform-export-handoff-service.ts) 파이프라인을 실제로
 * 거치는 플랫폼(naver_blog/news_article/opinion_column/naver_cafe/x/
 * threads/instagram — PublishCapability "manual"/"copy")에만 의미가
 * 있다. wordpress_blog는 Draft 기반의 완전히 다른 게시 준비 경로
 * (wordpress-blog-publish-prep-state.ts)를 쓰고 이 파이프라인을 전혀
 * 거치지 않으므로 해당 필드들이 영원히 초기값으로 남는다 — 이
 * 전제조건들을 공통으로 요구하면 wordpress_blog는 "게시 체크리스트
 * 만들기"(prepareManualPostingRecordAction, checklistPrepared 계산에
 * 쓰임)가 항상 실패한다(실제로 발견된 버그 — export_status 단계에서
 * "게시용 내보내기 준비가 아직 끝나지 않아..."로 막힘).
 * lib/ui를 import하지 않기 위해(레이어 방향 유지) 같은 구분을 여기서도
 * 직접 반복한다.
 */
function requiresManualExportPipelinePrecondition(platform: string): boolean {
  return platform !== "wordpress_blog";
}

/**
 * 수동 게시 결과를 기록할 수 없는 이유를 반환한다. 가능하면 null.
 * Phase UX-05B: raw DB 필드명/enum이 사용자에게 그대로 보이던 문제를
 * 고쳐 전부 자연어 문장으로 바꿨다(governance: disabled 사유에 raw
 * 필드명을 섞지 않는다) — 판단 조건 자체는 전혀 바꾸지 않았다.
 */
function checkRecordable(post: SocialPost): string | null {
  // OPS-02B: 멱등성 gap 수정 — 이전에는 publishStatus==="blocked"/"failed"만
  // 막았고 이미 "posted"로 기록된 글은 다시 걸러지지 않아, 같은 요청이
  // 중복 제출되면(네트워크 재시도/이중 클릭) manualPostUrl/manualPostedAt/
  // manualPostedBy가 새 값으로 조용히 덮어써질 수 있었다(실제 외부
  // side effect는 없지만 완료 기록이 의도치 않게 바뀔 수 있는 gap).
  if (post.manualPostStatus === "posted") return "이미 게시 완료로 기록된 글입니다(중복 기록 방지).";
  if (post.qualityStatus !== "ready") return "품질검사를 먼저 통과해야 게시 완료를 기록할 수 있습니다.";
  if (post.approvalStatus !== "approved") return "먼저 승인이 완료되어야 게시 완료를 기록할 수 있습니다.";

  if (requiresManualExportPipelinePrecondition(post.platform)) {
    if (post.exportStatus !== "ready" && post.exportStatus !== "exported") {
      return "게시용 내보내기 준비가 아직 끝나지 않아 게시 완료를 기록할 수 없습니다.";
    }
    if (post.platformPublishGuardStatus !== "ready") {
      return "게시 준비 확인이 아직 끝나지 않아 게시 완료를 기록할 수 없습니다.";
    }
    if (!post.platformPublishReady) return "게시 준비가 아직 끝나지 않아 게시 완료를 기록할 수 없습니다.";
    if (post.platformPublishDryRunStatus !== "ready") {
      return "게시 전 미리보기 준비가 아직 끝나지 않아 게시 완료를 기록할 수 없습니다.";
    }
    if (post.handoffStatus !== "completed") {
      return "수동 게시 준비 완료 표시가 아직 되어 있지 않아 게시 완료를 기록할 수 없습니다.";
    }
  }

  if (post.publishStatus === "blocked") return "게시 상태가 차단되어 있어 게시 완료를 기록할 수 없습니다.";
  if (post.publishStatus === "failed") return "게시 상태가 실패로 기록되어 있어 다시 게시 완료를 기록할 수 없습니다.";
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
