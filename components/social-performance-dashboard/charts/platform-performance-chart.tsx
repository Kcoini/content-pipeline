// Phase 3-19: Dashboard Charts & Trend Visualization.
// 플랫폼별 평균 performance_score를 간단한 HTML/CSS bar chart로
// 보여준다. 새 차트 라이브러리를 추가하지 않고 div 너비(%)만으로
// 그린다.

import type { PlatformPerformanceChartData } from "@/lib/social/social-performance-chart-types";
import { formatChartNumber, formatScore, normalizeChartValue } from "@/lib/social/chart-formatting";
import { ChartEmptyState } from "./chart-empty-state";

const PLATFORM_LABELS: Record<string, string> = {
  wordpress_blog: "WordPress",
  naver_blog: "Naver Blog",
  naver_cafe: "Naver Cafe",
  x: "X",
  threads: "Threads",
  instagram: "Instagram",
};

export function PlatformPerformanceChart({ data }: { data: PlatformPerformanceChartData[] }) {
  if (data.length === 0) {
    return <ChartEmptyState message="아직 metrics가 입력되지 않았습니다. 수동 게시 후 metrics를 입력하면 차트가 표시됩니다." />;
  }

  const maxScore = Math.max(0, ...data.map((d) => d.averagePerformanceScore ?? 0));

  return (
    <div className="flex flex-col gap-2">
      {data.map((row) => (
        <div key={row.platform} className="flex items-center gap-2 text-xs">
          <span className="w-24 shrink-0 text-zinc-600">{PLATFORM_LABELS[row.platform] ?? row.platform}</span>
          <div className="h-4 flex-1 rounded bg-zinc-100">
            <div
              className="h-4 rounded bg-indigo-500"
              style={{ width: `${normalizeChartValue(row.averagePerformanceScore, maxScore)}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right font-medium text-zinc-700">{formatScore(row.averagePerformanceScore)}</span>
          <span className="w-24 shrink-0 text-right text-[11px] text-zinc-400">measured {formatChartNumber(row.measuredCount)}</span>
        </div>
      ))}
    </div>
  );
}
