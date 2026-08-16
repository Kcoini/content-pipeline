// Phase 3-19: Dashboard Charts & Trend Visualization.
// 데이터가 없을 때 모든 차트 컴포넌트가 공통으로 쓰는 안내 문구.

export function ChartEmptyState({ message }: { message: string }) {
  return (
    <p className="mt-2 rounded border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-center text-xs text-zinc-500">{message}</p>
  );
}
