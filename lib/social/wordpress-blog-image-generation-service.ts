// wordpress_blog 글 카드의 "AI 대표 이미지 생성" 섹션이 사용하는 서비스.
// article의 실제 이미지 생성 파이프라인(Phase 2-7,
// lib/images/image-generation-service.ts)이 사용하는 것과 같은 provider
// client(lib/images/providers, IMAGE_GENERATION_ENABLED 등 config)를
// 그대로 재사용한다 — 새로운 실제 API 호출 코드를 추가하지 않는다.
//
// article과 다른 점: article 쪽은 article.featuredImagePrompt 등
// article 컬럼을 읽고 결과도 article 컬럼(saveGeneratedImageResult)에
// 저장한다. 이 서비스는 그 함수를 호출하지 않고 article 컬럼도 전혀
// 건드리지 않는다 — prompt/결과 모두 social_posts.platformMetadata.
// imageGeneration에만 저장한다. article.articleMode(글의 톤/구조
// 참고용)만 "출처 참조"로 읽고, article.title/content/featuredImage*는
// 전혀 읽지 않는다.

import { getArticleById } from "@/lib/repositories/article-repository";
import { getSocialPostById, updateSocialPostContent } from "@/lib/repositories/social-posts-repository";
import {
  getImageGenerationProvider,
  isImageGenerationEnabled,
  getDefaultImageModel,
  getDefaultDimensions,
} from "@/lib/images/image-generation-config";
import { getImageProviderClient } from "@/lib/images/providers";
import type { ImageGenerationRequest } from "@/lib/images/image-generation-types";
import { logEvent } from "@/lib/harness/logger";

const NEGATIVE_PROMPT = [
  "text overlay",
  "watermark",
  "logo",
  "distorted hands",
  "extra fingers",
  "blurry face",
  "unreadable text",
].join(", ");

const DEFAULT_ASPECT_RATIO = "16:9";

export interface WordPressBlogImageGenerationState {
  status: "not_generated" | "prepared" | "generating" | "generated" | "failed";
  prompt: string | null;
  altText: string | null;
  caption: string | null;
  imageUrl: string | null;
  provider: string | null;
  error: string | null;
  generatedAt: string | null;
}

export const DEFAULT_WORDPRESS_BLOG_IMAGE_GENERATION_STATE: WordPressBlogImageGenerationState = {
  status: "not_generated",
  prompt: null,
  altText: null,
  caption: null,
  imageUrl: null,
  provider: null,
  error: null,
  generatedAt: null,
};

export function readWordPressBlogImageGenerationState(
  platformMetadata: Record<string, unknown>
): WordPressBlogImageGenerationState {
  const raw = platformMetadata.imageGeneration;
  if (typeof raw !== "object" || raw === null) {
    return DEFAULT_WORDPRESS_BLOG_IMAGE_GENERATION_STATE;
  }
  const record = raw as Record<string, unknown>;
  const status = record.status;
  return {
    status:
      status === "prepared" || status === "generating" || status === "generated" || status === "failed"
        ? status
        : "not_generated",
    prompt: typeof record.prompt === "string" ? record.prompt : null,
    altText: typeof record.altText === "string" ? record.altText : null,
    caption: typeof record.caption === "string" ? record.caption : null,
    imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : null,
    provider: typeof record.provider === "string" ? record.provider : null,
    error: typeof record.error === "string" ? record.error : null,
    generatedAt: typeof record.generatedAt === "string" ? record.generatedAt : null,
  };
}

export interface GenerateWordPressBlogFeaturedImagePromptResult {
  success: boolean;
  message: string;
}

/**
 * wordpress_blog 글 자신의 title/targetKeyword/answerSummary로부터
 * 결정론적으로(새 AI 호출 없이) 이미지 prompt/alt text/caption을
 * 만든다. article.featuredImagePrompt는 읽지 않는다.
 */
export async function generateWordPressBlogFeaturedImagePrompt(
  articleId: string,
  socialPostId: string
): Promise<GenerateWordPressBlogFeaturedImagePromptResult> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return { success: false, message: `블로그 글을 찾을 수 없습니다: ${socialPostId}` };
  }
  if (post.platform !== "wordpress_blog") {
    return { success: false, message: `이 기능은 wordpress_blog 글에서만 사용할 수 있습니다 (현재 platform: ${post.platform}).` };
  }

  const title = post.postTitle?.trim() ?? "";
  if (!title) {
    return { success: false, message: "post_title이 비어 있어 이미지 prompt를 만들 수 없습니다." };
  }

  const platformMetadata = post.platformMetadata ?? {};
  const targetKeyword = typeof platformMetadata.targetKeyword === "string" ? platformMetadata.targetKeyword : null;
  const answerSummary = typeof platformMetadata.answerSummary === "string" ? platformMetadata.answerSummary : null;

  const subject = targetKeyword ? `${title} (${targetKeyword})` : title;
  const prompt = `블로그 대표 이미지: "${subject}"를 주제로 한 사진 스타일의 편집용 이미지. ${
    answerSummary ? `핵심 내용: ${answerSummary}. ` : ""
  }텍스트나 로고는 넣지 않는다.`;
  const altText = targetKeyword ? `${targetKeyword} 관련 대표 이미지` : `${title} 대표 이미지`;
  const caption = title;

  const existingMetadata = post.platformMetadata ?? {};
  const existingState = readWordPressBlogImageGenerationState(existingMetadata);
  await updateSocialPostContent(socialPostId, {
    platformMetadata: {
      ...existingMetadata,
      imageGeneration: {
        ...existingState,
        status: "prepared",
        prompt,
        altText,
        caption,
      },
    },
  });

  return { success: true, message: "이미지 prompt를 생성했습니다." };
}

