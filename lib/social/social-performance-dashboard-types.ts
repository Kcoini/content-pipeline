// Phase 3-15: Social Performance Dashboard — 읽기 전용 대시보드 타입 정의.
// 이 파일이 정의하는 모든 타입은 Phase 3-9~3-14에서 이미 저장된 데이터를
// 조회/집계해 보여주기 위한 것이며, 어떤 필드도 social_posts 상태를
// 변경하는 데 사용되지 않는다. performance_score/engagement 관련 값은
// 모두 내부 비교용 참고 지표다.

import type { SocialPlatform, ToneStyle, SocialPerformanceStatus, ManualPostStatus } from "./social-platform-types";
import type { SocialPostMetrics } from "./social-metrics-types";
import type { RewritePerformanceComparison } from "./social-platform-types";
import type { ContentGroup } from "./content-type-classifier";

export interface SocialPerformanceDashboardSummary {
  totalSocialPosts: number;
  publishedPosts: number;
  manualPostedPosts: number;
  metricsMeasuredPosts: number;
  metricsMissingPosts: number;
  averagePerformanceScore: number | null;
  bestPerformanceScore: number | null;
  worstPerformanceScore: number | null;
  totalViews: number;
  totalImpressions: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalClicks: number;
  averageEngagementRate: number | null;
  averageClickThroughRate: number | null;
  rewriteVersionsCount: number;
  rewriteComparisonsCount: number;
  rewriteWonCount: number;
  originalWonCount: number;
  similarCount: number;
  needsMoreDataCount: number;
}

export interface PlatformPerformanceSummary {
  platform: SocialPlatform;
  postCount: number;
  manualPostedCount: number;
  metricsMeasuredCount: number;
  averagePerformanceScore: number | null;
  averageEngagementRate: number | null;
  totalViews: number;
  totalImpressions: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalClicks: number;
  bestSocialPostId: string | null;
  worstSocialPostId: string | null;
}

export interface TonePerformanceSummary {
  toneStyle: ToneStyle;
  postCount: number;
  averagePerformanceScore: number | null;
  averageEngagementRate: number | null;
  totalViews: number;
  totalImpressions: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalClicks: number;
  bestSocialPostId: string | null;
}

export interface ArticlePerformanceSummary {
  articleId: string;
  articleTitle: string | null;
  socialPostCount: number;
  platformCount: number;
  metricsMeasuredCount: number;
  averagePerformanceScore: number | null;
  bestPlatform: SocialPlatform | null;
  bestToneStyle: ToneStyle | null;
  bestSocialPostId: string | null;
  rewriteComparisonCount: number;
  rewriteWonCount: number;
}

export interface RewritePerformanceSummary {
  rewriteWonCount: number;
  originalWonCount: number;
  similarCount: number;
  needsMoreDataCount: number;
  averagePerformanceScoreDelta: number | null;
  bestRewriteSocialPostId: string | null;
  worstRewriteSocialPostId: string | null;
  bestPlatforms: SocialPlatform[];
  bestToneStyles: ToneStyle[];
}

export interface LowPerformanceSocialPost {
  id: string;
  articleId: string;
  platform: SocialPlatform;
  toneStyle: ToneStyle;
  performanceStatus: SocialPerformanceStatus;
  performanceScore: number | null;
  latestViews: number;
  latestEngagementRate: number | null;
  latestClicks: number;
  rewriteSuggestionStatus: string;
  postUrl: string | null;
  updatedAt: string;
}

export interface MetricsMissingSocialPost {
  id: string;
  articleId: string;
  platform: SocialPlatform;
  toneStyle: ToneStyle;
  manualPostStatus: ManualPostStatus;
  postUrl: string | null;
  manualPostedAt: string | null;
  updatedAt: string;
}

export interface DashboardFilter {
  articleId?: string;
  platform?: SocialPlatform;
  toneStyle?: ToneStyle;
  performanceStatus?: SocialPerformanceStatus;
  manualPostStatus?: ManualPostStatus;
  /** Phase 3-16: content group(blog/community/social/rewrite/performance)으로 좁혀 본다. "all"이면 필터를 적용하지 않는다. */
  contentGroup?: ContentGroup | "all";
  dateFrom?: string;
  dateTo?: string;
  includeRewriteVersions: boolean;
  onlyRewriteVersions: boolean;
  onlyRecommendedForRepost: boolean;
  onlyMetricsMissing: boolean;
  onlyLowPerformance: boolean;
}

/** Phase 3-16: article 중심으로 blog/community/social/rewrite 글 개수와 게시/성과 현황을 요약한다. */
export interface ArticleContentBreakdown {
  articleId: string;
  articleTitle: string | null;
  blogCount: number;
  communityCount: number;
  socialCount: number;
  rewriteCount: number;
  publishedCount: number;
  metricsMeasuredCount: number;
  lowPerformanceCount: number;
  rewriteSuggestionCount: number;
  rewriteComparisonCount: number;
}

export type DashboardSortOption =
  | "latest_metrics_recorded_at desc"
  | "latest_performance_score desc"
  | "latest_performance_score asc"
  | "latest_views desc"
  | "latest_clicks desc"
  | "latest_engagement_rate desc"
  | "rewrite_performance_score_delta desc"
  | "created_at desc"
  | "updated_at desc";

/** buildSocialPerformanceDashboard()가 반환하는 대시보드 전체 데이터 묶음. */
export interface SocialPerformanceDashboard {
  filter: DashboardFilter;
  sort: DashboardSortOption;
  summary: SocialPerformanceDashboardSummary;
  platformSummaries: PlatformPerformanceSummary[];
  toneSummaries: TonePerformanceSummary[];
  articleSummaries: ArticlePerformanceSummary[];
  lowPerformancePosts: LowPerformanceSocialPost[];
  metricsMissingPosts: MetricsMissingSocialPost[];
  rewritePerformanceSummary: RewritePerformanceSummary;
  recentMetrics: SocialPostMetrics[];
  recentRewriteComparisons: RewritePerformanceComparison[];
  bestPlatform: SocialPlatform | null;
  bestToneStyle: ToneStyle | null;
}

/**
 * Phase 3-16: 기본값을 좁혀서 처음 열었을 때 정보량을 줄인다 — rewrite
 * version은 기본으로 숨기고(Rewrite Dashboard에서 별도로 본다),
 * 최근 수정 순으로 정렬한다.
 */
export const DEFAULT_DASHBOARD_FILTER: DashboardFilter = {
  contentGroup: "all",
  includeRewriteVersions: false,
  onlyRewriteVersions: false,
  onlyRecommendedForRepost: false,
  onlyMetricsMissing: false,
  onlyLowPerformance: false,
};

export const DEFAULT_DASHBOARD_SORT: DashboardSortOption = "updated_at desc";
