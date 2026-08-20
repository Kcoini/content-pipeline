// Phase 1-3: 기사 초안 생성기.
// mock 구현(generateMockArticleDraft)과 실제 AI 연동(generateAiArticleDraft)을 분리한다.
// Phase 1-10: article writer는 source summary(전문) 대신 key_points(불릿 사실)만
// 전달받아 synthesis 없이 paraphrase하는 경향을 차단한다.
// Phase 1-11: tool_use로 JSON 출력을 강제한다.
// Phase 2-1: article_mode(general_news / source_based_explainer / monetized_blog) 지원.
// mode 인자를 생략하면 기존과 동일하게 source_based_explainer로 동작해 기존 흐름을 깨지 않는다.
// source_based_explainer 개선: "출처 기반 해설 기사" 모드임을 프롬프트에 명확히 하고,
// thesis를 강한 주장이 아닌 중심 해석으로 재정의했다. sourceUsage 필드로 출처별 역할을
// 확인할 수 있게 했고, 사용 가능한 출처(key_points/summary가 있는 출처)가 3개 미만이면
// 실행 전에 InsufficientSourceMaterialError를 던져 mock 생성으로 안전하게 전환되게 했다.
// general_news/monetized_blog 모드와 두 모드의 프롬프트는 이 개선의 대상이 아니다.

import { getAnthropicClient, ANTHROPIC_MODEL } from "./anthropic-client";
import type { Source, Theme } from "@/lib/types/domain";
import type { SourceSummary } from "./source-summarizer";
import {
  AD_SLOT_MARKERS,
  DEFAULT_ARTICLE_MODE,
  adSlotMarkerComment,
  type AdSlotEntry,
  type AdSlotPosition,
  type ArticleMode,
  type InternalLinkSuggestion,
} from "@/lib/articles/article-modes";

/** source_based_explainer의 sourceUsage에서 각 출처가 맡을 수 있는 역할. */
export type SourceUsageRole = "background" | "data" | "contrast" | "analysis" | "implication" | "watch_point";

/** citedSourceIds 중 하나의 출처가 본문에서 어떤 역할로 쓰였는지 나타낸다. */
export interface SourceUsageEntry {
  sourceId: string;
  usedFor: SourceUsageRole[];
}

/**
 * monetized_blog의 E-E-A-T(Experience/Expertise/Authoritativeness/
 * Trustworthiness) 자가 점검 메모. 존재하지 않는 경험/자격/조사 결과를
 * 지어내지 않고, 실제로 확인 가능한 근거가 있을 때만 채워야 한다.
 * 값이 없으면 undefined로 두며(빈 문자열로 지어내지 않음), DB에는
 * 저장하지 않는다.
 */
export interface EeatNotes {
  experience?: string;
  expertise?: string;
  authoritativeness?: string;
  trustworthiness?: string;
}

/** monetized_blog AEO(Answer Engine Optimization) 보조 필드: 독자 질문-짧은 답변 쌍. */
export interface ReaderQuestionEntry {
  question: string;
  shortAnswer: string;
}

/**
 * monetized_blog GEO(생성형 AI 검색 이해성) 보조 요약. 검색/AI 노출을
 * 보장하는 표현을 담지 않으며, keyFacts는 출처 기반 사실만 담는다.
 */
export interface GeoSummary {
  directAnswer: string;
  keyFacts: string[];
  caveats: string[];
}

/** monetized_blog용 구조화 데이터(schema.org) 제안 — 실제 JSON-LD는 생성하지 않는다. */
export type StructuredDataSuggestionType = "Article" | "BlogPosting" | "FAQPage" | "HowTo";

export interface StructuredDataSuggestionEntry {
  type: StructuredDataSuggestionType;
  reason: string;
}

/** monetized_blog 후처리 중 발견된, 차단까지는 아니지만 검토가 필요한 품질 신호. */
export interface MonetizedBlogQualityWarning {
  code: string;
  message: string;
}

export interface GeneratedArticle {
  title: string;
  content: string;
  citedSourceIds: string[];
  /**
   * source_based_explainer 전용 부가 필드. citedSourceIds에 포함된 출처가
   * 본문에서 어떤 역할(background/data/contrast/analysis/implication/
   * watch_point)로 쓰였는지 표시한다. 다른 모드는 undefined다. 품질검사/
   * eval에서 출처 활용 방식을 확인하는 용도이며, 현재는 DB에 저장하지
   * 않는다(저장 구조 변경 없이 결과 객체에만 포함).
   */
  sourceUsage?: SourceUsageEntry[];
  /** monetized_blog 전용 부가 필드 (해당 없는 모드는 undefined) */
  seoTitle?: string;
  metaDescription?: string;
  targetKeyword?: string;
  secondaryKeywords?: string[];
  searchIntent?: string;
  readerPersona?: string;
  adSlots?: AdSlotEntry[];
  internalLinkSuggestions?: InternalLinkSuggestion[];
  monetizationScore?: number;
  policyRiskScore?: number;
  /** monetized_blog AEO 전용: 독자의 핵심 질문에 대한 2~4문장 직접 답변. content 상단에도 반영된다. */
  answerSummary?: string;
  /** monetized_blog E-E-A-T 전용: DB에는 저장하지 않는다(결과 객체에만 포함). */
  eeatNotes?: EeatNotes;
  /** monetized_blog AEO 전용(선택): DB에는 저장하지 않는다. */
  readerQuestions?: ReaderQuestionEntry[];
  /** monetized_blog GEO 전용: DB에는 저장하지 않는다. */
  geoSummary?: GeoSummary;
  /** monetized_blog 전용(선택): 실제 schema markup이 아닌 후보 제안일 뿐이다. DB에는 저장하지 않는다. */
  structuredDataSuggestions?: StructuredDataSuggestionEntry[];
  /** monetized_blog 전용(선택): 후처리 중 발견된 검토 필요 신호(차단하지 않음). DB에는 저장하지 않는다. */
  qualityWarnings?: MonetizedBlogQualityWarning[];
}

/**
 * AD_SLOT marker 하나를 본문의 "의미 있는" 위치에 배치하기 위한 anchor 설정.
 * heading을 못 찾으면 fallbackRatio(본문 내 대략적인 위치 비율)로 대체한다.
 * monetized_blog는 heading을 자연스럽게 쓰도록 유도하므로(고정 제목 강제 X),
 * 정확한 "## 비교표" 문자열이 아니라 느슨한 키워드 패턴으로 anchor를 찾는다.
 */
interface AdSlotAnchor {
  /** anchor heading을 찾기 위한 느슨한 키워드 패턴 (heading 줄 전체에 대해 테스트). */
  headingPattern: RegExp;
  /** true면 anchor heading 바로 앞에, false면 그 섹션이 끝나는 지점(다음 heading 직전)에 삽입. */
  insertBefore: boolean;
  /** anchor를 못 찾았을 때 사용할 본문 내 대략적인 위치(0~1, 줄 번호 기준 비율). */
  fallbackRatio: number;
}

