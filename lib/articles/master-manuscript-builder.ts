// Phase 4-2: "마스터 원고 중심" 구조 전환 — 2차(platformBrief 구조화).
//
// 핵심 설계 결정: 마스터 원고를 만들기 위해 AI를 다시 호출하지 않는다.
// article은 이미 Phase 1-3~2-24의 생성 파이프라인이 만든 결과물이고,
// 그 article과 이미 저장된 출처(summary/keyPoints)만으로 구조화된
// 편집 자료를 결정적으로(순수 함수로) 계산할 수 있다. 이렇게 하면
// - 새 AI 호출 비용이 추가되지 않는다("16. 비용 최적화 원칙"과도
//   부합한다 — 4차 범위를 앞당겨 지키는 셈이다).
// - 기존 article 생성 로직(lib/ai/article-writer.ts)을 전혀 건드리지
//   않는다.
// - 항상 최신 article/source 데이터로 다시 계산되는 파생 데이터라서
//   별도 동기화 문제가 없다.
//
// 이 파일은 순수 함수만 담는다 — DB 접근은 caller(action)가 한다.

import type { Article, Source } from "@/lib/types/domain";
import { BASE_PROHIBITED_PATTERNS } from "@/lib/social/platform-writing-config";
import type { SocialPlatform } from "@/lib/social/social-platform-types";
import type {
  MasterManuscript,
  MasterManuscriptSourceSummary,
  MasterManuscriptVerifiedFact,
  MasterManuscriptPlatformBriefs,
} from "./master-manuscript-types";

/** 플랫폼별로 "주의해서 써야 하는" 표현(차단은 아니지만 확인이 필요한 수준). */
const CAREFUL_EXPRESSIONS: readonly string[] = [
  "단정적 전망 표현",
  "과장된 수익/효과 보장",
  "낚시성 제목",
  "확인되지 않은 수치 단정",
  "감정적 표현 과다",
];

/** 마스터 원고 자체의 자동 검토 기준(섹션 11 — 사람이 읽는 문장). */
const MASTER_MANUSCRIPT_AUTO_REVIEW_CRITERIA: readonly string[] = [
  "출처가 있는가",
  "출처별 요약이 있는가",
  "확인된 사실과 해석이 분리되어 있는가",
  "확인 필요 사항이 있는가",
  "플랫폼별 brief가 생성되었는가",
  "금지/주의 표현이 포함되어 있는가",
  "출처 없는 수치 단정이 없는가",
  "플랫폼별 변환에 필요한 재료가 충분한가",
];

// Phase 4-4: 비용 최적화 — 출처 수가 많은 article이라도 마스터
// 원고(그리고 그로부터 파생되는 platformBrief/prompt)가 무한정 커지지
// 않도록 상한을 둔다. 이 상한을 넘는 나머지 출처는 요약/사실 추출에서
// 제외될 뿐, sources 테이블 자체에는 영향이 없다(출처 자체는 지워지지
// 않는다).
const MAX_SOURCE_SUMMARIES_IN_MASTER_MANUSCRIPT = 10;
const MAX_VERIFIED_FACTS_IN_MASTER_MANUSCRIPT = 20;

function buildSourceSummaries(sources: readonly Source[]): MasterManuscriptSourceSummary[] {
  return sources
    .filter((s) => s.summary.trim().length > 0 || s.keyPoints.length > 0)
    .slice(0, MAX_SOURCE_SUMMARIES_IN_MASTER_MANUSCRIPT)
    .map((s) => ({
      sourceId: s.id,
      title: s.title || s.url,
      publisher: s.publisher,
      publishedAt: s.publishedAt,
      url: s.url,
      summary: s.summary,
      supports: s.keyPoints,
    }));
}

/**
 * 같은 keyPoint 문장이 여러 출처에 등장하면 confidence를 높인다(교차
 * 확인된 사실로 취급) — AI의 주관적 판단이 아니라 출처 개수로만
 * 기계적으로 결정한다.
 */
function buildVerifiedFacts(sources: readonly Source[]): MasterManuscriptVerifiedFact[] {
  const bySentence = new Map<string, Set<string>>();
  for (const source of sources) {
    for (const point of source.keyPoints) {
      const key = point.trim();
      if (!key) continue;
      if (!bySentence.has(key)) bySentence.set(key, new Set());
      bySentence.get(key)!.add(source.id);
    }
  }

  return Array.from(bySentence.entries())
    .slice(0, MAX_VERIFIED_FACTS_IN_MASTER_MANUSCRIPT)
    .map(([fact, sourceIdSet]) => ({
      fact,
      sourceIds: Array.from(sourceIdSet),
      confidence: sourceIdSet.size >= 2 ? "high" : "medium",
    }));
}

