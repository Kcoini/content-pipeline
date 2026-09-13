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
import { getMasterManuscriptDirectionLabel } from "./article-modes";
import type { SocialPlatform } from "@/lib/social/social-platform-types";
import type {
  MasterManuscript,
  MasterManuscriptSourceSummary,
  MasterManuscriptVerifiedFact,
  MasterManuscriptFactInterpretation,
  MasterManuscriptFactType,
  MasterManuscriptEvidenceEntry,
  MasterManuscriptIssueEntry,
  MasterManuscriptPlatformBriefs,
  LongFormSupport,
  OptimizationSupport,
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
  "각 사실에 sourceId가 연결되어 있는가",
  "확인 필요 사항이 있는가",
  "금지/주의 표현이 포함되어 있는가",
  "플랫폼별 brief가 생성되었는가",
  "장문 글 설계도(longFormSupport)가 있는가",
  "evidenceMap이 있는가",
  "SEO/AEO/GEO/AGENT 재료(optimizationSupport)가 있는가",
  "출처 없는 수치 단정이 없는가",
  "확인 필요 사항이 사실로 처리되지 않았는가",
  "플랫폼별 변환에 필요한 재료가 충분한가",
];

// Phase 4-4: 비용 최적화 — 출처 수가 많은 article이라도 마스터
// 원고(그리고 그로부터 파생되는 platformBrief/prompt)가 무한정 커지지
// 않도록 상한을 둔다. 이 상한을 넘는 나머지 출처는 요약/사실 추출에서
// 제외될 뿐, sources 테이블 자체에는 영향이 없다(출처 자체는 지워지지
// 않는다).
const MAX_SOURCE_SUMMARIES_IN_MASTER_MANUSCRIPT = 10;
const MAX_VERIFIED_FACTS_IN_MASTER_MANUSCRIPT = 20;

/**
 * 출처별 "이 출처로 무엇을 말할 수 있는지"를 정리한다. 신뢰도/주의점은
 * 주관적으로 판단하지 않고, 발행처·발행일이 실제로 채워져 있는지 같은
 * 기계적으로 확인 가능한 조건만으로 계산한다.
 */
function buildSourceSummaries(sources: readonly Source[]): MasterManuscriptSourceSummary[] {
  return sources
    .filter((s) => s.summary.trim().length > 0 || s.keyPoints.length > 0)
    .slice(0, MAX_SOURCE_SUMMARIES_IN_MASTER_MANUSCRIPT)
    .map((s) => {
      const cautions: string[] = [];
      if (!s.publisher.trim()) cautions.push("발행처 정보가 없습니다 — 출처 신뢰도 확인이 필요합니다.");
      if (!s.publishedAt.trim()) cautions.push("발행일 정보가 없습니다 — 최신 정보인지 확인이 필요합니다.");

      const reliabilityNote =
        s.publisher.trim() && s.publishedAt.trim()
          ? "발행처와 발행일이 모두 확인됩니다."
          : s.publisher.trim()
            ? "발행처는 확인되지만 발행일이 없어 최신성 확인이 필요합니다."
            : s.publishedAt.trim()
              ? "발행일은 확인되지만 발행처가 없어 출처 신뢰도 확인이 필요합니다."
              : "발행처/발행일이 모두 확인되지 않아 신뢰도 확인이 필요합니다.";

      return {
        sourceId: s.id,
        title: s.title || s.url,
        publisher: s.publisher,
        publishedAt: s.publishedAt,
        url: s.url,
        summary: s.summary,
        supports: s.keyPoints,
        verifiedFacts: s.keyPoints,
        cautions,
        reliabilityNote,
      };
    });
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
      factType: classifyFactType(fact),
    }));
}

