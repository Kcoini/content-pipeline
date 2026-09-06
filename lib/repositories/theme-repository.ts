// themes 테이블 ↔ Theme 도메인 타입 매핑 및 데이터 접근.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ThemeRow } from "@/lib/supabase/database.types";
import type { Language, Theme } from "@/lib/types/domain";

export interface CreateThemeInput {
  title: string;
  description: string;
  keywords: string[];
  language: Language;
  /** Phase 1-12: 생성 방식 메타데이터 { creation_method, theme_cluster_id? } */
  metadata?: Record<string, unknown>;
}

export function mapThemeRowToTheme(row: ThemeRow): Theme {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    keywords: row.keywords ?? [],
    language: row.language === "en" ? "en" : "ko",
    createdAt: row.created_at,
    metadata: row.metadata ?? {},
    archivedAt: row.archived_at,
  };
}

/** 테마 생성 - FR-1 */
export async function createTheme(input: CreateThemeInput): Promise<Theme> {
  const supabase = createServerSupabaseClient();

  const metadata = {
    creation_method: "manual",
    ...input.metadata,
  };

  const { data, error } = await supabase
    .from("themes")
    .insert({
      title: input.title,
      description: input.description || null,
      keywords: input.keywords,
      language: input.language,
      metadata,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`테마 생성에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapThemeRowToTheme(data);
}

/**
 * 전체 테마 목록 조회 (생성 순). 기본적으로 보관 처리(archived_at 설정)된
 * 테마는 제외한다 — 목록에서 "삭제" 버튼을 누른 테마가 다시 보이지 않게
 * 하기 위해서다(hard delete가 아니라 soft delete이므로 DB에는 남아있다).
 */
export async function getThemes(options: { includeArchived?: boolean } = {}): Promise<Theme[]> {
  const supabase = createServerSupabaseClient();

  let query = supabase.from("themes").select().order("created_at", { ascending: true });
  if (!options.includeArchived) {
    query = query.is("archived_at", null);
  }
  const { data, error } = await query;

  if (error) {
    throw new Error(`테마 목록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapThemeRowToTheme);
}

export async function getThemeById(themeId: string): Promise<Theme | undefined> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.from("themes").select().eq("id", themeId).maybeSingle();

  if (error) {
    throw new Error(`테마 조회에 실패했습니다: ${error.message}`);
  }

  return data ? mapThemeRowToTheme(data) : undefined;
}

/** 테마 삭제(보관 처리) — hard delete가 아니라 archived_at = now()만 설정한다. */
export async function archiveTheme(themeId: string): Promise<Theme> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("themes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", themeId)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`테마 보관 처리에 실패했습니다: ${error.message}`);
  }
  if (!data) {
    throw new Error(`테마를 찾을 수 없습니다: ${themeId}`);
  }

  return mapThemeRowToTheme(data);
}

export interface ThemeRelatedCounts {
  sourceCount: number;
  articleCount: number;
}

/** 테마 삭제 확인 모달에 표시할 연관 데이터 개수(출처/기사, 활성 상태 기준)를 센다. */
export async function getThemeRelatedCounts(themeId: string): Promise<ThemeRelatedCounts> {
  const supabase = createServerSupabaseClient();

  const [sourcesResult, articlesResult] = await Promise.all([
    supabase.from("sources").select("id", { count: "exact", head: true }).eq("theme_id", themeId),
    supabase.from("articles").select("id", { count: "exact", head: true }).eq("theme_id", themeId).is("archived_at", null),
  ]);

  if (sourcesResult.error) {
    throw new Error(`출처 개수 조회에 실패했습니다: ${sourcesResult.error.message}`);
  }
  if (articlesResult.error) {
    throw new Error(`기사 개수 조회에 실패했습니다: ${articlesResult.error.message}`);
  }

  return {
    sourceCount: sourcesResult.count ?? 0,
    articleCount: articlesResult.count ?? 0,
  };
}
