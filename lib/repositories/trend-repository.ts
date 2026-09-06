// Phase 1-12: trend_candidates, theme_clusters 테이블 데이터 접근.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TrendCandidateRow, ThemeClusterRow } from "@/lib/supabase/database.types";
import type {
  TrendCandidate,
  ThemeCluster,
  ThemeClusterStatus,
  ThemeClusterEvidenceItem,
} from "@/lib/types/domain";
import { themeTitleSimilarity, THEME_SIMILARITY_MERGE_THRESHOLD } from "@/lib/trends/theme-normalization";

function mapCandidateRow(row: TrendCandidateRow): TrendCandidate {
  return {
    id: row.id,
    platform: row.platform,
    keyword: row.keyword,
    title: row.title,
    snippet: row.snippet,
    url: row.url,
    rankPosition: row.rank_position,
    collectedAt: row.collected_at,
    createdAt: row.created_at,
  };
}

function mapClusterRow(row: ThemeClusterRow): ThemeCluster {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    keywords: (row.keywords as string[]) ?? [],
    naverCount: row.naver_count,
    daumCount: row.daum_count,
    score: Number(row.score),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    normalizedKey: row.normalized_key ?? "",
    subtopics: (row.subtopics as string[] | null) ?? [],
    evidence: (row.evidence as ThemeClusterEvidenceItem[] | null) ?? [],
    seenCount: row.seen_count ?? 1,
    lastSeenAt: row.last_seen_at ?? row.created_at,
  };
}

export interface InsertTrendCandidateInput {
  platform: string;
  keyword: string | null;
  title: string | null;
  snippet: string | null;
  url: string | null;
  rankPosition: number | null;
  collectedAt: string;
  metadata?: Record<string, unknown>;
}

export async function insertTrendCandidates(
  inputs: InsertTrendCandidateInput[]
): Promise<TrendCandidate[]> {
  const supabase = createServerSupabaseClient();

  const rows = inputs.map((it) => ({
    platform: it.platform,
    keyword: it.keyword,
    title: it.title,
    snippet: it.snippet,
    url: it.url,
    rank_position: it.rankPosition,
    collected_at: it.collectedAt,
    metadata: it.metadata ?? {},
  }));

  const { data, error } = await supabase
    .from("trend_candidates")
    .insert(rows)
    .select();

  if (error || !data) {
    throw new Error(`트렌드 후보 저장에 실패했습니다: ${error?.message ?? "unknown"}`);
  }

  return data.map(mapCandidateRow);
}

/**
 * Phase 1-17: 여러 플랫폼(naver/daum/mock)이 같은 배치(같은 collected_at)로
 * 수집되면, `order(collected_at desc).limit(N)`만으로는 동일 시각 행들의
 * tie-break 순서가 보장되지 않는다 — 실측 결과 naver 46건/daum 47건이
 * 실제로 저장됐는데도, 상위 50건만 잘라 보면 naver 46건/daum 4건처럼
 * 한쪽 플랫폼이 우연히 앞쪽에 몰려 다른 플랫폼이 거의 안 보이는 문제가
 * 있었다(수집 자체는 정상이었고 "화면에 보여주는 조회" 단계의 버그였다).
 *
 * 이 함수는 각 플랫폼 안에서의 최신순은 그대로 유지하면서, 플랫폼을
 * 라운드로빈으로 번갈아 뽑아 `limit`을 채운다 — 그래서 한쪽 플랫폼이
 * 결과를 독식하지 않는다. DB schema 변경 없이 application 레벨에서만
 * 처리한다.
 */
export function balanceCandidatesByPlatform(rows: TrendCandidate[], limit: number): TrendCandidate[] {
  const byPlatform = new Map<string, TrendCandidate[]>();
  const platformOrder: string[] = [];

  for (const row of rows) {
    if (!byPlatform.has(row.platform)) {
      byPlatform.set(row.platform, []);
      platformOrder.push(row.platform);
    }
    byPlatform.get(row.platform)!.push(row);
  }

  const cursors = new Map<string, number>(platformOrder.map((p) => [p, 0]));
  const result: TrendCandidate[] = [];

  while (result.length < limit) {
    let addedAny = false;
    for (const platform of platformOrder) {
      if (result.length >= limit) break;
      const idx = cursors.get(platform)!;
      const list = byPlatform.get(platform)!;
      if (idx < list.length) {
        result.push(list[idx]);
        cursors.set(platform, idx + 1);
        addedAny = true;
      }
    }
    if (!addedAny) break;
  }

  return result;
}

/**
 * 최근 트렌드 후보를 조회한다. `limit`보다 넉넉하게(최소 4배 또는 200건 중
 * 큰 값) 먼저 가져온 뒤, balanceCandidatesByPlatform()으로 플랫폼별
 * 공평하게 섞어 최종 `limit`개만 반환한다(재수집 시 daum 결과가 화면에서
 * 거의 안 보이는 문제 방지, Phase 1-17).
 */
