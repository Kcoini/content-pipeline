// Phase 1-16 후속: 공통 테마 후보 "화면 표시" 중복 제거.
//
// upsertThemeClusters()가 재수집 시점부터는 중복 insert를 막지만, 그 이전에
// 이미 쌓인 theme_clusters 행(예: normalized_key가 없던 시절 생성된 행)은
// DB에 여전히 서로 다른 행으로 남아 있을 수 있다. 이 파일은 그런 행들을
// **화면에 보여줄 때만** 대표 후보 하나로 묶는다 — DB를 수정하거나 삭제하지
// 않는다(hard delete 금지, raw evidence 보존 원칙).
//
// 그룹핑 기준(둘 중 하나라도 해당하면 같은 후보로 묶는다):
// 1) normalizedKey가 정확히 같다(비어 있으면 title로 즉석 계산한 키를 쓴다
//    — normalized_key 컬럼이 없던 시절 생성된 행도 그룹핑 대상이 되게 하기
//    위해서다).
// 2) normalizedKey는 다르지만, 두 후보 중 하나 이상이 'candidate' 상태이고
//    제목 유사도가 임계값 이상이다(upsertThemeClusters()의 퍼지 매칭과
//    동일한 기준 — 이미 selected/dismissed로 확정된 후보끼리는 서로 다른
//    쪽이 candidate가 아니면 묶지 않는다).

import type { ThemeCluster, ThemeClusterEvidenceItem } from "@/lib/types/domain";
import { normalizeThemeKey, themeTitleSimilarity, THEME_SIMILARITY_MERGE_THRESHOLD } from "./theme-normalization";

/**
 * Phase 1-17: daum 근거 강도. daum 결과가 적다는 이유만으로 테마 자체를
 * 버리지 않는다(clusterTrendItems()도 naver/daum 중 하나만 있어도 후보를
 * 만든다) — 대신 화면에서 "네이버 중심 테마"/"다음 근거 약함"임을 알 수
 * 있게 표시용 강도만 계산한다.
 * - none: daum 근거 0건 → naver 중심 테마
 * - weak: daum 근거 1~2건 → 근거로 연결은 되지만 약함
 * - strong: daum 근거 3건 이상
 */
export type DaumEvidenceStrength = "none" | "weak" | "strong";

function classifyDaumEvidenceStrength(aggregatedDaumCount: number): DaumEvidenceStrength {
  if (aggregatedDaumCount <= 0) return "none";
  if (aggregatedDaumCount <= 2) return "weak";
  return "strong";
}

export interface DisplayThemeCluster {
  /** 목록에 실제로 보여줄 대표 후보. */
  representative: ThemeCluster;
  /** 대표 후보 카드 안의 "병합된 후보 보기" 접기 영역에만 노출되는 후보들. */
  mergedCandidates: ThemeCluster[];
  /** 대표 후보 + 병합된 후보를 합산한 네이버 건수(raw 데이터는 그대로 두고 화면 표시값만 합산). */
  aggregatedNaverCount: number;
  aggregatedDaumCount: number;
  /** 대표 후보 + 병합된 후보의 반복 발견 횟수 합. */
  aggregatedSeenCount: number;
  /** 대표 + 병합 후보의 subtopics를 합치고 정규화 키 기준으로 중복 제거한 목록. */
  aggregatedSubtopics: string[];
  /** 대표 + 병합 후보의 evidence를 URL(없으면 platform+title) 기준으로 중복 제거해 합친 목록. */
  aggregatedEvidence: ThemeClusterEvidenceItem[];
  /** 그룹 안에서 가장 최근인 lastSeenAt. */
  latestLastSeenAt: string;
  /** daum 근거 강도(none/weak/strong) — aggregatedDaumCount 기준. */
  daumEvidenceStrength: DaumEvidenceStrength;
}

function effectiveKey(cluster: ThemeCluster): string {
  return cluster.normalizedKey && cluster.normalizedKey.trim().length > 0
    ? cluster.normalizedKey
    : normalizeThemeKey(cluster.title);
}

function evidenceDedupeKey(item: ThemeClusterEvidenceItem): string {
  return item.url && item.url.trim().length > 0 ? `url:${item.url}` : `text:${item.platform}::${item.title}`;
}

function dedupeEvidence(items: ThemeClusterEvidenceItem[]): ThemeClusterEvidenceItem[] {
  const seen = new Set<string>();
  const result: ThemeClusterEvidenceItem[] = [];
  for (const item of items) {
    const key = evidenceDedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function dedupeSubtopics(titles: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const title of titles) {
    const trimmed = title.trim();
    if (!trimmed) continue;
    const key = normalizeThemeKey(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

/**
 * 그룹 안에서 대표 후보를 고른다. 우선순위:
 * 1) score가 가장 높은 후보
 * 2) score가 같으면 evidence 개수가 많은 후보
 * 3) 그래도 같으면 lastSeenAt이 가장 최신인 후보
 *
 * (이 저장소에는 canonical/mergedInto 같은 명시적 필드가 없으므로 기존
 * score/evidence/lastSeenAt만으로 판단한다.)
 */
function pickRepresentative(members: ThemeCluster[]): ThemeCluster {
  return members.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.evidence.length !== a.evidence.length) return b.evidence.length - a.evidence.length;
    return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
  })[0];
}

/**
 * theme_clusters 목록을 화면에 보여줄 "대표 후보 + 병합된 후보" 그룹으로
 * 묶는다. DB는 전혀 수정하지 않는다 — 순수 표시용 집계 함수다.
 */
export function groupThemeClustersForDisplay(clusters: ThemeCluster[]): DisplayThemeCluster[] {
  const groups: ThemeCluster[][] = [];

  for (const cluster of clusters) {
    const key = effectiveKey(cluster);

    const matchedGroup = groups.find((group) =>
      group.some((existing) => {
        if (effectiveKey(existing) === key) return true;
        const eitherCandidate = existing.status === "candidate" || cluster.status === "candidate";
        return eitherCandidate && themeTitleSimilarity(existing.title, cluster.title) >= THEME_SIMILARITY_MERGE_THRESHOLD;
      })
    );

    if (matchedGroup) {
      matchedGroup.push(cluster);
    } else {
      groups.push([cluster]);
    }
  }

  return groups
    .map((members) => {
      const representative = pickRepresentative(members);
      const mergedCandidates = members
        .filter((c) => c.id !== representative.id)
        .sort((a, b) => b.score - a.score);

      const aggregatedSubtopics = dedupeSubtopics(members.flatMap((c) => c.subtopics));
      const aggregatedEvidence = dedupeEvidence(members.flatMap((c) => c.evidence));
      const latestLastSeenAt = members.reduce(
        (latest, c) => (new Date(c.lastSeenAt).getTime() > new Date(latest).getTime() ? c.lastSeenAt : latest),
        members[0].lastSeenAt
      );

      const aggregatedDaumCount = members.reduce((sum, c) => sum + c.daumCount, 0);

      return {
        representative,
        mergedCandidates,
        aggregatedNaverCount: members.reduce((sum, c) => sum + c.naverCount, 0),
        aggregatedDaumCount,
        aggregatedSeenCount: members.reduce((sum, c) => sum + c.seenCount, 0),
        aggregatedSubtopics,
        aggregatedEvidence,
        latestLastSeenAt,
        daumEvidenceStrength: classifyDaumEvidenceStrength(aggregatedDaumCount),
      };
    })
    .sort((a, b) => b.representative.score - a.representative.score);
}
