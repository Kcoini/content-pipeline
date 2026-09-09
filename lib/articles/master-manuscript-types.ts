// Phase 4-2: "마스터 원고 중심" 구조 전환 — 2차(platformBrief 구조화).
// Phase 3-27(재): 마스터 원고 생성 전략 고도화 — 사실/해석 분리,
// 장문 대응(longFormSupport), EEAT/SEO/AEO/GEO/AGENT 대응 재료
// (optimizationSupport)를 추가했다.
//
// 마스터 원고는 최종 게시글이 아니라, 각 플랫폼 글을 만들기 위한
// 출처 기반 "편집 자료"다. 이 파일은 그 편집 자료의 타입만 정의한다
// (생성 로직은 master-manuscript-builder.ts, 저장은 기존
// articles.format_metadata.master_manuscript 재사용 — 새 테이블/컬럼
// 없음).

/** 확인된 사실의 신뢰도 — 출처 개수/명시적 수치 여부로 기계적으로 판단한다(AI 주관 판단 아님). */
export type FactConfidence = "high" | "medium" | "low";

export interface MasterManuscriptSourceSummary {
  sourceId: string;
  title: string;
  publisher: string;
  publishedAt: string;
  url: string;
  /** 출처 요약(이미 저장된 Source.summary 재사용 — 원문 전체를 복사하지 않는다). */
  summary: string;
  /** 이 출처가 뒷받침하는 핵심 포인트(Source.keyPoints 재사용) — "이 출처로 무엇을 말할 수 있는지". */
  supports: string[];
  /** 이 출처에서 실제로 확인된 사실만(Source.keyPoints와 동일한 재료지만, "확인된 사실"이라는 의미로 다시 노출한다). */
  verifiedFacts: string[];
  /** 이 출처를 쓸 때 주의할 점(발행일 누락 등, 기계적으로 판단 가능한 것만). */
  cautions: string[];
  /** 신뢰도/한계에 대한 짧은 메모(발행처/발행일 존재 여부 기준 — 주관적 신뢰도 평가가 아니다). */
  reliabilityNote: string;
}

export interface MasterManuscriptVerifiedFact {
  fact: string;
  sourceIds: string[];
  confidence: FactConfidence;
}

/** 사실과 해석을 구분해서 담는다 — 해석/전망을 사실처럼 쓰지 않기 위한 구조. */
export interface MasterManuscriptFactInterpretation {
  fact: string;
  /** 이 사실이 시사하는 바(사람이 다듬어 쓰는 것을 전제로 한 초안 — 사실이 아니라 해석임을 항상 명시한다). */
  interpretation: string;
  sourceIds: string[];
  /** 해석이 전망/추측에 가까울 때 붙이는 주의 문구. */
  caution: string;
}

export interface MasterManuscriptTitleCandidates {
  neutral: string;
  explainer: string;
  seo: string;
  socialHook: string;
  cafeQuestion: string;
  newsArticle: string;
}

export interface MasterManuscriptProhibitedExpressions {
  /** 모든 플랫폼 공통 금지 표현(BASE_PROHIBITED_PATTERNS 재사용). */
  prohibited: string[];
  /** 금지까지는 아니지만 플랫폼별로 주의해서 써야 하는 표현. */
  careful: string[];
}

/** 언론 기사(news_article, 3차에서 플랫폼으로 추가 예정)용 brief. 타입은 미리 정의해 두되 아직 사용하는 생성기는 없다. */
export interface NewsArticleBrief {
  angle: string;
  leadPoints: string[];
  factsToUse: string[];
  avoid: string[];
}

export interface WordPressBlogBrief {
  seoKeywords: string[];
  searchIntent: string | null;
  faqCandidates: string[];
  tableCandidates: string[];
  checklistCandidates: string[];
  longFormPoints: string[];
}

export interface NaverBlogBrief {
  easyExplanationPoints: string[];
  mobileParagraphPoints: string[];
  friendlyIntroIdeas: string[];
}

export interface NaverCafeBrief {
  empathyLines: string[];
  discussionQuestions: string[];
  commentPrompts: string[];
  safeDebatePoints: string[];
}

export interface ShortSocialBrief {
  oneLineSummary: string;
  hookLines: string[];
  threadPoints: string[];
}

export interface InstagramBrief {
  cardTitle: string;
  cardTexts: string[];
  captionSummary: string;
  hashtags: string[];
}

export interface MasterManuscriptPlatformBriefs {
  newsArticle: NewsArticleBrief;
  wordpressBlog: WordPressBlogBrief;
  naverBlog: NaverBlogBrief;
  naverCafe: NaverCafeBrief;
  shortSocial: ShortSocialBrief;
  instagram: InstagramBrief;
}

// ---------------------------------------------------------------------------
// 장문 대응(longFormSupport) — 언론 기사/수익형 블로그처럼 긴 글에
// 필요한 설계도. 짧은 SNS 글 생성에는 이 구조를 전달하지 않는다
// (lib/articles/master-manuscript-builder.ts의 getPlatformBrief가
// 플랫폼별로 필요한 조각만 골라준다).
// ---------------------------------------------------------------------------

/** 언론 기사(news_article) 전용 장문 설계. */
export interface NewsArticleExpansion {
  angle: string;
  titleCandidates: string[];
  subtitleCandidates: string[];
  leadCore: string;
  fiveWOneH: { who: string; when: string; where: string; what: string; how: string; why: string };
  bodyStructure: string[];
  background: string;
  stakeholderPositions: string[];
  keyIssues: string[];
  futureChecks: string[];
  sourcesToUse: string[];
  expressionsToAvoid: string[];
}