/** 단독 연도(2020~2029)/월일 표현이 있는지. */
const DATE_PATTERN = /\d{4}년|\d{1,2}월\s*\d{1,2}일|20\d{2}[.\-/]\d{1,2}([.\-/]\d{1,2})?/;
/** 퍼센트/금액/건수 등 명시적 수치. */
const NUMBER_PATTERN = /\d+(\.\d+)?\s*(%|퍼센트|원|건|명|배|위|점)/;
/** 정부/공공기관/기업/단체로 흔히 쓰이는 접미사. */
const ORGANIZATION_PATTERN = /(부|청|처|위원회|협회|공단|공사|재단|연구원|대학교|은행|그룹|㈜|주식회사)(은|는|이|가|의|을|를)?/;
/** 정책/제도 관련 표현. */
const POLICY_PATTERN = /(정책|제도|법안|규제|지원금|시행령|고시|가이드라인)/;
/** 사건/발표/행사성 표현. */
const EVENT_PATTERN = /(발표했|출시했|개최했|시작했|도입했|발생했|열렸다)/;

/**
 * 사실 문장을 정규식만으로 date/number/organization/policy/event/claim/
 * other 중 하나로 분류한다 — AI 판단이 아니라 기계적 패턴 매칭이다.
 * 여러 패턴에 걸치면 더 구체적인 것(date > number > organization >
 * policy > event) 순으로 우선한다.
 */
function classifyFactType(fact: string): MasterManuscriptFactType {
  if (DATE_PATTERN.test(fact)) return "date";
  if (NUMBER_PATTERN.test(fact)) return "number";
  if (ORGANIZATION_PATTERN.test(fact)) return "organization";
  if (POLICY_PATTERN.test(fact)) return "policy";
  if (EVENT_PATTERN.test(fact)) return "event";
  return fact.trim().length > 0 ? "claim" : "other";
}

/**
 * verifiedFacts 각각에 "해석" 자리를 만들어 사실과 분리한다. rule-based
 * 계산이라 실제로 통찰력 있는 해석을 쓸 수는 없다 — 대신 "이 사실이
 * 무엇을 시사하는지는 플랫폼별 글 작성 시 사람이 채워야 한다"는
 * 사실을 명시적으로 드러내는 초안만 만든다(없는 해석을 지어내지
 * 않는다는 원칙을 지키기 위한 선택이다).
 */
function buildFactInterpretationSplit(
  verifiedFacts: readonly MasterManuscriptVerifiedFact[]
): MasterManuscriptFactInterpretation[] {
  return verifiedFacts.map((f) => ({
    fact: f.fact,
    interpretation: `이 사실이 독자에게 어떤 의미인지는 아직 해설되지 않았습니다 — 플랫폼별 글 작성 시 배경/쟁점과 연결해 해석을 추가하세요.`,
    sourceIds: f.sourceIds,
    caution: f.confidence === "medium" ? "출처 1건에서만 확인된 사실이라 해석도 신중하게 다뤄야 합니다." : "",
  }));
}

/**
 * Phase 4-8: 최상위 evidenceMap — 각 확인된 사실을 "주장"으로 보고
 * 뒷받침 출처/강도/주의사항을 함께 담는다. confidence(출처 개수 기반)를
 * 그대로 strength로 옮기고, factInterpretationSplit의 caution을
 * 재사용한다(새로 지어내지 않는다).
 */
function buildEvidenceMap(
  verifiedFacts: readonly MasterManuscriptVerifiedFact[],
  factInterpretationSplit: readonly MasterManuscriptFactInterpretation[]
): MasterManuscriptEvidenceEntry[] {
  const cautionByFact = new Map(factInterpretationSplit.map((f) => [f.fact, f.caution]));

  return verifiedFacts.map((f) => ({
    claim: f.fact,
    supportingSourceIds: f.sourceIds,
    strength: f.confidence === "high" ? "strong" : f.confidence === "medium" ? "moderate" : "weak",
    caution: cautionByFact.get(f.fact) || "",
  }));
}

/**
 * Phase 4-8: 교차 확인이 안 된(medium confidence) 사실을 "쟁점"으로
 * 재구성한다 — 없는 긍정/부정 시각을 지어내지 않고, "이 사실이
 * 확인되면 근거로 쓸 수 있다"/"교차 확인이 필요하다"는 사실관계
 * 자체를 안내하는 정도로만 채운다. medium confidence 사실이 없으면
 * 상위 확인된 사실 중 일부를 대신 사용한다(항상 빈 배열이 되지 않게).
 */
