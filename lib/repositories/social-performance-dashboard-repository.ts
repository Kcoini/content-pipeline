// Phase 3-15: Social Performance Dashboard — 읽기 전용 조회/집계 repository.
// 이 파일의 어떤 함수도 social_posts/social_post_metrics/social_rewrite_
// performance_comparisons 등의 데이터를 수정하지 않는다(select만 사용).
// SQL은 단순한 eq/gte/lte/is 필터만 사용하고, 플랫폼별/문체별 집계처럼
// 복잡한 계산은 조회한 배열을 JS에서 reduce하는 방식으로 처리한다.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapSocialPostRow } from "./social-posts-repository";
import { mapSocialPostMetricsRow } from "./social-metrics-repository";
import { mapRewritePerformanceComparisonRow } from "./social-rewrite-performance-comparisons-repository";
import { getArticles } from "./article-repository";
import type { SocialPost, SocialPlatform, ToneStyle } from "@/lib/social/social-platform-types";
import type {
  DashboardFilter,
  SocialPerformanceDashboardSummary,
  PlatformPerformanceSummary,
  TonePerformanceSummary,
  ArticlePerformanceSummary,
  RewritePerformanceSummary,
  LowPerformanceSocialPost,
  MetricsMissingSocialPost,
} from "@/lib/social/social-performance-dashboard-types";
import type { SocialPostMetrics } from "@/lib/social/social-metrics-types";
import type { RewritePerformanceComparison } from "@/lib/social/social-platform-types";

const LOW_PERFORMANCE_SCORE_THRESHOLD = 40;
const RECENT_LIMIT = 20;

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * 필터에 맞는 social_posts를 조회한다. onlyLowPerformance/
 * onlyMetricsMissing처럼 복합 조건은 여기서 계산하지 않고, 각 조회
 * 함수가 이 목록을 받아 JS에서 다시 걸러낸다.
 */
export async function listSocialPostsForDashboard(filter: DashboardFilter): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  let query = supabase.from("social_posts").select();

  if (filter.articleId) query = query.eq("article_id", filter.articleId);
  if (filter.platform) query = query.eq("platform", filter.platform);
  if (filter.toneStyle) query = query.eq("tone_style", filter.toneStyle);
  if (filter.performanceStatus) query = query.eq("performance_status", filter.performanceStatus);
  if (filter.manualPostStatus) query = query.eq("manual_post_status", filter.manualPostStatus);
  if (filter.dateFrom) query = query.gte("created_at", filter.dateFrom);
  if (filter.dateTo) query = query.lte("created_at", filter.dateTo);
  if (filter.onlyRewriteVersions) {
    query = query.eq("is_rewrite_version", true);
  } else if (!filter.includeRewriteVersions) {
    query = query.eq("is_rewrite_version", false);
  }
  if (filter.onlyRecommendedForRepost) query = query.eq("recommended_for_repost", true);
  if (filter.onlyMetricsMissing) {
    query = query.eq("manual_post_status", "posted").is("latest_metrics_recorded_at", null);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(`대시보드용 social post 조회에 실패했습니다: ${error.message}`);
  }

  const posts = (data ?? []).map(mapSocialPostRow);

  if (filter.onlyLowPerformance) {
    return posts.filter(
      (post) =>
        post.performanceStatus === "low" ||
        post.performanceStatus === "needs_review" ||
        (post.latestPerformanceScore !== null && post.latestPerformanceScore < LOW_PERFORMANCE_SCORE_THRESHOLD)
    );
  }

  return posts;
}

