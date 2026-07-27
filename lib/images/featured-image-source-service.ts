// Featured Image Workflow: Step 1 (Source Setup).
// 대표 이미지 처리를 Source Setup(이 파일) → WordPress Media Upload
// (wordpress-media-upload-service.ts) → Featured Media Attach
// (wordpress-featured-media-service.ts) 3단계로 명확히 분리한다. AI 이미지
// 생성 actual integration은 이 단계에서도 구현하지 않는다. image binary는
// DB나 로그에 저장하지 않으며(경로/URL 문자열만 저장), 공개(publish)는
// 어떤 경우에도 수행하지 않는다.

import { getArticleById, saveFeaturedImageSourceResult } from "@/lib/repositories/article-repository";
import { savePublishLog } from "@/lib/repositories/publish-repository";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import {
  isRealHttpUrl,
  isAllowedMimeType,
  inferMimeTypeFromFilename,
  getDefaultImageFilename,
  ALLOWED_MIME_TYPES,
} from "@/lib/publish/wordpress-media-config";
import { saveLocalUploadFile } from "@/lib/images/featured-image-local-storage";
import type { Article } from "@/lib/types/domain";

export const FEATURED_IMAGE_SOURCE_TARGET = "featured_image_manual_source";

export interface FeaturedImageSourceResult {
  success: boolean;
  message: string;
}

async function logSourceEvent(
  type: LogEventType,
  status: LogStatus,
  message: string,
  articleId: string,
  article: Article | null,
  details?: Record<string, unknown>
): Promise<void> {
  await logEvent({
    type,
    status,
    message,
    articleId,
    themeId: article?.themeId,
    targetType: "article",
    targetId: articleId,
    ...(details ? { details } : {}),
  });
}

function mimeTypeToExtension(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return "webp";
}

async function reportInvalidSource(
  articleId: string,
  article: Article,
  sourceType: "external_url" | "local_upload" | "wordpress_media_existing",
  message: string
): Promise<FeaturedImageSourceResult> {
  await saveFeaturedImageSourceResult(articleId, { sourceStatus: "invalid", sourceError: message });
  await logSourceEvent("featured_image_source_failed", "failed", message, articleId, article, { sourceType });
  return { success: false, message };
}

export interface SaveExternalImageUrlInput {
  url: string;
  filename?: string;
  mimeType?: string;
}

/**
 * 인터넷 이미지 URL을 대표 이미지 source로 저장한다 (Step 1: Source Setup).
 * http/https로 시작하지 않는 URL(`/mock/...` 같은 상대경로 포함)은 거부하고
 * featured_image_source_status='invalid'로 기록한다.
 */
export async function saveExternalImageUrl(
  articleId: string,
  input: SaveExternalImageUrlInput
): Promise<FeaturedImageSourceResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  try {
    const url = input.url.trim();

    if (url.length === 0 || !isRealHttpUrl(url)) {
      return reportInvalidSource(
        articleId,
        article,
        "external_url",
        "이미지 URL은 http:// 또는 https://로 시작해야 합니다. 상대경로(/mock/... 등)는 사용할 수 없습니다."
      );
    }

    let mimeType = input.mimeType?.trim();
    if (mimeType) {
      if (!isAllowedMimeType(mimeType)) {
        return reportInvalidSource(
          articleId,
          article,
          "external_url",
          `허용되지 않는 이미지 형식입니다 (허용: ${ALLOWED_MIME_TYPES.join(", ")}). 입력값: ${mimeType}`
        );
      }
    } else {
      mimeType = inferMimeTypeFromFilename(input.filename || url);
    }

    const filename = input.filename?.trim() || getDefaultImageFilename(article, mimeTypeToExtension(mimeType));

    await saveFeaturedImageSourceResult(articleId, {
      sourceType: "external_url",
      sourceStatus: "prepared",
      sourceUrl: url,
      localPath: null,
      filename,
      mimeType,
      uploadStatus: "prepared",
      sourceError: null,
      uploadError: null,
    });

    const details = {
      sourceType: "external_url",
      sourceStatus: "prepared",
      filename,
      mimeType,
      hasUrl: true,
      hasLocalPath: false,
      hasWordPressMediaId: false,
    };

    await logSourceEvent(
      "featured_image_source_saved",
      "success",
      `기사(${articleId})의 대표 이미지 source(외부 URL)를 저장했습니다.`,
      articleId,
      article,
      details
    );
    await logSourceEvent(
      "featured_image_external_url_saved",
      "success",
      `기사(${articleId})에 외부 이미지 URL을 대표 이미지 source로 저장했습니다.`,
      articleId,
      article,
      details
    );

    await savePublishLog({ articleId, target: FEATURED_IMAGE_SOURCE_TARGET, status: "success", details });

    return { success: true, message: "이미지 URL을 대표 이미지 source로 저장했습니다." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    try {
      await saveFeaturedImageSourceResult(articleId, { sourceStatus: "failed", sourceError: message });
    } catch {
      // 결과 저장 실패는 무시하고 원래 오류를 그대로 알린다.
    }
    await logSourceEvent("featured_image_source_failed", "failed", message, articleId, article, {
      sourceType: "external_url",
    });
    return { success: false, message };
  }
}

