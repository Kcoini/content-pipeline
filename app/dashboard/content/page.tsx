import Link from "next/link";
import { buildContentDashboard } from "@/lib/social/social-performance-dashboard-service";

export const dynamic = "force-dynamic";

export default async function ContentDashboardPage() {
  const breakdowns = await buildContentDashboard();

  const totalArticles = breakdowns.length;
  const totalBlog = breakdowns.reduce((sum, b) => sum + b.blogCount, 0);
  const totalCommunity = breakdowns.reduce((sum, b) => sum + b.communityCount, 0);
  const totalSocial = breakdowns.reduce((sum, b) => sum + b.socialCount, 0);
  const totalRewrite = breakdowns.reduce((sum, b) => sum + b.rewriteCount, 0);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Content Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-600">article 중심으로 블로그/SNS·커뮤니티/rewrite 운영 현황을 한눈에 봅니다.</p>
          </div>
          <Link href="/dashboard/social-performance" className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
            Social Performance Dashboard로
          </Link>
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">Summary</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            <div className="rounded border border-zinc-200 bg-zinc-50 p-2">
              <p className="text-[11px] text-zinc-500">전체 article</p>
              <p className="font-semibold">{totalArticles}</p>
            </div>
            <div className="rounded border border-blue-200 bg-blue-50 p-2">
              <p className="text-[11px] text-blue-700">블로그 글</p>
              <p className="font-semibold text-blue-700">{totalBlog}</p>
            </div>
            <div className="rounded border border-purple-200 bg-purple-50 p-2">
              <p className="text-[11px] text-purple-700">커뮤니티 글</p>
              <p className="font-semibold text-purple-700">{totalCommunity}</p>
            </div>
            <div className="rounded border border-pink-200 bg-pink-50 p-2">
              <p className="text-[11px] text-pink-700">SNS 글</p>
              <p className="font-semibold text-pink-700">{totalSocial}</p>
            </div>
            <div className="rounded border border-indigo-200 bg-indigo-50 p-2">
              <p className="text-[11px] text-indigo-700">Rewrite 글</p>
              <p className="font-semibold text-indigo-700">{totalRewrite}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">Article별 현황</h2>
          {breakdowns.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">아직 생성된 social post가 없습니다.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead>
                  <tr className="text-zinc-500">
                    <th className="pr-3 py-1">기사</th>
                    <th className="pr-3 py-1">블로그</th>
                    <th className="pr-3 py-1">커뮤니티</th>
                    <th className="pr-3 py-1">SNS</th>
                    <th className="pr-3 py-1">Rewrite</th>
                    <th className="pr-3 py-1">게시 완료</th>
                    <th className="pr-3 py-1">metrics 측정</th>
                    <th className="pr-3 py-1">low performance</th>
                    <th className="pr-3 py-1">rewrite suggestion</th>
                    <th className="pr-3 py-1">rewrite comparison</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-700">
                  {breakdowns.map((b) => (
                    <tr key={b.articleId} className="border-t border-zinc-100">
                      <td className="pr-3 py-1 font-medium">
                        <Link href={`/articles/${b.articleId}`} className="text-blue-600 hover:underline">
                          {b.articleTitle ?? b.articleId}
                        </Link>
                      </td>
                      <td className="pr-3 py-1">{b.blogCount}</td>
                      <td className="pr-3 py-1">{b.communityCount}</td>
                      <td className="pr-3 py-1">{b.socialCount}</td>
                      <td className="pr-3 py-1">{b.rewriteCount}</td>
                      <td className="pr-3 py-1">{b.publishedCount}</td>
                      <td className="pr-3 py-1">{b.metricsMeasuredCount}</td>
                      <td className="pr-3 py-1">{b.lowPerformanceCount}</td>
                      <td className="pr-3 py-1">{b.rewriteSuggestionCount}</td>
                      <td className="pr-3 py-1">{b.rewriteComparisonCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
