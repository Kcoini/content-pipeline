// Phase 2-5: Featured Image 기본 설정.
// article_mode별 기본 스타일/톤, 그리고 "이미지 안에 글자를 넣지 않는다"는
// 정책의 기본값을 정의한다.

import type { ArticleMode } from "@/lib/types/domain";

export const DEFAULT_ASPECT_RATIO = "16:9";

/** article_mode별 기본 이미지 스타일. */
export const DEFAULT_STYLE_BY_MODE: Record<ArticleMode, string> = {
  general_news: "clean editorial news photo",
  source_based_explainer: "simple explanatory editorial illustration",
  monetized_blog: "clickable but trustworthy blog thumbnail",
};

/** article_mode별 의도한 감정/분위기. */
export const TARGET_EMOTION_BY_MODE: Record<ArticleMode, string> = {
  general_news: "calm and trustworthy",
  source_based_explainer: "clear and informative",
  monetized_blog: "curious but reassured",
};

/**
 * 이미지 안에 글자(특히 제목)를 넣는 것은 기본적으로 비추천한다.
 * AI 이미지 생성에서 글자가 깨지는 경우가 많고, 의미는 alt text/caption으로
 * 충분히 전달할 수 있기 때문이다.
 */
export const TEXT_IN_IMAGE_DEFAULT = false;

export const NO_TEXT_IN_IMAGE_INSTRUCTION = "no text in image";

/** 모든 article_mode에 공통으로 적용하는 금지 요소. */
export const COMMON_AVOID_LIST: readonly string[] = [
  "no real people's names or depictions",
  "no celebrity likeness",
  "no brand logos or trademarks",
  NO_TEXT_IN_IMAGE_INSTRUCTION,
];

/** article_mode별 추가 금지 요소. */
export const MODE_SPECIFIC_AVOID_LIST: Record<ArticleMode, readonly string[]> = {
  general_news: [
    "no fabricated depiction of a real news event",
    "no overly emotional or sensational imagery",
  ],
  source_based_explainer: ["no overly complex or cluttered photographic scenes"],
  monetized_blog: [
    "no sensational, shocking, or fear-inducing imagery",
    "no advertisement-style click-bait phrases",
  ],
};

export function resolveDefaultStyle(mode: ArticleMode): string {
  return DEFAULT_STYLE_BY_MODE[mode];
}

export function resolveAvoidList(mode: ArticleMode): string[] {
  return [...COMMON_AVOID_LIST, ...MODE_SPECIFIC_AVOID_LIST[mode]];
}