const AD_SLOT_ANCHORS: Record<AdSlotPosition, AdSlotAnchor> = {
  // "짧은 핵심 답변" 섹션이 도입부 뒤·요약 박스 앞에 새로 들어오므로, after_summary는
  // 핵심 답변이 아니라 "핵심 요약/요약 박스" heading에만 anchor해 그 뒤에 배치한다.
  after_summary: { headingPattern: /^#{2,3}\s*.*(핵심\s*요약|요약\s*박스|summary)/im, insertBefore: false, fallbackRatio: 0.3 },
  // 도입부 섹션이 끝나는 지점(= 짧은 핵심 답변 섹션 시작 직전)에 배치한다.
  after_intro: { headingPattern: /^#{2,3}\s*.*(도입부|들어가|서론|intro)/im, insertBefore: false, fallbackRatio: 0.15 },
  mid_content_1: { headingPattern: /^#{2,3}\s*.*(핵심\s*정보|본문\s*내용|정보)/im, insertBefore: false, fallbackRatio: 0.45 },
  mid_content_2: { headingPattern: /^#{2,3}\s*.*(비교)/im, insertBefore: false, fallbackRatio: 0.6 },
  before_faq: { headingPattern: /^#{2,3}\s*.*(faq|자주\s*묻는)/im, insertBefore: true, fallbackRatio: 0.8 },
  before_conclusion: { headingPattern: /^#{2,3}\s*.*(결론|마무리|정리하며)/im, insertBefore: true, fallbackRatio: 0.9 },
};

/** heading(## 또는 ### 로 시작하는 줄) 중 pattern에 매칭되는 첫 줄의 인덱스를 찾는다. */
function findHeadingLineIndex(lines: string[], pattern: RegExp): number {
  return lines.findIndex((line) => pattern.test(line));
}

/** headingIndex가 속한 섹션이 끝나는 줄(다음 heading 직전, 없으면 본문 끝)을 찾는다. */
function findSectionEndIndex(lines: string[], headingIndex: number): number {
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (/^#{2,3}\s+/.test(lines[i])) return i;
  }
  return lines.length;
}

/** anchor heading을 못 찾았을 때, 목표 비율에서 가장 가까운 빈 줄(문단 경계)을 찾는다. */
function findFallbackLineIndex(lines: string[], ratio: number): number {
  if (lines.length === 0) return 0;
  const target = Math.min(lines.length - 1, Math.max(0, Math.floor(lines.length * ratio)));
  for (let offset = 0; offset <= lines.length; offset++) {
    const forward = target + offset;
    const backward = target - offset;
    if (forward < lines.length && lines[forward].trim() === "") return forward;
    if (backward >= 0 && lines[backward].trim() === "") return backward;
  }
  return lines.length;
}

/** marker가 여러 번 등장하면 첫 번째만 남기고 나머지는 제거한다(각 marker는 최대 1회). */
function dedupeMarkerOccurrences(content: string, marker: string): { content: string; count: number } {
  const parts = content.split(marker);
  const count = parts.length - 1;
  if (count <= 1) return { content, count };

  let deduped = parts[0];
  let attached = false;
  for (let i = 1; i < parts.length; i++) {
    if (!attached) {
      deduped += marker + parts[i];
      attached = true;
    } else {
      deduped += parts[i];
    }
  }
  return { content: deduped, count: 1 };
}

/** marker 하나를 anchor 위치(또는 fallback 위치)에 삽입한다. 이미 정확히 1회 존재하면 그대로 둔다. */
function insertAdSlotMarker(content: string, position: AdSlotPosition): string {
  const marker = adSlotMarkerComment(position);
  const { content: deduped, count } = dedupeMarkerOccurrences(content, marker);
  if (count === 1) return deduped;

  const anchor = AD_SLOT_ANCHORS[position];
  const lines = deduped.split("\n");
  const headingIndex = findHeadingLineIndex(lines, anchor.headingPattern);

  const insertIndex =
    headingIndex === -1
      ? findFallbackLineIndex(lines, anchor.fallbackRatio)
      : anchor.insertBefore
        ? headingIndex
        : findSectionEndIndex(lines, headingIndex);

  const result = [...lines];
  result.splice(insertIndex, 0, "", marker, "");
  return result.join("\n");
}

/**
 * 본문에 AD_SLOT_MARKERS가 모두 존재하는지 확인하고, 빠진 marker는 heading을
 * 단서로 삼아 의미 있는 위치에 삽입한다(anchor를 못 찾으면 본문 내 비율 기준
 * fallback 위치에 삽입 — 본문 끝에 6개를 몰아서 넣지 않는다). marker가
 * 중복되면 첫 번째만 남긴다. 실제 AdSense 코드는 절대 삽입하지 않고 HTML
 * 주석 marker만 사용한다.
 */
function ensureAdSlotMarkers(content: string): { content: string; adSlots: AdSlotEntry[] } {
  let result = content;

  for (const position of AD_SLOT_MARKERS) {
    result = insertAdSlotMarker(result, position);
  }

  // 삽입 과정에서 생긴 3줄 이상의 연속 빈 줄을 2줄로 정리한다.
  result = result.replace(/\n{3,}/g, "\n\n");

  const adSlots: AdSlotEntry[] = AD_SLOT_MARKERS.map((position) => ({
    position,
    marker: adSlotMarkerComment(position),
  }));

  return { content: result, adSlots };
}

const DISALLOWED_AD_CODE_PATTERN =
  /<script[\s\S]*?<\/script>|<iframe\b[^>]*>[\s\S]*?<\/iframe>|adsbygoogle|googlesyndication|data-ad-client|data-ad-slot/gi;

/**
 * 모델이 실수로 실제 광고 스크립트/iframe을 생성했을 경우를 대비한 마지막
 * 방어선. 프롬프트로 금지해도 100% 보장되지 않으므로, 코드 레벨에서 한 번
 * 더 해당 패턴을 제거한다. AD_SLOT 주석 marker는 이 패턴에 걸리지 않는다.
 */
function stripDisallowedAdCode(content: string): string {
  return content.replace(DISALLOWED_AD_CODE_PATTERN, "");
}

const MIN_CONTENT_LENGTH = 500;

const FILLER_PARAGRAPH: Record<Theme["language"], string> = {
  ko: "이 기사는 mock article generator에 의해 자동 생성된 초안(draft)입니다. 실제 AI 모델을 통한 생성은 prompts/article-draft.v1.md를 기반으로 연동될 예정이며, 현재는 등록된 출처의 메타데이터를 바탕으로 본문을 구성합니다. 이 초안은 article.contract.yaml의 계약 검사를 통과한 뒤 AI Evals와 사용자 승인 절차를 거쳐야 reviewed 상태로 전환될 수 있습니다.",
  en: "This article is a draft automatically generated by the mock article generator. Generation via a real AI model will be wired up based on prompts/article-draft.v1.md. For now, the body is assembled from the metadata of the registered sources. This draft must pass the article.contract.yaml checks, then AI Evals and human approval before it can be transitioned to the reviewed status.",
};

/**
 * Phase 1-3: 실제 AI API를 호출하지 않는 mock 기사 초안 생성기.
 * Phase 2-1: mode를 생략하면 기존과 동일하게 source_based_explainer로 동작한다
 * (기존 흐름 보존).
 */
export function generateMockArticleDraft(
  theme: Theme,
  sources: Source[],
  mode: ArticleMode = DEFAULT_ARTICLE_MODE
): GeneratedArticle {
  if (mode === "general_news") {
    return generateGeneralNewsMock(theme, sources);
  }
  if (mode === "monetized_blog") {
    return generateMonetizedBlogMock(theme, sources);
  }
  return generateSourceBasedExplainerMock(theme, sources);
}

function generateSourceBasedExplainerMock(theme: Theme, sources: Source[]): GeneratedArticle {
  const lang = theme.language;
  const title = theme.title;
  const citedSourceIds = sources.map((source) => source.id);

  const sections =
    lang === "ko"
      ? buildKoreanSections(theme, sources)
      : buildEnglishSections(theme, sources);

  let content = sections.join("\n\n");
  while (content.length < MIN_CONTENT_LENGTH) {
    content += `\n\n${FILLER_PARAGRAPH[lang]}`;
  }

  return { title, content, citedSourceIds };
}

/** Phase 2-1: 일반 기사형(general_news) mock 생성기 — 짧고 간결한 구조. */
function generateGeneralNewsMock(theme: Theme, sources: Source[]): GeneratedArticle {
  const title = theme.title;
  const citedSourceIds = sources.map((source) => source.id);
  const desc = theme.description || `${theme.title}에 대한 최신 소식`;

  const issueParts = sources.slice(0, 3).map((s) => {
    const point = s.keyPoints?.[0] || s.summary?.substring(0, 80) || "(내용 없음)";
    return `- **${s.title || s.url}**: ${point}`;
  });

  const sections = [
    `# ${title}`,
    ["## 리드문", `${desc} 관련 출처 ${sources.length}건을 바탕으로 핵심 사실을 빠르게 전달한다.`].join("\n"),
    ["## 핵심 내용", ...issueParts].join("\n"),
    ["## 배경", `"${title}"는 최근 발생한 이슈다. 등록된 출처를 바탕으로 사실관계를 정리했다.`].join("\n"),
    [
      "## 관련 자료 또는 반응",
      sources.length > 0
        ? "등록된 출처들이 전하는 관련 사실과 반응은 다음과 같다."
        : "등록된 관련 자료가 아직 없다.",
    ].join("\n"),
    [
      "## 향후 전망",
      "추가 사실 확인과 후속 보도에 따라 상황이 달라질 수 있다.",
      "",
      "> ⚠️ 이 초안은 mock article generator가 자동 생성한 draft입니다.",
    ].join("\n"),
    [
      "## 참고 출처",
      ...sources.map((s, i) => `${i + 1}. ${s.title || s.url} ${s.publisher ? `(${s.publisher})` : ""}`),
    ].join("\n"),
  ];

  let content = sections.join("\n\n");
  while (content.length < MIN_CONTENT_LENGTH) {
    content += `\n\n${FILLER_PARAGRAPH[theme.language]}`;
  }

  return { title, content, citedSourceIds };
}

/** Phase 2-1: 수익형 블로그형(monetized_blog) mock 생성기 — SEO/광고 슬롯/체크리스트 포함. */
function generateMonetizedBlogMock(theme: Theme, sources: Source[]): GeneratedArticle {
  const title = theme.title;
  const citedSourceIds = sources.map((source) => source.id);
  const keywordStr = theme.keywords.join(", ");
  const targetKeyword = theme.keywords[0] || theme.title;
  const seoTitle = `${title} 완벽 가이드 (${new Date().getFullYear()}년 기준)`;
  const metaDescription = `${title}에 대해 알아야 할 핵심 정보를 정리했다. ${keywordStr}`.slice(0, 160);

  const sections = [
    `# ${seoTitle}`,
    ["## 도입부", `${theme.description || title}에 대해 궁금한 점을 이 글에서 모두 정리했다.`].join("\n"),
    adSlotMarkerComment("after_intro"),
    ["## 핵심 요약", `- ${title} 관련 핵심 정보 ${sources.length}건을 정리했다.`].join("\n"),
    adSlotMarkerComment("after_summary"),
    ["## 목차", "1. 문제 설명", "2. 핵심 정보", "3. 비교", "4. 체크리스트", "5. 주의점", "6. FAQ", "7. 결론"].join("\n"),
    ["## 문제 설명", `"${title}"를 찾는 독자가 흔히 겪는 어려움을 정리했다.`].join("\n"),
    [
      "## 핵심 정보",
      ...sources.slice(0, 3).map((s) => `- **${s.title || s.url}**: ${s.keyPoints?.[0] || s.summary?.substring(0, 80) || "(내용 없음)"}`),
    ].join("\n"),
    adSlotMarkerComment("mid_content_1"),
    ["## 비교표", "| 항목 | 설명 |", "|---|---|", `| ${title} | 출처 ${sources.length}건 기반 요약 |`].join("\n"),
    adSlotMarkerComment("mid_content_2"),
    ["## 체크리스트", "- [ ] 출처를 확인했는가", "- [ ] 최신 정보인가", "- [ ] 나에게 해당하는 정보인가"].join("\n"),
    ["## 주의점", "이 글은 일반 정보 제공 목적이며, 개별 상황에 따라 다를 수 있다."].join("\n"),
    adSlotMarkerComment("before_faq"),
    [
      "## FAQ",
      `**Q. ${title}란 무엇인가?**`,
      "A. 등록된 출처를 바탕으로 정리한 정보다.",
    ].join("\n"),
    adSlotMarkerComment("before_conclusion"),
    ["## 결론", `"${title}"에 대해 핵심 내용을 정리했다. 추가 정보는 참고자료를 확인하라.`].join("\n"),
    [
      "## 관련 글 추천",
      `- ${title} 관련 주제를 더 깊이 다루는 글 (추후 연결 예정)`,
    ].join("\n"),
    [
      "## 참고자료",
      ...sources.map((s, i) => `${i + 1}. ${s.title || s.url} ${s.publisher ? `(${s.publisher})` : ""}`),
    ].join("\n"),
  ];

  let content = sections.join("\n\n");
  while (content.length < MIN_CONTENT_LENGTH) {
    content += `\n\n${FILLER_PARAGRAPH[theme.language]}`;
  }

  const { content: contentWithAllSlots, adSlots } = ensureAdSlotMarkers(content);

  const internalLinkSuggestions: InternalLinkSuggestion[] = [
    { title: `${title} 관련 주제 1`, reason: "동일 카테고리 독자 관심사" },
  ];

  return {
    title,
    content: contentWithAllSlots,
    citedSourceIds,
    seoTitle,
    metaDescription,
    targetKeyword,
    secondaryKeywords: theme.keywords.slice(1),
    searchIntent: "informational",
    readerPersona: `${title}에 관심 있는 일반 독자`,
    adSlots,
    internalLinkSuggestions,
    monetizationScore: 50,
    policyRiskScore: 10,
  };
}

// ─────────────────────────────────────────────────────────────
// AI 기사 생성 (tool_use 방식)
// ─────────────────────────────────────────────────────────────

const ARTICLE_SYSTEM_PROMPT = `당신은 15년 경력의 전문 저널리스트이며, 여러 출처의 사실 조각을 종합해
일반 독자가 이해할 수 있는 "출처 기반 해설 기사"를 작성합니다.

이 모드(source_based_explainer)는 단순 뉴스 요약이나 SEO 블로그
글쓰기가 아닙니다. 광고 클릭을 유도하는 문구나 수익형 블로그 문체를
사용하지 않으며, 출처들이 공통으로 보여주는 흐름과 차이를 바탕으로
하나의 중심 해석을 제시하는 해설 기사 작성 모드입니다.

목표는 출처를 이어 붙이는 것이 아니라, 출처들 사이의 공통점·차이점·
긴장관계를 종합해 독자가 "왜 이 주제가 중요한지"를 이해하도록 돕는
것입니다.

【작업 순서 — 반드시 이 순서를 지킬 것】
1. synthesis_notes 작성 (내부 분석 메모, 독자에게 노출되지 않음):
   - 모든 출처의 key_points를 훑은 뒤, 공통 논지·의미 있는 차이점·
     긴장관계·독자에게 중요한 이유를 3~5문장으로 정리한다.
   - 특정 출처 하나의 구조를 따라가지 말고, 여러 출처를 재배열·통합해
     해석한다.
   - 출처에 없는 수치, 날짜, 고유명사, 인과관계는 만들지 않는다.
2. thesis 작성:
   - 강한 주장이나 사설식 결론이 아니라, "이 사안을 이해하는 중심
     해석"이다.
   - 출처들이 보여주는 흐름과 의미를 1~2문장으로 압축한다.
   - 찬반을 과도하게 단정하지 않는다.
   - 이후 title과 content는 이 thesis를 중심으로 구성한다.
3. title 작성:
   - thesis의 핵심을 반영한다 (40자 이내).
   - "충격", "대박", "난리", "무조건", "끝났다" 같은 클릭베이트 표현을
     금지한다.
   - 출처에 없는 숫자나 고유명사를 제목에 넣지 않는다.
   - 결론을 과도하게 단정하지 않는다.
4. content 작성:
   - thesis를 중심으로, 아래 "content가 포함해야 할 7가지 기능"을
     포함한 기사를 작성한다.
   - 800자 이상을 권장하며(최소 500자), markdown으로 작성한다.
5. sourceUsage 작성:
   - citedSourceIds에 포함된 각 출처가 본문에서 어떤 역할로 쓰였는지
     표시한다 (아래 "sourceUsage" 항목 참고).

【문체 기준】
- 한국 주요 일간지 수준의 품격 있는 설명형 저널리즘
- 역피라미드 구조 + 내러티브 흐름
- 각 문단은 하나의 생각을 담고 다음 문단으로 자연스럽게 이어진다
- 독자가 기사를 다 읽고 나서 "아, 이래서 이 주제가 중요하구나"를 느껴야 한다

【절대 금지】
- key_points 항목을 그대로 복사하거나 단어 순서만 바꾸는 paraphrase
- 출처를 순서대로 나열하는 구조 ("A 기사에 따르면... B 기사에 따르면... C 기사에 따르면..." 패턴)
- 특정 출처 하나의 문단 순서·논리 전개를 그대로 따라가는 source structure copy
- key_points에 없는 수치·날짜·고유명사를 만들어 추가하는 것 (hallucination)
- 출처에 없는 인과관계를 단정하는 것
- 출처에 없는 전망을 단정하는 것
- 광고 클릭 유도 표현, 수익형 블로그 문체
- 선정적 제목, 과장된 위기감
- 개인 투자·의료·법률 판단을 단정하는 표현
- 결론에서 근거 없이 "~일 것이다", "~해야 한다"를 나열하는 빈약한 전망
- 500자 미만 본문

【불확실성 표현 규칙】
- 출처에서 직접 확인되지 않는 인과관계, 전망, 평가는 단정하지 않는다.
- 필요한 경우 "가능성이 있다", "관찰된다", "해석할 수 있다", "과제로
  남는다"처럼 제한적으로 표현한다.
- 다만 출처가 직접 확인한 사실은 명확하게 쓴다 (불필요하게 모든
  문장을 헤지하지 않는다).

【content가 포함해야 할 7가지 기능 — heading을 기계적으로 고정하지 않는다】
아래는 content가 반드시 포함해야 할 기능이다. 다만 실제 heading은
주제에 맞게 자연스럽게 작성하고, 모든 기사에서 "## 배경", "## 핵심
쟁점" 같은 고정 제목을 기계적으로 반복하지 않아도 된다 — 기능이
드러나면 충분하다.
1. 리드문 — 독자가 계속 읽을 이유를 제시 (thesis 반영)
2. 배경 — 이 주제가 왜 지금 중요한지 맥락
3. 핵심 쟁점 — 여러 출처가 공통으로 짚는 문제의 핵심
4. 다각도 분석 — 출처들의 공통점·차이점·긴장관계를 통합해 해석
5. 사실과 데이터 — 출처에 명시된 구체적 사실·수치·사례만 사용
6. 독자에게 주는 의미 — 이 정보가 독자에게 왜 중요한지 해석
7. 향후 전망 또는 과제 — 출처 기반의 제한적 전망 또는 아직 해결되지
   않은 과제

【sourceUsage】
citedSourceIds에 포함된 각 sourceId가 본문에서 어떤 역할로 쓰였는지
표시한다. 하나의 sourceId가 여러 역할을 겸할 수 있다.
- background: 배경 설명에 사용
- data: 구체적 사실·수치·데이터 제공
- contrast: 다른 출처와의 차이·긴장관계를 보여주는 데 사용
- analysis: 다각도 분석에 사용
- implication: 독자에게 주는 의미 해석에 사용
- watch_point: 향후 전망/과제 제시에 사용
citedSourceIds에 없는 sourceId는 sourceUsage에 포함하지 않는다.`;

const ARTICLE_TOOL = {
  name: "write_article",
  description:
    "기사 작성 결과를 저장한다. synthesis_notes → thesis → title → content → sourceUsage 순서로 반드시 작성해야 한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      synthesis_notes: {
        type: "string",
        description: "출처 분석 메모 (독자에게 노출되지 않음). 출처들의 공통 논지·차이점·긴장관계·의미를 3~5문장으로 정리.",
      },
      thesis: {
        type: "string",
        description:
          "이 기사의 핵심 주장이 아니라 중심 해석 (1~2문장). 강한 단정이나 사설식 결론이 아니어야 하며, content 전체가 이 해석을 뒷받침해야 한다.",
      },
      title: {
        type: "string",
        description: "기사 제목 (40자 이내, thesis 반영, 클릭베이트/출처에 없는 숫자·고유명사 금지)",
      },
      content: {
        type: "string",
        description:
          "기사 본문 (markdown, 공백 포함 800자 이상 권장·최소 500자). 7가지 기능을 포함하되 heading은 자연스럽게 작성한다.",
      },
      citedSourceIds: {
        type: "array",
        items: { type: "string" },
        description: "본문에서 실제로 활용한 출처 ID 목록 (최소 3개)",
      },
      sourceUsage: {
        type: "array",
        description:
          "citedSourceIds에 포함된 sourceId가 본문에서 어떤 역할로 쓰였는지 표시하는 목록. citedSourceIds에 없는 sourceId는 포함하지 않는다.",
        items: {
          type: "object",
          properties: {
            sourceId: { type: "string", description: "citedSourceIds 중 하나와 정확히 일치하는 값" },
            usedFor: {
              type: "array",
              items: {
                type: "string",
                enum: ["background", "data", "contrast", "analysis", "implication", "watch_point"],
              },
              description: "이 출처가 본문에서 수행한 역할 (복수 선택 가능)",
            },
          },
          required: ["sourceId", "usedFor"],
        },
      },
    },
    required: ["synthesis_notes", "thesis", "title", "content", "citedSourceIds", "sourceUsage"],
  },
};

/**
 * article writer에 보낼 출처 입력을 구성한다.
 * summary 전문 대신 key_points(불릿 사실)만 전달해 paraphrase를 차단한다.
 * key_points가 없는 출처는 summary 앞 150자를 짧게 fallback한다.
 */
function buildSourceBlock(summary: SourceSummary): string {
  const lines = [
    `[출처 ${summary.sourceId}]`,
    // sourceUsage.sourceId가 이 값과 정확히 일치해야 하므로, 모델이 ID를
    // 혼동하지 않도록 별도 줄로 한 번 더 명시한다.
    `sourceId(정확히 그대로 사용): ${summary.sourceId}`,
    `제목: ${summary.title}`,
    `출판사: ${summary.publisher || "(없음)"}`,
    `발행일: ${summary.publishedAt || "(없음)"}`,
  ];

  if (summary.sourceAngle) {
    lines.push(`관점: ${summary.sourceAngle}`);
  }

  if (summary.keyPoints.length > 0) {
    lines.push("핵심 사실:");
    summary.keyPoints.forEach((kp) => lines.push(`  • ${kp}`));
  } else if (summary.summary) {
    // key_points가 없는 구형 출처는 summary 150자로 fallback
    const fallback = summary.summary.length > 150
      ? `${summary.summary.substring(0, 150)}…`
      : summary.summary;
    lines.push(`핵심 내용 (요약): ${fallback}`);
  }

  return lines.join("\n");
}

function buildArticleUserPrompt(theme: Theme, sourceSummaries: SourceSummary[]): string {
  const sourceBlocks = sourceSummaries.map(buildSourceBlock).join("\n\n");

  const audienceNote =
    theme.language === "en" ? "General blog readers" : "일반 블로그 독자 (한국어)";

  return [
    `주제: ${theme.title}`,
    `주제 설명: ${theme.description || "(없음)"}`,
    `주요 키워드: ${theme.keywords.join(", ") || "(없음)"}`,
    `독자 대상: ${audienceNote}`,
    "",
    "─── 출처별 핵심 사실 목록 (요약문이 아닌 사실 추출물) ───",
    sourceBlocks,
    "",
    "─── 작업 지시 ───",
    "위 사실 목록을 바탕으로 write_article 도구를 호출하세요.",
    "반드시 synthesis_notes → thesis → title → content → sourceUsage 순서로 채우세요.",
    "각 출처를 순서대로 소개하는 방식으로 작성하지 마세요.",
    "출처의 핵심 사실을 종합·해석하여 하나의 논지가 있는 기사로 작성하세요.",
    "sourceUsage의 sourceId는 위 [출처 ...] 블록의 sourceId와 정확히 동일한 문자열을 사용하세요.",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────
// source_based_explainer 실행 조건(guard) + sourceUsage 파싱
// ─────────────────────────────────────────────────────────────

/** source_based_explainer가 실제로 종합할 수 있는 최소 출처 개수. */
export const MIN_USABLE_SOURCES_FOR_EXPLAINER = 3;

export interface SourceReadinessCheck {
  ready: boolean;
  usableCount: number;
  totalCount: number;
  message: string;
}

/**
 * key_points와 summary가 모두 비어 있는 출처는 종합(synthesis)할 사실이
 * 없으므로 "사용 가능한 출처"로 세지 않는다.
 */
function isUsableSourceSummary(summary: SourceSummary): boolean {
  return summary.keyPoints.length > 0 || summary.summary.trim().length > 0;
}

/**
 * source_based_explainer 실행 가능 여부를 판단한다. AI 호출 전에 서버
 * 액션/UI에서 미리 확인해 "최소 3개 출처가 필요합니다" 같은 안내를
 * 보여주는 데 사용할 수 있다.
 */
export function checkSourceBasedExplainerReadiness(sourceSummaries: SourceSummary[]): SourceReadinessCheck {
  const usableCount = sourceSummaries.filter(isUsableSourceSummary).length;
  const ready = usableCount >= MIN_USABLE_SOURCES_FOR_EXPLAINER;

  return {
    ready,
    usableCount,
    totalCount: sourceSummaries.length,
    message: ready
      ? `사용 가능한 출처 ${usableCount}건으로 source_based_explainer 모드를 실행할 수 있습니다.`
      : `source_based_explainer는 최소 ${MIN_USABLE_SOURCES_FOR_EXPLAINER}개 이상의 사용 가능한 출처(key_points 또는 summary가 있는 출처)가 필요합니다 ` +
        `(현재 사용 가능: ${usableCount}건, 전체 등록: ${sourceSummaries.length}건). ` +
        "출처를 보강하거나 general_news 모드를 사용하세요.",
  };
}

/**
 * source_based_explainer 실행에 필요한 최소 출처 재료가 부족할 때 던지는
 * 오류. 새 fallback 모드를 만드는 대신, 호출자가 이 오류를 잡아 기존
 * mock 생성 경로로 안전하게 전환할 수 있도록 명확한 상태를 제공한다.
 */
export class InsufficientSourceMaterialError extends Error {
  readonly usableCount: number;
  readonly totalCount: number;

  constructor(check: SourceReadinessCheck) {
    super(check.message);
    this.name = "InsufficientSourceMaterialError";
    this.usableCount = check.usableCount;
    this.totalCount = check.totalCount;
  }
}

const SOURCE_USAGE_ROLES: readonly SourceUsageRole[] = [
  "background",
  "data",
  "contrast",
  "analysis",
  "implication",
  "watch_point",
];

function isSourceUsageRole(value: unknown): value is SourceUsageRole {
  return typeof value === "string" && (SOURCE_USAGE_ROLES as readonly string[]).includes(value);
}

/**
 * AI 응답의 sourceUsage를 검증한다. citedSourceIds에 없는 sourceId나
 * 허용되지 않은 usedFor 값은 조용히 버리고, 그 외 결과는 그대로
 * 반환한다 (형식이 다소 어긋나도 기사 생성 자체를 막지 않는다).
 */
function parseSourceUsage(raw: unknown, citedSourceIds: string[]): SourceUsageEntry[] {
  if (!Array.isArray(raw)) return [];
  const citedSet = new Set(citedSourceIds);
  const result: SourceUsageEntry[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const sourceId = typeof record.sourceId === "string" ? record.sourceId : "";
    if (!sourceId || !citedSet.has(sourceId)) continue;

    const usedForRaw = Array.isArray(record.usedFor) ? record.usedFor : [];
    const usedFor = usedForRaw.filter(isSourceUsageRole);
    if (usedFor.length === 0) continue;

    result.push({ sourceId, usedFor });
  }

  return result;
}

/**
 * Phase 1-4: prompts/article-draft.v1.md 기준으로 Anthropic API를 호출해
 * 기사 초안을 생성한다. tool_use로 JSON 출력을 강제한다.
 * 반환되는 status는 항상 "draft"로 강제한다 (모델 응답값과 무관).
 * Phase 2-1: mode를 생략하면 기존과 동일하게 source_based_explainer로 동작한다
 * (기존 흐름 보존 — client 생성 실패 시 즉시 예외, 이하 로직 동일).
 */
export async function generateAiArticleDraft(
  theme: Theme,
  sourceSummaries: SourceSummary[],
  mode: ArticleMode = DEFAULT_ARTICLE_MODE
): Promise<GeneratedArticle> {
  const client = getAnthropicClient();

  if (mode === "general_news") {
    return generateGeneralNewsAiDraft(client, theme, sourceSummaries);
  }
  if (mode === "monetized_blog") {
    return generateMonetizedBlogAiDraft(client, theme, sourceSummaries);
  }
  return generateSourceBasedExplainerAiDraft(client, theme, sourceSummaries);
}

type AnthropicClient = ReturnType<typeof getAnthropicClient>;

async function generateSourceBasedExplainerAiDraft(
  client: AnthropicClient,
  theme: Theme,
  sourceSummaries: SourceSummary[]
): Promise<GeneratedArticle> {
  const readiness = checkSourceBasedExplainerReadiness(sourceSummaries);
  if (!readiness.ready) {
    throw new InsufficientSourceMaterialError(readiness);
  }

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 8192,
    system: ARTICLE_SYSTEM_PROMPT,
    tools: [ARTICLE_TOOL],
    tool_choice: { type: "tool", name: "write_article" },
    messages: [{ role: "user", content: buildArticleUserPrompt(theme, sourceSummaries) }],
  });

  const toolUseBlock = response.content.find((block) => block.type === "tool_use");
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error("generateAiArticleDraft: AI가 도구를 호출하지 않았습니다.");
  }

  const input = toolUseBlock.input as Record<string, unknown>;

  const title = typeof input.title === "string" ? input.title.trim() : "";
  const content = typeof input.content === "string" ? input.content.trim() : "";

  if (!title || !content) {
    throw new Error("generateAiArticleDraft: AI 응답에 title 또는 content가 없습니다.");
  }

  const citedSourceIds = Array.isArray(input.citedSourceIds)
    ? input.citedSourceIds.filter((id): id is string => typeof id === "string")
    : [];

  const sourceUsage = parseSourceUsage(input.sourceUsage, citedSourceIds);

  return { title, content, citedSourceIds, sourceUsage };
}

// ─────────────────────────────────────────────────────────────
// Phase 2-1: 일반 기사형(general_news) AI 생성
// ─────────────────────────────────────────────────────────────

const GENERAL_NEWS_SYSTEM_PROMPT = `당신은 통신사 소속의 스트레이트 뉴스 기자입니다.
빠른 이슈 전달을 목표로, 객관적이고 간결한 일반 기사형 초안을 작성합니다.

【절대 금지】
- 과장된 표현, 클릭베이트성 제목
- 출처에 없는 단정적 주장이나 수치·고유명사 추가 (hallucination)
- 출처를 순서대로 나열하는 구조 ("A 기사에 따르면... B 기사에 따르면...")

【7개 섹션 구조】
1. 리드문 — 무엇이·언제·왜 일어났는지 2~3문장 요약
2. 핵심 내용 — 이슈의 핵심 사실
3. 배경 — 이슈가 발생한 맥락
4. 관련 자료 또는 반응 — 출처가 전하는 관련 사실/반응
5. 향후 전망 — 출처 근거가 있는 전망 (과도한 예측 금지)
6. 참고 출처 — 인용된 출처

빠른 전달이 목적이므로 출처 기반 설명형보다 짧고 간결하게 작성하세요 (500자 이상, 1500자 이내 권장).`;

const GENERAL_NEWS_TOOL = {
  name: "write_general_news_article",
  description: "일반 기사형(general_news) 결과를 저장한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "기사 제목 (과장 금지, 40자 이내)" },
      content: { type: "string", description: "기사 본문 (markdown, 500자 이상, 7개 섹션)" },
      citedSourceIds: {
        type: "array",
        items: { type: "string" },
        description: "본문에서 실제로 활용한 출처 ID 목록 (최소 3개)",
      },
    },
    required: ["title", "content", "citedSourceIds"],
  },
};