export interface SaveExistingWordPressMediaInput {
  mediaId: number;
  mediaUrl?: string;
}

/**
 * 이미 WordPress Media Library에 있는 media id를 대표 이미지로 직접
 * 지정한다 (Step 1: Source Setup). 이 경우 WordPress media upload를 다시
 * 수행하지 않고 곧바로 uploaded 상태로 간주하며, Step 3(Featured Media
 * Attach)로 바로 넘어갈 수 있다.
 */
export async function saveExistingWordPressMedia(
  articleId: string,
  input: SaveExistingWordPressMediaInput
): Promise<FeaturedImageSourceResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  try {
    if (!Number.isFinite(input.mediaId) || input.mediaId <= 0) {
      return reportInvalidSource(
        articleId,
        article,
        "wordpress_media_existing",
        "WordPress media id를 올바른 양의 정수로 입력해야 합니다."
      );
    }

    await saveFeaturedImageSourceResult(articleId, {
      sourceType: "wordpress_media_existing",
      sourceStatus: "prepared",
      uploadStatus: "uploaded",
      wordpressMediaId: input.mediaId,
      wordpressUrl: input.mediaUrl?.trim() || null,
      sourceError: null,
      uploadError: null,
    });

    const details = {
      sourceType: "wordpress_media_existing",
      sourceStatus: "prepared",
      filename: article.featuredImageFilename,
      mimeType: article.featuredImageMimeType,
      hasUrl: Boolean(input.mediaUrl?.trim()),
      hasLocalPath: false,
      hasWordPressMediaId: true,
    };

    await logSourceEvent(
      "featured_image_source_saved",
      "success",
      `기사(${articleId})의 대표 이미지 source(기존 WordPress media)를 저장했습니다.`,
      articleId,
      article,
      details
    );
    await logSourceEvent(
      "featured_image_existing_wordpress_media_saved",
      "success",
      `기사(${articleId})에 기존 WordPress media(id: ${input.mediaId})를 대표 이미지로 지정했습니다.`,
      articleId,
      article,
      details
    );

    await savePublishLog({
      articleId,
      target: FEATURED_IMAGE_SOURCE_TARGET,
      status: "success",
      externalPostId: String(input.mediaId),
      postUrl: input.mediaUrl?.trim() || undefined,
      details,
    });

    return { success: true, message: "기존 WordPress media를 대표 이미지로 지정했습니다." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    try {
      await saveFeaturedImageSourceResult(articleId, { sourceStatus: "failed", sourceError: message });
    } catch {
      // 결과 저장 실패는 무시하고 원래 오류를 그대로 알린다.
    }
    await logSourceEvent("featured_image_source_failed", "failed", message, articleId, article, {
      sourceType: "wordpress_media_existing",
    });
    return { success: false, message };
  }
}

/**
 * 로컬 컴퓨터에서 업로드한 이미지 파일을 서버에 저장하고 대표 이미지
 * source로 등록한다 (Step 1: Source Setup). jpg/jpeg/png/webp만 허용하며
 * 최대 크기(기본 5MB)를 초과하면 거부한다. image binary는 DB나 로그에
 * 저장하지 않는다(디스크 경로 문자열만 저장한다).
 */
export async function saveLocalImageUpload(articleId: string, file: File): Promise<FeaturedImageSourceResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  try {
    const saved = await saveLocalUploadFile(articleId, file);
    if (!saved.success || !saved.localPath || !saved.filename || !saved.mimeType) {
      return reportInvalidSource(
        articleId,
        article,
        "local_upload",
        saved.error ?? "이미지 파일 저장에 실패했습니다."
      );
    }

    await saveFeaturedImageSourceResult(articleId, {
      sourceType: "local_upload",
      sourceStatus: "prepared",
      localPath: saved.localPath,
      sourceUrl: null,
      filename: saved.filename,
      mimeType: saved.mimeType,
      uploadStatus: "prepared",
      sourceError: null,
      uploadError: null,
    });

    const details = {
      sourceType: "local_upload",
      sourceStatus: "prepared",
      filename: saved.filename,
      mimeType: saved.mimeType,
      hasUrl: false,
      hasLocalPath: true,
      hasWordPressMediaId: false,
    };

    await logSourceEvent(
      "featured_image_source_saved",
      "success",
      `기사(${articleId})의 대표 이미지 source(로컬 업로드)를 저장했습니다.`,
      articleId,
      article,
      details
    );
    await logSourceEvent(
      "featured_image_local_upload_saved",
      "success",
      `기사(${articleId})에 로컬 업로드 파일을 대표 이미지 source로 저장했습니다.`,
      articleId,
      article,
      details
    );

    await savePublishLog({ articleId, target: FEATURED_IMAGE_SOURCE_TARGET, status: "success", details });

    return { success: true, message: "업로드한 파일을 대표 이미지 source로 저장했습니다." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    try {
      await saveFeaturedImageSourceResult(articleId, { sourceStatus: "failed", sourceError: message });
    } catch {
      // 결과 저장 실패는 무시하고 원래 오류를 그대로 알린다.
    }
    await logSourceEvent("featured_image_source_failed", "failed", message, articleId, article, {
      sourceType: "local_upload",
    });
    return { success: false, message };
  }
}
