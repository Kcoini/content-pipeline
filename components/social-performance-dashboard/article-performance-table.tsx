import Link from "next/link";
import type { ArticlePerformanceSummary } from "@/lib/social/social-performance-dashboard-types";

export function ArticlePerformanceTable({ summaries }: { summaries: ArticlePerformanceSummary[] }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-700">Article Performance</h2>
      {summaries.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">데이터가 없습니다.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="text-zinc-500">
                <th className="pr-3 py-1">기사</th>
                <th className="pr-3 py-1">글 수</th>
                <th className="pr-3 py-1">플랫폼 수</th>
                <th className="pr-3 py-1">측정됨</th>
                <th className="pr-3 py-1">평균 score</th>
                <th className="pr-3 py-1">best platform/tone</th>
                <th className="pr-3 py-1">rewrite 비교/승리</th>
              </tr>
            </thead>
            <tbody className="text-zinc-700">
              {summaries.map((s) => (
                <tr key={s.articleId} className="border-t border-zinc-100">
                  <td className="pr-3 py-1 font-medium">
                    <Link href={`/articles/${s.articleId}`} className="text-blue-600 hover:underline">
                      {s.articleTitle ?? s.articleId}
                    </Link>
                  </td>
                  <td className="pr-3 py-1">{s.socialPostCount}</td>
                  <td className="pr-3 py-1">{s.platformCount}</td>
                  <td className="pr-3 py-1">{s.metricsMeasuredCount}</td>
                  <td className="pr-3 py-1">{s.averagePerformanceScore?.toFixed(1) ?? "-"}</td>
                  <td className="pr-3 py-1">
                    {s.bestPlatform ?? "-"} / {s.bestToneStyle ?? "-"}
                  </td>
                  <td className="pr-3 py-1">
                    {s.rewriteComparisonCount}건 / {s.rewriteWonCount}승
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
