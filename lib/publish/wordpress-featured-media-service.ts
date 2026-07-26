// Phase 2-11: WordPress Featured Media Draft Publish Test.
// Phase 2-10에서 업로드된 WordPress media id를 기존 WordPress draft post의
// featured_media로 연결한다. 공개 publish는 수행하지 않으며, post status는
// 항상 draft로 유지된다. 새 draft 생성 시 featured_media를 포함하는 로직은
// lib/publish/publish-service.ts(resolveFeaturedMediaForPublish/createDraftPost)가
// 이미 담당하므로, 이 서비스는 "이미 생성된 기존 draft"에 대한 업데이트만 다룬다.

import {
  getArticleById,
  saveWordPressFeaturedMediaAttachResult,
} from "@/lib/repositories/article-repository";
import { savePublishLog, getSuccessfulWordPressDraft } from "@/lib/repositories/publish-repository";
import { updateDraftFeaturedMedia, getMediaItem } from "./wordpress-client";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { Article } from "@/lib/types/domain";

export const WORDPRESS_FEATURED_MEDIA_TARGET = "wordpress_featured_media";

export interface AttachFeaturedMediaResult {
  success: boolean;
  message: string;
  postId?: string;
  postUrl?: string;
}

async function logAttachEvent(
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

function isValidMediaId(mediaId: number | null): mediaId is number {
  return typeof mediaId === "number" && Number.isInteger(mediaId) && mediaId > 0;
}

/**
 * article의 featured_image_wordpress_media_id를 기존 WordPress draft post의
 * featured_media로 연결한다. media id가 없으면 skipped_no_media_id로 처리하고,
 * 기존 draft가 없으면(아직 생성되지 않았으면) 연결을 시도하지 않고 안내
 * 메시지를 반환한다 (이 경우 새 draft는 'WordPress 초안 생성' 버튼으로 만든다 —
 * 그 흐름은 featured_media를 자동으로 포함한다). 실패해도 예외를 던지지 않는다.
 */
export async function attachFeaturedMediaToDraft(articleId: string): Promise<AttachFeaturedMediaResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  const mediaId = article.featuredImageWordpressMediaId;

  if (!isValidMediaId(mediaId)) {
    const message = `기사(${articleId})에 연결할 WordPress media id가 없습니다. 먼저 이미지 업로드를 완료하세요.`;
    await saveWordPressFeaturedMediaAttachResult(articleId, { status: "skipped_no_media_id" });
    await logAttachEvent("wordpress_featured_media_attach_skipped_no_media_id", "info", message, articleId, article);
    await savePublishLog({
      articleId,
      target: WORDPRESS_FEATURED_MEDIA_TARGET,
      status: "skipped",
      details: {
        actual: false,
        reason: "no_media_id",
        featuredMedia: { included: false },
      },
    });
    return { success: false, message };
  }

  const existingDraft = await getSuccessfulWordPressDraft(articleId);
  if (!existingDraft) {
    const message = `기사(${articleId})에 대해 이미 생성된 WordPress draft가 없습니다. 먼저 'WordPress 초안 생성'을 실행하세요.`;
    await logAttachEvent("wordpress_featured_media_existing_draft_not_found", "info", message, articleId, article);
    return { success: false, message };
  }

  await logAttachEvent(
    "wordpress_featured_media_existing_draft_found",
    "info",
    `기사(${articleId})의 기존 WordPress draft(post id: ${existingDraft.externalPostId})를 찾았습니다.`,
    articleId,
    article,
    { externalPostId: existingDraft.externalPostId, mediaUrl: article.featuredImageWordpressUrl ?? null }
  );

  const postId = Number(existingDraft.externalPostId);
  if (!Number.isInteger(postId) || postId <= 0) {
    const message = "기존 WordPress draft의 post id가 유효하지 않습니다.";
    await saveWordPressFeaturedMediaAttachResult(articleId, { status: "failed", errorMessage: message });
    await logAttachEvent("wordpress_featured_media_attach_failed", "failed", message, articleId, article);
    await savePublishLog({
      articleId,
      target: WORDPRESS_FEATURED_MEDIA_TARGET,
      status: "failed",
      errorMessage: message,
      details: { actual: true, reasonCandidate: ["원인을 특정할 수 없는 오류입니다."] },
    });
    return { success: false, message };
  }

  // 선택적 사전 검증: media item이 실제로 존재하는지 확인한다 — 실패하면 연결을 중단한다.
  const mediaCheck = await getMediaItem(mediaId);
  if (!mediaCheck.exists) {
    const safeMessage = mediaCheck.errorMessage ?? "WordPress media item을 확인할 수 없습니다.";
    await logAttachEvent(
      "wordpress_media_item_validation_failed",
      "failed",
      safeMessage,
      articleId,
      article,
      { statusCode: mediaCheck.statusCode ?? null }
    );
    await saveWordPressFeaturedMediaAttachResult(articleId, { status: "failed", errorMessage: safeMessage });
    await savePublishLog({
      articleId,
      target: WORDPRESS_FEATURED_MEDIA_TARGET,
      status: "failed",
      errorMessage: safeMessage,
      details: {
        actual: true,
        statusCode: mediaCheck.statusCode ?? null,
        reasonCandidate: [safeMessage],
      },
    });
    return { success: false, message: safeMessage };
  }
  await logAttachEvent(
    "wordpress_media_item_validation_completed",
    "success",
    `WordPress media item(${mediaId}) 확인 완료.`,
    articleId,
    article
  );

  await logAttachEvent(
    "wordpress_featured_media_attach_started",
    "info",
    `기사(${articleId})의 기존 draft(post id: ${postId})에 featured_media(${mediaId})를 연결합니다.`,
    articleId,
    article
  );

  const result = await updateDraftFeaturedMedia(postId, mediaId);

  if (!result.success) {
    await saveWordPressFeaturedMediaAttachResult(articleId, { status: "failed", errorMessage: result.errorMessage });
    await logAttachEvent(
      "wordpress_featured_media_attach_failed",
      "failed",
      `featured_media 연결 실패: ${result.errorMessage}`,
      articleId,
      article,
      { statusCode: result.statusCode ?? null }
    );
    await savePublishLog({
      articleId,
      target: WORDPRESS_FEATURED_MEDIA_TARGET,
      status: "failed",
      errorMessage: result.errorMessage,
      details: {
        actual: true,
        statusCode: result.statusCode ?? null,
        reasonCandidate: result.reasonCandidate,
      },
    });
    return { success: false, message: result.errorMessage };
  }

  await saveWordPressFeaturedMediaAttachResult(articleId, { status: "attached", errorMessage: null });
  await logAttachEvent(
    "wordpress_featured_media_attach_completed",
    "success",
    `기사(${articleId})의 featured_media 연결 완료 (media id: ${mediaId}).`,
    articleId,
    article,
    { mediaId, postId: result.postId }
  );

  await savePublishLog({
    articleId,
    target: WORDPRESS_FEATURED_MEDIA_TARGET,
    status: "success",
    externalPostId: String(result.postId),
    postUrl: result.link,
    details: {
      actual: true,
      featuredMedia: { included: true, mediaId, mode: "update_existing_draft" },
    },
  });

  return {
    success: true,
    message: "대표 이미지를 기존 WordPress draft에 연결했습니다.",
    postId: String(result.postId),
    postUrl: result.link,
  };
}
