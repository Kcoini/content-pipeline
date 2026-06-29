// Phase 1-13: article_url_candidates 테이블 데이터 접근.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ArticleUrlCandidateRow, ArticleUrlCandidateStatus } from "@/lib/supabase/database.types";
import type { ArticleUrlCandidate } from "@/lib/types/domain";

export function mapCandidateRow(row: ArticleUrlCandidateRow): ArticleUrlCandidate {
  return {
    id: row.id,
    themeId: row.theme_id,
    themeClusterId: row.theme_cluster_id,
    platform: row.platform,
    query: row.query,
    title: row.title,
    snippet: row.snippet,
    url: row.url,
    publisher: row.publisher,
    publishedAt: row.published_at,
    rankPosition: row.rank_position,
    status: row.status,
    metadata: row.metadata ?? {},
    collectedAt: row.collected_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 후보 목록을 저장한다.
 * partial unique index와 ON CONFLICT가 호환되지 않으므로,
 * 기존 URL을 먼저 조회해 중복을 직접 필터링한 뒤 insert한다.
 */
export async function upsertArticleUrlCandidates(
  candidates: Omit<ArticleUrlCandidate, "id">[]
): Promise<ArticleUrlCandidate[]> {
  if (candidates.length === 0) return [];

  const supabase = createServerSupabaseClient();
  const themeId = candidates[0].themeId;

  // 이미 저장된 URL 목록을 가져와 중복 제거
  let existingUrls = new Set<string>();
  if (themeId) {
    const { data: existing } = await supabase
      .from("article_url_candidates")
      .select("url")
      .eq("theme_id", themeId);
    existingUrls = new Set((existing ?? []).map((r) => r.url));
  }

  const newCandidates = candidates.filter((c) => !existingUrls.has(c.url));

  if (newCandidates.length === 0) return [];

  const rows = newCandidates.map((c) => ({
    theme_id: c.themeId,
    theme_cluster_id: c.themeClusterId,
    platform: c.platform,
    query: c.query,
    title: c.title,
    snippet: c.snippet,
    url: c.url,
    publisher: c.publisher,
    published_at: c.publishedAt,
    rank_position: c.rankPosition,
    status: c.status,
    metadata: c.metadata ?? {},
    collected_at: c.collectedAt,
  }));

  const { data, error } = await supabase
    .from("article_url_candidates")
    .insert(rows)
    .select();

  if (error || !data) {
    throw new Error(`기사 URL 후보 저장에 실패했습니다: ${error?.message ?? "unknown"}`);
  }

  return data.map(mapCandidateRow);
}

export async function getArticleUrlCandidatesByThemeId(
  themeId: string
): Promise<ArticleUrlCandidate[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("article_url_candidates")
    .select()
    .eq("theme_id", themeId)
    .order("rank_position", { ascending: true });

  if (error) {
    throw new Error(`기사 URL 후보 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapCandidateRow);
}

export async function getArticleUrlCandidateById(
  candidateId: string
): Promise<ArticleUrlCandidate | undefined> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("article_url_candidates")
    .select()
    .eq("id", candidateId)
    .maybeSingle();

  if (error) {
    throw new Error(`기사 URL 후보 조회에 실패했습니다: ${error.message}`);
  }

  return data ? mapCandidateRow(data) : undefined;
}

export async function updateArticleUrlCandidateStatus(
  candidateId: string,
  status: ArticleUrlCandidateStatus
): Promise<void> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("article_url_candidates")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", candidateId);

  if (error) {
    throw new Error(`기사 URL 후보 상태 업데이트에 실패했습니다: ${error.message}`);
  }
}
