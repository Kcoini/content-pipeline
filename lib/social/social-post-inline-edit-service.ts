// Phase 4-15: SNS/커뮤니티 글 목록 카드 안에서 본문을 바로 수정하고,
// [저장]/[저장 후 자동 검토]/[저장 후 승인]을 한 번의 제출로 처리하기
// 위한 오케스트레이션. 새 저장 로직이나 새 승인 로직을 만들지 않고,
// 이미 있는 editSocialPostContent()/runSocialPostQualityGateAndSave()/
// approveSocialPost()를 순서대로 호출할 뿐이다 — 자동 public publish는
// 어떤 경우에도 수행하지 않는다.

import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { PLATFORM_WRITING_CONFIGS } from "./platform-writing-config";
import { editSocialPostContent, runSocialPostQualityGateAndSave } from "./social-post-service";
import { approveSocialPost } from "./social-post-approval-service";
import { summarizeAutoReview } from "./social-post-auto-review";
import { logEvent } from "@/lib/harness/logger";
import type { SocialPlatform, SocialPost, SocialPostQualityChecklistItem } from "./social-platform-types";

export type SocialPostBodySaveMode = "save_only" | "save_and_review" | "save_review_and_approve";

export type SocialPostBodySaveStage =
  | "saved"
  | "reviewed_passed"
  | "reviewed_failed"
  | "approved"
  | "approve_blocked";

export interface SaveSocialPostBodyResult {
  success: boolean;
  message: string;
  stage: SocialPostBodySaveStage;
  socialPost?: SocialPost;
  /** 자동 검토가 실패했을 때만 채워지는 문제 요약(축약, "상세 상태 보기" 참고 문구와 함께 씀). */
  qualityIssues?: string[];
}

/**
 * 이 플랫폼의 게시용 본문이 저장되는 필드를 결정한다. 하드코딩된 platform
 * 이름 목록이 아니라 PLATFORM_WRITING_CONFIGS(getSocialPostDisplayBody와
 * 동일한 기준)를 사용한다 — naver_cafe/naver_blog/wordpress_blog/threads는
 * postBody, instagram은 caption이다. x는 threadItems 배열 기반 콘텐츠라
 * 단일 textarea로 안전하게 수정할 수 없어 null(지원 안 함)을 반환한다 —
 * x의 스레드 편집은 기존 상세 페이지의 전용 편집기를 그대로 사용해야 한다.
 */
export function getSocialPostEditableField(platform: SocialPlatform): "postBody" | "caption" | null {
  const config = PLATFORM_WRITING_CONFIGS[platform];
  if (config.supportsThreads) return null;
  return config.supportsBody ? "postBody" : "caption";
}

/** checklist에서 blocked/fail 항목만 뽑아 사람이 읽을 문장 목록으로 만든다(원문 본문은 포함하지 않는다). */
function summarizeQualityIssues(checklist: unknown): string[] {
  if (!Array.isArray(checklist)) return [];
  const review = summarizeAutoReview(checklist as SocialPostQualityChecklistItem[]);
  return review.issues.map((issue) => `[${issue.axisLabel}] ${issue.message}`);
}

async function logInlineEditEvent(
  type:
    | "social_post_body_save_started"
    | "social_post_body_save_completed"
    | "social_post_body_save_failed"
    | "social_post_save_review_started"
    | "social_post_save_review_completed"
    | "social_post_save_review_failed"
    | "social_post_save_approve_started"
    | "social_post_save_approve_completed"
    | "social_post_save_approve_blocked",
  status: "info" | "success" | "failed",
  message: string,
  articleId: string,
  details: Record<string, unknown>
): Promise<void> {
  // full post body/caption은 절대 로그에 남기지 않는다 — 길이·상태 등
  // 메타데이터만 기록한다.
  await logEvent({ type, status, message, articleId, targetType: "article", targetId: articleId, details });
}

/**
 * 본문(post_body 또는 caption)을 저장하고, saveMode에 따라 자동 검토/승인까지
 * 이어서 처리한다. [저장 후 승인]은 반드시 저장 → 자동 검토 → (통과 시)
 * 승인 순서로 진행하며, 자동 검토가 통과하지 못하면 승인하지 않는다
 * (approveSocialPost() 자신의 승인 가능 조건을 그대로 재사용 — 이 함수가
 * 별도로 승인 가능 여부를 판단하지 않는다).
 */
