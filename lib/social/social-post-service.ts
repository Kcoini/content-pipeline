// Phase 3-1: Multi-platform Writing 서비스 레이어.
// placeholder draft 생성, quality gate 실행, 승인/거부, manual export를
// 담당한다. 이 단계에서는 실제 AI 생성이나 실제 플랫폼 게시를 수행하지
// 않으며, 모든 단계는 pipeline_logs(event_name 기준)에 기록된다.

import {
  createSocialPostDraft,
  getSocialPostById,
  updateSocialPostQuality,
  updateSocialPostApproval,
  updateSocialPostPublishStatus,
  SocialPostNotFoundError,
} from "@/lib/repositories/social-posts-repository";
import { savePublishLog } from "@/lib/repositories/publish-repository";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import { buildSocialWritingContext, type SocialWritingContext } from "./social-writing-context-builder";
import { runSocialPostQualityGate } from "./social-quality-gate";
import { buildExportPayload } from "./social-export-builder";
import { getPlatformWritingConfig } from "./platform-writing-config";
import { getToneStyleConfig } from "./tone-style-config";
import type {
  SocialPlatform,
  ToneStyle,
  SocialPost,
  SocialPostDraftInput,
  ThreadItem,
  CardItem,
} from "./social-platform-types";

export const SOCIAL_DRAFT_TARGET = "social_draft";
export const SOCIAL_EXPORT_TARGET = "social_export";

export interface GenericSocialResult {
  success: boolean;
  message: string;
}

export interface GeneratePlaceholderDraftResult extends GenericSocialResult {
  socialPost?: SocialPost;
}

