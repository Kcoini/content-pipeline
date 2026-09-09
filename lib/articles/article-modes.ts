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

// ---------------------------------------------------------------------------
// Phase 4-1: "마스터 원고 중심" 구조 전환 — 1차(용어 정리 + 고급 옵션화).
//
// 사용자에게 처음부터 3종류(general_news/source_based_explainer/
// monetized_blog) 중 하나를 반드시 고르게 하지 않는다. 기본은 "자동
// 추천"이고, 기존 3종류는 "원고 생성 방향"이라는 고급 옵션으로 남겨둔다.
// DB의 article_mode 컬럼은 여전히 3개 값만 허용하므로(articles_article_mode_check
// constraint, db/migrations/011), "자동 추천"은 실제로 저장되는 값이
// 아니라 UI에서만 쓰는 sentinel("auto")이다 — 제출 시
// resolveMasterManuscriptDirection()이 실제 ArticleMode로 바꿔서
// generateArticleDraft에 넘긴다. ArticleMode enum 자체나 기존 3종류는
// 삭제하지 않는다.
// ---------------------------------------------------------------------------

/** UI에서만 쓰는 "자동 추천" sentinel 값. DB에는 절대 저장되지 않는다. */
export const AUTO_MASTER_MANUSCRIPT_DIRECTION = "auto" as const;

export type MasterManuscriptDirectionInput = ArticleMode | typeof AUTO_MASTER_MANUSCRIPT_DIRECTION;

/**
 * 사용자에게 보여줄 "원고 생성 방향" 라벨. 기존 ArticleModeConfig.label
 * ("일반 기사형" 등, eval/prompt 파일명과 짝지어진 내부 표기)은 그대로
 * 두고, 이 맵만 새 사용자 표현으로 분리했다 — 내부 값은 바꾸지 않는다.
 */
export const MASTER_MANUSCRIPT_DIRECTION_LABELS: Record<MasterManuscriptDirectionInput, string> = {
  auto: "자동 추천",
  general_news: "빠른 기사 중심",
  source_based_explainer: "해설 중심",
  monetized_blog: "SEO/수익화 중심",
};

export function getMasterManuscriptDirectionLabel(value: MasterManuscriptDirectionInput): string {
  return MASTER_MANUSCRIPT_DIRECTION_LABELS[value];
}

/** "원고 생성 방향" 선택 목록(고급 옵션 UI용) — 자동 추천 + 기존 3종류. */
export const MASTER_MANUSCRIPT_DIRECTION_LIST: MasterManuscriptDirectionInput[] = [
  AUTO_MASTER_MANUSCRIPT_DIRECTION,
  ...ARTICLE_MODE_LIST.map((m) => m.id),
];

/**
 * "자동 추천"(auto)을 실제 ArticleMode로 바꾼다. 그 외 값은 그대로
 * `resolveArticleMode`(알 수 없는 값이면 기본값)에 위임한다 — DB에
 * 넘기기 직전에 반드시 이 함수를 거쳐야 한다.
 */
export function resolveMasterManuscriptDirection(value: unknown): ArticleMode {
  if (value === AUTO_MASTER_MANUSCRIPT_DIRECTION) return DEFAULT_ARTICLE_MODE;
  return resolveArticleMode(value);
}