async function generateGeneralNewsAiDraft(
  client: AnthropicClient,
  theme: Theme,
  sourceSummaries: SourceSummary[]
): Promise<GeneratedArticle> {
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: GENERAL_NEWS_SYSTEM_PROMPT,
    tools: [GENERAL_NEWS_TOOL],
    tool_choice: { type: "tool", name: "write_general_news_article" },
    messages: [{ role: "user", content: buildArticleUserPrompt(theme, sourceSummaries) }],
  });

  const toolUseBlock = response.content.find((block) => block.type === "tool_use");
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error("generateAiArticleDraft: AI가 도구를 호출하지 않았습니다.");
  }

  const input = toolUseBlock.input as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const content = typeof input.content === "string" ? input.content.trim() : "";

  if (!title || !content) {
    throw new Error("generateAiArticleDraft: AI 응답에 title 또는 content가 없습니다.");
  }

  const citedSourceIds = Array.isArray(input.citedSourceIds)
    ? input.citedSourceIds.filter((id): id is string => typeof id === "string")
    : [];

  return { title, content, citedSourceIds };
}

// ─────────────────────────────────────────────────────────────
// Phase 2-1: 수익형 블로그형(monetized_blog) AI 생성
// ─────────────────────────────────────────────────────────────

const MONETIZED_BLOG_SYSTEM_PROMPT = `당신은 검색 유입, 독자 만족도, 체류시간, 수익화 가능성을 함께 고려하는
SEO 콘텐츠 전문 작가입니다. 그러나 최우선 목표는 광고 수익이 아니라
독자의 문제를 정확하고 신뢰성 있게 해결하는 것입니다. 검색엔진
최적화는 사람에게 유용한 콘텐츠를 더 잘 발견되게 하기 위한 보조
수단으로만 사용합니다.

monetized_blog는 단순 광고 수익형 글이 아니라, 독자의 문제를
해결하고, 검색엔진이 이해하기 쉽고, 생성형 AI 검색에서도 요약하기
쉬우며, 광고 정책과 신뢰성 기준을 지키는 "문제 해결형 수익 블로그"
콘텐츠입니다.

【E-E-A-T / 신뢰성 기준】
- 이 글은 수익화 목적이 있더라도 독자의 문제 해결과 신뢰성을 최우선으로 한다.
- 실제 경험, 사용 후기, 전문가 자격, 조사 결과를 출처 없이 만들어내지 않는다.
- 출처에서 확인 가능한 사실과 작성자의 해석을 구분한다.
- 의료, 금융, 법률, 안전, 공공정책 등 고위험(YMYL) 주제에서는 단정적
  조언을 피하고, 확인이 필요한 사항과 일반적 판단 기준을 제시한다.
- 독자가 스스로 판단할 수 있도록 비교 기준, 주의점, 한계, 확인
  방법을 제공한다.
- 출처가 부족하거나 확인이 필요한 내용은 단정하지 않는다.
- "직접 사용해봤다", "전문가가 검증했다", "조사 결과 밝혀졌다" 같은
  표현은 실제 근거가 있을 때만 사용한다.

【SEO 기준】
- targetKeyword는 seoTitle, 도입부, 주요 heading 중 일부에 자연스럽게 포함한다.
- secondaryKeywords는 문맥에 맞을 때만 사용하며, 키워드 반복이나
  부자연스러운 삽입을 금지한다.
- metaDescription은 검색 사용자가 글의 가치를 이해할 수 있도록
  120~160자 내외로 작성한다.
- heading은 검색엔진보다 독자가 내용을 쉽게 이해할 수 있도록
  구성한다.
- 내부 링크 제안은 실제로 연결하면 도움이 될 만한 주제로만 작성한다.
- 제목은 클릭하고 싶게 만들되, 과장·낚시·허위 기대를 만들지 않는다.
- 검색엔진만 의식한 빈 문장, 키워드 나열, 의미 없는 장문을 금지한다.

【AEO / 직접 답변 기준】
- answerSummary는 tool 필드로 별도 작성한다 — 독자의 핵심 질문에
  2~4문장으로 직접 답하며, 결론을 먼저 제시하되 조건이나 예외가
  있으면 함께 표시한다. 출처 없는 수치, 단정적 전망, 허위 결론을
  넣지 않는다.
- **다만 본문(content)은 answerSummary로 바로 시작하지 않는다.**
  일반 독자가 자연스럽게 읽을 수 있도록 도입부를 먼저 배치하고,
  그 직후에 answerSummary 내용을 "짧은 핵심 답변" 섹션으로 자연스럽게
  풀어서 제시한다 (아래 【구조】참고). 보고서나 AI 응답처럼 느껴지는
  "답변부터 던지고 시작하는" 구성을 피한다.
- content 안의 짧은 핵심 답변 섹션은 answerSummary를 그대로
  복사하지 말고 자연스러운 문장으로 풀어 쓰되, answerSummary와
  content의 결론이 서로 충돌하지 않아야 한다.
- 본문에는 "무엇인가", "왜 중요한가", "어떻게 선택해야 하나", "주의할
  점은 무엇인가"와 같은 질문형 흐름을 자연스럽게 반영한다.
- FAQ는 본문 내용을 보완하는 실제 질문과 답변으로 작성하며, 본문에
  없는 내용을 새로 만들어 답하지 않는다.
- 질문만 많이 만들고 답이 빈약한 구조를 금지한다.

【GEO / 생성형 AI 검색 이해성 기준】
- 각 섹션은 독립적으로 읽어도 의미가 통하도록 작성한다.
- 중요한 결론은 먼저 제시하고, 그 뒤에 근거와 예외를 설명한다.
- geoSummary.keyFacts는 출처에 있는 사실만 사용한다.
- geoSummary.caveats에는 주의점, 예외, 판단 한계를 명확히 적는다.
- 표, 체크리스트, FAQ, 요약 박스를 활용해 내용을 구조화한다.
- 특정 AI 검색 기능에 노출되거나 인용된다고 보장하지 않는다.
- "AI Overview에 노출", "검색 1위 보장", "AI가 반드시 인용" 같은
  표현을 절대 사용하지 않는다.

【절대 금지】
- 허위 경험담, 허위 사용 후기, 허위 전문가 검토
- 출처 없는 통계·주장, 원문 15단어 이상 연속 복사
- 키워드 반복(keyword stuffing), 제목 낚시(클릭베이트)
- 본문과 불일치하는 FAQ
- 과장된 클릭베이트, 허위 또는 과장된 수익 약속
- 실제 광고 클릭을 유도하는 문구(AdSense 정책 위반 소지)
- "AI Overview에 노출되도록", "AI가 인용하도록", "검색 1위 보장" 같은
  검색/AI 노출 보장 표현
- 의료/금융/법률/안전/공공정책 등 고위험(YMYL) 주제에 대한 단정적 조언
- "무조건", "100%", "반드시 수익", "확실한 방법" 같은 과장 표현

【실제 광고 코드 절대 금지】
- 실제 AdSense 스크립트나 광고 코드를 절대 작성하지 마세요.
- 광고 위치는 반드시 HTML 주석 marker만 사용하세요: <!-- AD_SLOT: after_summary --> 형태.
- 사용 가능한 marker: after_summary, after_intro, mid_content_1, mid_content_2, before_faq, before_conclusion
- after_intro는 도입부와 짧은 핵심 답변 섹션 사이에 배치하세요.
- after_summary는 짧은 핵심 답변이 아니라 그 뒤에 오는 "핵심 요약
  박스" 섹션 다음에 배치하세요.
- 각 marker는 최대 1회만 사용하세요. 광고 marker가 글의 흐름(도입부
  → 핵심 답변 전환 등)을 방해하지 않게 하세요.

【구조 — 도입부를 먼저, 핵심 답변은 그 뒤에. heading은 자연스럽게】
SEO 제목 → 메타 설명 → 도입부 → 짧은 핵심 답변(answerSummary를
자연스럽게 반영) → 핵심 요약 박스(AD_SLOT: after_summary) → 목차 →
문제 설명 → 핵심 정보(AD_SLOT: mid_content_1) → 비교표
(AD_SLOT: mid_content_2) → 선택 기준 → 체크리스트 → 주의점/한계 →
FAQ(AD_SLOT: before_faq) → 결론(AD_SLOT: before_conclusion) → 관련
글 추천 → 참고자료

이 순서는 AEO/GEO 이점(직접 답변, 명확한 결론 우선 제시)은
유지하면서도 일반 블로그 독자가 보고서식·AI 답변식이 아니라
자연스럽게 읽히도록 하기 위한 하이브리드 구조입니다. 도입부 없이
곧바로 결론부터 던지는 구성을 사용하지 마세요.

【도입부 작성 기준】
- 독자의 상황이나 문제의식에서 시작한다.
- 왜 이 주제가 중요한지 설명한다.
- 이 글에서 무엇을 정리할지 안내한다.
- 과장, 클릭베이트, 광고성 표현은 사용하지 않는다.
- targetKeyword는 자연스럽게 포함하되 억지로 반복하지 않는다.

【짧은 핵심 답변 섹션 작성 기준】
- 도입부 바로 뒤에 배치한다.
- answerSummary의 내용을 바탕으로 2~4문장으로 작성하되, 그대로
  복사하지 말고 자연스럽게 풀어 쓴다.
- heading은 주제에 맞게 자연스럽게 선택한다. 허용 heading 예:
  "## 먼저 결론부터 보면", "## 핵심만 정리하면", "## 이 글의 핵심",
  "## 짧게 정리하면", "## 결론부터 말하면".
- 아래와 같은 heading은 금지한다: "## 무조건 이것만 보세요",
  "## 이거 모르면 손해입니다", "## 충격적인 결론", "## 반드시 수익
  나는 방법" — 클릭베이트/과장 표현이 섞인 heading은 쓰지 않는다.

광고 marker는 글 흐름을 해치지 않는 위치에만 삽입하세요.

【점수 산출】
monetizationScore(0~100)는 검색 수요, 문제 해결성, 비교/구매 의도,
콘텐츠 확장성, 광고 적합성, 장기 검색 가능성, 경쟁 강도, 정책
위험도를 종합해 산출하세요. 높은 monetizationScore가 과장 표현이나
허위 수익 약속을 사용하라는 의미가 아닙니다.
policyRiskScore(0~100, 높을수록 위험)는 허위/과장 수익 약속, 광고
클릭 유도 문구, 선정적 제목, 고위험(YMYL) 단정, 출처 없는 주장,
복사/저작권 위험, 허위 E-E-A-T 표현, AI 검색 노출 보장 표현, 본문과
불일치하는 FAQ, 키워드 반복, 실제 광고 코드를 종합해 산출하세요.`;

