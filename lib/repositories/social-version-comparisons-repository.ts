// Phase 3-12: social_post_version_comparisons 데이터 접근.
// 비교 결과는 사람이 판단하기 위한 보조 지표일 뿐이며, 이 repository의
// 어떤 함수도 실제 게시나 원본 교체를 수행하지 않는다.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SocialPostVersionComparisonRow } from "@/lib/supabase/database.types";
import { updateVersionComparisonSummary } from "./social-posts-repository";
import type { SocialPost } from "@/lib/social/social-platform-types";
import type { CreateVersionComparisonInput, SocialPostVersionComparison } from "@/lib/social/social-rewrite-types";

export function mapSocialPostVersionComparisonRow(row: SocialPostVersionComparisonRow): SocialPostVersionComparison {
  return {
    id: row.id,
    articleId: row.article_id,
    rootSocialPostId: row.root_social_post_id,
    originalSocialPostId: row.original_social_post_id,
    rewriteSocialPostId: row.rewrite_social_post_id,
    rewriteSourceSuggestionId: row.rewrite_source_suggestion_id,
    platform: row.platform,
    originalVersionNumber: row.original_version_number,
    rewriteVersionNumber: row.rewrite_version_number,
    originalQualityStatus: row.original_quality_status,
    originalQualityScore: row.original_quality_score,
    rewriteQualityStatus: row.rewrite_quality_status,
    rewriteQualityScore: row.rewrite_quality_score,
    originalPerformanceStatus: row.original_performance_status,
    originalPerformanceScore: row.original_performance_score,
    rewritePerformanceStatus: row.rewrite_performance_status,
    rewritePerformanceScore: row.rewrite_performance_score,
    comparisonStatus: row.comparison_status as SocialPostVersionComparison["comparisonStatus"],
    comparisonScore: row.comparison_score,
    recommendedSocialPostId: row.recommended_social_post_id,
    recommendationReason: row.recommendation_reason,
    comparisonSummary: row.comparison_summary,
    checklist: row.checklist as unknown as SocialPostVersionComparison["checklist"],
    warnings: row.warnings as unknown as string[],
    failures: row.failures as unknown as string[],
    comparedBy: row.compared_by,
    comparedAt: row.compared_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 원본 vs rewrite version 비교 결과를 저장한다. */
export async function createVersionComparison(input: CreateVersionComparisonInput): Promise<SocialPostVersionComparison> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_version_comparisons")
    .insert({
      article_id: input.articleId,
      root_social_post_id: input.rootSocialPostId,
      original_social_post_id: input.originalSocialPostId,
      rewrite_social_post_id: input.rewriteSocialPostId,
      rewrite_source_suggestion_id: input.rewriteSourceSuggestionId ?? null,
      platform: input.platform,
      original_version_number: input.originalVersionNumber ?? null,
      rewrite_version_number: input.rewriteVersionNumber ?? null,
      original_quality_status: input.originalQualityStatus ?? null,
      original_quality_score: input.originalQualityScore ?? null,
      rewrite_quality_status: input.rewriteQualityStatus ?? null,
      rewrite_quality_score: input.rewriteQualityScore ?? null,
      original_performance_status: input.originalPerformanceStatus ?? null,
      original_performance_score: input.originalPerformanceScore ?? null,
      rewrite_performance_status: input.rewritePerformanceStatus ?? null,
      rewrite_performance_score: input.rewritePerformanceScore ?? null,
      comparison_status: input.comparisonStatus,
      comparison_score: input.comparisonScore ?? null,
      recommended_social_post_id: input.recommendedSocialPostId ?? null,
      recommendation_reason: input.recommendationReason ?? null,
      comparison_summary: input.comparisonSummary ?? {},
      checklist: (input.checklist ?? []) as unknown as Record<string, unknown>[],
      warnings: (input.warnings ?? []) as unknown as Record<string, unknown>[],
      failures: (input.failures ?? []) as unknown as Record<string, unknown>[],
      compared_by: input.comparedBy ?? null,
      compared_at: input.comparedAt ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`version comparison 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostVersionComparisonRow(data);
}

/** id로 비교 결과 하나를 조회한다. 없으면 null. */
export async function getVersionComparisonById(id: string): Promise<SocialPostVersionComparison | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.from("social_post_version_comparisons").select().eq("id", id).maybeSingle();

  if (error) {
    throw new Error(`version comparison 조회에 실패했습니다: ${error.message}`);
  }

  return data ? mapSocialPostVersionComparisonRow(data) : null;
}

/** 특정 기사에 속한 모든 비교 결과를 최신순으로 조회한다. */
export async function listComparisonsByArticle(articleId: string): Promise<SocialPostVersionComparison[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_version_comparisons")
    .select()
    .eq("article_id", articleId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`기사별 version comparison 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostVersionComparisonRow);
}

/** 특정 root social post에 속한 모든 비교 결과를 최신순으로 조회한다. */
export async function listComparisonsByRootSocialPost(rootSocialPostId: string): Promise<SocialPostVersionComparison[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_version_comparisons")
    .select()
    .eq("root_social_post_id", rootSocialPostId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`root social post 기준 version comparison 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostVersionComparisonRow);
}

/** 특정 rewrite social post에 대한 비교 결과를 최신순으로 조회한다. */
export async function listComparisonsByRewriteSocialPost(rewriteSocialPostId: string): Promise<SocialPostVersionComparison[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_version_comparisons")
    .select()
    .eq("rewrite_social_post_id", rewriteSocialPostId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`rewrite social post 기준 version comparison 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostVersionComparisonRow);
}

/**
 * social_posts의 버전 비교 요약 컬럼을 최신 비교 결과로 갱신한다.
 * social-posts-repository.updateVersionComparisonSummary()를 그대로
 * 위임한다(비교 도메인 관점에서 호출하기 편하도록 이름만 다르게 노출).
 */
export async function updateSocialPostVersionComparisonSummary(
  socialPostId: string,
  comparison: SocialPostVersionComparison
): Promise<SocialPost> {
  const recommendedForRepost =
    comparison.comparisonStatus === "rewrite_better" &&
    comparison.rewriteSocialPostId === socialPostId &&
    comparison.rewriteQualityStatus === "ready";

  return updateVersionComparisonSummary(socialPostId, {
    latestVersionComparisonId: comparison.id,
    versionComparisonStatus: comparison.comparisonStatus,
    versionComparisonScore: comparison.comparisonScore,
    recommendedForRepost,
  });
}
