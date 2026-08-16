// Phase 3-19: Dashboard Charts & Trend Visualization.
// rewrite_won/original_won/similar/needs_more_data 분포를 bar chart로
// 보여준다. 동일 조건 A/B 테스트가 아니므로 참고 지표라는 안내를 함께
// 표시한다.

import type { RewriteComparisonChartData } from "@/lib/social/social-performance-chart-types";
import { formatChartNumber, normalizeChartValue } from "@/lib/social/chart-formatting";
import { ChartEmptyState } from "./chart-empty-state";

const BARS: { key: keyof RewriteComparisonChartData; label: string; className: string }[] = [
  { key: "rewriteWonCount", label: "rewrite 승리", className: "bg-green-500" },
  { key: "originalWonCount", label: "원본 승리", className: "bg-amber-500" },
  { key: "similarCount", label: "비슷함", className: "bg-zinc-400" },
  { key: "needsMoreDataCount", label: "데이터 부족", className: "bg-blue-400" },
];

export function RewriteComparisonChart({ data }: { data: RewriteComparisonChartData }) {
  const total = data.rewriteWonCount + data.originalWonCount + data.similarCount + data.needsMoreDataCount;

  if (total === 0) {
    return <ChartEmptyState message="rewrite comparison 데이터가 없습니다. 성과 비교를 실행하면 rewrite chart가 표시됩니다." />;
  }

  const max = Math.max(data.rewriteWonCount, data.originalWonCount, data.similarCount, data.needsMoreDataCount);

  return (
    <div className="flex flex-col gap-2">
      {BARS.map((bar) => {
        const value = data[bar.key];
        return (
          <div key={bar.key} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 text-zinc-600">{bar.label}</span>
            <div className="h-4 flex-1 rounded bg-zinc-100">
              <div className={`h-4 rounded ${bar.className}`} style={{ width: `${normalizeChartValue(value, max)}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right font-medium text-zinc-700">{formatChartNumber(value)}</span>
          </div>
        );
      })}
      <p className="mt-1 text-[11px] text-zinc-400">
        총 {formatChartNumber(total)}건 비교됨. 동일 조건의 A/B 테스트가 아니므로 참고 지표로만 사용하세요.
      </p>
    </div>
  );
}
