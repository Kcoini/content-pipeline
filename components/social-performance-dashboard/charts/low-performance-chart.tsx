// Phase 3-19: Dashboard Charts & Trend Visualization.
// social_posts.performance_status 분포를 bar chart로 보여준다.

import type { LowPerformanceChartData } from "@/lib/social/social-performance-chart-types";
import { formatChartNumber, normalizeChartValue } from "@/lib/social/chart-formatting";
import { ChartEmptyState } from "./chart-empty-state";

const BARS: { key: keyof LowPerformanceChartData; label: string; className: string }[] = [
  { key: "excellent", label: "excellent", className: "bg-green-600" },
  { key: "good", label: "good", className: "bg-green-400" },
  { key: "average", label: "average", className: "bg-zinc-400" },
  { key: "needsReview", label: "needs_review", className: "bg-red-500" },
  { key: "low", label: "low", className: "bg-amber-500" },
  { key: "notMeasured", label: "not_measured", className: "bg-zinc-300" },
];

export function LowPerformanceChart({ data }: { data: LowPerformanceChartData }) {
  const total = data.low + data.needsReview + data.notMeasured + data.average + data.good + data.excellent;

  if (total === 0) {
    return <ChartEmptyState message="아직 metrics가 입력되지 않았습니다. 수동 게시 후 metrics를 입력하면 차트가 표시됩니다." />;
  }

  const max = Math.max(data.low, data.needsReview, data.notMeasured, data.average, data.good, data.excellent);

  return (
    <div className="flex flex-col gap-2">
      {BARS.map((bar) => {
        const value = data[bar.key];
        return (
          <div key={bar.key} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 text-zinc-600">{bar.label}</span>
            <div className="h-4 flex-1 rounded bg-zinc-100">
              <div className={`h-4 rounded ${bar.className}`} style={{ width: `${normalizeChartValue(value, max)}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right font-medium text-zinc-700">{formatChartNumber(value)}</span>
          </div>
        );
      })}
      <p className="mt-1 text-[11px] text-zinc-400">총 {formatChartNumber(total)}개 social post.</p>
    </div>
  );
}
