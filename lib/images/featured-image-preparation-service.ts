// Phase 2-5: Featured Image Preparation 서비스.
// 실제 이미지 생성 API나 WordPress media upload는 호출하지 않는다.
// article_mode/제목/키워드/메타 설명 기반 규칙으로 prompt/alt text/caption/style을
// 생성해 저장한다 (이름 기반 규칙, AI 호출 없음).

import { getArticleById, saveFeaturedImageMetadata, markFeaturedImageReviewed as markReviewedInRepository } from "@/lib/repositories/article-repository";
import { getThemeById } from "@/lib/repositories/theme-repository";
import { logEvent } from "@/lib/harness/logger";
import {
  DEFAULT_ASPECT_RATIO,
  TARGET_EMOTION_BY_MODE,
  resolveAvoidList,
  resolveDefaultStyle,
} from "./featured-image-config";
import type { Article, ArticleMode, Theme } from "@/lib/types/domain";
import type { FeaturedImageMetadata } from "./featured-image-types";

export interface PrepareFeaturedImageResult {
  success: boolean;
  message: string;
  metadata?: FeaturedImageMetadata;
}

function resolveSubject(article: Article, theme: Theme | undefined): string {
  return article.targetKeyword || article.title || theme?.title || "이 주제";
}

const SCENE_TEMPLATE_BY_MODE: Record<ArticleMode, (subject: string) => string> = {
  general_news: (subject) =>
    `a symbolic editorial scene representing "${subject}", without depicting any specific real event or person`,
  source_based_explainer: (subject) =>
    `a simple explanatory illustration or infographic-style visualization of "${subject}", showing structure, flow, or comparison`,
  monetized_blog: (subject) =>
    `a relatable scene showing a person facing a real-life situation related to "${subject}", with helpful visual cues like a checklist or documents on a table`,
};

const ALT_TEXT_TEMPLATE_BY_MODE: Record<ArticleMode, (subject: string) => string> = {
  general_news: (subject) => `${subject} 관련 소식을 상징적으로 표현한 편집 이미지`,
  source_based_explainer: (subject) => `${subject}의 핵심 개념과 구조를 설명하는 일러스트`,
  monetized_blog: (subject) => `${subject} 선택 기준을 비교하는 모습과 체크리스트를 표현한 일러스트`,
};

const CAPTION_TEMPLATE_BY_MODE: Record<ArticleMode, (subject: string) => string> = {
  general_news: (subject) => `${subject}와 관련된 핵심 내용을 정리했습니다.`,
  source_based_explainer: (subject) => `${subject}의 핵심 개념과 흐름을 이해하는 데 도움이 되는 내용을 정리했습니다.`,
  monetized_blog: (subject) => `${subject}을(를) 선택하기 전 확인해야 할 핵심 기준을 정리했습니다.`,
};

const ALT_TEXT_MAX_LENGTH = 140;
const CAPTION_MAX_LENGTH = 200;

/** 문장 단위로 첫 문장을 추출한다 (한국어 종결어미/구두점 기준). */
function extractFirstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?=\s|$)|^.*?(?:다|요)(?=\s|$)/);
  return (match ? match[0] : text).trim();
}

function buildVisualConcept(mode: ArticleMode, subject: string): string {
  return SCENE_TEMPLATE_BY_MODE[mode](subject);
}

function buildPrompt(mode: ArticleMode, subject: string, style: string, aspectRatio: string): string {
  const scene = buildVisualConcept(mode, subject);
  const mood = TARGET_EMOTION_BY_MODE[mode];
  const avoid = resolveAvoidList(mode).join(", ");

  return [
    `A ${style} showing ${scene}.`,
    `Audience: general readers interested in ${subject}.`,
    `Mood: ${mood}.`,
    `Color/style: ${style}, warm and clean color palette.`,
    `Composition: ${aspectRatio} aspect ratio, balanced composition, clear focal point.`,
    `Avoid: ${avoid}.`,
  ].join(" ");
}

