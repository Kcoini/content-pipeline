// Phase 3-19: Dashboard Charts & Trend Visualization.
// metrics 측정 완료 vs 미입력 비율을 bar chart로 보여준다.

import type { MetricsMissingChartData } from "@/lib/social/social-performance-chart-types";
import { formatChartNumber, formatPercentage, normalizeChartValue } from "@/lib/social/chart-formatting";
import { ChartEmptyState } from "./chart-empty-state";

export function MetricsMissingChart({ data }: { data: MetricsMissingChartData }) {
  const total = data.measured + data.missing;

  if (total === 0) {
    return <ChartEmptyState message="아직 metrics가 입력되지 않았습니다. 수동 게시 후 metrics를 입력하면 차트가 표시됩니다." />;
  }

  const measuredRatio = total > 0 ? data.measured / total : null;
  const max = Math.max(data.measured, data.missing);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="w-16 shrink-0 text-zinc-600">측정됨</span>
        <div className="h-4 flex-1 rounded bg-zinc-100">
          <div className="h-4 rounded bg-blue-500" style={{ width: `${normalizeChartValue(data.measured, max)}%` }} />
        </div>
        <span className="w-10 shrink-0 text-right font-medium text-zinc-700">{formatChartNumber(data.measured)}</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="w-16 shrink-0 text-zinc-600">미입력</span>
        <div className="h-4 flex-1 rounded bg-zinc-100">
          <div className="h-4 rounded bg-zinc-400" style={{ width: `${normalizeChartValue(data.missing, max)}%` }} />
        </div>
        <span className="w-10 shrink-0 text-right font-medium text-zinc-700">{formatChartNumber(data.missing)}</span>
      </div>
      <p className="mt-1 text-[11px] text-zinc-400">
        측정 비율 {formatPercentage(measuredRatio)} (총 {formatChartNumber(total)}개)
      </p>
    </div>
  );
}
