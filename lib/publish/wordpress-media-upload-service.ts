// Phase 2-10: WordPress Media Upload Actual Test.
// Phase 2-6에서 준비한 featured image metadata를 바탕으로 실제 WordPress Media
// Library에 이미지 1개를 업로드한다. 공개 publish는 수행하지 않으며,
// WORDPRESS_MEDIA_UPLOAD_ENABLED=true일 때만 실제 업로드를 시도한다.

import {
  getArticleById,
  updateWordPressMediaUploadStatus,
  saveFeaturedImageUploadResult,
} from "@/lib/repositories/article-repository";
import { savePublishLog } from "@/lib/repositories/publish-repository";
import { uploadMediaToWordPress } from "./wordpress-client";
import {
  isWordPressMediaUploadEnabled,
  isRealHttpUrl,
  inferMimeTypeFromFilename,
  getDefaultImageFilename,
} from "./wordpress-media-config";
import { logEvent } from "@/lib/harness/logger";
import type { Article } from "@/lib/types/domain";

export const WORDPRESS_MEDIA_TARGET = "wordpress_media";

export interface UploadFeaturedImageResult {
  success: boolean;
  message: string;
  wordpressMediaId?: number;
  wordpressUrl?: string;
}

type MediaUploadSourceType = "generated_url" | "external_url" | "local_file" | "none";

interface ResolvedUploadSource {
  sourceType: MediaUploadSourceType;
  sourceUrl?: string;
  localPath?: string;
  /** true면 mock/상대경로 등 업로드 후보는 있었지만 실제 업로드 대상이 될 수 없었다. */
  hadInvalidCandidate: boolean;
}

/**
 * featured image 업로드에 사용할 source를 결정한다 (Phase 2-10).
 * 1. generated_image_status가 generated/reviewed이고 generated_image_url이 http/https이면 generated_url
 * 2. 아니면 featured_image_source_url이 http/https이면 external_url
 * 3. 아니면 featured_image_local_path가 있으면 local_file
 * 4. 모두 없으면 none (mock/상대경로만 있는 경우도 여기 포함 — 실제 업로드는 금지된다)
 */
function resolveUploadSource(article: Article): ResolvedUploadSource {
  const isGeneratedReady = article.generatedImageStatus === "generated" || article.generatedImageStatus === "reviewed";

  if (isGeneratedReady && isRealHttpUrl(article.generatedImageUrl)) {
    return { sourceType: "generated_url", sourceUrl: article.generatedImageUrl, hadInvalidCandidate: false };
  }

  if (isRealHttpUrl(article.featuredImageSourceUrl)) {
    return { sourceType: "external_url", sourceUrl: article.featuredImageSourceUrl, hadInvalidCandidate: false };
  }

  if (article.featuredImageLocalPath) {
    return { sourceType: "local_file", localPath: article.featuredImageLocalPath, hadInvalidCandidate: false };
  }

  const hadInvalidCandidate =
    (isGeneratedReady && Boolean(article.generatedImageUrl) && !isRealHttpUrl(article.generatedImageUrl)) ||
    (Boolean(article.featuredImageSourceUrl) && !isRealHttpUrl(article.featuredImageSourceUrl));

  return { sourceType: "none", hadInvalidCandidate };
}

/** filename은 featured_image_filename 우선, 없으면 slug 기반(또는 article id fallback)으로 생성한다. */
function resolveFilenameAndMimeType(article: Article): { filename: string; mimeType: string } {
  const explicitMimeType = article.featuredImageMimeType || undefined;
  const extension = explicitMimeType === "image/jpeg" ? "jpg" : explicitMimeType === "image/png" ? "png" : "webp";

  const filename = article.featuredImageFilename || getDefaultImageFilename(article, extension);
  const mimeType = explicitMimeType || inferMimeTypeFromFilename(filename);

  return { filename, mimeType };
}

