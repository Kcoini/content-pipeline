// Phase 3-9: social_post_metrics / social_posts latest metrics 데이터 접근.
// 실제 플랫폼 Analytics/Insights API 호출은 하지 않는다 — 모든 수치는
// 사람이 입력한 값을 그대로 저장한다.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SocialPostMetricsRow, SocialPostRow } from "@/lib/supabase/database.types";
import { mapSocialPostRow } from "./social-posts-repository";
import type { SocialPost } from "@/lib/social/social-platform-types";
import type { SocialPostMetrics, SocialMetricsSummary } from "@/lib/social/social-metrics-types";

export function mapSocialPostMetricsRow(row: SocialPostMetricsRow): SocialPostMetrics {
  return {
    id: row.id,
    socialPostId: row.social_post_id,
    articleId: row.article_id,
    platform: row.platform,
    measuredAt: row.measured_at,
    recordedBy: row.recorded_by,
    views: row.views,
    impressions: row.impressions,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    saves: row.saves,
    clicks: row.clicks,
    profileVisits: row.profile_visits,
    follows: row.follows,
    reach: row.reach,
    engagementRate: row.engagement_rate,
    clickThroughRate: row.click_through_rate,
    conversionCount: row.conversion_count,
    conversionRate: row.conversion_rate,
    performanceScore: row.performance_score,
    notes: row.notes,
    rawMetrics: row.raw_metrics,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateSocialPostMetricsInput {
  socialPostId: string;
  articleId: string;
  platform: SocialPostMetricsRow["platform"];
  measuredAt?: string;
  recordedBy?: string | null;
  views?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  profileVisits?: number;
  follows?: number;
  reach?: number;
  engagementRate?: number | null;
  clickThroughRate?: number | null;
  conversionCount?: number;
  conversionRate?: number | null;
  performanceScore?: number | null;
  notes?: string | null;
  rawMetrics?: Record<string, unknown>;
}

/** social_post_metrics에 새 측정 row를 insert한다 (이력 누적, 기존 row는 수정하지 않음). */
export async function createSocialPostMetrics(input: CreateSocialPostMetricsInput): Promise<SocialPostMetrics> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_metrics")
    .insert({
      social_post_id: input.socialPostId,
      article_id: input.articleId,
      platform: input.platform,
      measured_at: input.measuredAt ?? new Date().toISOString(),
      recorded_by: input.recordedBy ?? null,
      views: input.views ?? 0,
      impressions: input.impressions ?? 0,
      likes: input.likes ?? 0,
      comments: input.comments ?? 0,
      shares: input.shares ?? 0,
      saves: input.saves ?? 0,
      clicks: input.clicks ?? 0,
      profile_visits: input.profileVisits ?? 0,
      follows: input.follows ?? 0,
      reach: input.reach ?? 0,
      engagement_rate: input.engagementRate ?? null,
      click_through_rate: input.clickThroughRate ?? null,
      conversion_count: input.conversionCount ?? 0,
      conversion_rate: input.conversionRate ?? null,
      performance_score: input.performanceScore ?? null,
      notes: input.notes ?? null,
      raw_metrics: input.rawMetrics ?? {},
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`social post metrics 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostMetricsRow(data);
}

/** 특정 social post의 metrics 이력을 최신순으로 조회한다. */
export async function listMetricsBySocialPost(socialPostId: string): Promise<SocialPostMetrics[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_metrics")
    .select()
    .eq("social_post_id", socialPostId)
    .order("measured_at", { ascending: false });

  if (error) {
    throw new Error(`social post metrics 이력 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostMetricsRow);
}

/** 특정 social post의 가장 최근 metrics 한 건을 조회한다. 없으면 null. */
export async function getLatestMetricsBySocialPost(socialPostId: string): Promise<SocialPostMetrics | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_metrics")
    .select()
    .eq("social_post_id", socialPostId)
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`최신 social post metrics 조회에 실패했습니다: ${error.message}`);
  }

  return data ? mapSocialPostMetricsRow(data) : null;
}

/** social_posts의 latest_ 및 performance_ 관련 컬럼을 최신 측정값으로 갱신한다. */
export async function updateSocialPostLatestMetrics(socialPostId: string, summary: SocialMetricsSummary): Promise<SocialPost> {
  const supabase = createServerSupabaseClient();

  const update: Partial<SocialPostRow> = {
    latest_metrics_id: summary.latestMetricsId,
    latest_metrics_recorded_at: summary.latestMetricsRecordedAt,
    latest_views: summary.latestViews,
    latest_impressions: summary.latestImpressions,
    latest_likes: summary.latestLikes,
    latest_comments: summary.latestComments,
    latest_shares: summary.latestShares,
    latest_saves: summary.latestSaves,
    latest_clicks: summary.latestClicks,
    latest_engagement_rate: summary.latestEngagementRate,
    latest_click_through_rate: summary.latestClickThroughRate,
    latest_performance_score: summary.latestPerformanceScore,
    performance_status: summary.performanceStatus,
    performance_summary: summary.performanceSummary,
  };

  const { data, error } = await supabase.from("social_posts").update(update).eq("id", socialPostId).select().single();

  if (error || !data) {
    throw new Error(`social post 최신 성과 요약 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

/** 특정 기사에 속한 모든 social post의 metrics 이력을 최신순으로 조회한다. */
export async function listMetricsByArticle(articleId: string): Promise<SocialPostMetrics[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_metrics")
    .select()
    .eq("article_id", articleId)
    .order("measured_at", { ascending: false });

  if (error) {
    throw new Error(`기사별 social post metrics 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostMetricsRow);
}

/** 특정 기사에 속한 social post들의 최신 성과 요약(social_posts의 latest_*)만 모아 조회한다. */
export async function listPerformanceSummaryByArticle(articleId: string): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("article_id", articleId)
    .order("latest_performance_score", { ascending: false });

  if (error) {
    throw new Error(`기사별 성과 요약 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}