async function logSocialEvent(
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

/** placeholder 목적의 짧은 문구만 사용한다 (실제 AI 생성이 아님을 명시). */
function buildPlaceholderFields(context: SocialWritingContext): Partial<SocialPostDraftInput> {
  const { platform, toneStyle, title } = context;
  const toneLabel = getToneStyleConfig(toneStyle).label;
  const notice = `[placeholder] "${title}" 기사를 ${toneLabel} 문체로 ${platform}용으로 작성할 예정입니다. 실제 AI 생성 전 구조 테스트용 draft입니다.`;

  switch (platform) {
    case "wordpress_blog":
    case "naver_blog":
    case "naver_cafe":
      return {
        postTitle: `[Placeholder] ${title}`,
        postBody: notice,
        hashtags: platform === "naver_blog" ? ["placeholder"] : [],
      };

    case "x": {
      const threadItems: ThreadItem[] = [
        { order: 1, text: `[placeholder] ${title} — ${toneLabel}` },
        { order: 2, text: notice },
      ];
      return { threadItems, hashtags: ["placeholder"] };
    }

    case "threads":
      return { postBody: notice, hashtags: ["placeholder"] };

    case "instagram": {
      const cardItems: CardItem[] = [{ order: 1, heading: title, body: notice }];
      return { caption: notice, hashtags: ["placeholder"], cardItems };
    }

    default:
      return { postBody: notice };
  }
}

/**
 * 실제 AI 생성 전 구조 테스트를 위한 placeholder draft를 생성한다.
 * article/출처 요약을 담은 compact context를 만든 뒤, 플랫폼에 맞는
 * placeholder 형태의 필드만 채워 social_posts에 저장한다.
 */
export async function generatePlaceholderDraft(
  articleId: string,
  platform: SocialPlatform,
  toneStyle: ToneStyle
): Promise<GeneratePlaceholderDraftResult> {
  await logSocialEvent(
    "social_post_placeholder_generation_started",
    "info",
    `기사(${articleId})의 ${platform}/${toneStyle} placeholder draft 생성을 시작합니다.`,
    articleId,
    { platform, toneStyle }
  );

  try {
    const context = await buildSocialWritingContext(articleId, { platform, toneStyle });
    const placeholderFields = buildPlaceholderFields(context);

    const socialPost = await createSocialPostDraft({
      articleId,
      platform,
      toneStyle,
      generatedAt: new Date().toISOString(),
      generationContext: {
        sourceCount: context.sourceCount,
        hasTargetKeyword: Boolean(context.targetKeyword),
        placeholder: true,
      },
      platformMetadata: { purpose: context.platformConfig.purpose },
      ...placeholderFields,
    });

    await logSocialEvent(
      "social_post_created",
      "success",
      `social post(${socialPost.id})가 생성되었습니다.`,
      articleId,
      { socialPostId: socialPost.id, platform, toneStyle }
    );
    await logSocialEvent(
      "social_post_placeholder_generation_completed",
      "success",
      `기사(${articleId})의 ${platform}/${toneStyle} placeholder draft 생성을 완료했습니다.`,
      articleId,
      { socialPostId: socialPost.id, platform, toneStyle }
    );

    await savePublishLog({
      articleId,
      target: SOCIAL_DRAFT_TARGET,
      status: "success",
      details: {
        actual: false,
        socialPostId: socialPost.id,
        platform,
        toneStyle,
        placeholder: true,
      },
    });

    return { success: true, message: "placeholder draft를 생성했습니다.", socialPost };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logSocialEvent(
      "social_post_placeholder_generation_failed",
      "failed",
      `placeholder draft 생성 실패: ${message}`,
      articleId,
      { platform, toneStyle }
    );
    return { success: false, message };
  }
}

export interface RunSocialQualityGateResult extends GenericSocialResult {
  socialPost?: SocialPost;
}

/** social post 하나에 대해 rule-based quality gate를 실행하고 결과를 저장한다. */
export async function runSocialPostQualityGateAndSave(socialPostId: string): Promise<RunSocialQualityGateResult> {
  const existing = await getSocialPostById(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  await logSocialEvent(
    "social_quality_gate_started",
    "info",
    `social post(${socialPostId})의 quality gate를 시작합니다.`,
    existing.articleId,
    { socialPostId, platform: existing.platform }
  );

  try {
    const result = runSocialPostQualityGate({
      platform: existing.platform,
      toneStyle: existing.toneStyle,
      postTitle: existing.postTitle,
      postBody: existing.postBody,
      caption: existing.caption,
      excerpt: existing.excerpt,
      hashtags: existing.hashtags,
      threadItems: existing.threadItems,
      cardItems: existing.cardItems,
    });

    const updated = await updateSocialPostQuality(socialPostId, result);

    const eventType: LogEventType =
      result.status === "blocked" ? "social_quality_gate_blocked" : "social_quality_gate_completed";
    await logSocialEvent(
      eventType,
      result.status === "blocked" ? "failed" : "success",
      `social post(${socialPostId})의 quality gate가 완료되었습니다 (status: ${result.status}, score: ${result.score}).`,
      existing.articleId,
      { socialPostId, platform: existing.platform, status: result.status, score: result.score }
    );

    return {
      success: true,
      message: `quality gate 실행 완료 (status: ${result.status}, score: ${result.score}).`,
      socialPost: updated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logSocialEvent(
      "social_quality_gate_failed",
      "failed",
      `quality gate 실행 실패: ${message}`,
      existing.articleId,
      { socialPostId, platform: existing.platform }
    );
    return { success: false, message };
  }
}

export interface DecideSocialPostApprovalResult extends GenericSocialResult {
  socialPost?: SocialPost;
}

/**
 * social post를 승인 또는 거부한다. quality gate가 'ready'가 아니면 승인을
 * 차단한다 (blocked/needs_revision/failed/not_checked 상태에서는 승인 불가).
 */
export async function decideSocialPostApproval(
  socialPostId: string,
  decision: "approved" | "rejected",
  approvedBy?: string,
  notes?: string
): Promise<DecideSocialPostApprovalResult> {
  const existing = await getSocialPostById(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  await logSocialEvent(
    "social_approval_started",
    "info",
    `social post(${socialPostId})의 승인 절차를 시작합니다 (decision: ${decision}).`,
    existing.articleId,
    { socialPostId, platform: existing.platform, decision }
  );

  try {
    if (decision === "approved" && existing.qualityStatus !== "ready") {
      const message = `quality_status가 'ready'가 아니어서(${existing.qualityStatus}) 승인할 수 없습니다.`;
      return { success: false, message };
    }

    const updated = await updateSocialPostApproval(socialPostId, {
      status: decision,
      approvedBy: approvedBy ?? "unknown",
      notes,
    });

    const eventType: LogEventType = decision === "approved" ? "social_approval_completed" : "social_approval_rejected";
    await logSocialEvent(
      eventType,
      decision === "approved" ? "success" : "info",
      `social post(${socialPostId}) 승인 절차가 완료되었습니다 (decision: ${decision}).`,
      existing.articleId,
      { socialPostId, platform: existing.platform, decision, approvedBy: approvedBy ?? "unknown", hasNotes: Boolean(notes) }
    );

    return { success: true, message: `social post가 ${decision === "approved" ? "승인" : "거부"}되었습니다.`, socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return { success: false, message };
  }
}

export interface ExportSocialPostResult extends GenericSocialResult {
  socialPost?: SocialPost;
}

/**
 * 승인된 social post를 플랫폼별 manual export payload로 변환해 저장한다.
 * 실제 외부 플랫폼 게시 API는 호출하지 않는다. approval_status='approved'가
 * 아니면 export를 거부한다.
 */
export async function exportSocialPostDraft(socialPostId: string): Promise<ExportSocialPostResult> {
  const existing = await getSocialPostById(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  try {
    if (existing.approvalStatus !== "approved") {
      return {
        success: false,
        message: `승인되지 않은 social post는 export할 수 없습니다 (approval_status: ${existing.approvalStatus}).`,
      };
    }

    const { format, payload } = buildExportPayload(existing);

    const updated = await updateSocialPostPublishStatus(socialPostId, {
      status: "exported",
      exportFormat: format,
      exportPayload: payload,
      errorMessage: null,
    });

    await logSocialEvent(
      "social_export_completed",
      "success",
      `social post(${socialPostId})의 manual export를 완료했습니다 (format: ${format}).`,
      existing.articleId,
      { socialPostId, platform: existing.platform, format }
    );

    await savePublishLog({
      articleId: existing.articleId,
      target: SOCIAL_EXPORT_TARGET,
      status: "success",
      details: {
        actual: false,
        socialPostId,
        platform: existing.platform,
        exportFormat: format,
      },
    });

    return { success: true, message: "manual export payload를 생성했습니다.", socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return { success: false, message };
  }
}

export { getPlatformWritingConfig, SocialPostNotFoundError };
