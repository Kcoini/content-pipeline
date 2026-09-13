// Phase 4-9: "undefined.filter" 오류 재발 방지.
//
// 마스터 원고는 articles.format_metadata.master_manuscript(jsonb)에
// 저장되고, 읽을 때는 raw JSON을 그대로 `MasterManuscript` 타입으로
// 캐스팅했다(`readArticleMasterManuscript`) — 실제 shape을 검증하지
// 않았다. Phase 4-8에서 최상위 `evidenceMap`/`issues`/`readerMeaning`을
// 새로 추가했는데, **그 이전에 생성돼 저장된 마스터 원고**에는 이
// 필드들이 아예 없다. 그런 원고를 읽으면 타입상으로는 `string[]`이라고
// 믿고 있는 값이 실제로는 `undefined`라서, 이후 `.filter()`/`.map()`/
// `.length`를 호출하는 모든 코드(social-writing-context-builder,
// master-manuscript-review, 화면 표시)가 그대로 죽었다 — 사용자가 본
// "Cannot read properties of undefined (reading 'filter')"가 이 경로다.
//
// 이 파일은 그 근본 원인을 고친다 — 저장된 마스터 원고를 읽는 유일한
// 지점(`readArticleMasterManuscript`)에서 항상 이 정규화를 거치게 해서,
// 이후의 모든 소비자(페이지, 검토, 플랫폼 글 생성)가 "필드가 없을 수도
// 있다"는 걱정 없이 항상 완전한 배열/객체를 받게 한다.

import { asArray } from "@/lib/utils/safe-array";
import type {
  MasterManuscript,
  MasterManuscriptPlatformBriefs,
  LongFormSupport,
  OptimizationSupport,
  MasterManuscriptProhibitedExpressions,
  MasterManuscriptVerifiedFact,
} from "./master-manuscript-types";

type Loose<T> = { [K in keyof T]?: unknown };

function normalizeVerifiedFacts(value: unknown): MasterManuscriptVerifiedFact[] {
  return asArray(value as MasterManuscriptVerifiedFact[] | undefined).map((f) => {
    const loose = (f ?? {}) as Loose<MasterManuscriptVerifiedFact>;
    return {
      fact: typeof loose.fact === "string" ? loose.fact : "",
      sourceIds: asArray(loose.sourceIds as string[] | undefined),
      confidence: loose.confidence === "high" || loose.confidence === "low" ? loose.confidence : "medium",
      factType: typeof loose.factType === "string" ? (loose.factType as MasterManuscriptVerifiedFact["factType"]) : undefined,
    };
  });
}

function normalizeProhibitedOrCareful(value: unknown): MasterManuscriptProhibitedExpressions {
  const loose = (value ?? {}) as Loose<MasterManuscriptProhibitedExpressions>;
  return {
    prohibited: asArray(loose.prohibited as string[] | undefined),
    careful: asArray(loose.careful as string[] | undefined),
  };
}

/** platformBriefs는 플랫폼별로 자유 형식 object다 — 없으면 빈 object로만 채운다(내부 필드까지 채우지 않는다, 소비자가 각자 optional하게 읽는다). */
function normalizePlatformBriefs(value: unknown): MasterManuscriptPlatformBriefs {
  const loose = (value ?? {}) as Partial<Record<keyof MasterManuscriptPlatformBriefs, unknown>>;
  const keys: (keyof MasterManuscriptPlatformBriefs)[] = [
    "newsArticle",
    "opinionColumn",
    "wordpressBlog",
    "naverBlog",
    "naverCafe",
    "shortSocial",
    "instagram",
  ];
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const brief = loose[key];
    result[key] = brief && typeof brief === "object" ? brief : {};
  }
  return result as unknown as MasterManuscriptPlatformBriefs;
}