function buildAltText(mode: ArticleMode, subject: string): string {
  const text = ALT_TEXT_TEMPLATE_BY_MODE[mode](subject);
  return text.length > ALT_TEXT_MAX_LENGTH ? `${text.slice(0, ALT_TEXT_MAX_LENGTH)}…` : text;
}

function buildCaption(article: Article, mode: ArticleMode, subject: string): string {
  if (article.metaDescription) {
    const firstSentence = extractFirstSentence(article.metaDescription);
    if (firstSentence) {
      return firstSentence.length > CAPTION_MAX_LENGTH
        ? `${firstSentence.slice(0, CAPTION_MAX_LENGTH)}…`
        : firstSentence;
    }
  }
  return CAPTION_TEMPLATE_BY_MODE[mode](subject);
}

function buildFeaturedImageMetadata(article: Article, theme: Theme | undefined): FeaturedImageMetadata {
  const mode = article.articleMode;
  const subject = resolveSubject(article, theme);
  const style = resolveDefaultStyle(mode);
  const aspectRatio = DEFAULT_ASPECT_RATIO;

  return {
    prompt: buildPrompt(mode, subject, style, aspectRatio),
    altText: buildAltText(mode, subject),
    caption: buildCaption(article, mode, subject),
    style,
    aspectRatio,
    visualConcept: buildVisualConcept(mode, subject),
    targetEmotion: TARGET_EMOTION_BY_MODE[mode],
    safeTextPolicy: "이미지 안에 제목이나 문구를 넣지 않는다 (AI 생성 시 글자가 깨질 수 있으며, 의미는 alt text/caption으로 전달한다).",
    articleMode: mode,
    targetKeyword: article.targetKeyword ?? undefined,
    sourceBasis: article.targetKeyword
      ? "target_keyword 기반"
      : theme
        ? "article.title 및 theme 기반"
        : "article.title 기반",
  };
}

/**
 * article_mode/제목/키워드 기반 규칙으로 featured image 준비 정보(prompt/alt
 * text/caption/style/aspect ratio)를 생성하고 저장한다. 실제 이미지 생성
 * API나 WordPress media upload는 호출하지 않는다.
 */
export async function prepareFeaturedImage(articleId: string): Promise<PrepareFeaturedImageResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  await logEvent({
    type: "featured_image_preparation_started",
    status: "info",
    message: `기사(${articleId}) 대표 이미지 준비를 시작합니다.`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });

  try {
    const theme = await getThemeById(article.themeId);
    const metadata = buildFeaturedImageMetadata(article, theme);

    await saveFeaturedImageMetadata({ articleId, metadata, status: "prepared" });

    await logEvent({
      type: "featured_image_preparation_completed",
      status: "success",
      message: `기사(${articleId}) 대표 이미지 준비를 완료했습니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
      details: { style: metadata.style, aspectRatio: metadata.aspectRatio },
    });

    return { success: true, message: "대표 이미지 정보를 준비했습니다.", metadata };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

    try {
      await saveFeaturedImageMetadata({
        articleId,
        metadata: {
          prompt: "",
          altText: "",
          caption: "",
          style: "",
          aspectRatio: DEFAULT_ASPECT_RATIO,
          visualConcept: "",
          targetEmotion: "",
          safeTextPolicy: "",
          articleMode: article.articleMode,
          sourceBasis: "",
        },
        status: "failed",
        error: message,
      });
    } catch {
      // metadata 저장 실패는 무시하고 원래 오류를 그대로 알린다.
    }

    await logEvent({
      type: "featured_image_preparation_failed",
      status: "failed",
      message: `대표 이미지 준비 실패: ${message}`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
      details: { error: message },
    });

    return { success: false, message };
  }
}

/** 대표 이미지 준비 정보를 사람이 검토 완료했음을 표시한다. */
export async function reviewFeaturedImage(articleId: string): Promise<PrepareFeaturedImageResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  await markReviewedInRepository(articleId);

  await logEvent({
    type: "featured_image_reviewed",
    status: "success",
    message: `기사(${articleId})의 대표 이미지 준비 정보 검토를 완료했습니다.`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });

  return { success: true, message: "대표 이미지 검토를 완료했습니다." };
}