function buildIssues(verifiedFacts: readonly MasterManuscriptVerifiedFact[]): MasterManuscriptIssueEntry[] {
  const mediumConfidenceFacts = verifiedFacts.filter((f) => f.confidence === "medium").slice(0, 3);
  const source = mediumConfidenceFacts.length > 0 ? mediumConfidenceFacts : verifiedFacts.slice(0, 2);

  return source.map((f) => ({
    issue: f.fact,
    positiveView: `이 사실이 확인되면 "${f.fact}"를 뒷받침하는 근거로 쓸 수 있습니다.`,
    concern:
      f.confidence === "medium"
        ? "출처 1건에서만 확인되어 교차 확인이 필요합니다."
        : "추가 확인 없이 지나치게 단정적으로 쓰지 않는 것이 좋습니다.",
    readerCheckPoint: "다른 출처에서도 같은 내용이 확인되는지 확인하세요.",
    sourceIds: f.sourceIds,
  }));
}

/** Phase 4-8: 핵심 내용이 독자에게 어떤 의미인지 안내하는 문장(지어내지 않고 템플릿으로만 구성). */
function buildReaderMeaning(supportingMessages: readonly string[]): string[] {
  return supportingMessages.map(
    (message) => `"${message}"가 독자의 실제 상황(선택/행동/판단)에 어떤 영향을 주는지 확인해서 반영하세요.`
  );
}

function buildLongFormSupport(
  article: Article,
  sourceSummaries: readonly MasterManuscriptSourceSummary[],
  verifiedFacts: readonly MasterManuscriptVerifiedFact[],
  supportingMessages: string[],
  background: string,
  verificationNeeded: readonly string[],
  careful: readonly string[]
): LongFormSupport {
  const sufficiencyLevel = sourceSummaries.length >= 5 ? "충분" : sourceSummaries.length >= 3 ? "보통" : "부족";
  const recommendedLength =
    sourceSummaries.length >= 5
      ? "장문(2,500~4,000자) — 출처가 충분해 깊이 있는 설명이 가능합니다."
      : sourceSummaries.length >= 3
        ? "중간 분량(1,200~2,000자) — 핵심 내용 위주로 정리하는 것을 권장합니다."
        : "단문(800~1,200자) — 출처가 적어 무리하게 길게 쓰지 않는 것을 권장합니다.";

  const sectionPlan = [
    "도입 및 핵심 요약",
    "배경 설명",
    ...supportingMessages.map((m) => `핵심 내용: ${m}`),
    ...(verificationNeeded.length > 0 ? ["확인 필요 사항"] : []),
    "결론 및 정리",
  ];

  const evidenceMap = verifiedFacts.map((f) => ({ claim: f.fact, sourceIds: f.sourceIds }));

  const expansionNotes = verificationNeeded.map((v) => `다음 내용은 배경/쟁점 설명에서 더 자세히 다루는 것을 권장합니다: ${v}`);

  const tableCandidates = verifiedFacts.slice(0, 5).map((f) => f.fact);
  const faqCandidates = verificationNeeded.map((v) => `확인이 필요합니다: ${v}`);

  const newsArticleExpansion = {
    angle: "사실 전달 · 중립적 설명",
    titleCandidates: [article.title],
    subtitleCandidates: supportingMessages.slice(0, 1),
    leadCore: supportingMessages[0] ?? background,
    fiveWOneH: {
      who: "확인 필요",
      when: article.createdAt.slice(0, 10),
      where: "확인 필요",
      what: supportingMessages[0] ?? article.title,
      how: "확인 필요",
      why: "확인 필요",
    },
    bodyStructure: sectionPlan,
    background,
    stakeholderPositions: [] as string[],
    keyIssues: [] as string[],
    futureChecks: [...verificationNeeded],
    sourcesToUse: sourceSummaries.map((s) => s.sourceId),
    expressionsToAvoid: [...careful],
  };

  const monetizedBlogExpansion = {
    searchIntent: article.searchIntent,
    audience: "일반 독자",
    primaryKeyword: article.targetKeyword,
    secondaryKeywords: [...article.secondaryKeywords],
    titleCandidates: [article.seoTitle ?? article.title],
    metaDescriptionCandidates: article.metaDescription ? [article.metaDescription] : [],
    introDirection: `"${article.title}"를 찾는 독자가 무엇을 궁금해하는지로 도입부를 시작하는 것을 권장합니다.`,
    headingPlan: sectionPlan,
    summaryBoxPoints: supportingMessages,
    comparisonTableCandidates: tableCandidates,
    checklistCandidates: [...verificationNeeded],
    faqCandidates,
    cautionNotes: [...careful],
    internalLinkCandidates: [] as string[],
    adSlotCandidates: ["after_intro", "after_summary", "before_faq", "before_conclusion"],
    dwellTimePoints: supportingMessages,
    sourceCitationStyle: "출처명과 발행일을 본문 또는 참고 자료 섹션에 명시",
  };

  return {
    recommendedLength,
    sourceSufficiency: `${sufficiencyLevel} (출처 ${sourceSummaries.length}건)`,
    sectionPlan,
    paragraphPoints: supportingMessages,
    evidenceMap,
    expansionNotes,
    examplesAndAnalogies: [],
    tablesAndLists: tableCandidates,
    faqBank: faqCandidates,
    cautionBank: [...careful, ...verificationNeeded],
    newsArticleExpansion,
    monetizedBlogExpansion,
  };
}