export function buildMasterManuscript(article: Article, sources: readonly Source[]): MasterManuscript {
  const sourceSummaries = buildSourceSummaries(sources);
  const verifiedFacts = buildVerifiedFacts(sources);
  const supportingMessages = verifiedFacts.slice(0, 3).map((f) => f.fact);

  // "확인 필요 사항": 단일 출처에서만 확인된 사실(교차 확인이 안 된 것) +
  // 출처 자체가 부족하면 그 사실도 함께 안내한다.
  const verificationNeeded: string[] = verifiedFacts
    .filter((f) => f.confidence === "medium")
    .slice(0, 5)
    .map((f) => `"${f.fact}" — 출처 1건에서만 확인됨, 교차 확인이 필요합니다.`);
  if (sourceSummaries.length < 3) {
    verificationNeeded.push(`현재 확인 가능한 출처가 ${sourceSummaries.length}건뿐입니다 — 추가 출처 확인을 권장합니다.`);
  }

  const mainMessage = article.title;
  const background =
    supportingMessages.length > 0
      ? `"${article.title}" 관련 주요 내용은 다음과 같다: ${supportingMessages.join(" ")}`
      : `"${article.title}"에 대해 등록된 출처 ${sourceSummaries.length}건을 바탕으로 정리했다.`;

  const targetKeyword = article.targetKeyword ?? null;
  const keywords = [targetKeyword, ...article.secondaryKeywords].filter((k): k is string => Boolean(k));

  const platformBriefs: MasterManuscriptPlatformBriefs = {
    newsArticle: {
      angle: "사실 전달 · 중립적 설명",
      leadPoints: supportingMessages,
      factsToUse: verifiedFacts.map((f) => f.fact),
      avoid: [...CAREFUL_EXPRESSIONS],
    },
    wordpressBlog: {
      seoKeywords: keywords,
      searchIntent: article.searchIntent,
      faqCandidates: verificationNeeded,
      tableCandidates: verifiedFacts.slice(0, 5).map((f) => f.fact),
      checklistCandidates: verificationNeeded,
      longFormPoints: supportingMessages,
    },
    naverBlog: {
      easyExplanationPoints: supportingMessages,
      mobileParagraphPoints: sourceSummaries.slice(0, 3).map((s) => s.summary).filter(Boolean),
      friendlyIntroIdeas: [`"${article.title}" 관련 소식을 쉽게 풀어드릴게요.`],
    },
    naverCafe: {
      empathyLines: [`"${article.title}" 소식, 다들 어떻게 보고 계세요?`],
      discussionQuestions: [`${article.title}에 대해 여러분은 어떻게 생각하시나요?`],
      commentPrompts: ["비슷한 경험이 있으신가요?", "여러분 생각은 어떠세요?"],
      safeDebatePoints: verificationNeeded,
    },
    shortSocial: {
      oneLineSummary: mainMessage.slice(0, 80),
      hookLines: [`${article.title}, 지금 확인해야 하는 이유`],
      threadPoints: supportingMessages,
    },
    instagram: {
      cardTitle: article.title.slice(0, 40),
      cardTexts: supportingMessages.slice(0, 3),
      captionSummary: mainMessage,
      hashtags: keywords.slice(0, 5),
    },
  };

  return {
    theme: {
      title: article.title,
      topic: article.title,
      audience: "일반 독자",
      purpose: "출처 기반 정보 전달",
      referenceDate: article.createdAt.slice(0, 10),
    },
    sourceSummaries,
    verifiedFacts,
    mainMessage,
    supportingMessages,
    background,
    verificationNeeded,
    prohibitedOrCarefulExpressions: {
      prohibited: [...BASE_PROHIBITED_PATTERNS],
      careful: [...CAREFUL_EXPRESSIONS],
    },
    titleCandidates: {
      neutral: article.title,
      explainer: `${article.title}, 무엇이 핵심인가`,
      seo: article.seoTitle ?? article.title,
      socialHook: `${article.title}, 꼭 알아야 할 이유`,
      cafeQuestion: `${article.title}, 여러분의 생각은 어떠신가요?`,
    },
    platformBriefs,
    autoReviewCriteria: [...MASTER_MANUSCRIPT_AUTO_REVIEW_CRITERIA],
    generatedFromMode: article.articleMode,
    builtAt: new Date().toISOString(),
  };
}

/** 플랫폼(SocialPlatform) → platformBriefs의 어느 필드를 쓸지 매핑한다. */
const BRIEF_KEY_BY_PLATFORM: Record<SocialPlatform, keyof MasterManuscriptPlatformBriefs> = {
  news_article: "newsArticle",
  wordpress_blog: "wordpressBlog",
  naver_blog: "naverBlog",
  naver_cafe: "naverCafe",
  x: "shortSocial",
  threads: "shortSocial",
  instagram: "instagram",
};

/**
 * 플랫폼별 글 생성에 필요한 brief "만" 추출한다 — 마스터 원고 전체
 * (다른 플랫폼 brief, 전체 sourceSummaries 등)를 프롬프트에 넣지
 * 않기 위한 진입점이다.
 */
export function getPlatformBrief<K extends keyof MasterManuscriptPlatformBriefs>(
  master: Pick<MasterManuscript, "platformBriefs">,
  platform: SocialPlatform
): MasterManuscriptPlatformBriefs[K] {
  const key = BRIEF_KEY_BY_PLATFORM[platform] as K;
  return master.platformBriefs[key];
}
