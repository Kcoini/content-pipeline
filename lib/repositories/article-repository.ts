// articles / article_sources 테이블 ↔ Article 도메인 타입 매핑 및 데이터 접근.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ArticleRow } from "@/lib/supabase/database.types";
import type { Article } from "@/lib/types/domain";

export interface SaveDraftArticleInput {
  themeId: string;
  title: string;
  content: string;
  citedSourceIds: string[];
}

export function mapArticleRowToArticle(row: ArticleRow, citedSourceIds: string[]): Article {
  return {
    id: row.id,
    themeId: row.theme_id,
    title: row.title,
    content: row.content,
    status: row.status,
    citedSourceIds,
    createdAt: row.created_at,
  };
}

export async function getArticleByThemeId(themeId: string): Promise<Article | undefined> {
  const supabase = createServerSupabaseClient();

  const { data: articleRow, error: articleError } = await supabase
    .from("articles")
    .select()
    .eq("theme_id", themeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (articleError) {
    throw new Error(`기사 조회에 실패했습니다: ${articleError.message}`);
  }
  if (!articleRow) return undefined;

  const { data: sourceRows, error: sourceError } = await supabase
    .from("article_sources")
    .select()
    .eq("article_id", articleRow.id);

  if (sourceError) {
    throw new Error(`기사-출처 연결 조회에 실패했습니다: ${sourceError.message}`);
  }

  return mapArticleRowToArticle(articleRow, (sourceRows ?? []).map((row) => row.source_id));
}

/**
 * 계약 검사를 통과한 기사 초안을 status='draft'로 저장한다 (FR-4, FR-5, FR-7).
 * 기존 초안이 있으면 새 초안으로 교체한다.
 */
export async function saveDraftArticle(input: SaveDraftArticleInput): Promise<Article> {
  const supabase = createServerSupabaseClient();

  const { error: deleteError } = await supabase
    .from("articles")
    .delete()
    .eq("theme_id", input.themeId)
    .eq("status", "draft");

  if (deleteError) {
    throw new Error(`기존 기사 초안 삭제에 실패했습니다: ${deleteError.message}`);
  }

  const { data: articleRow, error: insertError } = await supabase
    .from("articles")
    .insert({
      theme_id: input.themeId,
      title: input.title,
      content: input.content,
      status: "draft",
    })
    .select()
    .single();

  if (insertError || !articleRow) {
    throw new Error(`기사 초안 저장에 실패했습니다: ${insertError?.message ?? "unknown error"}`);
  }

  if (input.citedSourceIds.length > 0) {
    const { error: linkError } = await supabase.from("article_sources").insert(
      input.citedSourceIds.map((sourceId) => ({
        article_id: articleRow.id,
        source_id: sourceId,
      }))
    );

    if (linkError) {
      throw new Error(`기사-출처 연결 저장에 실패했습니다: ${linkError.message}`);
    }
  }

  return mapArticleRowToArticle(articleRow, input.citedSourceIds);
}
