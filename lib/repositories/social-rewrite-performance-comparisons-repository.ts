// Phase 3-14: social_rewrite_performance_comparisons 데이터 접근.
// 비교 결과는 사람이 판단하기 위한 보조 지표일 뿐이며, 이 repository의
// 어떤 함수도 실제 게시나 원본 교체, 자동 재작성을 수행하지 않는다.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SocialRewritePerformanceComparisonRow } from "@/lib/supabase/database.types";
import { updateRewritePerformanceComparisonSummary } from "./social-posts-repository";
import type { SocialPost, RewritePerformanceComparison } from "@/lib/social/social-platform-types";

export function mapRewritePerformanceComparisonRow(
  row: SocialRewritePerformanceComparisonRow
): RewritePerformanceComparison {
  return {
    id: row.id,
    articleId: row.article_id,
    rootSocialPostId: row.root_social_post_id,
    originalSocialPostId: row.original_social_post_id,
    rewriteSocialPostId: row.rewrite_social_post_id,
    rewriteSourceSuggestionId: row.rewrite_source_suggestion_id,
    versionComparisonId: row.version_comparison_id,
    platform: row.platform,
    toneStyle: row.tone_style,
    originalVersionNumber: row.original_version_number,
    rewriteVersionNumber: row.rewrite_version_number,

    originalMetricsId: row.original_metrics_id,
    originalMeasuredAt: row.original_measured_at,
    originalViews: row.original_views,
    originalImpressions: row.original_impressions,
    originalReach: row.original_reach,
    originalLikes: row.original_likes,
    originalComments: row.original_comments,
    originalShares: row.original_shares,
    originalSaves: row.original_saves,
    originalClicks: row.original_clicks,
    originalProfileVisits: row.original_profile_visits,
    originalFollows: row.original_follows,
    originalConversionCount: row.original_conversion_count,
    originalEngagementRate: row.original_engagement_rate,
    originalClickThroughRate: row.original_click_through_rate,
    originalConversionRate: row.original_conversion_rate,
    originalPerformanceScore: row.original_performance_score,
    originalPerformanceStatus: row.original_performance_status,

    rewriteMetricsId: row.rewrite_metrics_id,
    rewriteMeasuredAt: row.rewrite_measured_at,
    rewriteViews: row.rewrite_views,
    rewriteImpressions: row.rewrite_impressions,
    rewriteReach: row.rewrite_reach,
    rewriteLikes: row.rewrite_likes,
    rewriteComments: row.rewrite_comments,
    rewriteShares: row.rewrite_shares,
    rewriteSaves: row.rewrite_saves,
    rewriteClicks: row.rewrite_clicks,
    rewriteProfileVisits: row.rewrite_profile_visits,
    rewriteFollows: row.rewrite_follows,
    rewriteConversionCount: row.rewrite_conversion_count,
    rewriteEngagementRate: row.rewrite_engagement_rate,
    rewriteClickThroughRate: row.rewrite_click_through_rate,
    rewriteConversionRate: row.rewrite_conversion_rate,
    rewritePerformanceScore: row.rewrite_performance_score,
    rewritePerformanceStatus: row.rewrite_performance_status,

    comparisonStatus: row.comparison_status as RewritePerformanceComparison["comparisonStatus"],
    winner: row.winner as RewritePerformanceComparison["winner"],
    performanceScoreDelta: row.performance_score_delta,
    performanceScoreDeltaRate: row.performance_score_delta_rate,
    viewsDelta: row.views_delta,
    viewsDeltaRate: row.views_delta_rate,
    impressionsDelta: row.impressions_delta,
    impressionsDeltaRate: row.impressions_delta_rate,
    engagementRateDelta: row.engagement_rate_delta,
    clickThroughRateDelta: row.click_through_rate_delta,
    clicksDelta: row.clicks_delta,
    clicksDeltaRate: row.clicks_delta_rate,
    commentsDelta: row.comments_delta,
    commentsDeltaRate: row.comments_delta_rate,
    sharesDelta: row.shares_delta,
    sharesDeltaRate: row.shares_delta_rate,
    savesDelta: row.saves_delta,
    savesDeltaRate: row.saves_delta_rate,
    improvementSummary: row.improvement_summary,
    platformSpecificSummary: row.platform_specific_summary,
    warnings: row.warnings as unknown as Record<string, unknown>[],
    failures: row.failures as unknown as Record<string, unknown>[],
    comparedBy: row.compared_by,
    comparedAt: row.compared_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateRewritePerformanceComparisonInput {
  articleId: string;
  rootSocialPostId: string;
  originalSocialPostId: string;
  rewriteSocialPostId: string;
  rewriteSourceSuggestionId?: string | null;
  versionComparisonId?: string | null;
  platform: SocialRewritePerformanceComparisonRow["platform"];
  toneStyle?: SocialRewritePerformanceComparisonRow["tone_style"];
  originalVersionNumber?: number | null;
  rewriteVersionNumber?: number | null;

  originalMetricsId?: string | null;
  originalMeasuredAt?: string | null;
  originalViews?: number;
  originalImpressions?: number;
  originalReach?: number;
  originalLikes?: number;
  originalComments?: number;
  originalShares?: number;
  originalSaves?: number;
  originalClicks?: number;
  originalProfileVisits?: number;
  originalFollows?: number;
  originalConversionCount?: number;
  originalEngagementRate?: number | null;
  originalClickThroughRate?: number | null;
  originalConversionRate?: number | null;
  originalPerformanceScore?: number | null;
  originalPerformanceStatus?: string | null;

  rewriteMetricsId?: string | null;
  rewriteMeasuredAt?: string | null;
  rewriteViews?: number;
  rewriteImpressions?: number;
  rewriteReach?: number;
  rewriteLikes?: number;
  rewriteComments?: number;
  rewriteShares?: number;
  rewriteSaves?: number;
  rewriteClicks?: number;
  rewriteProfileVisits?: number;
  rewriteFollows?: number;
  rewriteConversionCount?: number;
  rewriteEngagementRate?: number | null;
  rewriteClickThroughRate?: number | null;
  rewriteConversionRate?: number | null;
  rewritePerformanceScore?: number | null;
  rewritePerformanceStatus?: string | null;

  comparisonStatus: RewritePerformanceComparison["comparisonStatus"];
  winner?: RewritePerformanceComparison["winner"];
  performanceScoreDelta?: number | null;
  performanceScoreDeltaRate?: number | null;
  viewsDelta?: number | null;
  viewsDeltaRate?: number | null;
  impressionsDelta?: number | null;
  impressionsDeltaRate?: number | null;
  engagementRateDelta?: number | null;
  clickThroughRateDelta?: number | null;
  clicksDelta?: number | null;
  clicksDeltaRate?: number | null;
  commentsDelta?: number | null;
  commentsDeltaRate?: number | null;
  sharesDelta?: number | null;
  sharesDeltaRate?: number | null;
  savesDelta?: number | null;
  savesDeltaRate?: number | null;
  improvementSummary?: Record<string, unknown>;
  platformSpecificSummary?: Record<string, unknown>;
  warnings?: Record<string, unknown>[];
  failures?: Record<string, unknown>[];
  comparedBy?: string | null;
  comparedAt?: string | null;
}

/** 원본 vs rewrite 성과 비교 결과를 저장한다. */
export async function createRewritePerformanceComparison(
  input: CreateRewritePerformanceComparisonInput
): Promise<RewritePerformanceComparison> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_rewrite_performance_comparisons")
    .insert({
      article_id: input.articleId,
      root_social_post_id: input.rootSocialPostId,
      original_social_post_id: input.originalSocialPostId,
      rewrite_social_post_id: input.rewriteSocialPostId,
      rewrite_source_suggestion_id: input.rewriteSourceSuggestionId ?? null,
      version_comparison_id: input.versionComparisonId ?? null,
      platform: input.platform,
      tone_style: input.toneStyle ?? null,
      original_version_number: input.originalVersionNumber ?? null,
      rewrite_version_number: input.rewriteVersionNumber ?? null,

      original_metrics_id: input.originalMetricsId ?? null,
      original_measured_at: input.originalMeasuredAt ?? null,
      original_views: input.originalViews ?? 0,
      original_impressions: input.originalImpressions ?? 0,
      original_reach: input.originalReach ?? 0,
      original_likes: input.originalLikes ?? 0,
      original_comments: input.originalComments ?? 0,
      original_shares: input.originalShares ?? 0,
      original_saves: input.originalSaves ?? 0,
      original_clicks: input.originalClicks ?? 0,
      original_profile_visits: input.originalProfileVisits ?? 0,
      original_follows: input.originalFollows ?? 0,
      original_conversion_count: input.originalConversionCount ?? 0,
      original_engagement_rate: input.originalEngagementRate ?? null,
      original_click_through_rate: input.originalClickThroughRate ?? null,
      original_conversion_rate: input.originalConversionRate ?? null,
      original_performance_score: input.originalPerformanceScore ?? null,
      original_performance_status: input.originalPerformanceStatus ?? null,

      rewrite_metrics_id: input.rewriteMetricsId ?? null,
      rewrite_measured_at: input.rewriteMeasuredAt ?? null,
      rewrite_views: input.rewriteViews ?? 0,
      rewrite_impressions: input.rewriteImpressions ?? 0,
      rewrite_reach: input.rewriteReach ?? 0,
      rewrite_likes: input.rewriteLikes ?? 0,
      rewrite_comments: input.rewriteComments ?? 0,
      rewrite_shares: input.rewriteShares ?? 0,
      rewrite_saves: input.rewriteSaves ?? 0,
      rewrite_clicks: input.rewriteClicks ?? 0,
      rewrite_profile_visits: input.rewriteProfileVisits ?? 0,
      rewrite_follows: input.rewriteFollows ?? 0,
      rewrite_conversion_count: input.rewriteConversionCount ?? 0,
      rewrite_engagement_rate: input.rewriteEngagementRate ?? null,
      rewrite_click_through_rate: input.rewriteClickThroughRate ?? null,
      rewrite_conversion_rate: input.rewriteConversionRate ?? null,
      rewrite_performance_score: input.rewritePerformanceScore ?? null,
      rewrite_performance_status: input.rewritePerformanceStatus ?? null,

      comparison_status: input.comparisonStatus,
      winner: input.winner ?? null,
      performance_score_delta: input.performanceScoreDelta ?? null,
      performance_score_delta_rate: input.performanceScoreDeltaRate ?? null,
      views_delta: input.viewsDelta ?? null,
      views_delta_rate: input.viewsDeltaRate ?? null,
      impressions_delta: input.impressionsDelta ?? null,
      impressions_delta_rate: input.impressionsDeltaRate ?? null,
      engagement_rate_delta: input.engagementRateDelta ?? null,
      click_through_rate_delta: input.clickThroughRateDelta ?? null,
      clicks_delta: input.clicksDelta ?? null,
      clicks_delta_rate: input.clicksDeltaRate ?? null,
      comments_delta: input.commentsDelta ?? null,
      comments_delta_rate: input.commentsDeltaRate ?? null,
      shares_delta: input.sharesDelta ?? null,
      shares_delta_rate: input.sharesDeltaRate ?? null,
      saves_delta: input.savesDelta ?? null,
      saves_delta_rate: input.savesDeltaRate ?? null,
      improvement_summary: input.improvementSummary ?? {},
      platform_specific_summary: input.platformSpecificSummary ?? {},
      warnings: (input.warnings ?? []) as unknown as Record<string, unknown>[],
      failures: (input.failures ?? []) as unknown as Record<string, unknown>[],
      compared_by: input.comparedBy ?? null,
      compared_at: input.comparedAt ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`rewrite 성과 비교 결과 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapRewritePerformanceComparisonRow(data);
}

/** id로 비교 결과 하나를 조회한다. 없으면 null. */
export async function getRewritePerformanceComparisonById(id: string): Promise<RewritePerformanceComparison | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.from("social_rewrite_performance_comparisons").select().eq("id", id).maybeSingle();

  if (error) {
    throw new Error(`rewrite 성과 비교 결과 조회에 실패했습니다: ${error.message}`);
  }

  return data ? mapRewritePerformanceComparisonRow(data) : null;
}

/** 특정 기사에 속한 모든 비교 결과를 최신순으로 조회한다. */
export async function listRewritePerformanceComparisonsByArticle(articleId: string): Promise<RewritePerformanceComparison[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_rewrite_performance_comparisons")
    .select()
    .eq("article_id", articleId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`기사별 rewrite 성과 비교 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapRewritePerformanceComparisonRow);
}

/** 특정 root social post에 속한 모든 비교 결과를 최신순으로 조회한다. */
export async function listRewritePerformanceComparisonsByRootSocialPost(
  rootSocialPostId: string
): Promise<RewritePerformanceComparison[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_rewrite_performance_comparisons")
    .select()
    .eq("root_social_post_id", rootSocialPostId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`root social post 기준 rewrite 성과 비교 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapRewritePerformanceComparisonRow);
}

/** 특정 rewrite social post에 대한 비교 결과를 최신순으로 조회한다. */
export async function listRewritePerformanceComparisonsByRewriteSocialPost(
  rewriteSocialPostId: string
): Promise<RewritePerformanceComparison[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_rewrite_performance_comparisons")
    .select()
    .eq("rewrite_social_post_id", rewriteSocialPostId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`rewrite social post 기준 rewrite 성과 비교 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapRewritePerformanceComparisonRow);
}

/**
 * social_posts의 rewrite 성과 비교 요약 컬럼을 최신 비교 결과로
 * 갱신한다. social-posts-repository.updateRewritePerformanceComparisonSummary()
 * 를 그대로 위임한다(비교 도메인 관점에서 호출하기 편하도록 이름만
 * 다르게 노출).
 */
export async function updateSocialPostRewritePerformanceSummary(
  socialPostId: string,
  comparison: RewritePerformanceComparison
): Promise<SocialPost> {
  return updateRewritePerformanceComparisonSummary(socialPostId, {
    latestRewritePerformanceComparisonId: comparison.id,
    rewritePerformanceComparisonStatus: comparison.comparisonStatus,
    rewritePerformanceWinner: comparison.winner,
    rewritePerformanceScoreDelta: comparison.performanceScoreDelta,
    rewritePerformanceImprovementRate: comparison.performanceScoreDeltaRate,
    rewritePerformanceSummary: comparison.improvementSummary,
  });
}
