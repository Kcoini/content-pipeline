// Phase 2-1: 수익형 콘텐츠 글쓰기 모드 3종.
// article_mode에 따라 prompt, eval 기준, 저장 필드가 달라진다.
// 기존 흐름(모드 미지정)은 source_based_explainer와 동일하게 동작해야 한다.

export type ArticleMode = "general_news" | "source_based_explainer" | "monetized_blog";

export type ArticleLength = "short_to_medium" | "medium" | "medium_to_long";

/** monetized_blog 본문에 삽입하는 광고 위치 marker. 실제 광고 코드는 절대 삽입하지 않는다. */
export const AD_SLOT_MARKERS = [
  "after_summary",
  "after_intro",
  "mid_content_1",
  "mid_content_2",
  "before_faq",
  "before_conclusion",
] as const;

export type AdSlotPosition = (typeof AD_SLOT_MARKERS)[number];

export function adSlotMarkerComment(position: AdSlotPosition): string {
  return `<!-- AD_SLOT: ${position} -->`;
}

export interface AdSlotEntry {
  position: string;
  marker: string;
}

export interface InternalLinkSuggestion {
  title: string;
  reason: string;
}

export interface ArticleModeConfig {
  id: ArticleMode;
  label: string;
  /** UI에 표시할 짧은 설명 */
  description: string;
  requiresSources: boolean;
  requiresSeoMetadata: boolean | "optional";
  requiresAdSlots: boolean;
  defaultLength: ArticleLength;
  /** lib/ai/eval-article.ts loadEvalConfig()에 넘길 파일명 */
  evalFileName: string;
  /** 문서화 목적의 prompt 참고 파일 (prompts/articles/ 기준 상대경로) */
  promptFileName: string;
}

export const DEFAULT_ARTICLE_MODE: ArticleMode = "source_based_explainer";

export const ARTICLE_MODE_CONFIGS: Record<ArticleMode, ArticleModeConfig> = {
  general_news: {
    id: "general_news",
    label: "일반 기사형",
    description: "빠른 이슈 전달용 기사 형식",
    requiresSources: true,
    requiresSeoMetadata: false,
    requiresAdSlots: false,
    defaultLength: "short_to_medium",
    evalFileName: "general-news.eval.yaml",
    promptFileName: "general-news.md",
  },
  source_based_explainer: {
    id: "source_based_explainer",
    label: "출처 기반 설명형",
    description: "자료와 출처를 바탕으로 정확하게 설명하는 형식",
    requiresSources: true,
    requiresSeoMetadata: "optional",
    requiresAdSlots: false,
    defaultLength: "medium",
    evalFileName: "article-quality.v1.eval.yaml",
    promptFileName: "source-based-explainer.md",
  },
  monetized_blog: {
    id: "monetized_blog",
    label: "수익형 블로그형",
    description: "SEO, 체류시간, 광고 슬롯, FAQ, 체크리스트를 고려한 블로그 형식",
    requiresSources: true,
    requiresSeoMetadata: true,
    requiresAdSlots: true,
    defaultLength: "medium_to_long",
    evalFileName: "monetized-blog.eval.yaml",
    promptFileName: "monetized-blog.md",
  },
};

export const ARTICLE_MODE_LIST: ArticleModeConfig[] = [
  ARTICLE_MODE_CONFIGS.general_news,
  ARTICLE_MODE_CONFIGS.source_based_explainer,
  ARTICLE_MODE_CONFIGS.monetized_blog,
];

export function isArticleMode(value: unknown): value is ArticleMode {
  return value === "general_news" || value === "source_based_explainer" || value === "monetized_blog";
}

/** 알 수 없거나 비어있는 값이면 기본값(source_based_explainer)으로 대체한다. */
export function resolveArticleMode(value: unknown): ArticleMode {
  return isArticleMode(value) ? value : DEFAULT_ARTICLE_MODE;
}

export function getArticleModeConfig(mode: ArticleMode): ArticleModeConfig {
  return ARTICLE_MODE_CONFIGS[mode];
}
