// Phase 2-7: Image Generation Integration 서비스.
// Phase 2-5에서 준비한 featured image prompt/alt text/caption/style/aspect
// ratio를 바탕으로 실제 또는 mock 이미지 생성 결과를 저장한다. provider가
// 예외를 던지거나 실패해도 시스템 전체가 Runtime Error로 터지지 않도록
// 항상 방어적으로 처리한다.

import {
  getArticleById,
  markGeneratedImageGenerating,
  saveGeneratedImageResult,
  markGeneratedImageReviewed as markReviewedInRepository,
} from "@/lib/repositories/article-repository";
import { logEvent } from "@/lib/harness/logger";
import {
  getImageGenerationProvider,
  isImageGenerationEnabled,
  getDefaultImageModel,
  getDefaultDimensions,
} from "./image-generation-config";
import { getImageProviderClient } from "./providers";
import type { Article, ArticleMode } from "@/lib/types/domain";
import type { ImageGenerationRequest, ImageGenerationResult } from "./image-generation-types";

export interface GenerateFeaturedImageResult {
  success: boolean;
  message: string;
  result?: ImageGenerationResult;
}

/**
 * 모든 article_mode에 공통으로 적용하는 negative prompt.
 * 텍스트/워터마크/로고 삽입과 손가락 등 흔한 AI 이미지 결함을 방지한다.
 */
const NEGATIVE_PROMPT_BASE = [
  "text overlay",
  "watermark",
  "logo",
  "distorted hands",
  "extra fingers",
  "blurry face",
  "unreadable text",
].join(", ");

function buildNegativePrompt(mode: ArticleMode): string {
  // 현재는 모드와 무관하게 공통 목록만 사용한다 (article-modes/featured-image-config의
  // avoid list와 함께 이미지 안전 정책의 두 번째 계층 역할을 한다).
  void mode;
  return NEGATIVE_PROMPT_BASE;
}

function buildRequest(article: Article): ImageGenerationRequest {
  const provider = getImageGenerationProvider();
  const { width, height } = getDefaultDimensions(article.featuredImageAspectRatio);

  return {
    articleId: article.id,
    provider,
    model: getDefaultImageModel(),
    prompt: article.featuredImagePrompt || article.title,
    negativePrompt: buildNegativePrompt(article.articleMode),
    aspectRatio: article.featuredImageAspectRatio,
    width,
    height,
    style: article.featuredImageStyle ?? undefined,
    altText: article.featuredImageAltText ?? undefined,
    caption: article.featuredImageCaption ?? undefined,
    articleMode: article.articleMode,
    targetKeyword: article.targetKeyword ?? undefined,
    dryRun: !isImageGenerationEnabled(),
  };
}

/**
 * featured image metadata(Phase 2-5)를 바탕으로 이미지를 생성한다 (mock 또는
 * 실제 provider). 실제 WordPress media upload는 하지 않는다 — 생성 결과 저장
 * 까지만 수행한다.
 */
export async function generateFeaturedImage(articleId: string): Promise<GenerateFeaturedImageResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  if (!article.featuredImagePrompt) {
    return { success: false, message: "먼저 대표 이미지 정보를 준비하세요 (Featured Image Preparation)." };
  }

  const request = buildRequest(article);

  await logEvent({
    type: "image_generation_started",
    status: "info",
    message: `기사(${articleId}) 이미지 생성을 시작합니다 (provider=${request.provider}).`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
    details: { provider: request.provider, dryRun: request.dryRun },
  });

  try {
    await markGeneratedImageGenerating({
      articleId,
      provider: request.provider,
      model: request.model ?? null,
      prompt: request.prompt,
      negativePrompt: request.negativePrompt ?? null,
    });

    const client = getImageProviderClient(request.provider);
    const result = await client.generateImage(request);

    if (result.status === "failed") {
      await saveGeneratedImageResult({
        articleId,
        status: "failed",
        provider: result.provider,
        model: result.model ?? null,
        metadata: result.metadata,
        error: result.error ?? "알 수 없는 오류가 발생했습니다.",
      });

      await logEvent({
        type: "image_generation_failed",
        status: "failed",
        message: `이미지 생성 실패: ${result.error ?? "알 수 없는 오류"}`,
        articleId,
        themeId: article.themeId,
        targetType: "article",
        targetId: articleId,
        details: { provider: result.provider, error: result.error },
      });

      return { success: false, message: result.error ?? "이미지 생성에 실패했습니다.", result };
    }

    await saveGeneratedImageResult({
      articleId,
      status: "generated",
      provider: result.provider,
      model: result.model ?? null,
      imageUrl: result.imageUrl ?? null,
      localPath: result.localPath ?? null,
      width: result.width ?? null,
      height: result.height ?? null,
      format: result.format ?? null,
      metadata: result.metadata,
    });

    // provider가 mock이 아닌데 실제로는 disabled fallback(mock 대체)으로 처리된 경우
    // "완료"가 아니라 "비활성화로 건너뜀"으로 명확히 구분해 기록한다.
    const wasDisabledFallback = request.provider !== "mock" && result.metadata?.disabled === true;

    await logEvent({
      type: wasDisabledFallback ? "image_generation_skipped_disabled" : "image_generation_completed",
      status: "success",
      message: wasDisabledFallback
        ? `IMAGE_GENERATION_ENABLED=false이므로 기사(${articleId})는 mock으로 대체 처리되었습니다 (provider=${request.provider}).`
        : `기사(${articleId}) 이미지 생성을 완료했습니다 (provider=${result.provider}).`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
      details: {
        provider: result.provider,
        imageUrl: result.imageUrl ?? null,
        width: result.width ?? null,
        height: result.height ?? null,
      },
    });

    return { success: true, message: "이미지 생성을 완료했습니다.", result };
  } catch (error) {
    // provider abstraction이 이미 내부적으로 예외를 잡지만, 예상치 못한 실패에도
    // 시스템 전체가 Runtime Error로 터지지 않도록 한 번 더 방어한다.
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

    try {
      await saveGeneratedImageResult({
        articleId,
        status: "failed",
        provider: request.provider,
        metadata: {},
        error: message,
      });
    } catch {
      // 저장 실패는 무시하고 원래 오류를 그대로 알린다.
    }

    await logEvent({
      type: "image_generation_failed",
      status: "failed",
      message: `이미지 생성 중 예외가 발생했습니다: ${message}`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
      details: { error: message },
    });

    return { success: false, message };
  }
}

/** 생성된 이미지를 사람이 검토 완료했음을 표시한다. */
export async function reviewGeneratedImage(articleId: string): Promise<GenerateFeaturedImageResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  await markReviewedInRepository(articleId);

  await logEvent({
    type: "generated_image_reviewed",
    status: "success",
    message: `기사(${articleId})의 생성된 이미지 검토를 완료했습니다.`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });

  return { success: true, message: "생성된 이미지 검토를 완료했습니다." };
}