/** 수익형 블로그(monetized_blog 방향/wordpress_blog) 전용 장문 설계. */
export interface MonetizedBlogExpansion {
  searchIntent: string | null;
  audience: string;
  primaryKeyword: string | null;
  secondaryKeywords: string[];
  titleCandidates: string[];
  metaDescriptionCandidates: string[];
  introDirection: string;
  headingPlan: string[];
  summaryBoxPoints: string[];
  comparisonTableCandidates: string[];
  checklistCandidates: string[];
  faqCandidates: string[];
  cautionNotes: string[];
  internalLinkCandidates: string[];
  adSlotCandidates: string[];
  dwellTimePoints: string[];
  sourceCitationStyle: string;
}

export interface MasterManuscriptEvidenceMapEntry {
  claim: string;
  sourceIds: string[];
}

export interface LongFormSupport {
  /** 이 주제/출처 수로 적절한 글 길이(사람이 읽는 설명, raw 숫자만이 아니다). */
  recommendedLength: string;
  /** 긴 글을 쓰기에 출처가 충분한지("충분"/"보통"/"부족" + 근거). */
  sourceSufficiency: string;
  /** 긴 글의 섹션(H2/H3 또는 기사 문단) 구성. */
  sectionPlan: string[];
  /** 각 문단에서 말할 핵심 내용. */
  paragraphPoints: string[];
  /** 어떤 주장에 어떤 출처를 쓸지 매핑. */
  evidenceMap: MasterManuscriptEvidenceMapEntry[];
  /** 내용을 더 깊게 확장할 수 있는 설명 포인트(확인 필요 사항 기반). */
  expansionNotes: string[];
  /** 독자가 이해하기 쉬운 예시(출처 기반 재료가 없으면 빈 배열 — 지어내지 않는다). */
  examplesAndAnalogies: string[];
  /** 표/비교표/체크리스트 후보. */
  tablesAndLists: string[];
  /** FAQ 후보. */
  faqBank: string[];
  /** 주의사항/단정 금지 표현. */
  cautionBank: string[];
  newsArticleExpansion: NewsArticleExpansion;
  monetizedBlogExpansion: MonetizedBlogExpansion;
}

// ---------------------------------------------------------------------------
// EEAT/SEO/AEO/GEO/AGENT 대응 재료(optimizationSupport) — 각각을
// 장황한 글로 만들지 않고, 플랫폼별 글 생성에 재료로 쓸 수 있게
// 구조화한다.
// ---------------------------------------------------------------------------

export interface EeatNotes {
  trustedSources: string[];
  hasOfficialSource: boolean;
  hasExpertSource: boolean;
  factInterpretationNote: string;
  needsReferenceDate: boolean;
  limitations: string[];
  sourceGaps: string[];
}

export interface SeoSupport {
  primaryKeyword: string | null;
  secondaryKeywords: string[];
  searchIntent: string | null;
  readerQuestions: string[];
  headingIdeas: string[];
  metaDescriptionIdeas: string[];
  internalLinkIdeas: string[];
}

export interface AeoSupport {
  mainQuestion: string;
  shortAnswer: string;
  faqCandidates: string[];
  misunderstoodPoints: string[];
  answerSummary: string;
  directAnswerCandidates: string[];
}

export interface GeoSupport {
  aiSummary: string;
  keyFacts: string[];
  sourceBackedClaims: string[];
  caveats: string[];
  referenceDate: string;
  quotableSummary: string;
  uncertaintyNotes: string[];
}

export interface AgentReadiness {
  topic: string;
  entityMap: string[];
  factList: string[];
  sourceMap: { sourceId: string; title: string; url: string }[];
  actionItems: string[];
  verificationChecklist: string[];
  nextActions: string[];
  structuredSummary: string;
}

export interface OptimizationSupport {
  eeatNotes: EeatNotes;
  seoSupport: SeoSupport;
  aeoSupport: AeoSupport;
  geoSupport: GeoSupport;
  agentReadiness: AgentReadiness;
}

export interface MasterManuscript {
  theme: {
    title: string;
    topic: string;
    audience: string;
    purpose: string;
    /** 수치/정책/날짜 정보의 기준일(article.createdAt 재사용). */
    referenceDate: string;
    /** 지역/국가 범위(확인 가능한 정보가 없으면 "확인 필요"). */
    region: string;
    /** 주제 유형(article.articleMode를 사람이 읽는 문구로 다시 표현한 것). */
    topicType: string;
  };
  sourceSummaries: MasterManuscriptSourceSummary[];
  verifiedFacts: MasterManuscriptVerifiedFact[];
  /** 사실과 해석을 분리해서 담는다 — verifiedFacts 각각에 대응한다. */
  factInterpretationSplit: MasterManuscriptFactInterpretation[];
  mainMessage: string;
  supportingMessages: string[];
  background: string;
  verificationNeeded: string[];
  prohibitedOrCarefulExpressions: MasterManuscriptProhibitedExpressions;
  titleCandidates: MasterManuscriptTitleCandidates;
  platformBriefs: MasterManuscriptPlatformBriefs;
  /** 긴 글(언론 기사/수익형 블로그) 대응 설계도. */
  longFormSupport: LongFormSupport;
  /** EEAT/SEO/AEO/GEO/AGENT 대응 재료. */
  optimizationSupport: OptimizationSupport;
  /** 마스터 원고 자체의 자동 검토 기준(사람이 읽는 문장) — lib/articles/master-manuscript-review.ts가 사용한다. */
  autoReviewCriteria: string[];
  /** 이 마스터 원고를 만든 원고 생성 방향(내부 ArticleMode 값 그대로 — UI 라벨은 별도). */
  generatedFromMode: string;
  /** 계산 시각(항상 다시 계산할 수 있는 파생 데이터이므로 캐시 무효화 판단에만 쓴다). */
  builtAt: string;
}
