// Phase 3-19: Dashboard Charts & Trend Visualization.
// social_posts.performance_status 분포를 bar chart로 보여준다.

import type { LowPerformanceChartData } from "@/lib/social/social-performance-chart-types";
import { formatChartNumber, normalizeChartValue } from "@/lib/social/chart-formatting";
import { ChartEmptyState } from "./chart-empty-state";
import { describeStatusValue } from "@/lib/social/status-labels";

// Phase UX-03C: 범례가 raw performance_status enum(excellent/good/...)을
// 그대로 노출하던 문제를 수정 — 공통 describeStatusValue로 번역한다.
const BARS: { key: keyof LowPerformanceChartData; rawStatus: string; className: string }[] = [
  { key: "excellent", rawStatus: "excellent", className: "bg-green-600" },
  { key: "good", rawStatus: "good", className: "bg-green-400" },
  { key: "average", rawStatus: "average", className: "bg-zinc-400" },
  { key: "needsReview", rawStatus: "needs_review", className: "bg-red-500" },
  { key: "low", rawStatus: "low", className: "bg-amber-500" },
  { key: "notMeasured", rawStatus: "not_measured", className: "bg-zinc-300" },
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
            <span className="w-24 shrink-0 text-zinc-600">{describeStatusValue(bar.rawStatus)}</span>
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
