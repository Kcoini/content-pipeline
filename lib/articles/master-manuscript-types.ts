// Phase 4-2: "마스터 원고 중심" 구조 전환 — 2차(platformBrief 구조화).
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
  /** 이 출처가 뒷받침하는 핵심 포인트(Source.keyPoints 재사용). */
  supports: string[];
}

export interface MasterManuscriptVerifiedFact {
  fact: string;
  sourceIds: string[];
  confidence: FactConfidence;
}

export interface MasterManuscriptTitleCandidates {
  neutral: string;
  explainer: string;
  seo: string;
  socialHook: string;
  cafeQuestion: string;
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

export interface MasterManuscript {
  theme: {
    title: string;
    topic: string;
    audience: string;
    purpose: string;
    /** 수치/정책/날짜 정보의 기준일(article.createdAt 재사용). */
    referenceDate: string;
  };
  sourceSummaries: MasterManuscriptSourceSummary[];
  verifiedFacts: MasterManuscriptVerifiedFact[];
  mainMessage: string;
  supportingMessages: string[];
  background: string;
  verificationNeeded: string[];
  prohibitedOrCarefulExpressions: MasterManuscriptProhibitedExpressions;
  titleCandidates: MasterManuscriptTitleCandidates;
  platformBriefs: MasterManuscriptPlatformBriefs;
  /** 마스터 원고 자체의 자동 검토 기준(사람이 읽는 문장) — lib/articles/master-manuscript-review.ts가 사용한다. */
  autoReviewCriteria: string[];
  /** 이 마스터 원고를 만든 원고 생성 방향(내부 ArticleMode 값 그대로 — UI 라벨은 별도). */
  generatedFromMode: string;
  /** 계산 시각(항상 다시 계산할 수 있는 파생 데이터이므로 캐시 무효화 판단에만 쓴다). */
  builtAt: string;
}
