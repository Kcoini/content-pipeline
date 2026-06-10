// sources 테이블 ↔ Source 도메인 타입 매핑 및 데이터 접근.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SourceRow } from "@/lib/supabase/database.types";
import type { Source } from "@/lib/types/domain";

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
    themeId: row.topic_id,
    url: row.url,
    title: row.title,
    publisher: row.author ?? "",
    publishedAt: row.published_at ? row.published_at.slice(0, 10) : "",
    summary: row.summary ?? "",
    createdAt: row.created_at,
  };
}

/** 출처 등록 - FR-2, FR-3 */
export async function addSource(input: AddSourceInput): Promise<Source> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("sources")
    .insert({
      topic_id: input.themeId,
      url: input.url,
      title: input.title,
      author: input.publisher || null,
      published_at: input.publishedAt ? new Date(input.publishedAt).toISOString() : null,
      summary: input.summary || null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`출처 등록에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSourceRowToSource(data);
}

export async function getSourcesByThemeId(themeId: string): Promise<Source[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("sources")
    .select()
    .eq("topic_id", themeId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`출처 목록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSourceRowToSource);
}
