// sources 테이블 ↔ Source 도메인 타입 매핑 및 데이터 접근.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SourceRow } from "@/lib/supabase/database.types";
import type { Source } from "@/lib/types/domain";
import type { FetchResult } from "@/lib/services/url-fetcher";

/** 같은 테마 안에서 동일한 URL을 중복 등록할 때 발생하는 오류. */
export class DuplicateSourceError extends Error {
  constructor(url: string) {
    super(
      `이미 이 테마에 등록된 출처입니다. 다른 URL을 입력하거나 기존 출처를 사용하세요. (${url})`
    );
    this.name = "DuplicateSourceError";
  }
}

export interface AddSourceInput {
  themeId: string;
  url: string;
  title: string;
  publisher: string;
  publishedAt: string;
  summary: string;
}

export function mapSourceRowToSource(row: SourceRow): Source {
  return {
    id: row.id,
    themeId: row.theme_id,
    url: row.url,
    title: row.title,
    publisher: row.author ?? "",
    publishedAt: row.published_at ? row.published_at.slice(0, 10) : "",
    summary: row.summary ?? "",
    createdAt: row.created_at,
    fetchStatus: row.fetch_status ?? "pending",
    fetchError: row.fetch_error ?? null,
    rawContent: row.raw_content ?? null,
  };
}

/** 출처 등록 - FR-2, FR-3 */
export async function addSource(input: AddSourceInput): Promise<Source> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("sources")
    .insert({
      theme_id: input.themeId,
      url: input.url,
      title: input.title,
      author: input.publisher || null,
      published_at: input.publishedAt ? new Date(input.publishedAt).toISOString() : null,
      summary: input.summary || null,
    })
    .select()
    .single();

  if (error || !data) {
    // PostgreSQL unique constraint violation (23505): theme_id + url 중복
    if (error?.code === "23505") {
      throw new DuplicateSourceError(input.url);
    }
    throw new Error(`출처 등록에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSourceRowToSource(data);
}

/** URL 수집 결과를 sources 테이블에 반영한다 (Phase 1-9). */
export async function updateSourceFetchResult(
  sourceId: string,
  result: FetchResult
): Promise<void> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("sources")
    .update({
      fetch_status: result.status,
      raw_content: result.rawContent,
      extracted_title: result.extractedTitle,
      fetched_at: result.fetchedAt,
      fetch_error: result.fetchError,
    })
    .eq("id", sourceId);

  if (error) {
    throw new Error(`출처 수집 결과 저장에 실패했습니다: ${error.message}`);
  }
}

export async function getSourcesByThemeId(themeId: string): Promise<Source[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("sources")
    .select()
    .eq("theme_id", themeId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`출처 목록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSourceRowToSource);
}

/** 기사가 인용한 출처 목록을 조회한다 (/articles/[id] 상세 페이지). */
export async function getSourcesByArticleId(articleId: string): Promise<Source[]> {
  const supabase = createServerSupabaseClient();

  const { data: linkRows, error: linkError } = await supabase
    .from("article_sources")
    .select()
    .eq("article_id", articleId);

  if (linkError) {
    throw new Error(`기사-출처 연결 조회에 실패했습니다: ${linkError.message}`);
  }

  const sourceIds = (linkRows ?? []).map((row) => row.source_id);
  if (sourceIds.length === 0) return [];

  const { data, error } = await supabase.from("sources").select().in("id", sourceIds);

  if (error) {
    throw new Error(`출처 목록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSourceRowToSource);
}
