// Phase 1-12: trend_candidates, theme_clusters 테이블 데이터 접근.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TrendCandidateRow, ThemeClusterRow } from "@/lib/supabase/database.types";
import type { TrendCandidate, ThemeCluster, ThemeClusterStatus } from "@/lib/types/domain";

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

export async function getRecentTrendCandidates(limit = 50): Promise<TrendCandidate[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("trend_candidates")
    .select()
    .order("collected_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`트렌드 후보 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapCandidateRow);
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