export async function getRecentTrendCandidates(limit = 50): Promise<TrendCandidate[]> {
  const supabase = createServerSupabaseClient();

  const fetchLimit = Math.max(limit * 4, 200);

  const { data, error } = await supabase
    .from("trend_candidates")
    .select()
    .order("collected_at", { ascending: false })
    .limit(fetchLimit);

  if (error) {
    throw new Error(`트렌드 후보 조회에 실패했습니다: ${error.message}`);
  }

  const rows = (data ?? []).map(mapCandidateRow);
  return balanceCandidatesByPlatform(rows, limit);
}

export interface TrendCandidateCounts {
  naver: number;
  daum: number;
  mock: number;
  total: number;
}

/**
 * Phase 1-20: /trends 상단 "수집 결과" 요약 배너에 쓸 플랫폼별 전체 개수를
 * 반환한다. getRecentTrendCandidates()는 화면 표시용으로 최근 N건만(균형
 * 조정 후) 가져오므로, 상단 요약에는 실제 누적 전체 건수를 따로
 * 조회한다(count-only 쿼리라 비용이 적다).
 */
export async function getTrendCandidateCounts(): Promise<TrendCandidateCounts> {
  const supabase = createServerSupabaseClient();

  const [naverResult, daumResult, mockResult] = await Promise.all([
    supabase.from("trend_candidates").select("id", { count: "exact", head: true }).eq("platform", "naver"),
    supabase.from("trend_candidates").select("id", { count: "exact", head: true }).eq("platform", "daum"),
    supabase.from("trend_candidates").select("id", { count: "exact", head: true }).eq("platform", "mock"),
  ]);

  for (const result of [naverResult, daumResult, mockResult]) {
    if (result.error) {
      throw new Error(`트렌드 후보 개수 조회에 실패했습니다: ${result.error.message}`);
    }
  }

  const naver = naverResult.count ?? 0;
  const daum = daumResult.count ?? 0;
  const mock = mockResult.count ?? 0;

  return { naver, daum, mock, total: naver + daum + mock };
}

export interface InsertThemeClusterInput {
  title: string;
  description: string;
  keywords: string[];
  naverCount: number;
  daumCount: number;
  score: number;
}

export async function insertThemeClusters(
  inputs: InsertThemeClusterInput[]
): Promise<ThemeCluster[]> {
  const supabase = createServerSupabaseClient();

  const rows = inputs.map((it) => ({
    title: it.title,
    description: it.description || null,
    keywords: it.keywords,
    naver_count: it.naverCount,
    daum_count: it.daumCount,
    score: it.score,
    status: "candidate" as const,
  }));

  const { data, error } = await supabase
    .from("theme_clusters")
    .insert(rows)
    .select();

  if (error || !data) {
    throw new Error(`테마 클러스터 저장에 실패했습니다: ${error?.message ?? "unknown"}`);
  }

  return data.map(mapClusterRow);
}

export interface UpsertThemeClusterInput {
  title: string;
  description: string;
  keywords: string[];
  naverCount: number;
  daumCount: number;
  score: number;
  /** lib/trends/theme-normalization.ts의 normalizeThemeKey() 결과. */
  normalizedKey: string;
  subtopics: string[];
  evidence: ThemeClusterEvidenceItem[];
}

