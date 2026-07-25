// Phase 2-6: WordPress Media Upload Preparation 서비스.
// Phase 2-5에서 준비한 featured image metadata(prompt/alt text/caption/style)를
// 바탕으로 WordPress media endpoint에 전달할 업로드 payload를 준비한다.
// 실제 이미지 생성/다운로드/업로드는 하지 않는다.

import {
  getArticleById,
  saveWordPressMediaUploadPayload,
  updateWordPressMediaUploadStatus,
} from "@/lib/repositories/article-repository";
import { logEvent } from "@/lib/harness/logger";
import { getDefaultImageFilename } from "./wordpress-media-config";
import { uploadMediaToWordPress } from "./wordpress-client";
import type { Article } from "@/lib/types/domain";
import type { WordPressMediaUploadPayload } from "./wordpress-media-types";

export interface PrepareMediaUploadResult {
  success: boolean;
  message: string;
  payload?: WordPressMediaUploadPayload;
}

const DEFAULT_MIME_TYPE = "image/webp";

function isDryRun(): boolean {
  const mediaUploadEnabled = process.env.WORDPRESS_MEDIA_UPLOAD_ENABLED === "true";
  const publishEnabled = process.env.WORDPRESS_PUBLISH_ENABLED === "true";
  return !(mediaUploadEnabled && publishEnabled);
}

function buildUploadPayload(article: Article, filename: string, mimeType: string): WordPressMediaUploadPayload {
  return {
    articleId: article.id,
    sourceType: article.featuredImageSourceType,
    sourceUrl: article.featuredImageSourceUrl ?? undefined,
    localPath: article.featuredImageLocalPath ?? undefined,
    filename,
    mimeType,
    altText: article.featuredImageAltText || "",
    caption: article.featuredImageCaption || "",
    title: article.featuredImageAltText || article.seoTitle || article.title,
    description: article.featuredImageCaption || "",
    aspectRatio: article.featuredImageAspectRatio,
    shouldSetAsFeatured: true,
    dryRun: isDryRun(),
  };
}

/**
 * featured image metadata를 바탕으로 WordPress media upload payload를 준비하고
 * 저장한다. 현재는 실제 이미지 파일이 없을 수 있으므로(sourceType='none') 그
 * 상태 그대로도 dry-run 확인용 payload를 만들 수 있다. 실제 이미지 생성/업로드는
 * 하지 않는다.
 */
export async function prepareWordPressMediaUpload(articleId: string): Promise<PrepareMediaUploadResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  await logEvent({
    type: "wordpress_media_upload_preparation_started",
    status: "info",
    message: `기사(${articleId}) WordPress 이미지 업로드 준비를 시작합니다.`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });

  try {
    const filename = article.featuredImageFilename || getDefaultImageFilename(article);
    const mimeType = article.featuredImageMimeType || DEFAULT_MIME_TYPE;
    const payload = buildUploadPayload(article, filename, mimeType);

    await saveWordPressMediaUploadPayload({
      articleId,
      sourceType: payload.sourceType,
      filename,
      mimeType,
      payload,
      status: "prepared",
    });

    await logEvent({
      type: "wordpress_media_upload_preparation_completed",
      status: "success",
      message: `기사(${articleId}) WordPress 이미지 업로드 준비를 완료했습니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
      details: { filename, mimeType, sourceType: payload.sourceType },
    });

    return { success: true, message: "WordPress 이미지 업로드 준비를 완료했습니다.", payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

    try {
      const fallbackFilename = article.featuredImageFilename || getDefaultImageFilename(article);
      await saveWordPressMediaUploadPayload({
        articleId,
        sourceType: article.featuredImageSourceType,
        filename: fallbackFilename,
        mimeType: article.featuredImageMimeType || DEFAULT_MIME_TYPE,
        payload: buildUploadPayload(article, fallbackFilename, article.featuredImageMimeType || DEFAULT_MIME_TYPE),
        status: "failed",
        error: message,
      });
    } catch {
      // 저장 실패는 무시하고 원래 오류를 그대로 알린다.
    }

    await logEvent({
      type: "wordpress_media_upload_preparation_failed",
      status: "failed",
      message: `WordPress 이미지 업로드 준비 실패: ${message}`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
      details: { error: message },
    });

    return { success: false, message };
  }
}

/**
 * 준비된 payload로 dry-run 업로드 확인을 수행한다 (실제 업로드는 하지 않는다).
 * WORDPRESS_MEDIA_UPLOAD_ENABLED=false이면 skipped, WORDPRESS_PUBLISH_ENABLED=true가
 * 아니면 dry_run으로 기록되고, 두 조건이 모두 충족되어도 실제 업로드는 아직
 * 구현되지 않았으므로 failed로 기록된다 (lib/publish/wordpress-client.ts의 safe stub).
 */
export async function confirmWordPressMediaUploadDryRun(articleId: string): Promise<PrepareMediaUploadResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  const payload = article.featuredImageUploadPayload as unknown as Partial<WordPressMediaUploadPayload>;
  if (!payload?.filename) {
    return { success: false, message: "먼저 'WordPress 이미지 업로드 준비'를 실행하세요." };
  }

  const result = await uploadMediaToWordPress({
    filename: payload.filename,
    mimeType: payload.mimeType || DEFAULT_MIME_TYPE,
    altText: payload.altText || "",
    caption: payload.caption || "",
    title: payload.title || article.title,
    description: payload.description || "",
  });

  if (result.status === "skipped") {
    await updateWordPressMediaUploadStatus(articleId, "skipped");
    await logEvent({
      type: "wordpress_media_upload_skipped_disabled",
      status: "info",
      message: `WORDPRESS_MEDIA_UPLOAD_ENABLED=false이므로 기사(${articleId})의 실제 업로드를 건너뜁니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
    return { success: true, message: "업로드 기능이 비활성화되어 있어 dry-run만 확인되었습니다 (실제 업로드는 건너뜀)." };
  }

  if (result.status === "dry_run") {
    await updateWordPressMediaUploadStatus(articleId, "dry_run");
    await logEvent({
      type: "wordpress_media_upload_dry_run",
      status: "success",
      message: `dry-run 확인 완료: 기사(${articleId})는 실제 WordPress에 업로드되지 않았습니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
    return { success: true, message: "dry-run 확인 완료: 실제 WordPress에는 업로드되지 않았습니다." };
  }

  if (result.status === "failed") {
    await updateWordPressMediaUploadStatus(articleId, "failed", result.error);
    await logEvent({
      type: "wordpress_media_upload_preparation_failed",
      status: "failed",
      message: `WordPress 이미지 업로드 dry-run 확인 실패: ${result.error}`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
      details: { error: result.error },
    });
    return { success: false, message: result.error ?? "업로드 확인에 실패했습니다." };
  }

  // status === "uploaded" (실제 업로드 구현 후에만 도달 가능)
  await updateWordPressMediaUploadStatus(articleId, "uploaded");
  return { success: true, message: "업로드가 완료되었습니다." };
}
