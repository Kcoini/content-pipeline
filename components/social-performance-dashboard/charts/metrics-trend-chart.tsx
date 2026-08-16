// Phase 3-19: Dashboard Charts & Trend Visualization.
// 월별/일별 metrics 추세를 보여준다. line chart 구현이 부담스러워
// 스펙 안내대로 "trend table + simple bar sparkline" 형태로 만들었다
// — 각 행이 기간(월/일)이고, views 막대 + performance_score를 함께
// 표시한다.

import type { MetricsTrendChartData } from "@/lib/social/social-performance-chart-types";
import { formatChartNumber, formatMonthLabel, formatScore, normalizeChartValue } from "@/lib/social/chart-formatting";
import { ChartEmptyState } from "./chart-empty-state";

export function MetricsTrendChart({ data }: { data: MetricsTrendChartData }) {
  if (data.points.length === 0) {
    return <ChartEmptyState message="아직 metrics가 입력되지 않았습니다. 수동 게시 후 metrics를 입력하면 차트가 표시됩니다." />;
  }

  const maxViews = Math.max(0, ...data.points.map((p) => p.views));

  return (
    <div>
      <p className="mb-2 text-[11px] text-zinc-400">
        {data.granularity === "month" ? "월별" : "일별"} 집계 (최근 입력된 metrics 기준 — 실시간 분석이 아닙니다)
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead>
            <tr className="text-zinc-500">
              <th className="pr-3 py-1">기간</th>
              <th className="pr-3 py-1">views</th>
              <th className="pr-3 py-1">clicks</th>
              <th className="pr-3 py-1">likes/comments/shares</th>
              <th className="pr-3 py-1">평균 score</th>
            </tr>
          </thead>
          <tbody className="text-zinc-700">
            {data.points.map((point) => (
              <tr key={point.period} className="border-t border-zinc-100">
                <td className="pr-3 py-1 whitespace-nowrap">
                  {data.granularity === "month" ? formatMonthLabel(point.period) : point.period}
                </td>
                <td className="pr-3 py-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 rounded bg-zinc-100">
                      <div className="h-2 rounded bg-blue-500" style={{ width: `${normalizeChartValue(point.views, maxViews)}%` }} />
                    </div>
                    <span>{formatChartNumber(point.views)}</span>
                  </div>
                </td>
                <td className="pr-3 py-1">{formatChartNumber(point.clicks)}</td>
                <td className="pr-3 py-1">
                  {formatChartNumber(point.likes)}/{formatChartNumber(point.comments)}/{formatChartNumber(point.shares)}
                </td>
                <td className="pr-3 py-1 font-medium">{formatScore(point.averagePerformanceScore)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
