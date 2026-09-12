// Phase 1-24: 자동테마 후보 cross-day 중복/업데이트 분류.
//
// 문제: 오늘 후보끼리는 병합(theme-clusterer.ts + upsertThemeClusters)하지만,
// 이미 `themes` 테이블에 존재하는(과거에 채택된) 테마와는 전혀 비교하지
// 않았다 — 그래서 어제 만든 "AI 동행" 테마가 오늘도 새 후보처럼 다시
// 나타난다. 이 파일은 공통 테마 후보(ThemeCluster) 하나를 기존 테마
// 목록과 비교해 4가지 상태 중 하나로 분류한다:
//   - new_theme: 기존 테마와 겹치지 않는 진짜 새 테마
//   - existing_theme_update: 기존 테마와 같은 주제, 오늘 새 자료가 있음
//   - duplicate_theme: 기존 테마와 거의 동일, 새 자료가 거의 없음
//   - needs_review: 이름은 비슷하지만 같은 주제인지 자동 판단이 어려움
//
// 원칙: normalizedThemeKey/제목 유사도만으로 최종 판단하지 않는다 —
// 같은 제목이라도 실제 내용(키워드/설명)이 다르면 needs_review로 사람에게
// 넘긴다("AI 동행" = 고령자 돌봄 vs "AI 동행" = 업무 자동화 같은 경우).

import type { Theme, ThemeCluster } from "@/lib/types/domain";
import {
  normalizeThemeKey,
  themeTitleSimilarity,
  tokenizeThemeTitle,
  THEME_SIMILARITY_MERGE_THRESHOLD,
} from "./theme-normalization";

/** 사용자에게 보여줄 4가지 자동테마 후보 상태. */
export type ThemeCandidateClassification =
  | "new_theme"
  | "existing_theme_update"
  | "duplicate_theme"
  | "needs_review";

/** 화면에 노출하는 한국어 라벨 — raw enum 값을 그대로 노출하지 않기 위한 매핑. */
export const THEME_CANDIDATE_CLASSIFICATION_LABEL: Record<ThemeCandidateClassification, string> = {
  new_theme: "신규 테마",
  existing_theme_update: "기존 테마 업데이트",
  duplicate_theme: "중복 테마",
  needs_review: "확인 필요",
};

/**
 * 기존 테마 하나를 cross-day 비교에 쓸 수 있게 감싼 컨텍스트.
 * themes 테이블 자체에는 normalizedKey/evidence 같은 필드가 없으므로,
 * 비교에 필요한 최소 정보(등록된 출처 URL, 마스터 원고/플랫폼 글 존재
 * 여부, 최근 갱신 시각)를 호출하는 쪽(trend-service.ts)에서 모아 전달한다.
 */
export interface ExistingThemeContext {
  theme: Theme;
  /** 이 테마에 이미 등록된 출처 URL 목록(중복 URL 판정용). */
  sourceUrls: string[];
  sourceCount: number;
  hasMasterManuscript: boolean;
  hasSocialPosts: boolean;
  /** 가장 최근 갱신 시각(출처 추가 등) — 없으면 테마 생성 시각. */
  lastUpdatedAt: string;
}

export interface ThemeCandidateClassificationResult {
  classification: ThemeCandidateClassification;
  /** 매칭된 기존 테마(있으면). new_theme이면 null. */
  matchedExistingTheme: Theme | null;
  matchedExistingThemeContext: ExistingThemeContext | null;
  /** 후보 근거(evidence) URL 중 기존 테마에 아직 없는 것. */
  newUrls: string[];
  newUrlCount: number;
  duplicateUrlCount: number;
  /** 제목 유사도(0~1). normalizedKey가 정확히 같으면 1. 매칭 대상이 없으면 null. */
  similarityScore: number | null;
  /** 사용자에게 보여줄 한국어 설명(왜 이렇게 분류했는지). */
  reason: string;
  /** needs_review일 때 화면에 "차이점"으로 보여줄 키워드 비교. */
  commonKeywords: string[];
  onlyExistingKeywords: string[];
  onlyCandidateKeywords: string[];
}