const MONETIZED_BLOG_TOOL = {
  name: "write_monetized_blog_article",
  description: "수익형 블로그형(monetized_blog) 결과를 저장한다. 독자 문제 해결이 최우선이며, answerSummary/eeatNotes/geoSummary를 반드시 포함해야 한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      seoTitle: { type: "string", description: "SEO 제목 (60자 이내, 타깃 키워드 포함, 클릭베이트 금지)" },
      metaDescription: { type: "string", description: "메타 설명 (120~160자 내외)" },
      targetKeyword: { type: "string", description: "타깃 키워드" },
      secondaryKeywords: { type: "array", items: { type: "string" }, description: "보조 키워드 목록 (자연스러운 경우만)" },
      searchIntent: { type: "string", description: "검색 의도 (informational/commercial/transactional 등)" },
      readerPersona: { type: "string", description: "독자 페르소나 설명" },
      title: { type: "string", description: "본문에 표시할 제목" },
      answerSummary: {
        type: "string",
        description:
          "독자의 핵심 질문에 대한 2~4문장 직접 답변. 결론을 먼저 제시하고 조건/예외를 함께 표시한다. 출처에 없는 수치·단정은 넣지 않는다. " +
          "content는 이 값을 그대로 복사한 문장으로 시작하지 않는다 — 도입부 뒤에 자연스럽게 풀어서 반영한다.",
      },
      content: {
        type: "string",
        description:
          "기사 본문 (markdown, 도입부로 시작, 도입부 직후 answerSummary를 자연스럽게 반영한 짧은 핵심 답변 섹션 포함, " +
          "AD_SLOT marker 각 1회 포함, 목차/비교표/체크리스트/FAQ 포함, 1200자 이상)",
      },
      citedSourceIds: {
        type: "array",
        items: { type: "string" },
        description: "본문에서 실제로 활용한 출처 ID 목록 (최소 3개)",
      },
      adSlots: {
        type: "array",
        items: {
          type: "object",
          properties: {
            position: { type: "string" },
            marker: { type: "string" },
          },
        },
        description: "본문에 삽입한 AD_SLOT marker 목록",
      },
      internalLinkSuggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            reason: { type: "string" },
          },
        },
        description: "관련 글 추천 목록",
      },
      monetizationScore: { type: "number", description: "수익화 적합도 점수 (0~100)" },
      policyRiskScore: { type: "number", description: "AdSense 정책 위험도 점수 (0~100, 높을수록 위험)" },
      eeatNotes: {
        type: "object",
        description: "E-E-A-T 자가 점검 메모. 실제 근거가 있는 항목만 채우고, 없으면 비워둔다(지어내지 않는다).",
        properties: {
          experience: { type: "string", description: "이 글이 반영한 실제 경험적 근거(있는 경우만)" },
          expertise: { type: "string", description: "이 글이 반영한 전문성 근거(있는 경우만)" },
          authoritativeness: { type: "string", description: "출처의 권위성 근거(있는 경우만)" },
          trustworthiness: { type: "string", description: "신뢰성을 뒷받침하는 근거(있는 경우만)" },
        },
      },
      readerQuestions: {
        type: "array",
        description: "독자가 가질 법한 질문과 짧은 답변 목록 (선택)",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            shortAnswer: { type: "string" },
          },
          required: ["question", "shortAnswer"],
        },
      },
      geoSummary: {
        type: "object",
        description: "생성형 AI 검색 이해성을 위한 내부 요약. 검색/AI 노출 보장 표현을 사용하지 않는다.",
        properties: {
          directAnswer: { type: "string", description: "핵심 결론 1~2문장" },
          keyFacts: { type: "array", items: { type: "string" }, description: "출처 기반 핵심 사실 3~5개" },
          caveats: { type: "array", items: { type: "string" }, description: "주의점/한계/예외 2~4개" },
        },
      },
      structuredDataSuggestions: {
        type: "array",
        description: "schema.org 구조화 데이터 후보 제안 (실제 JSON-LD 코드는 생성하지 않는다)",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["Article", "BlogPosting", "FAQPage", "HowTo"] },
            reason: { type: "string" },
          },
          required: ["type", "reason"],
        },
      },
    },
    required: [
      "seoTitle",
      "metaDescription",
      "targetKeyword",
      "title",
      "answerSummary",
      "content",
      "citedSourceIds",
      "monetizationScore",
      "policyRiskScore",
      "eeatNotes",
      "geoSummary",
    ],
  },
};

