// topics 테이블 ↔ Theme 도메인 타입 매핑 및 데이터 접근.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TopicRow } from "@/lib/supabase/database.types";
import type { Language, Theme } from "@/lib/types/domain";

export interface CreateThemeInput {
  title: string;
  description: string;
  keywords: string[];
  language: Language;
}

export function mapTopicRowToTheme(row: TopicRow): Theme {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    keywords: row.keywords ?? [],
    language: row.language === "en" ? "en" : "ko",
    createdAt: row.created_at,
  };
}

/** 테마 생성 - FR-1 */
export async function createTheme(input: CreateThemeInput): Promise<Theme> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("topics")
    .insert({
      title: input.title,
      description: input.description || null,
      keywords: input.keywords,
      language: input.language,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`테마 생성에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapTopicRowToTheme(data);
}

/** 전체 테마 목록 조회 (생성 순) */
export async function getThemes(): Promise<Theme[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("topics")
    .select()
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`테마 목록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapTopicRowToTheme);
}

export async function getThemeById(themeId: string): Promise<Theme | undefined> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.from("topics").select().eq("id", themeId).maybeSingle();

  if (error) {
    throw new Error(`테마 조회에 실패했습니다: ${error.message}`);
  }

  return data ? mapTopicRowToTheme(data) : undefined;
}