async function logMediaUploadEvent(
  type: Parameters<typeof logEvent>[0]["type"],
  status: Parameters<typeof logEvent>[0]["status"],
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

/**
 * article의 featured image를 실제 WordPress Media Library에 업로드한다 (Phase 2-10).
 * WORDPRESS_MEDIA_UPLOAD_ENABLED=false(기본값)이면 실제 업로드를 시도하지 않고
 * skipped로 처리한다. 실패해도 예외를 던지지 않고 safe한 결과를 반환한다.
 */
export async function uploadFeaturedImageToWordPress(articleId: string): Promise<UploadFeaturedImageResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  if (!isWordPressMediaUploadEnabled()) {
    const message = `WORDPRESS_MEDIA_UPLOAD_ENABLED=false이므로 기사(${articleId})의 실제 이미지 업로드를 건너뜁니다.`;
    await updateWordPressMediaUploadStatus(articleId, "skipped");
    await logMediaUploadEvent("wordpress_media_upload_skipped_disabled", "info", message, articleId, article);
    return { success: true, message: "이미지 업로드가 비활성화되어 있어 건너뜁니다 (WORDPRESS_MEDIA_UPLOAD_ENABLED=false)." };
  }

  const source = resolveUploadSource(article);

  if (source.sourceType === "none") {
    if (source.hadInvalidCandidate) {
      const message = `기사(${articleId})의 이미지 source가 mock 또는 상대경로여서 실제 업로드를 건너뜁니다.`;
      await updateWordPressMediaUploadStatus(articleId, "skipped", message);
      await logMediaUploadEvent("wordpress_media_source_invalid", "info", message, articleId, article);
      return { success: false, message };
    }
    const message = `기사(${articleId})에 업로드할 이미지 source가 없어 건너뜁니다.`;
    await updateWordPressMediaUploadStatus(articleId, "skipped", message);
    await logMediaUploadEvent("wordpress_media_upload_skipped_no_source", "info", message, articleId, article);
    return { success: false, message };
  }

  const { filename, mimeType } = resolveFilenameAndMimeType(article);

  await logMediaUploadEvent(
    "wordpress_media_upload_started",
    "info",
    `기사(${articleId})의 실제 WordPress 이미지 업로드를 시작합니다.`,
    articleId,
    article,
    { sourceType: source.sourceType, filename, mimeType }
  );

  const result = await uploadMediaToWordPress({
    sourceType: source.sourceType,
    sourceUrl: source.sourceUrl,
    localPath: source.localPath,
    filename,
    mimeType,
    altText: article.featuredImageAltText || "",
    caption: article.featuredImageCaption || "",
    title: article.seoTitle || article.title,
    description: article.featuredImageCaption || article.seoTitle || article.title,
  });

  if (result.status !== "uploaded") {
    const safeMessage = result.error ?? "이미지 업로드에 실패했습니다.";

    await saveFeaturedImageUploadResult(articleId, { status: "failed", errorMessage: safeMessage });
    await logMediaUploadEvent(
      "wordpress_media_upload_failed",
      "failed",
      `WordPress 이미지 업로드 실패: ${safeMessage}`,
      articleId,
      article,
      { statusCode: result.statusCode ?? null }
    );
    await savePublishLog({
      articleId,
      target: WORDPRESS_MEDIA_TARGET,
      status: "failed",
      errorMessage: safeMessage,
      details: {
        actual: true,
        mediaUpload: true,
        statusCode: result.statusCode ?? null,
        sourceType: source.sourceType,
        filename,
        reasonCandidate: result.reasonCandidate ?? [],
      },
    });

    return { success: false, message: safeMessage };
  }

  await saveFeaturedImageUploadResult(articleId, {
    status: "uploaded",
    wordpressMediaId: result.wordpressMediaId,
    wordpressUrl: result.wordpressUrl ?? null,
    errorMessage: null,
    sourceType: "uploaded",
  });

  await logMediaUploadEvent(
    "wordpress_media_upload_completed",
    "success",
    `WordPress 이미지 업로드 완료 (media id: ${result.wordpressMediaId}).`,
    articleId,
    article,
    { mediaId: result.wordpressMediaId }
  );

  // metadata(alt_text/caption/description/title) 업데이트 실패는 업로드 성공을
  // 무효화하지 않는다 — warning으로만 기록한다.
  if (result.metadataUpdateStatus === "success") {
    await logMediaUploadEvent(
      "wordpress_media_metadata_update_completed",
      "success",
      `기사(${articleId})의 media metadata(alt text/caption) 업데이트를 완료했습니다.`,
      articleId,
      article
    );
  } else if (result.metadataUpdateStatus === "failed") {
    await logMediaUploadEvent(
      "wordpress_media_metadata_update_failed",
      "failed",
      `기사(${articleId})의 media metadata 업데이트에 실패했습니다 (업로드 자체는 성공, warning으로 처리).`,
      articleId,
      article
    );
  }

  await savePublishLog({
    articleId,
    target: WORDPRESS_MEDIA_TARGET,
    status: "success",
    externalPostId: String(result.wordpressMediaId),
    postUrl: result.wordpressUrl,
    details: {
      actual: true,
      mediaUpload: true,
      mediaId: result.wordpressMediaId,
      sourceType: source.sourceType,
      filename,
      mimeType,
      metadataUpdateStatus: result.metadataUpdateStatus ?? "not_attempted",
      altTextPresent: Boolean(article.featuredImageAltText),
      captionPresent: Boolean(article.featuredImageCaption),
    },
  });

  return {
    success: true,
    message: "WordPress 이미지 업로드가 완료되었습니다.",
    wordpressMediaId: result.wordpressMediaId,
    wordpressUrl: result.wordpressUrl,
  };
}