/**
 * "짧은 핵심 답변" 섹션에 이미 자연스럽게 반영됐다고 볼 수 있는 heading
 * 패턴(허용 heading 목록 + 하위 호환용 "핵심 답변"). 프롬프트가 지시하는
 * 허용 heading 예시와 맞춰뒀다 — 이 중 하나가 이미 있으면 fallback 삽입을
 * 건너뛴다(모델이 자연스럽게 반영한 것으로 본다).
 */
const CORE_ANSWER_HEADING_PATTERN =
  /^#{2,3}\s*.*(핵심\s*답변|결론부터|핵심만\s*정리|이\s*글의\s*핵심|짧게\s*정리|먼저\s*결론)/im;

/** fallback 삽입 시 사용할 기본 heading (허용 heading 목록 중 하나). */
const DEFAULT_CORE_ANSWER_HEADING = "## 핵심만 정리하면";

/** 도입부 heading을 찾기 위한 패턴 (AD_SLOT_ANCHORS.after_intro와 동일한 기준을 공유). */
const INTRO_HEADING_PATTERN = /^#{2,3}\s*.*(도입부|들어가|서론|intro)/im;

/** answerSummary가 지나치게 길면(직접 답변이라기엔 장황함) 검토가 필요하다고 본다. */
const ANSWER_SUMMARY_MAX_RECOMMENDED_LENGTH = 400;
/** policyRiskScore가 이 값 이상이면 검토가 필요하다고 본다(차단은 아님 — 최종 판단은 사람이 한다). */
const POLICY_RISK_WARNING_THRESHOLD = 70;