/** 전체 성과 summary를 계산한다. */
export async function getSocialPerformanceDashboardSummary(filter: DashboardFilter): Promise<SocialPerformanceDashboardSummary> {
  const posts = await listSocialPostsForDashboard(filter);
  const comparisons = await listRewriteComparisonsForDashboardFilter(filter);

  const scores = posts.map((p) => p.latestPerformanceScore).filter((v): v is number => v !== null);
  const engagementRates = posts.map((p) => p.latestEngagementRate).filter((v): v is number => v !== null);
  const clickThroughRates = posts.map((p) => p.latestClickThroughRate).filter((v): v is number => v !== null);

  return {
    totalSocialPosts: posts.length,
    publishedPosts: posts.filter((p) => p.publishStatus === "published").length,
    manualPostedPosts: posts.filter((p) => p.manualPostStatus === "posted").length,
    metricsMeasuredPosts: posts.filter((p) => p.latestMetricsRecordedAt !== null).length,
    metricsMissingPosts: posts.filter((p) => p.manualPostStatus === "posted" && p.latestMetricsRecordedAt === null).length,
    averagePerformanceScore: average(scores),
    bestPerformanceScore: scores.length > 0 ? Math.max(...scores) : null,
    worstPerformanceScore: scores.length > 0 ? Math.min(...scores) : null,
    totalViews: posts.reduce((sum, p) => sum + p.latestViews, 0),
    totalImpressions: posts.reduce((sum, p) => sum + p.latestImpressions, 0),
    totalLikes: posts.reduce((sum, p) => sum + p.latestLikes, 0),
    totalComments: posts.reduce((sum, p) => sum + p.latestComments, 0),
    totalShares: posts.reduce((sum, p) => sum + p.latestShares, 0),
    totalSaves: posts.reduce((sum, p) => sum + p.latestSaves, 0),
    totalClicks: posts.reduce((sum, p) => sum + p.latestClicks, 0),
    averageEngagementRate: average(engagementRates),
    averageClickThroughRate: average(clickThroughRates),
    rewriteVersionsCount: posts.filter((p) => p.isRewriteVersion).length,
    rewriteComparisonsCount: comparisons.length,
    rewriteWonCount: comparisons.filter((c) => c.comparisonStatus === "rewrite_won").length,
    originalWonCount: comparisons.filter((c) => c.comparisonStatus === "original_won").length,
    similarCount: comparisons.filter((c) => c.comparisonStatus === "similar").length,
    needsMoreDataCount: comparisons.filter((c) => c.comparisonStatus === "needs_more_data").length,
  };
}

/** platform별 성과 summary 목록을 계산한다. */
export async function listPlatformPerformanceSummaries(filter: DashboardFilter): Promise<PlatformPerformanceSummary[]> {
  const posts = await listSocialPostsForDashboard(filter);

  const byPlatform = new Map<SocialPlatform, SocialPost[]>();
  for (const post of posts) {
    const list = byPlatform.get(post.platform) ?? [];
    list.push(post);
    byPlatform.set(post.platform, list);
  }

  const summaries: PlatformPerformanceSummary[] = [];
  for (const [platform, group] of byPlatform) {
    const scores = group.map((p) => p.latestPerformanceScore).filter((v): v is number => v !== null);
    const engagementRates = group.map((p) => p.latestEngagementRate).filter((v): v is number => v !== null);
    const sorted = [...group].filter((p) => p.latestPerformanceScore !== null).sort((a, b) => (b.latestPerformanceScore ?? 0) - (a.latestPerformanceScore ?? 0));

    summaries.push({
      platform,
      postCount: group.length,
      manualPostedCount: group.filter((p) => p.manualPostStatus === "posted").length,
      metricsMeasuredCount: group.filter((p) => p.latestMetricsRecordedAt !== null).length,
      averagePerformanceScore: average(scores),
      averageEngagementRate: average(engagementRates),
      totalViews: group.reduce((sum, p) => sum + p.latestViews, 0),
      totalImpressions: group.reduce((sum, p) => sum + p.latestImpressions, 0),
      totalLikes: group.reduce((sum, p) => sum + p.latestLikes, 0),
      totalComments: group.reduce((sum, p) => sum + p.latestComments, 0),
      totalShares: group.reduce((sum, p) => sum + p.latestShares, 0),
      totalSaves: group.reduce((sum, p) => sum + p.latestSaves, 0),
      totalClicks: group.reduce((sum, p) => sum + p.latestClicks, 0),
      bestSocialPostId: sorted.length > 0 ? sorted[0].id : null,
      worstSocialPostId: sorted.length > 0 ? sorted[sorted.length - 1].id : null,
    });
  }

  return summaries.sort((a, b) => (b.averagePerformanceScore ?? -Infinity) - (a.averagePerformanceScore ?? -Infinity));
}