/** evidence를 (platform, title) 기준으로 중복 제거한다. */
function dedupeEvidence(items: ThemeClusterEvidenceItem[]): ThemeClusterEvidenceItem[] {
  const seen = new Set<string>();
  const result: ThemeClusterEvidenceItem[] = [];
  for (const item of items) {
    const key = `${item.platform}::${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

const MAX_MERGED_SUBTOPICS = 12;
const MAX_MERGED_EVIDENCE = 20;

/**
 * 공통 테마 후보를 저장한다. 재수집 시 같은 테마가 계속 새로 insert되어
 * 쌓이는 문제(Phase 1-16)를 막기 위해, 저장 전 기존 theme_clusters를
 * 조회해 같은 후보인지 먼저 확인한다.
 *
 * 매칭 기준(둘 중 하나라도 해당하면 같은 후보로 본다):
 * - normalizedKey가 정확히 같다(완전/거의 동일한 표현).
 * - status가 'candidate'인 기존 후보와 제목 유사도(themeTitleSimilarity)가
 *   임계값 이상이다(표현은 다르지만 같은 이슈로 보이는 경우). 이미
 *   'selected'/'dismissed'로 사람이 판단을 마친 후보는 퍼지 매칭으로
 *   임의로 건드리지 않는다 — normalizedKey가 완전히 같을 때만 병합한다.
 *
 * 매칭되면 insert 대신 keywords/subtopics/evidence를 병합하고
 * naver_count/daum_count를 누적하며 seen_count/last_seen_at을
 * 갱신한다(update). 매칭되지 않으면 새 후보로 insert한다.
 *
 * 같은 배치(inputs) 안에서도 유사 후보가 있으면 먼저 병합한 뒤 저장하므로,
 * 한 번의 실행에서 중복 행이 여러 개 생기지 않는다.
 */
export async function upsertThemeClusters(inputs: UpsertThemeClusterInput[]): Promise<ThemeCluster[]> {
  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();

  const { data: existingRows, error: fetchError } = await supabase.from("theme_clusters").select();
  if (fetchError) {
    throw new Error(`테마 클러스터 조회에 실패했습니다: ${fetchError.message}`);
  }

  // in-memory 작업 목록 — 이번 배치 안에서 병합된 후보도 즉시 반영해
  // 같은 실행 내 중복도 하나로 합친다.
  const pool: ThemeCluster[] = (existingRows ?? []).map(mapClusterRow);
  const results: ThemeCluster[] = [];

  for (const input of inputs) {
    const exactMatch = pool.find((row) => row.normalizedKey && row.normalizedKey === input.normalizedKey);
    const fuzzyMatch =
      !exactMatch &&
      pool.find(
        (row) =>
          row.status === "candidate" &&
          themeTitleSimilarity(row.title, input.title) >= THEME_SIMILARITY_MERGE_THRESHOLD
      );
    const match = exactMatch ?? fuzzyMatch;

    if (match) {
      const mergedKeywords = Array.from(new Set([...match.keywords, ...input.keywords])).slice(0, 8);
      const mergedSubtopics = Array.from(new Set([...match.subtopics, ...input.subtopics])).slice(
        0,
        MAX_MERGED_SUBTOPICS
      );
      const mergedEvidence = dedupeEvidence([...match.evidence, ...input.evidence]).slice(0, MAX_MERGED_EVIDENCE);

      const { data, error } = await supabase
        .from("theme_clusters")
        .update({
          keywords: mergedKeywords,
          subtopics: mergedSubtopics,
          evidence: mergedEvidence,
          naver_count: match.naverCount + input.naverCount,
          daum_count: match.daumCount + input.daumCount,
          score: Math.max(match.score, input.score),
          normalized_key: match.normalizedKey || input.normalizedKey,
          seen_count: match.seenCount + 1,
          last_seen_at: now,
          updated_at: now,
        })
        .eq("id", match.id)
        .select()
        .single();

      if (error || !data) {
        throw new Error(`테마 클러스터 병합에 실패했습니다: ${error?.message ?? "unknown"}`);
      }

      const merged = mapClusterRow(data);
      results.push(merged);
      // pool도 갱신해서 같은 배치 내 다음 input이 이 병합 결과를 다시 찾을 수 있게 한다.
      const poolIndex = pool.findIndex((row) => row.id === merged.id);
      if (poolIndex >= 0) pool[poolIndex] = merged;
    } else {
      const { data, error } = await supabase
        .from("theme_clusters")
        .insert({
          title: input.title,
          description: input.description || null,
          keywords: input.keywords,
          naver_count: input.naverCount,
          daum_count: input.daumCount,
          score: input.score,
          status: "candidate" as const,
          normalized_key: input.normalizedKey,
          subtopics: input.subtopics,
          evidence: input.evidence,
          seen_count: 1,
          last_seen_at: now,
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(`테마 클러스터 저장에 실패했습니다: ${error?.message ?? "unknown"}`);
      }

      const inserted = mapClusterRow(data);
      results.push(inserted);
      pool.push(inserted);
    }
  }

  return results;
}

export async function getThemeClusters(
  status?: ThemeClusterStatus
): Promise<ThemeCluster[]> {
  const supabase = createServerSupabaseClient();

  let query = supabase
    .from("theme_clusters")
    .select()
    .order("score", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`테마 클러스터 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapClusterRow);
}

export async function getThemeClusterById(
  clusterId: string
): Promise<ThemeCluster | undefined> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("theme_clusters")
    .select()
    .eq("id", clusterId)
    .maybeSingle();

  if (error) {
    throw new Error(`테마 클러스터 조회에 실패했습니다: ${error.message}`);
  }

  return data ? mapClusterRow(data) : undefined;
}

export async function updateThemeClusterStatus(
  clusterId: string,
  status: ThemeClusterStatus
): Promise<void> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("theme_clusters")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", clusterId);

  if (error) {
    throw new Error(`테마 클러스터 상태 업데이트에 실패했습니다: ${error.message}`);
  }
}