/** 후보 제목과 정확히 일치하지 않아도 "같은 이슈일 가능성"으로 취급할 최소 제목 유사도. */
const WEAK_TITLE_SIMILARITY_THRESHOLD = 0.25;

/**
 * 키워드/설명이 명백히 다른 주제를 가리킨다고 판단할 임계값. 이 값보다
 * 낮으면(둘 다 비교 가능한 데이터가 있는데도 거의 안 겹치면) 제목이
 * 같거나 비슷해도 needs_review로 분류한다.
 */
const CONTENT_DIFFERENT_THRESHOLD = 0.15;

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase();
}

/** 두 문자열 집합의 Jaccard 유사도. 둘 다 비어 있으면 비교 불가(null)를 반환한다. */
function setSimilarity(a: string[], b: string[]): number | null {
  const setA = new Set(a.filter(Boolean));
  const setB = new Set(b.filter(Boolean));
  if (setA.size === 0 && setB.size === 0) return null;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? null : intersection / union;
}

/**
 * 기존 테마와 후보의 "내용"이 실제로 같은 주제인지 판단할 유사도.
 * 키워드 집합 + 설명 토큰 집합을 함께 본다 — 제목만으로는 "AI 동행"처럼
 * 이름이 같아도 의미가 다른 경우를 구분할 수 없기 때문이다.
 */
function contentSimilarity(existing: Theme, candidate: ThemeCluster): number | null {
  const keywordSim = setSimilarity(
    existing.keywords.map(normalizeKeyword),
    candidate.keywords.map(normalizeKeyword)
  );
  const descSim = setSimilarity(
    tokenizeThemeTitle(existing.description || ""),
    tokenizeThemeTitle(candidate.description || "")
  );

  const scores = [keywordSim, descSim].filter((s): s is number => s !== null);
  if (scores.length === 0) return null;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

function uniqueNonNullUrls(cluster: ThemeCluster): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const item of cluster.evidence) {
    if (!item.url) continue;
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    urls.push(item.url);
  }
  return urls;
}

function diffKeywords(existing: string[], candidate: string[]) {
  const existingSet = new Set(existing.map(normalizeKeyword));
  const candidateSet = new Set(candidate.map(normalizeKeyword));
  const common = existing.filter((kw) => candidateSet.has(normalizeKeyword(kw)));
  const onlyExisting = existing.filter((kw) => !candidateSet.has(normalizeKeyword(kw)));
  const onlyCandidate = candidate.filter((kw) => !existingSet.has(normalizeKeyword(kw)));
  return { common, onlyExisting, onlyCandidate };
}

interface MatchCandidate {
  context: ExistingThemeContext;
  keyMatch: boolean;
  titleSim: number;
}

/** 후보와 가장 관련 있어 보이는 기존 테마를 찾는다(exact key 우선, 그다음 제목 유사도). */
function findBestMatch(cluster: ThemeCluster, contexts: ExistingThemeContext[]): MatchCandidate | null {
  const candidateKey = cluster.normalizedKey || normalizeThemeKey(cluster.title);

  const scored: MatchCandidate[] = contexts.map((context) => ({
    context,
    keyMatch: normalizeThemeKey(context.theme.title) === candidateKey && candidateKey.length > 0,
    titleSim: themeTitleSimilarity(context.theme.title, cluster.title),
  }));

  const keyMatches = scored.filter((s) => s.keyMatch);
  if (keyMatches.length > 0) {
    return keyMatches.sort((a, b) => b.titleSim - a.titleSim)[0];
  }

  const fuzzyMatches = scored
    .filter((s) => s.titleSim >= WEAK_TITLE_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.titleSim - a.titleSim);

  return fuzzyMatches[0] ?? null;
}