function buildOptimizationSupport(
  article: Article,
  sourceSummaries: readonly MasterManuscriptSourceSummary[],
  verifiedFacts: readonly MasterManuscriptVerifiedFact[],
  supportingMessages: string[],
  background: string,
  verificationNeeded: readonly string[],
  mainMessage: string,
  referenceDate: string
): OptimizationSupport {
  const trustedSources = sourceSummaries.filter((s) => s.publisher.trim()).map((s) => s.publisher);
  const hasNumericFact = verifiedFacts.some((f) => /\d/.test(f.fact));

  const keywords = [article.targetKeyword, ...article.secondaryKeywords].filter((k): k is string => Boolean(k));

  return {
    eeatNotes: {
      trustedSources,
      hasOfficialSource: trustedSources.some((p) => /(정부|청|부|공식|위원회|협회|공단)/.test(p)),
      hasExpertSource: trustedSources.length > 0,
      factInterpretationNote: "확인된 사실(factInterpretationSplit)과 해석을 항상 구분해서 사용하세요.",
      needsReferenceDate: hasNumericFact,
      limitations: [...verificationNeeded],
      sourceGaps: sourceSummaries.length < 3 ? [`출처가 ${sourceSummaries.length}건뿐입니다 — 추가 확인을 권장합니다.`] : [],
    },
    seoSupport: {
      primaryKeyword: article.targetKeyword,
      secondaryKeywords: [...article.secondaryKeywords],
      searchIntent: article.searchIntent,
      readerQuestions: verificationNeeded.map((v) => `확인이 필요합니다: ${v}`),
      headingIdeas: supportingMessages,
      metaDescriptionIdeas: article.metaDescription ? [article.metaDescription] : [mainMessage.slice(0, 150)],
      internalLinkIdeas: [],
    },
    aeoSupport: {
      mainQuestion: `${article.title}란 무엇인가?`,
      shortAnswer: mainMessage,
      faqCandidates: verificationNeeded.map((v) => `확인이 필요합니다: ${v}`),
      misunderstoodPoints: [...verificationNeeded],
      answerSummary: mainMessage,
      directAnswerCandidates: [...supportingMessages],
    },
    geoSupport: {
      aiSummary: `${mainMessage} ${background}`.slice(0, 300),
      keyFacts: verifiedFacts.map((f) => f.fact),
      sourceBackedClaims: verifiedFacts.filter((f) => f.confidence === "high").map((f) => f.fact),
      caveats: [...verificationNeeded],
      referenceDate,
      quotableSummary: mainMessage,
      uncertaintyNotes: [...verificationNeeded],
    },
    agentReadiness: {
      topic: article.title,
      entityMap: keywords,
      factList: verifiedFacts.map((f) => f.fact),
      sourceMap: sourceSummaries.map((s) => ({ sourceId: s.sourceId, title: s.title, url: s.url })),
      actionItems: [...verificationNeeded],
      verificationChecklist: [...verificationNeeded],
      nextActions: ["플랫폼별 글 생성", "자동 검토 실행", "사람 최종 승인"],
      structuredSummary: mainMessage,
    },
  };
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

  const factInterpretationSplit = buildFactInterpretationSplit(verifiedFacts);

  const platformBriefs: MasterManuscriptPlatformBriefs = {
    newsArticle: {
      angle: "사실 전달 · 중립적 설명",
      leadPoints: supportingMessages,
      factsToUse: verifiedFacts.map((f) => f.fact),
      avoid: [...CAREFUL_EXPRESSIONS],
    },
    // Phase 4-5: 칼럼은 "사실 전달"이 아니라 "관점 전달"이 목적이므로
    // factsToUse 대신 mainMessage/issues/readerMeaning을 채운다.
    // factInterpretationSplit을 그대로 재사용해 "이 재료는 확인된 사실,
    // 이건 해석"이 프롬프트 단계에서부터 구분되게 한다.
    opinionColumn: {
      mainMessage: article.title,
      issues: supportingMessages,
      readerMeaning: `"${article.title}"이 독자에게 어떤 의미인지, 왜 지금 생각해봐야 하는지를 중심으로 쓴다.`,
      factInterpretationSplit,
      limitations: [
        ...verificationNeeded,
        "이 칼럼은 특정 관점을 담은 의견형 글이며, 다른 해석이 있을 수 있다.",
      ],
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

  const referenceDate = article.createdAt.slice(0, 10);
  const careful = [...CAREFUL_EXPRESSIONS];

  return {
    theme: {
      title: article.title,
      topic: article.title,
      audience: "일반 독자",
      purpose: "출처 기반 정보 전달",
      referenceDate,
      region: "확인 필요",
      topicType: getMasterManuscriptDirectionLabel(article.articleMode),
    },
    sourceSummaries,
    verifiedFacts,
    factInterpretationSplit,
    mainMessage,
    supportingMessages,
    background,
    evidenceMap: buildEvidenceMap(verifiedFacts, factInterpretationSplit),
    issues: buildIssues(verifiedFacts),
    readerMeaning: buildReaderMeaning(supportingMessages),
    verificationNeeded,
    prohibitedOrCarefulExpressions: {
      prohibited: [...BASE_PROHIBITED_PATTERNS],
      careful,
    },
    titleCandidates: {
      neutral: article.title,
      explainer: `${article.title}, 무엇이 핵심인가`,
      seo: article.seoTitle ?? article.title,
      socialHook: `${article.title}, 꼭 알아야 할 이유`,
      cafeQuestion: `${article.title}, 여러분의 생각은 어떠신가요?`,
      newsArticle: article.title,
    },
    platformBriefs,
    longFormSupport: buildLongFormSupport(
      article,
      sourceSummaries,
      verifiedFacts,
      supportingMessages,
      background,
      verificationNeeded,
      careful
    ),
    optimizationSupport: buildOptimizationSupport(
      article,
      sourceSummaries,
      verifiedFacts,
      supportingMessages,
      background,
      verificationNeeded,
      mainMessage,
      referenceDate
    ),
    autoReviewCriteria: [...MASTER_MANUSCRIPT_AUTO_REVIEW_CRITERIA],
    generatedFromMode: article.articleMode,
    builtAt: new Date().toISOString(),
  };
}

/** 플랫폼(SocialPlatform) → platformBriefs의 어느 필드를 쓸지 매핑한다. */
const BRIEF_KEY_BY_PLATFORM: Record<SocialPlatform, keyof MasterManuscriptPlatformBriefs> = {
  news_article: "newsArticle",
  opinion_column: "opinionColumn",
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
