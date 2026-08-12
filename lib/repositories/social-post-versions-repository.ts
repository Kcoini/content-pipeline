// Phase 3-11: social_post_versions 데이터 접근.
// 버전 이력만 다루며, social_posts 본문을 직접 수정하지 않는다.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SocialPostVersionRow } from "@/lib/supabase/database.types";
import type { CreateSocialPostVersionInput, SocialPostVersion } from "@/lib/social/social-rewrite-types";

export function mapSocialPostVersionRow(row: SocialPostVersionRow): SocialPostVersion {
  return {
    id: row.id,
    socialPostId: row.social_post_id,
    articleId: row.article_id,
    rootSocialPostId: row.root_social_post_id,
    parentSocialPostId: row.parent_social_post_id,
    versionNumber: row.version_number,
    versionLabel: row.version_label,
    versionStatus: row.version_status,
    platform: row.platform,
    toneStyle: row.tone_style,
    rewriteSourceSuggestionId: row.rewrite_source_suggestion_id,
    changeSummary: row.change_summary,
    appliedBy: row.applied_by,
    appliedAt: row.applied_at,
    createdAt: row.created_at,
  };
}

/** 새 버전 이력 row를 추가한다 (social_posts 본문은 건드리지 않음). */
export async function createSocialPostVersion(input: CreateSocialPostVersionInput): Promise<SocialPostVersion> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_versions")
    .insert({
      social_post_id: input.socialPostId,
      article_id: input.articleId,
      root_social_post_id: input.rootSocialPostId,
      parent_social_post_id: input.parentSocialPostId ?? null,
      version_number: input.versionNumber,
      version_label: input.versionLabel ?? null,
      version_status: input.versionStatus ?? "current",
      platform: input.platform,
      tone_style: input.toneStyle,
      rewrite_source_suggestion_id: input.rewriteSourceSuggestionId ?? null,
      change_summary: input.changeSummary ?? {},
      applied_by: input.appliedBy ?? null,
      applied_at: input.appliedAt ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`social post version 이력 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostVersionRow(data);
}

/** 특정 root social post의 전체 버전 이력을 버전 순으로 조회한다. */
export async function listVersionsByRootSocialPost(rootSocialPostId: string): Promise<SocialPostVersion[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_versions")
    .select()
    .eq("root_social_post_id", rootSocialPostId)
    .order("version_number", { ascending: true });

  if (error) {
    throw new Error(`social post version 이력 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostVersionRow);
}

/** 특정 기사에 속한 모든 버전 이력을 조회한다. */
export async function listVersionsByArticle(articleId: string): Promise<SocialPostVersion[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_versions")
    .select()
    .eq("article_id", articleId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`기사별 social post version 이력 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostVersionRow);
}

/** 특정 root social post의 가장 최신 버전 이력 한 건을 조회한다. */
export async function getLatestVersionByRootSocialPost(rootSocialPostId: string): Promise<SocialPostVersion | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_versions")
    .select()
    .eq("root_social_post_id", rootSocialPostId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`최신 social post version 조회에 실패했습니다: ${error.message}`);
  }

  return data ? mapSocialPostVersionRow(data) : null;
}

/** social_post_id로 특정되는 버전 이력 row의 version_status를 갱신한다. */
export async function markSocialPostVersionStatus(socialPostId: string, status: string): Promise<SocialPostVersion | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_versions")
    .update({ version_status: status })
    .eq("social_post_id", socialPostId)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`social post version 상태 저장에 실패했습니다: ${error.message}`);
  }

  return data ? mapSocialPostVersionRow(data) : null;
}

/**
 * 특정 social_post_id가 속한 root의 전체 버전 계보(체인)를 조회한다.
 * 먼저 해당 social_post_id의 버전 row를 찾아 root_social_post_id를
 * 확인한 뒤, 같은 root를 가진 모든 버전을 버전 순으로 반환한다.
 */
export async function getVersionChain(socialPostId: string): Promise<SocialPostVersion[]> {
  const supabase = createServerSupabaseClient();

  const { data: current, error: currentError } = await supabase
    .from("social_post_versions")
    .select()
    .eq("social_post_id", socialPostId)
    .maybeSingle();

  if (currentError) {
    throw new Error(`social post version 조회에 실패했습니다: ${currentError.message}`);
  }
  if (!current) return [];

  return listVersionsByRootSocialPost(current.root_social_post_id);
}
