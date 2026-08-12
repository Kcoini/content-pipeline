import Link from "next/link";
import { buildSocialPerformanceDashboard } from "@/lib/social/social-performance-dashboard-service";
import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import {
  isSocialPlatform,
  isToneStyle,
  type SocialPlatform,
  type ToneStyle,
  type SocialPerformanceStatus,
  type ManualPostStatus,
} from "@/lib/social/social-platform-types";
import { DEFAULT_DASHBOARD_SORT, type DashboardSortOption, type LowPerformanceSocialPost } from "@/lib/social/social-performance-dashboard-types";
import { SocialPerformanceSummaryCards } from "@/components/social-performance-dashboard/social-performance-summary-cards";
import { PlatformPerformanceTable } from "@/components/social-performance-dashboard/platform-performance-table";
import { TonePerformanceTable } from "@/components/social-performance-dashboard/tone-performance-table";
import { ArticlePerformanceTable } from "@/components/social-performance-dashboard/article-performance-table";
import { LowPerformancePostsTable } from "@/components/social-performance-dashboard/low-performance-posts-table";
import { MetricsMissingPostsTable } from "@/components/social-performance-dashboard/metrics-missing-posts-table";
import { RewritePerformanceSummary } from "@/components/social-performance-dashboard/rewrite-performance-summary";
import { RecentMetricsTable } from "@/components/social-performance-dashboard/recent-metrics-table";
import { RecentRewriteComparisonsTable } from "@/components/social-performance-dashboard/recent-rewrite-comparisons-table";
import { DashboardFilterControls } from "@/components/social-performance-dashboard/dashboard-filter-controls";

export const dynamic = "force-dynamic";

const VALID_SORT_OPTIONS: DashboardSortOption[] = [
  "latest_metrics_recorded_at desc",
  "latest_performance_score desc",
  "latest_performance_score asc",
  "latest_views desc",
  "latest_clicks desc",
  "latest_engagement_rate desc",
  "rewrite_performance_score_delta desc",
  "created_at desc",
  "updated_at desc",
];

function parseSort(value: string | undefined): DashboardSortOption {
  if (value && (VALID_SORT_OPTIONS as string[]).includes(value)) {
    return value as DashboardSortOption;
  }
  return DEFAULT_DASHBOARD_SORT;
}

function sortLowPerformancePosts(posts: LowPerformanceSocialPost[], sort: DashboardSortOption): LowPerformanceSocialPost[] {
  const sorted = [...posts];
  switch (sort) {
    case "latest_performance_score desc":
      return sorted.sort((a, b) => (b.performanceScore ?? -Infinity) - (a.performanceScore ?? -Infinity));
    case "latest_performance_score asc":
      return sorted.sort((a, b) => (a.performanceScore ?? Infinity) - (b.performanceScore ?? Infinity));
    case "latest_views desc":
      return sorted.sort((a, b) => b.latestViews - a.latestViews);
    case "latest_clicks desc":
      return sorted.sort((a, b) => b.latestClicks - a.latestClicks);
    case "latest_engagement_rate desc":
      return sorted.sort((a, b) => (b.latestEngagementRate ?? -Infinity) - (a.latestEngagementRate ?? -Infinity));
    case "updated_at desc":
      return sorted.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
    default:
      return sorted;
  }
}

export default async function SocialPerformanceDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    platform?: string;
    toneStyle?: string;
    performanceStatus?: string;
    manualPostStatus?: string;
    includeRewriteVersions?: string;
    onlyRewriteVersions?: string;
    onlyRecommendedForRepost?: string;
    onlyLowPerformance?: string;
    onlyMetricsMissing?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;

  const filter = {
    platform: isSocialPlatform(params.platform) ? (params.platform as SocialPlatform) : undefined,
    toneStyle: isToneStyle(params.toneStyle) ? (params.toneStyle as ToneStyle) : undefined,
    performanceStatus: (params.performanceStatus || undefined) as SocialPerformanceStatus | undefined,
    manualPostStatus: (params.manualPostStatus || undefined) as ManualPostStatus | undefined,
    includeRewriteVersions: params.includeRewriteVersions !== undefined ? params.includeRewriteVersions === "true" : true,
    onlyRewriteVersions: params.onlyRewriteVersions === "true",
    onlyRecommendedForRepost: params.onlyRecommendedForRepost === "true",
    onlyLowPerformance: params.onlyLowPerformance === "true",
    onlyMetricsMissing: params.onlyMetricsMissing === "true",
  };
  const sort = parseSort(params.sort);

  const dashboard = await buildSocialPerformanceDashboard(filter, sort);

  const sortedLowPerformancePosts = sortLowPerformancePosts(dashboard.lowPerformancePosts, sort);

  const bestRewritePost = dashboard.rewritePerformanceSummary.bestRewriteSocialPostId
    ? await getSocialPostById(dashboard.rewritePerformanceSummary.bestRewriteSocialPostId)
    : null;
  const articleIdBySocialPostId = new Map<string, string>();
  if (bestRewritePost) articleIdBySocialPostId.set(bestRewritePost.id, bestRewritePost.articleId);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Social Performance Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-600">
              이 대시보드는 수동 입력된 metrics를 기반으로 한 내부 비교용입니다.
            </p>
          </div>
          <Link href="/dashboard" className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
            메인 대시보드로
          </Link>
        </header>

        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p>metrics는 외부 API가 아니라 수동 입력값입니다.</p>
          <p>performance_score는 내부 비교용 점수이며, 절대적인 마케팅 성공 지표가 아닙니다.</p>
          <p>rewrite comparison은 동일 조건의 A/B 테스트가 아니므로 참고 지표로만 사용하세요.</p>
          <p>이 화면을 조회하는 것만으로는 어떤 social_post 상태도 변경되지 않습니다.</p>
        </div>

        <DashboardFilterControls filter={filter} sort={sort} />

        <SocialPerformanceSummaryCards summary={dashboard.summary} bestPlatform={dashboard.bestPlatform} bestToneStyle={dashboard.bestToneStyle} />

        <PlatformPerformanceTable summaries={dashboard.platformSummaries} bestPlatform={dashboard.bestPlatform} />

        <TonePerformanceTable summaries={dashboard.toneSummaries} bestToneStyle={dashboard.bestToneStyle} />

        <ArticlePerformanceTable summaries={dashboard.articleSummaries} />

        <LowPerformancePostsTable posts={sortedLowPerformancePosts} />

        <MetricsMissingPostsTable posts={dashboard.metricsMissingPosts} />

        <RewritePerformanceSummary summary={dashboard.rewritePerformanceSummary} articleIdBySocialPostId={articleIdBySocialPostId} />

        <RecentMetricsTable metrics={dashboard.recentMetrics} />

        <RecentRewriteComparisonsTable comparisons={dashboard.recentRewriteComparisons} />
      </div>
    </div>
  );
}