export interface GenerateWordPressBlogFeaturedImageResult {
  success: boolean;
  message: string;
  imageUrl?: string;
}

/**
 * 준비된 prompt로 실제(또는 mock) 이미지를 생성한다.
 * IMAGE_GENERATION_ENABLED=false이면 실제 API를 호출하지 않고 mock/dry-run으로
 * 처리한다(기존 provider client의 안전한 기본 동작 그대로). 결과는 article
 * 컬럼이 아니라 social_posts.platformMetadata.imageGeneration에만 저장한다.
 */
export async function generateWordPressBlogFeaturedImage(
  articleId: string,
  socialPostId: string
): Promise<GenerateWordPressBlogFeaturedImageResult> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return { success: false, message: `블로그 글을 찾을 수 없습니다: ${socialPostId}` };
  }
  if (post.platform !== "wordpress_blog") {
    return { success: false, message: `이 기능은 wordpress_blog 글에서만 사용할 수 있습니다 (현재 platform: ${post.platform}).` };
  }

  const platformMetadata = post.platformMetadata ?? {};
  const state = readWordPressBlogImageGenerationState(platformMetadata);
  if (!state.prompt) {
    return { success: false, message: "먼저 '이미지 prompt 생성'을 실행하세요." };
  }

  // article.articleMode는 문체/구조 참고용으로만 읽는다(article title/content/featuredImage*는 읽지 않음).
  const article = await getArticleById(articleId);
  const provider = getImageGenerationProvider();
  const { width, height } = getDefaultDimensions(DEFAULT_ASPECT_RATIO);

  const request: ImageGenerationRequest = {
    articleId,
    provider,
    model: getDefaultImageModel(),
    prompt: state.prompt,
    negativePrompt: NEGATIVE_PROMPT,
    aspectRatio: DEFAULT_ASPECT_RATIO,
    width,
    height,
    altText: state.altText ?? undefined,
    caption: state.caption ?? undefined,
    articleMode: article?.articleMode ?? "source_based_explainer",
    targetKeyword: typeof platformMetadata.targetKeyword === "string" ? platformMetadata.targetKeyword : undefined,
    dryRun: !isImageGenerationEnabled(),
  };

  await logEvent({
    type: "wordpress_blog_featured_image_generation_started",
    status: "info",
    message: `wordpress_blog 글(${socialPostId})의 AI 대표 이미지 생성을 시작합니다.`,
    details: { socialPostId, provider, dryRun: request.dryRun },
    articleId,
    themeId: article?.themeId,
    targetType: "article",
    targetId: articleId,
  });

  const client = getImageProviderClient(provider);
  const result = await client.generateImage(request);

  const existingMetadata = post.platformMetadata ?? {};
  const nextState: WordPressBlogImageGenerationState = {
    ...state,
    status: result.status === "generated" ? "generated" : result.status === "failed" ? "failed" : "generating",
    imageUrl: result.imageUrl ?? null,
    provider: result.provider,
    error: result.error ?? null,
    generatedAt: new Date().toISOString(),
  };
  await updateSocialPostContent(socialPostId, {
    platformMetadata: { ...existingMetadata, imageGeneration: nextState },
  });

  await logEvent({
    type: "wordpress_blog_featured_image_generation_completed",
    status: result.status === "failed" ? "failed" : "success",
    message: `wordpress_blog 글(${socialPostId})의 AI 대표 이미지 생성이 완료되었습니다 (status: ${result.status}).`,
    // 이미지 binary/전체 provider 응답은 로그에 남기지 않는다 — 상태와 존재 여부만.
    details: { socialPostId, provider: result.provider, status: result.status, hasImageUrl: Boolean(result.imageUrl) },
    articleId,
    themeId: article?.themeId,
    targetType: "article",
    targetId: articleId,
  });

  if (result.status === "failed") {
    return { success: false, message: result.error ?? "이미지 생성에 실패했습니다." };
  }

  return {
    success: true,
    message: request.dryRun
      ? "IMAGE_GENERATION_ENABLED=false이어서 실제 이미지 생성 없이 mock 처리되었습니다."
      : "AI 대표 이미지를 생성했습니다.",
    imageUrl: result.imageUrl,
  };
}