const EEAT_NOTE_KEYS = ["experience", "expertise", "authoritativeness", "trustworthiness"] as const;

/** eeatNotes를 파싱한다. 존재하지 않는 근거를 지어내지 않도록, 빈 값은 채우지 않고 그대로 둔다. */
function parseEeatNotes(raw: unknown): EeatNotes {
  const notes: EeatNotes = {};
  if (!raw || typeof raw !== "object") return notes;

  const record = raw as Record<string, unknown>;
  for (const key of EEAT_NOTE_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      notes[key] = value.trim();
    }
  }
  return notes;
}

/** readerQuestions를 파싱한다. question/shortAnswer가 모두 있는 항목만 유지한다. */
function parseReaderQuestions(raw: unknown): ReaderQuestionEntry[] {
  if (!Array.isArray(raw)) return [];

  const result: ReaderQuestionEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const question = typeof record.question === "string" ? record.question.trim() : "";
    const shortAnswer = typeof record.shortAnswer === "string" ? record.shortAnswer.trim() : "";
    if (!question || !shortAnswer) continue;
    result.push({ question, shortAnswer });
  }
  return result;
}

/** geoSummary를 파싱한다. 검색/AI 노출 보장 여부는 별도로 검증하지 않고 있는 값만 정리한다. */
function parseGeoSummary(raw: unknown): GeoSummary {
  const empty: GeoSummary = { directAnswer: "", keyFacts: [], caveats: [] };
  if (!raw || typeof raw !== "object") return empty;

  const record = raw as Record<string, unknown>;
  const directAnswer = typeof record.directAnswer === "string" ? record.directAnswer.trim() : "";
  const keyFacts = Array.isArray(record.keyFacts)
    ? record.keyFacts.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
  const caveats = Array.isArray(record.caveats)
    ? record.caveats.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];

  return { directAnswer, keyFacts, caveats };
}

