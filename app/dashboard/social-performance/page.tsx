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
import { DEFAULT_DASHBOARD_FILTER, DEFAULT_DASHBOARD_SORT, type DashboardSortOption, type LowPerformanceSocialPost } from "@/lib/social/social-performance-dashboard-types";
import type { ContentGroup } from "@/lib/social/content-type-classifier";
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
import { buildSocialPerformanceCharts } from "@/lib/social/social-performance-chart-service";
import { ChartSection } from "@/components/social-performance-dashboard/charts/chart-section";
import { PlatformPerformanceChart } from "@/components/social-performance-dashboard/charts/platform-performance-chart";
import { TonePerformanceChart } from "@/components/social-performance-dashboard/charts/tone-performance-chart";
import { MetricsTrendChart } from "@/components/social-performance-dashboard/charts/metrics-trend-chart";
import { RewriteComparisonChart } from "@/components/social-performance-dashboard/charts/rewrite-comparison-chart";
import { LowPerformanceChart } from "@/components/social-performance-dashboard/charts/low-performance-chart";
import { MetricsMissingChart } from "@/components/social-performance-dashboard/charts/metrics-missing-chart";

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
    contentGroup?: string;
    platform?: string;
    toneStyle?: string;
    performanceStatus?: string;
    manualPostStatus?: string;
    includeRewriteVersions?: string;
    onlyRewriteVersions?: string;
    onlyRecommendedForRepost?: string;
    onlyLowPerformance?: string;
    onlyMetricsMissing?: string;
    dateFrom?: string;
    dateTo?: string;
    onlyPublished?: string;
    onlyMeasured?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;

  const VALID_CONTENT_GROUPS: (ContentGroup | "all")[] = ["all", "blog", "community", "social", "rewrite", "performance"];
  const contentGroup = (VALID_CONTENT_GROUPS as string[]).includes(params.contentGroup ?? "")
    ? (params.contentGroup as ContentGroup | "all")
    : "all";

  const filter = {
    contentGroup,
    platform: isSocialPlatform(params.platform) ? (params.platform as SocialPlatform) : undefined,
    toneStyle: isToneStyle(params.toneStyle) ? (params.toneStyle as ToneStyle) : undefined,
    performanceStatus: (params.performanceStatus || undefined) as SocialPerformanceStatus | undefined,
    manualPostStatus: (params.manualPostStatus || undefined) as ManualPostStatus | undefined,
    includeRewriteVersions:
      params.includeRewriteVersions !== undefined ? params.includeRewriteVersions === "true" : DEFAULT_DASHBOARD_FILTER.includeRewriteVersions,
    onlyRewriteVersions: params.onlyRewriteVersions === "true",
    onlyRecommendedForRepost: params.onlyRecommendedForRepost === "true",
    onlyLowPerformance: params.onlyLowPerformance === "true",
    onlyMetricsMissing: params.onlyMetricsMissing === "true",
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
  };
  const sort = parseSort(params.sort);
  const onlyPublished = params.onlyPublished === "true";
  const onlyMeasured = params.onlyMeasured === "true";

  const dashboard = await buildSocialPerformanceDashboard(filter, sort);

  // Phase 3-19: 차트는 테이블과 같은 필터(platform/toneStyle/dateFrom/dateTo/
  // includeRewriteVersions)를 공유하되, 차트 전용 필터(onlyPublished/
  // onlyMeasured)를 추가로 적용한다 — 테이블 조회(dashboard)에는 영향을
  // 주지 않는다.
  const charts = await buildSocialPerformanceCharts({
    platform: filter.platform,
    toneStyle: filter.toneStyle,
    dateFrom: filter.dateFrom,
    dateTo: filter.dateTo,
    includeRewriteVersions: filter.includeRewriteVersions,
    onlyPublished,
    onlyMeasured,
  });

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

        <nav className="flex flex-wrap gap-2 text-xs">
          <Link href="/dashboard/content" className="rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100">
            Content Dashboard
          </Link>
          <Link href="/dashboard/blog" className="rounded border border-blue-300 bg-blue-50 px-2 py-1 font-medium text-blue-700 hover:bg-blue-100">
            Blog Dashboard
          </Link>
          <Link href="/dashboard/rewrite" className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100">
            Rewrite Dashboard
          </Link>
        </nav>

        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p>metrics는 외부 API가 아니라 수동 입력값입니다.</p>
          <p>performance_score는 내부 비교용 점수이며, 절대적인 마케팅 성공 지표가 아닙니다.</p>
          <p>rewrite comparison은 동일 조건의 A/B 테스트가 아니므로 참고 지표로만 사용하세요.</p>
          <p>이 화면을 조회하는 것만으로는 어떤 social_post 상태도 변경되지 않습니다.</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { label: "전체 성과", href: "/dashboard/social-performance" },
            { label: "블로그", href: "/dashboard/social-performance?contentGroup=blog" },
            { label: "SNS/커뮤니티", href: "/dashboard/social-performance?contentGroup=social" },
            { label: "Rewrite", href: "/dashboard/social-performance?contentGroup=rewrite" },
            { label: "Metrics Missing", href: "/dashboard/social-performance?onlyMetricsMissing=true" },
            { label: "Low Performance", href: "/dashboard/social-performance?onlyLowPerformance=true" },
          ].map((tab) => (
            <a key={tab.label} href={tab.href} className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 font-medium text-zinc-600 hover:bg-zinc-100">
              {tab.label}
            </a>
          ))}
        </div>

        <DashboardFilterControls filter={filter} sort={sort} onlyPublished={onlyPublished} onlyMeasured={onlyMeasured} />

        <SocialPerformanceSummaryCards summary={dashboard.summary} bestPlatform={dashboard.bestPlatform} bestToneStyle={dashboard.bestToneStyle} />

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">Chart Overview</h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            아래 차트는 모두 수동 입력된 metrics 기반이며, performance_score는 내부 비교용 참고 지표입니다.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartSection title="Platform Performance" description="플랫폼별 평균 performance_score">
              <PlatformPerformanceChart data={charts.platformPerformanceChart} />
            </ChartSection>
            <ChartSection title="Metrics Trend" description="월별/일별 views·clicks·performance_score 추세" note="실시간 분석이 아니라 dashboard summary용 추세입니다.">
              <MetricsTrendChart data={charts.metricsTrendChart} />
            </ChartSection>
            <ChartSection title="Rewrite Comparison" description="original vs rewrite 성과 비교 분포" note="동일 조건의 A/B 테스트가 아닙니다.">
              <RewriteComparisonChart data={charts.rewriteComparisonChart} />
            </ChartSection>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartSection title="Tone Performance" description="tone_style별 평균 performance_score" collapsible defaultOpen={false}>
              <TonePerformanceChart data={charts.tonePerformanceChart} />
            </ChartSection>
            <ChartSection title="Low Performance 분포" description="performance_status별 social post 개수" collapsible defaultOpen={false}>
              <LowPerformanceChart data={charts.lowPerformanceChart} />
            </ChartSection>
            <ChartSection title="Metrics Missing 현황" description="metrics 측정 완료 vs 미입력 비율" collapsible defaultOpen={false}>
              <MetricsMissingChart data={charts.metricsMissingChart} />
            </ChartSection>
          </div>
        </section>

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
