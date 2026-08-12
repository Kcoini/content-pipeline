import type { PlatformPerformanceSummary } from "@/lib/social/social-performance-dashboard-types";
import { RecommendationBadge } from "./badges";

export function PlatformPerformanceTable({
  summaries,
  bestPlatform,
}: {
  summaries: PlatformPerformanceSummary[];
  bestPlatform: string | null;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-700">Platform Performance</h2>
      {summaries.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">데이터가 없습니다.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="text-zinc-500">
                <th className="pr-3 py-1">platform</th>
                <th className="pr-3 py-1">글 수</th>
                <th className="pr-3 py-1">수동 게시</th>
                <th className="pr-3 py-1">측정됨</th>
                <th className="pr-3 py-1">평균 score</th>
                <th className="pr-3 py-1">평균 engagement</th>
                <th className="pr-3 py-1">조회/노출</th>
                <th className="pr-3 py-1">좋아요/댓글/공유/저장</th>
                <th className="pr-3 py-1">클릭</th>
              </tr>
            </thead>
            <tbody className="text-zinc-700">
              {summaries.map((s) => (
                <tr key={s.platform} className="border-t border-zinc-100">
                  <td className="pr-3 py-1 font-medium">
                    {s.platform}
                    {s.platform === bestPlatform && <RecommendationBadge label="Best Platform" />}
                  </td>
                  <td className="pr-3 py-1">{s.postCount}</td>
                  <td className="pr-3 py-1">{s.manualPostedCount}</td>
                  <td className="pr-3 py-1">{s.metricsMeasuredCount}</td>
                  <td className="pr-3 py-1">{s.averagePerformanceScore?.toFixed(1) ?? "-"}</td>
                  <td className="pr-3 py-1">{s.averageEngagementRate !== null ? `${(s.averageEngagementRate * 100).toFixed(1)}%` : "-"}</td>
                  <td className="pr-3 py-1">
                    {s.totalViews}/{s.totalImpressions}
                  </td>
                  <td className="pr-3 py-1">
                    {s.totalLikes}/{s.totalComments}/{s.totalShares}/{s.totalSaves}
                  </td>
                  <td className="pr-3 py-1">{s.totalClicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