const STRUCTURED_DATA_TYPES: readonly StructuredDataSuggestionType[] = ["Article", "BlogPosting", "FAQPage", "HowTo"];

function isStructuredDataSuggestionType(value: unknown): value is StructuredDataSuggestionType {
  return typeof value === "string" && (STRUCTURED_DATA_TYPES as readonly string[]).includes(value);
}

/**
 * structuredDataSuggestions를 파싱한다. 허용된 type이 아니면 버린다 — 이 필드는
 * 실제 schema markup 자동 삽입이 아니라 후보 제안일 뿐이며, JSON-LD 코드를
 * 생성하지 않는다.
 */
function parseStructuredDataSuggestions(raw: unknown): StructuredDataSuggestionEntry[] {
  if (!Array.isArray(raw)) return [];

  const result: StructuredDataSuggestionEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (!isStructuredDataSuggestionType(record.type)) continue;
    const reason = typeof record.reason === "string" ? record.reason.trim() : "";
    if (!reason) continue;
    result.push({ type: record.type, reason });
  }
  return result;
}

/**
 * answerSummary가 본문 어딘가에 "짧은 핵심 답변" 형태로 반영되도록 보장하되,
 * content 전체를 answerSummary로 시작하게 만들지 않는다 — 독자 친화성을
 * 위해 도입부를 먼저 존중한다.
 *
 * - 이미 허용된 핵심 답변류 heading(CORE_ANSWER_HEADING_PATTERN)이 있으면
 *   모델이 자연스럽게 반영한 것으로 보고 그대로 둔다(원문을 그대로 복사해
 *   비교하지 않는다 — 자연스럽게 풀어 쓴 표현은 문자열이 다를 수 있다).
 * - 없으면 도입부 섹션이 끝나는 지점(도입부 heading을 못 찾으면 본문 초반
 *   대략적인 위치)에 fallback heading + answerSummary 원문을 삽입한다.
 */
function ensureCoreAnswerInContent(content: string, answerSummary: string): string {
  if (CORE_ANSWER_HEADING_PATTERN.test(content)) return content;

  const lines = content.split("\n");
  const introHeadingIndex = findHeadingLineIndex(lines, INTRO_HEADING_PATTERN);
  const insertIndex =
    introHeadingIndex === -1 ? findFallbackLineIndex(lines, 0.15) : findSectionEndIndex(lines, introHeadingIndex);

  const section = [DEFAULT_CORE_ANSWER_HEADING, "", answerSummary].join("\n");
  const result = [...lines];
  result.splice(insertIndex, 0, "", section, "");
  return result.join("\n");
}

/**
 * 차단하지는 않지만 사람이 검토할 만한 신호를 모은다. 프롬프트 지시만으로는
 * 100% 보장되지 않는 항목(요약 길이, 위험도 점수, 키워드 반복 의심 등)을
 * 코드에서 한 번 더 가볍게 점검한다. 여기서 발견된 항목은 자동으로
 * 수정하지 않는다 — 최종 판단은 사람이 한다.
 */
function assessMonetizedBlogQuality(
  content: string,
  answerSummary: string,
  targetKeyword: string,
  policyRiskScore: number
): MonetizedBlogQualityWarning[] {
  const warnings: MonetizedBlogQualityWarning[] = [];

  if (answerSummary.length > ANSWER_SUMMARY_MAX_RECOMMENDED_LENGTH) {
    warnings.push({
      code: "answer_summary_too_long",
      message: `answerSummary가 권장 길이(${ANSWER_SUMMARY_MAX_RECOMMENDED_LENGTH}자)보다 깁니다 (${answerSummary.length}자). 직접 답변은 간결해야 합니다.`,
    });
  }

  if (policyRiskScore >= POLICY_RISK_WARNING_THRESHOLD) {
    warnings.push({
      code: "policy_risk_high",
      message: `policyRiskScore가 ${policyRiskScore}점으로 높습니다 (기준: ${POLICY_RISK_WARNING_THRESHOLD}점 이상). 게시 전 사람이 검토해야 합니다.`,
    });
  }

  const trimmedKeyword = targetKeyword.trim();
  if (trimmedKeyword.length > 0) {
    const occurrences = content.split(trimmedKeyword).length - 1;
    const contentLengthInThousands = Math.max(1, content.length / 1000);
    // 1000자당 8회를 넘게 등장하면 키워드 반복(keyword stuffing) 의심으로 본다.
    if (occurrences / contentLengthInThousands > 8) {
      warnings.push({
        code: "keyword_stuffing_suspected",
        message: `targetKeyword가 본문에 ${occurrences}회 등장해 키워드 반복(keyword stuffing)이 의심됩니다.`,
      });
    }
  }

  for (const position of AD_SLOT_MARKERS) {
    const marker = adSlotMarkerComment(position);
    const count = content.split(marker).length - 1;
    if (count !== 1) {
      warnings.push({
        code: "ad_slot_marker_count_invalid",
        message: `AD_SLOT marker(${position})가 본문에 ${count}회 등장합니다 (정확히 1회여야 함).`,
      });
    }
  }

  return warnings;
}