/**
 * 오늘 병합된 대표 공통 테마 후보 하나를 기존 테마 목록과 비교해
 * new_theme / existing_theme_update / duplicate_theme / needs_review 중
 * 하나로 분류한다.
 */
export function classifyThemeCandidate(
  cluster: ThemeCluster,
  existingContexts: ExistingThemeContext[]
): ThemeCandidateClassificationResult {
  const evidenceUrls = uniqueNonNullUrls(cluster);
  const match = findBestMatch(cluster, existingContexts);

  if (!match) {
    return {
      classification: "new_theme",
      matchedExistingTheme: null,
      matchedExistingThemeContext: null,
      newUrls: evidenceUrls,
      newUrlCount: evidenceUrls.length,
      duplicateUrlCount: 0,
      similarityScore: null,
      reason: "기존 테마와 의미상 겹치지 않는 새로운 주제입니다.",
      commonKeywords: [],
      onlyExistingKeywords: [],
      onlyCandidateKeywords: [],
    };
  }

  const { context, keyMatch, titleSim } = match;
  const similarityScore = keyMatch ? 1 : titleSim;
  const isConfidentTitleMatch = keyMatch || titleSim >= THEME_SIMILARITY_MERGE_THRESHOLD;

  const newUrls = evidenceUrls.filter((url) => !context.sourceUrls.includes(url));
  const duplicateUrlCount = evidenceUrls.length - newUrls.length;
  const { common, onlyExisting, onlyCandidate } = diffKeywords(context.theme.keywords, cluster.keywords);

  // 제목만으로는 "같은 이름, 다른 주제"(예: "AI 동행" = 고령자 돌봄 vs
  // 업무 자동화)를 구분할 수 없다 — 비교 가능한 내용(키워드/설명)이
  // 있는데도 거의 겹치지 않으면 자동 병합하지 않고 사람에게 넘긴다.
  const contentSim = contentSimilarity(context.theme, cluster);
  const contentClearlyDifferent = contentSim !== null && contentSim < CONTENT_DIFFERENT_THRESHOLD;

  if (!isConfidentTitleMatch || contentClearlyDifferent) {
    const reason = contentClearlyDifferent
      ? `제목은 "${context.theme.title}"과(와) 비슷하지만, 키워드/설명 내용이 달라 같은 주제인지 확인이 필요합니다.`
      : `제목이 "${context.theme.title}"과(와) 비슷하지만(유사도 ${(titleSim * 100).toFixed(0)}%), 같은 주제인지 자동으로 확신할 수 없습니다.`;
    return {
      classification: "needs_review",
      matchedExistingTheme: context.theme,
      matchedExistingThemeContext: context,
      newUrls,
      newUrlCount: newUrls.length,
      duplicateUrlCount,
      similarityScore,
      reason,
      commonKeywords: common,
      onlyExistingKeywords: onlyExisting,
      onlyCandidateKeywords: onlyCandidate,
    };
  }

  if (newUrls.length === 0) {
    return {
      classification: "duplicate_theme",
      matchedExistingTheme: context.theme,
      matchedExistingThemeContext: context,
      newUrls,
      newUrlCount: 0,
      duplicateUrlCount,
      similarityScore,
      reason: `기존 "${context.theme.title}" 테마와 거의 동일하고, 새로운 출처가 없습니다.`,
      commonKeywords: common,
      onlyExistingKeywords: onlyExisting,
      onlyCandidateKeywords: onlyCandidate,
    };
  }

  return {
    classification: "existing_theme_update",
    matchedExistingTheme: context.theme,
    matchedExistingThemeContext: context,
    newUrls,
    newUrlCount: newUrls.length,
    duplicateUrlCount,
    similarityScore,
    reason: `기존 "${context.theme.title}" 테마와 같은 주제이며, 오늘 새 출처 ${newUrls.length}개가 발견되었습니다.`,
    commonKeywords: common,
    onlyExistingKeywords: onlyExisting,
    onlyCandidateKeywords: onlyCandidate,
  };
}
