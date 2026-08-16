import Link from "next/link";
import { notFound } from "next/navigation";
import { buildArticlePerformancePageData } from "@/lib/social/article-performance-page-service";
import { ArticleWorkflowNavigation } from "@/components/articles/article-workflow-navigation";
import { DeepLinkNotice } from "@/components/navigation/deep-link-highlight";
import { buildArticlePerformanceUrl, buildRewriteVersionDeepLink } from "@/lib/navigation/article-deep-links";
import { SocialPerformanceSummaryCards } from "@/components/social-performance-dashboard/social-performance-summary-cards";
import { PlatformPerformanceTable } from "@/components/social-performance-dashboard/platform-performance-table";
import { TonePerformanceTable } from "@/components/social-performance-dashboard/tone-performance-table";
import { LowPerformancePostsTable } from "@/components/social-performance-dashboard/low-performance-posts-table";
import { MetricsMissingPostsTable } from "@/components/social-performance-dashboard/metrics-missing-posts-table";
import { RewritePerformanceSummary } from "@/components/social-performance-dashboard/rewrite-performance-summary";
import { RecentMetricsTable } from "@/components/social-performance-dashboard/recent-metrics-table";
import { RecentRewriteComparisonsTable } from "@/components/social-performance-dashboard/recent-rewrite-comparisons-table";
import { compareRewritePerformanceAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ArticlePerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    metricsTargetId?: string;
    socialPostId?: string;
    comparisonId?: string;
    section?: string;
    returnTo?: string;
  }>;
}) {
  const { id } = await params;
  const { metricsTargetId, socialPostId: targetSocialPostId, comparisonId: targetComparisonId, returnTo } = await searchParams;
  const { article, dashboard } = await buildArticlePerformancePageData(id);

  if (!article) {
    notFound();
  }

  const articleIdBySocialPostId = new Map<string, string>();
  if (dashboard.rewritePerformanceSummary.bestRewriteSocialPostId) {
    articleIdBySocialPostId.set(dashboard.rewritePerformanceSummary.bestRewriteSocialPostId, article.id);
  }

  // metricsTargetId와 socialPostId는 이 페이지에서 같은 의미(강조할 social_post id)로 취급한다.
  const targetPostId = metricsTargetId ?? targetSocialPostId;
  const knownPostIds = new Set([
    ...dashboard.lowPerformancePosts.map((p) => p.id),
    ...dashboard.metricsMissingPosts.map((p) => p.id),
    ...dashboard.recentMetrics.map((m) => m.socialPostId),
  ]);
  const postTargetFound = targetPostId ? knownPostIds.has(targetPostId) : true;

  const knownComparisonIds = new Set(dashboard.recentRewriteComparisons.map((c) => c.id));
  const comparisonTargetFound = targetComparisonId ? knownComparisonIds.has(targetComparisonId) : true;

  // Phase 3-17: 이 페이지에서 "돌아가기"를 시도하는 액션(성과 비교 실행)이 사용할 self-returnTo.
  const selfReturnTo = buildArticlePerformanceUrl(id);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Link href={`/articles/${id}`} className="text-sm text-zinc-500 hover:underline">
          ← 기사 개요로
        </Link>

        <ArticleWorkflowNavigation articleId={id} active="performance" returnTo={returnTo} />

        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p>성과 페이지입니다. 수동 입력된 metrics를 기반으로 성과와 rewrite 효과를 비교합니다.</p>
          <p>performance_score는 내부 비교용 참고 지표입니다 — 절대적인 마케팅 성공 지표가 아닙니다.</p>
          <p>rewrite comparison은 동일 조건의 A/B 테스트가 아니므로 참고 지표로만 사용하세요.</p>
        </div>

        {targetPostId && <DeepLinkNotice targetId={targetPostId} found={postTargetFound} />}
        {targetComparisonId && <DeepLinkNotice targetId={targetComparisonId} found={comparisonTargetFound} />}

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold">{article.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Link href={`/articles/${id}/blog`} className="rounded border border-blue-300 bg-blue-50 px-2 py-1 font-medium text-blue-700 hover:bg-blue-100">
              Metrics 입력하러 블로그로
            </Link>
            <Link href={`/articles/${id}/social`} className="rounded border border-purple-300 bg-purple-50 px-2 py-1 font-medium text-purple-700 hover:bg-purple-100">
              Metrics 입력하러 SNS로
            </Link>
            <Link href={`/articles/${id}/rewrite`} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100">
              Low performance 글 개선 제안으로 이동
            </Link>
          </div>
        </section>

        <SocialPerformanceSummaryCards summary={dashboard.summary} bestPlatform={dashboard.bestPlatform} bestToneStyle={dashboard.bestToneStyle} />

        <PlatformPerformanceTable summaries={dashboard.platformSummaries} bestPlatform={dashboard.bestPlatform} />

        <TonePerformanceTable summaries={dashboard.toneSummaries} bestToneStyle={dashboard.bestToneStyle} />

        <LowPerformancePostsTable posts={dashboard.lowPerformancePosts} />

        <MetricsMissingPostsTable posts={dashboard.metricsMissingPosts} />

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">Original vs Rewrite 성과 비교 실행</h2>
          <p className="mt-1 text-[11px] text-zinc-500">rewrite version을 선택해 원본과의 성과 비교를 실행합니다.</p>
          {dashboard.summary.rewriteVersionsCount === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">이 기사에는 아직 rewrite version이 없습니다.</p>
          ) : (
            <form action={compareRewritePerformanceAction} className="mt-2 flex flex-wrap items-end gap-2 text-xs">
              <input type="hidden" name="articleId" value={article.id} />
              {/* Phase 3-17: 비교 결과가 생성되면 action이 comparisonId로 이 페이지에 강조 이동시킨다(없으면 이 페이지 기본값). */}
              <input type="hidden" name="returnTo" value={selfReturnTo} />
              <input name="socialPostId" placeholder="rewrite social_post id" className="rounded border border-zinc-300 px-2 py-1" required />
              <button type="submit" className="rounded border border-purple-300 bg-purple-50 px-2 py-1 font-medium text-purple-700 hover:bg-purple-100">
                성과 비교 실행
              </button>
            </form>
          )}
          <p className="mt-2 text-[11px] text-zinc-500">
            비교 대상 rewrite version을 먼저 확인하려면{" "}
            {dashboard.rewritePerformanceSummary.bestRewriteSocialPostId ? (
              <a href={buildRewriteVersionDeepLink(article.id, dashboard.rewritePerformanceSummary.bestRewriteSocialPostId, selfReturnTo)} className="text-indigo-700 hover:underline">
                Rewrite 관리에서 보기 →
              </a>
            ) : (
              <Link href={`/articles/${id}/rewrite`} className="text-indigo-700 hover:underline">
                Rewrite 관리로 이동 →
              </Link>
            )}
          </p>
        </section>

        <RewritePerformanceSummary summary={dashboard.rewritePerformanceSummary} articleIdBySocialPostId={articleIdBySocialPostId} />

        <RecentMetricsTable metrics={dashboard.recentMetrics} />

        <RecentRewriteComparisonsTable comparisons={dashboard.recentRewriteComparisons} />
      </div>
    </div>
  );
}