function normalizeLongFormSupport(value: unknown): LongFormSupport {
  const loose = (value ?? {}) as Loose<LongFormSupport>;
  return {
    recommendedLength: typeof loose.recommendedLength === "string" ? loose.recommendedLength : "",
    sourceSufficiency: typeof loose.sourceSufficiency === "string" ? loose.sourceSufficiency : "",
    sectionPlan: asArray(loose.sectionPlan as string[] | undefined),
    paragraphPoints: asArray(loose.paragraphPoints as string[] | undefined),
    evidenceMap: asArray(loose.evidenceMap as LongFormSupport["evidenceMap"]),
    expansionNotes: asArray(loose.expansionNotes as string[] | undefined),
    examplesAndAnalogies: asArray(loose.examplesAndAnalogies as string[] | undefined),
    tablesAndLists: asArray(loose.tablesAndLists as string[] | undefined),
    faqBank: asArray(loose.faqBank as string[] | undefined),
    cautionBank: asArray(loose.cautionBank as string[] | undefined),
    newsArticleExpansion: (loose.newsArticleExpansion ?? {}) as LongFormSupport["newsArticleExpansion"],
    monetizedBlogExpansion: (loose.monetizedBlogExpansion ?? {}) as LongFormSupport["monetizedBlogExpansion"],
  };
}

function normalizeOptimizationSupport(value: unknown): OptimizationSupport {
  const loose = (value ?? {}) as Loose<OptimizationSupport>;
  return {
    eeatNotes: (loose.eeatNotes ?? {}) as OptimizationSupport["eeatNotes"],
    seoSupport: (loose.seoSupport ?? {}) as OptimizationSupport["seoSupport"],
    aeoSupport: (loose.aeoSupport ?? {}) as OptimizationSupport["aeoSupport"],
    geoSupport: (loose.geoSupport ?? {}) as OptimizationSupport["geoSupport"],
    agentReadiness: (loose.agentReadiness ?? {}) as OptimizationSupport["agentReadiness"],
  };
}

/**
 * 저장된(또는 어디서 왔는지 확실하지 않은) 마스터 원고 후보를 항상
 * 완전한 `MasterManuscript` 모양으로 만든다 — 배열 필드는 없으면 `[]`,
 * object 필드는 없으면 `{}`로 채운다. `input`이 객체가 아니면(null/
 * undefined/배열/원시값) `null`을 반환한다 — "마스터 원고 자체가 없다"는
 * 뜻이므로 지어내지 않는다.
 */
export function normalizeMasterManuscript(input: unknown): MasterManuscript | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const loose = input as Loose<MasterManuscript>;
  const themeLoose = (loose.theme ?? {}) as Loose<MasterManuscript["theme"]>;

  return {
    theme: {
      title: typeof themeLoose.title === "string" ? themeLoose.title : "",
      topic: typeof themeLoose.topic === "string" ? themeLoose.topic : "",
      audience: typeof themeLoose.audience === "string" ? themeLoose.audience : "",
      purpose: typeof themeLoose.purpose === "string" ? themeLoose.purpose : "",
      referenceDate: typeof themeLoose.referenceDate === "string" ? themeLoose.referenceDate : "",
      region: typeof themeLoose.region === "string" ? themeLoose.region : "확인 필요",
      topicType: typeof themeLoose.topicType === "string" ? themeLoose.topicType : "",
    },
    sourceSummaries: asArray(loose.sourceSummaries as MasterManuscript["sourceSummaries"]),
    verifiedFacts: normalizeVerifiedFacts(loose.verifiedFacts),
    factInterpretationSplit: asArray(loose.factInterpretationSplit as MasterManuscript["factInterpretationSplit"]),
    mainMessage: typeof loose.mainMessage === "string" ? loose.mainMessage : "",
    supportingMessages: asArray(loose.supportingMessages as string[] | undefined),
    background: typeof loose.background === "string" ? loose.background : "",
    evidenceMap: asArray(loose.evidenceMap as MasterManuscript["evidenceMap"]),
    issues: asArray(loose.issues as MasterManuscript["issues"]),
    readerMeaning: asArray(loose.readerMeaning as string[] | undefined),
    verificationNeeded: asArray(loose.verificationNeeded as string[] | undefined),
    prohibitedOrCarefulExpressions: normalizeProhibitedOrCareful(loose.prohibitedOrCarefulExpressions),
    titleCandidates: (loose.titleCandidates ?? {}) as MasterManuscript["titleCandidates"],
    platformBriefs: normalizePlatformBriefs(loose.platformBriefs),
    longFormSupport: normalizeLongFormSupport(loose.longFormSupport),
    optimizationSupport: normalizeOptimizationSupport(loose.optimizationSupport),
    autoReviewCriteria: asArray(loose.autoReviewCriteria as string[] | undefined),
    generatedFromMode: typeof loose.generatedFromMode === "string" ? loose.generatedFromMode : "",
    builtAt: typeof loose.builtAt === "string" ? loose.builtAt : "",
  };
}