async function generateMonetizedBlogAiDraft(
  client: AnthropicClient,
  theme: Theme,
  sourceSummaries: SourceSummary[]
): Promise<GeneratedArticle> {
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 8192,
    system: MONETIZED_BLOG_SYSTEM_PROMPT,
    tools: [MONETIZED_BLOG_TOOL],
    tool_choice: { type: "tool", name: "write_monetized_blog_article" },
    messages: [{ role: "user", content: buildArticleUserPrompt(theme, sourceSummaries) }],
  });

  const toolUseBlock = response.content.find((block) => block.type === "tool_use");
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error("generateAiArticleDraft: AI가 도구를 호출하지 않았습니다.");
  }

  const input = toolUseBlock.input as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  let content = typeof input.content === "string" ? input.content.trim() : "";

  if (!title || !content) {
    throw new Error("generateAiArticleDraft: AI 응답에 title 또는 content가 없습니다.");
  }

  // AEO 핵심 필드다 — title/content와 동일하게 누락 시 명확히 실패시킨다
  // (조용히 빈 문자열로 채우면 "직접 답변"이 없는 글이 그대로 저장될 수 있다).
  const answerSummary = typeof input.answerSummary === "string" ? input.answerSummary.trim() : "";
  if (!answerSummary) {
    throw new Error("generateAiArticleDraft: AI 응답에 answerSummary가 없습니다.");
  }

  const citedSourceIds = Array.isArray(input.citedSourceIds)
    ? input.citedSourceIds.filter((id): id is string => typeof id === "string")
    : [];

  content = ensureCoreAnswerInContent(content, answerSummary);
  content = stripDisallowedAdCode(content);
  const { content: contentWithAllSlots, adSlots } = ensureAdSlotMarkers(content);
  content = contentWithAllSlots;

  const internalLinkSuggestions: InternalLinkSuggestion[] = Array.isArray(input.internalLinkSuggestions)
    ? input.internalLinkSuggestions
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          title: typeof item.title === "string" ? item.title : "",
          reason: typeof item.reason === "string" ? item.reason : "",
        }))
    : [];

  const clampScore = (value: unknown): number => {
    const num = typeof value === "number" ? value : 0;
    return Math.max(0, Math.min(100, Math.round(num)));
  };

  const targetKeyword =
    typeof input.targetKeyword === "string" && input.targetKeyword.trim()
      ? input.targetKeyword
      : theme.keywords[0] || theme.title;
  const monetizationScore = clampScore(input.monetizationScore);
  const policyRiskScore = clampScore(input.policyRiskScore);

  return {
    title,
    content,
    citedSourceIds,
    answerSummary,
    seoTitle: typeof input.seoTitle === "string" ? input.seoTitle : title,
    metaDescription: typeof input.metaDescription === "string" ? input.metaDescription : "",
    // AI가 targetKeyword를 누락하거나 빈 문자열로 응답해도 완전히 비지 않도록
    // theme 키워드/제목으로 fallback한다 (target_keyword 누락 방지).
    targetKeyword,
    secondaryKeywords: Array.isArray(input.secondaryKeywords)
      ? input.secondaryKeywords.filter((k): k is string => typeof k === "string")
      : [],
    searchIntent: typeof input.searchIntent === "string" ? input.searchIntent : "",
    readerPersona: typeof input.readerPersona === "string" ? input.readerPersona : "",
    adSlots,
    internalLinkSuggestions,
    monetizationScore,
    policyRiskScore,
    eeatNotes: parseEeatNotes(input.eeatNotes),
    readerQuestions: parseReaderQuestions(input.readerQuestions),
    geoSummary: parseGeoSummary(input.geoSummary),
    structuredDataSuggestions: parseStructuredDataSuggestions(input.structuredDataSuggestions),
    qualityWarnings: assessMonetizedBlogQuality(content, answerSummary, targetKeyword, policyRiskScore),
  };
}

function buildKoreanSections(theme: Theme, sources: Source[]): string[] {
  const keywordStr = theme.keywords.length > 0 ? theme.keywords.join(", ") : "";
  const desc = theme.description || `${theme.title}에 대한 최신 동향`;

  const titleSection = `# ${theme.title}`;

  const lead = [
    "## 리드문",
    `${desc} ${sources.length}개 출처를 분석해 핵심 내용을 정리했다.` +
      " 이 초안은 AI 평가와 사용자 검토를 거쳐야 최종 승인된다.",
  ].join("\n");

  const background = [
    "## 배경",
    `"${theme.title}"는 최근 주목받는 주제다.` +
      (keywordStr ? ` 이 기사는 ${keywordStr} 등 핵심 키워드를 중심으로 구성했다.` : "") +
      ` 등록된 ${sources.length}개 출처는 이 주제의 다양한 측면을 다루고 있다.`,
  ].join("\n");

  const issueParts = sources.slice(0, 3).map((s) => {
    const point = s.keyPoints?.[0] || s.summary?.substring(0, 80) || "(내용 없음)";
    return `- **${s.title || s.url}**: ${point}`;
  });
  const issues = ["## 핵심 쟁점", ...issueParts].join("\n");

  const comparison = [
    "## 출처 간 비교",
    sources.length >= 2
      ? `${sources.length}개 출처가 공통적으로 다루는 핵심 사안과 각 출처의 관점 차이를 비교했다.` +
        " 출처마다 강조점이 다르며, 이러한 차이는 주제를 다각도로 이해하는 데 도움이 된다."
      : "비교를 위해 최소 2개 이상의 출처가 필요하다.",
  ].join("\n");

  const significance = [
    "## 독자에게 중요한 의미",
    "이 주제는 독자의 일상 또는 업무와 직결될 수 있다." +
      " 출처들이 공통으로 지적하는 변화와 시사점을 주의 깊게 살펴볼 필요가 있다.",
  ].join("\n");

  const outlook = [
    "## 향후 전망 또는 과제",
    `현재까지 확인된 사실을 바탕으로 볼 때 "${theme.title}" 분야는 지속적인 변화가 예상된다.` +
      " 구체적인 전망은 추가 출처와 전문가 검토를 거쳐 보완될 필요가 있다.",
    "",
    "> ⚠️ 이 초안은 mock article generator가 자동 생성한 draft입니다." +
      " AI 평가와 사용자 승인을 거쳐야 reviewed 상태로 전환됩니다.",
  ].join("\n");

  return [titleSection, lead, background, issues, comparison, significance, outlook];
}

function buildEnglishSections(theme: Theme, sources: Source[]): string[] {
  const keywordStr = theme.keywords.length > 0 ? theme.keywords.join(", ") : "";
  const desc = theme.description || `The latest trends in ${theme.title}`;

  const titleSection = `# ${theme.title}`;

  const lead = [
    "## Lead",
    `${desc} This draft synthesizes ${sources.length} registered sources and must pass AI evaluation and human review before publication.`,
  ].join("\n");

  const background = [
    "## Background",
    `"${theme.title}" is a topic that has been gaining attention recently.` +
      (keywordStr ? ` Key topics include: ${keywordStr}.` : "") +
      ` The ${sources.length} registered sources cover various aspects of this subject.`,
  ].join("\n");

  const issueParts = sources.slice(0, 3).map((s) => {
    const point = s.keyPoints?.[0] || s.summary?.substring(0, 80) || "(no content)";
    return `- **${s.title || s.url}**: ${point}`;
  });
  const issues = ["## Key Issues", ...issueParts].join("\n");

  const comparison = [
    "## Comparison Across Sources",
    sources.length >= 2
      ? `Among the ${sources.length} sources, common themes and differing emphases have been identified.` +
        " These differences help illuminate the topic from multiple angles."
      : "At least 2 sources are required for comparison.",
  ].join("\n");

  const significance = [
    "## Why This Matters to Readers",
    "This topic may have direct relevance to readers' daily lives or professional work." +
      " The key changes and implications highlighted by the sources deserve careful attention.",
  ].join("\n");

  const outlook = [
    "## Outlook or Open Questions",
    `Based on what has been confirmed so far, "${theme.title}" is expected to continue evolving.` +
      " Specific forecasts should be supplemented with additional sources and expert review.",
    "",
    "> ⚠️ This draft was auto-generated by the mock article generator." +
      " It must pass AI evaluation and human approval before transitioning to reviewed status.",
  ].join("\n");

  return [titleSection, lead, background, issues, comparison, significance, outlook];
}
