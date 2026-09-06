// wordpress_blog 글의 WordPress 게시용 metadata(article에는 없을 수 있는
// seoTitle/metaDescription/targetKeyword/answerSummary/eeatNotes/geoSummary/
// structuredDataSuggestions 등)를 결정론적으로 만든다.
//
// 왜 필요한가: article은 원본 콘텐츠일 뿐이다. source_based_explainer/
// general_news 모드로 생성된 article에는 애초에 seoTitle/metaDescription/
// targetKeyword가 없을 수 있고, answerSummary/eeatNotes/geoSummary/
// structuredDataSuggestions는 article_mode와 무관하게 애초에 article
// 테이블에 저장되지 않는다(monetized_blog 모드에서도 AI 생성 시점에만
// 존재했다가 article.content 안에 자연어로 녹아들 뿐, 별도 구조화
// 필드로 남지 않는다 — lib/ai/article-writer.ts의 GeneratedArticle 참고).
// 따라서 wordpress_blog 글 자신이 이 정보를 새로 만들어야 한다.
//
// 이 함수는 실제 AI를 다시 호출하지 않는다(새 외부 API 호출 추가 금지) —
// 이미 생성된 wordpress_blog title/body/excerpt에서 결정론적으로 도출한
// "최소한의 근거 있는 값"이다. 실제 키워드 리서치나 EEAT 분석을 대체하지
// 않으며, 사람이 검토/수정할 것을 전제로 한다(질문 응답/과장 방지를 위해
// 존재하지 않는 사실을 지어내지 않는다 — geoSummary.keyFacts/caveats는
// 항상 빈 배열로 시작한다).
//
// article에 이미 있는 값(seoTitle/metaDescription/targetKeyword/
// secondaryKeywords/searchIntent/readerPersona/adSlots/monetizationScore/
// policyRiskScore)은 "생성 시점"에는 참고용으로 재사용할 수 있다(주로
// monetized_blog 모드 article). 다만 이 재사용은 wordpress_blog 글이
// 아직 자기 자신의 metadata를 한 번도 가져본 적 없을 때만 유효하며,
// 이후 SEO metadata 업데이트 단계(wordpress-blog-seo-metadata-service.ts)
// 에서는 이 fallback을 다시 쓰지 않는다 — 그 단계는 wordpress_blog
// 자신의 metadata만 사용한다.

const SEO_TITLE_MAX_LENGTH = 60;
const META_DESCRIPTION_MAX_LENGTH = 160;
const MAX_SECONDARY_KEYWORDS = 5;
const DEFAULT_MONETIZATION_SCORE = 50;
const DEFAULT_POLICY_RISK_SCORE = 10;
const DEFAULT_SEARCH_INTENT = "informational";

export interface WordPressBlogGeneratedMetadata {
  seoTitle: string | null;
  metaDescription: string | null;
  targetKeyword: string | null;
  secondaryKeywords: string[];
  searchIntent: string | null;
  readerPersona: string | null;
  answerSummary: string | null;
  eeatNotes: Record<string, unknown> | null;
  geoSummary: Record<string, unknown> | null;
  structuredDataSuggestions: unknown[];
  adSlots: unknown[];
  monetizationScore: number | null;
  policyRiskScore: number | null;
}

export interface WordPressBlogMetadataGenerationInput {
  title: string;
  body: string;
  excerpt?: string | null;
  citedSourceCount?: number;
  /** article에 이미 있는 값(있으면 생성 시점에 참고용으로 재사용). */
  articleSeoTitle?: string | null;
  articleMetaDescription?: string | null;
  articleTargetKeyword?: string | null;
  articleSecondaryKeywords?: string[];
  articleSearchIntent?: string | null;
  articleReaderPersona?: string | null;
  articleAdSlots?: unknown[];
  articleMonetizationScore?: number | null;
  articlePolicyRiskScore?: number | null;
}

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function stripMarkup(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_>`|[\](){}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** title에서 가장 긴 토큰을 대표 키워드 후보로 삼는다(간단한 휴리스틱 — 실제 키워드 리서치가 아니다). */
function deriveTargetKeywordFromTitle(title: string): string | null {
  const cleaned = stripMarkup(title);
  if (!cleaned) return null;
  const tokens = cleaned.split(/\s+/).filter((token) => token.length >= 2);
  if (tokens.length === 0) return null;
  return tokens.reduce((longest, token) => (token.length > longest.length ? token : longest), tokens[0]);
}

/** 본문에서 자주 등장하는 토큰 상위 N개를 보조 키워드 후보로 삼는다(targetKeyword는 제외). */
function deriveSecondaryKeywordsFromBody(body: string, excludeKeyword: string | null): string[] {
  const tokens = stripMarkup(body)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && token !== excludeKeyword);

  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SECONDARY_KEYWORDS)
    .map(([token]) => token);
}

/**
 * wordpress_blog 글의 WordPress 게시용 metadata를 생성한다. article
 * 원문(title/content)은 이 함수의 입력값이 아니다 — wordpress_blog
 * 자신의 title/body/excerpt만 실제 콘텐츠 소스로 사용하며, article
 * 값은 "이미 있으면 참고"하는 선택적 힌트로만 쓰인다.
 */
export function generateWordPressBlogMetadata(
  input: WordPressBlogMetadataGenerationInput
): WordPressBlogGeneratedMetadata {
  const body = input.body ?? "";
  const plainExcerpt = input.excerpt?.trim() || stripMarkup(body).slice(0, META_DESCRIPTION_MAX_LENGTH);

  const seoTitle =
    input.articleSeoTitle?.trim() || (input.title.trim() ? truncate(input.title, SEO_TITLE_MAX_LENGTH) : null);
  const metaDescription =
    input.articleMetaDescription?.trim() || (plainExcerpt ? truncate(plainExcerpt, META_DESCRIPTION_MAX_LENGTH) : null);
  const targetKeyword = input.articleTargetKeyword?.trim() || deriveTargetKeywordFromTitle(input.title);
  const secondaryKeywords =
    input.articleSecondaryKeywords && input.articleSecondaryKeywords.length > 0
      ? input.articleSecondaryKeywords
      : deriveSecondaryKeywordsFromBody(body, targetKeyword);

  const answerSummary = plainExcerpt || null;
  const eeatNotes =
    input.citedSourceCount && input.citedSourceCount > 0
      ? { citedSourceCount: input.citedSourceCount }
      : null;

  return {
    seoTitle,
    metaDescription,
    targetKeyword,
    secondaryKeywords,
    searchIntent: input.articleSearchIntent?.trim() || DEFAULT_SEARCH_INTENT,
    readerPersona: input.articleReaderPersona?.trim() || null,
    answerSummary,
    eeatNotes,
    // 실제로 확인하지 않은 사실을 지어내지 않기 위해 항상 빈 값으로 시작한다 —
    // 사람이 검토 후 채워야 한다.
    geoSummary: { directAnswer: answerSummary ?? "", keyFacts: [], caveats: [] },
    structuredDataSuggestions: [],
    adSlots: input.articleAdSlots ?? [],
    monetizationScore: input.articleMonetizationScore ?? DEFAULT_MONETIZATION_SCORE,
    policyRiskScore: input.articlePolicyRiskScore ?? DEFAULT_POLICY_RISK_SCORE,
  };
}