/** tone_style별 성과 summary 목록을 계산한다. */
export async function listTonePerformanceSummaries(filter: DashboardFilter): Promise<TonePerformanceSummary[]> {
  const posts = await listSocialPostsForDashboard(filter);

  const byTone = new Map<ToneStyle, SocialPost[]>();
  for (const post of posts) {
    const list = byTone.get(post.toneStyle) ?? [];
    list.push(post);
    byTone.set(post.toneStyle, list);
  }

  const summaries: TonePerformanceSummary[] = [];
  for (const [toneStyle, group] of byTone) {
    const scores = group.map((p) => p.latestPerformanceScore).filter((v): v is number => v !== null);
    const engagementRates = group.map((p) => p.latestEngagementRate).filter((v): v is number => v !== null);
    const sorted = [...group].filter((p) => p.latestPerformanceScore !== null).sort((a, b) => (b.latestPerformanceScore ?? 0) - (a.latestPerformanceScore ?? 0));

    summaries.push({
      toneStyle,
      postCount: group.length,
      averagePerformanceScore: average(scores),
      averageEngagementRate: average(engagementRates),
      totalViews: group.reduce((sum, p) => sum + p.latestViews, 0),
      totalImpressions: group.reduce((sum, p) => sum + p.latestImpressions, 0),
      totalLikes: group.reduce((sum, p) => sum + p.latestLikes, 0),
      totalComments: group.reduce((sum, p) => sum + p.latestComments, 0),
      totalShares: group.reduce((sum, p) => sum + p.latestShares, 0),
      totalClicks: group.reduce((sum, p) => sum + p.latestClicks, 0),
      bestSocialPostId: sorted.length > 0 ? sorted[0].id : null,
    });
  }

  return summaries.sort((a, b) => (b.averagePerformanceScore ?? -Infinity) - (a.averagePerformanceScore ?? -Infinity));
}

/** article별 성과 summary 목록을 계산한다. */
export async function listArticlePerformanceSummaries(filter: DashboardFilter): Promise<ArticlePerformanceSummary[]> {
  const posts = await listSocialPostsForDashboard(filter);
  const comparisons = await listRewriteComparisonsForDashboardFilter(filter);
  const articles = await getArticles();
  const titleByArticleId = new Map(articles.map((a) => [a.id, a.title]));

  const byArticle = new Map<string, SocialPost[]>();
  for (const post of posts) {
    const list = byArticle.get(post.articleId) ?? [];
    list.push(post);
    byArticle.set(post.articleId, list);
  }

  const summaries: ArticlePerformanceSummary[] = [];
  for (const [articleId, group] of byArticle) {
    const scores = group.map((p) => p.latestPerformanceScore).filter((v): v is number => v !== null);
    const sorted = [...group].filter((p) => p.latestPerformanceScore !== null).sort((a, b) => (b.latestPerformanceScore ?? 0) - (a.latestPerformanceScore ?? 0));
    const best = sorted[0];
    const articleComparisons = comparisons.filter((c) => c.articleId === articleId);

    summaries.push({
      articleId,
      articleTitle: titleByArticleId.get(articleId) ?? null,
      socialPostCount: group.length,
      platformCount: new Set(group.map((p) => p.platform)).size,
      metricsMeasuredCount: group.filter((p) => p.latestMetricsRecordedAt !== null).length,
      averagePerformanceScore: average(scores),
      bestPlatform: best?.platform ?? null,
      bestToneStyle: best?.toneStyle ?? null,
      bestSocialPostId: best?.id ?? null,
      rewriteComparisonCount: articleComparisons.length,
      rewriteWonCount: articleComparisons.filter((c) => c.comparisonStatus === "rewrite_won").length,
    });
  }

  return summaries.sort((a, b) => (b.averagePerformanceScore ?? -Infinity) - (a.averagePerformanceScore ?? -Infinity));
}

/** 성과가 낮은(low/needs_review 또는 점수 40 미만) social post 목록을 조회한다. */
export async function listLowPerformanceSocialPosts(filter: DashboardFilter): Promise<LowPerformanceSocialPost[]> {
  const posts = await listSocialPostsForDashboard({ ...filter, onlyLowPerformance: true });

  return posts.map((post) => ({
    id: post.id,
    articleId: post.articleId,
    platform: post.platform,
    toneStyle: post.toneStyle,
    performanceStatus: post.performanceStatus,
    performanceScore: post.latestPerformanceScore,
    latestViews: post.latestViews,
    latestEngagementRate: post.latestEngagementRate,
    latestClicks: post.latestClicks,
    rewriteSuggestionStatus: post.rewriteSuggestionStatus,
    postUrl: post.postUrl,
    updatedAt: post.updatedAt,
  }));
}