export async function saveSocialPostBodyAndProcess(
  socialPostId: string,
  body: string,
  saveMode: SocialPostBodySaveMode,
  approvedBy: string
): Promise<SaveSocialPostBodyResult> {
  const existing = await getSocialPostById(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}`, stage: "saved" };
  }

  const trimmed = body.trim();
  if (!trimmed) {
    return { success: false, message: "본문이 비어 있어 저장할 수 없습니다.", stage: "saved" };
  }

  const field = getSocialPostEditableField(existing.platform);
  if (!field) {
    return {
      success: false,
      message: "이 플랫폼은 카드 안에서 직접 수정할 수 없습니다 — 상세 페이지의 편집 화면을 사용하세요.",
      stage: "saved",
    };
  }

  await logInlineEditEvent("social_post_body_save_started", "info", "본문 저장을 시작합니다.", existing.articleId, {
    socialPostId,
    platform: existing.platform,
    saveMode,
    bodyLength: trimmed.length,
  });

  const editResult = await editSocialPostContent(
    socialPostId,
    field === "postBody" ? { postBody: trimmed, editedBy: approvedBy } : { caption: trimmed, editedBy: approvedBy }
  );

  if (!editResult.success || !editResult.socialPost) {
    await logInlineEditEvent("social_post_body_save_failed", "failed", editResult.message, existing.articleId, {
      socialPostId,
      platform: existing.platform,
      saveMode,
    });
    return { success: false, message: editResult.message, stage: "saved" };
  }

  await logInlineEditEvent(
    "social_post_body_save_completed",
    "success",
    "본문 저장을 완료했습니다.",
    existing.articleId,
    { socialPostId, platform: existing.platform, saveMode, bodyLength: trimmed.length }
  );

  if (saveMode === "save_only") {
    return {
      success: true,
      message: "수정 내용이 저장되었습니다. 자동 검토가 다시 필요합니다.",
      stage: "saved",
      socialPost: editResult.socialPost,
    };
  }

  await logInlineEditEvent("social_post_save_review_started", "info", "저장 후 자동 검토를 시작합니다.", existing.articleId, {
    socialPostId,
    platform: existing.platform,
    saveMode,
  });

  const reviewResult = await runSocialPostQualityGateAndSave(socialPostId);
  if (!reviewResult.success || !reviewResult.socialPost) {
    await logInlineEditEvent(
      "social_post_save_review_failed",
      "failed",
      reviewResult.message,
      existing.articleId,
      { socialPostId, platform: existing.platform, saveMode }
    );
    return {
      success: false,
      message: "수정 내용은 저장되었지만 자동 검토를 실행하지 못했습니다.",
      stage: "reviewed_failed",
      socialPost: editResult.socialPost,
    };
  }

  const reviewedPost = reviewResult.socialPost;
  const passed = reviewedPost.qualityStatus === "ready";
  await logInlineEditEvent(
    "social_post_save_review_completed",
    passed ? "success" : "info",
    `저장 후 자동 검토를 완료했습니다 (status: ${reviewedPost.qualityStatus}).`,
    existing.articleId,
    { socialPostId, platform: existing.platform, saveMode, qualityStatus: reviewedPost.qualityStatus }
  );

  if (saveMode === "save_and_review") {
    if (passed) {
      return {
        success: true,
        message: "수정 내용이 저장되었고 자동 검토를 통과했습니다.\n최종 확인 후 승인할 수 있습니다.",
        stage: "reviewed_passed",
        socialPost: reviewedPost,
      };
    }
    return {
      success: false,
      message: "수정 내용은 저장되었지만 자동 검토에서 문제가 발견되었습니다.",
      stage: "reviewed_failed",
      socialPost: reviewedPost,
      qualityIssues: summarizeQualityIssues(reviewedPost.qualitySummary?.checklist),
    };
  }

  // saveMode === "save_review_and_approve"
  await logInlineEditEvent("social_post_save_approve_started", "info", "저장 후 승인을 시작합니다.", existing.articleId, {
    socialPostId,
    platform: existing.platform,
  });

  const approveResult = await approveSocialPost(socialPostId, approvedBy);
  if (approveResult.success) {
    await logInlineEditEvent(
      "social_post_save_approve_completed",
      "success",
      "저장 후 승인을 완료했습니다.",
      existing.articleId,
      { socialPostId, platform: existing.platform }
    );
    return {
      success: true,
      message: "수정 내용이 저장되었고 자동 검토를 통과했습니다.\n글이 승인되었습니다.",
      stage: "approved",
      socialPost: approveResult.socialPost ?? reviewedPost,
    };
  }

  await logInlineEditEvent(
    "social_post_save_approve_blocked",
    "failed",
    approveResult.message,
    existing.articleId,
    { socialPostId, platform: existing.platform }
  );
  return {
    success: false,
    message: "수정 내용은 저장되었지만 자동 검토에서 문제가 발견되어 승인하지 않았습니다.",
    stage: "approve_blocked",
    socialPost: reviewedPost,
    qualityIssues: summarizeQualityIssues(reviewedPost.qualitySummary?.checklist),
  };
}