/** 수동 게시되었지만 아직 metrics가 입력되지 않은 social post 목록을 조회한다. */
export async function listMetricsMissingSocialPosts(filter: DashboardFilter): Promise<MetricsMissingSocialPost[]> {
  const posts = await listSocialPostsForDashboard({ ...filter, onlyMetricsMissing: true });

  return posts.map((post) => ({
    id: post.id,
    articleId: post.articleId,
    platform: post.platform,
    toneStyle: post.toneStyle,
    manualPostStatus: post.manualPostStatus,
    postUrl: post.postUrl,
    manualPostedAt: post.manualPostedAt,
    updatedAt: post.updatedAt,
  }));
}

async function listRewriteComparisonsForDashboardFilter(filter: DashboardFilter): Promise<RewritePerformanceComparison[]> {
  const supabase = createServerSupabaseClient();

  let query = supabase.from("social_rewrite_performance_comparisons").select();
  if (filter.articleId) query = query.eq("article_id", filter.articleId);
  if (filter.platform) query = query.eq("platform", filter.platform);
  if (filter.toneStyle) query = query.eq("tone_style", filter.toneStyle);

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(`대시보드용 rewrite 성과 비교 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapRewritePerformanceComparisonRow);
}

/** rewrite 성과 비교 요약(전체)을 계산한다. */
export async function listRewritePerformanceSummaries(filter: DashboardFilter): Promise<RewritePerformanceSummary> {
  const comparisons = await listRewriteComparisonsForDashboardFilter(filter);

  const deltas = comparisons.map((c) => c.performanceScoreDelta).filter((v): v is number => v !== null);
  const sorted = [...comparisons].filter((c) => c.performanceScoreDelta !== null).sort((a, b) => (b.performanceScoreDelta ?? 0) - (a.performanceScoreDelta ?? 0));

  const wonComparisons = comparisons.filter((c) => c.comparisonStatus === "rewrite_won");
  const bestPlatforms = Array.from(new Set(wonComparisons.map((c) => c.platform)));
  const bestToneStyles = Array.from(new Set(wonComparisons.map((c) => c.toneStyle).filter((t): t is ToneStyle => t !== null)));

  return {
    rewriteWonCount: comparisons.filter((c) => c.comparisonStatus === "rewrite_won").length,
    originalWonCount: comparisons.filter((c) => c.comparisonStatus === "original_won").length,
    similarCount: comparisons.filter((c) => c.comparisonStatus === "similar").length,
    needsMoreDataCount: comparisons.filter((c) => c.comparisonStatus === "needs_more_data").length,
    averagePerformanceScoreDelta: average(deltas),
    bestRewriteSocialPostId: sorted.length > 0 ? sorted[0].rewriteSocialPostId : null,
    worstRewriteSocialPostId: sorted.length > 0 ? sorted[sorted.length - 1].rewriteSocialPostId : null,
    bestPlatforms,
    bestToneStyles,
  };
}

/** 최근 입력된 metrics 목록을 조회한다 (최대 20건). */
export async function listRecentMetrics(filter: DashboardFilter): Promise<SocialPostMetrics[]> {
  const supabase = createServerSupabaseClient();

  let query = supabase.from("social_post_metrics").select();
  if (filter.articleId) query = query.eq("article_id", filter.articleId);
  if (filter.platform) query = query.eq("platform", filter.platform);

  const { data, error } = await query.order("measured_at", { ascending: false }).limit(RECENT_LIMIT);

  if (error) {
    throw new Error(`최근 metrics 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostMetricsRow);
}

/** 최근 rewrite 성과 비교 목록을 조회한다 (최대 20건). */
export async function listRecentRewriteComparisons(filter: DashboardFilter): Promise<RewritePerformanceComparison[]> {
  const supabase = createServerSupabaseClient();

  let query = supabase.from("social_rewrite_performance_comparisons").select();
  if (filter.articleId) query = query.eq("article_id", filter.articleId);
  if (filter.platform) query = query.eq("platform", filter.platform);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(RECENT_LIMIT);

  if (error) {
    throw new Error(`최근 rewrite 성과 비교 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapRewritePerformanceComparisonRow);
}
