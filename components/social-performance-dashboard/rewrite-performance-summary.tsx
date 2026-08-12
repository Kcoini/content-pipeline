import type { RewritePerformanceSummary as RewritePerformanceSummaryType } from "@/lib/social/social-performance-dashboard-types";
import { socialPostHref } from "./badges";

export function RewritePerformanceSummary({
  summary,
  articleIdBySocialPostId,
}: {
  summary: RewritePerformanceSummaryType;
  articleIdBySocialPostId: Map<string, string>;
}) {
  const bestArticleId = summary.bestRewriteSocialPostId ? articleIdBySocialPostId.get(summary.bestRewriteSocialPostId) : undefined;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-700">Rewrite Performance Summary</h2>
      <p className="mt-1 text-[11px] text-zinc-500">
        rewrite comparison은 동일 조건의 A/B 테스트가 아니므로 참고 지표로만 사용하세요.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded border border-zinc-200 bg-zinc-50 p-2">
          <p className="text-[11px] text-zinc-500">rewrite 승리</p>
          <p className="font-semibold text-green-700">{summary.rewriteWonCount}</p>
        </div>
        <div className="rounded border border-zinc-200 bg-zinc-50 p-2">
          <p className="text-[11px] text-zinc-500">원본 승리</p>
          <p className="font-semibold text-amber-700">{summary.originalWonCount}</p>
        </div>
        <div className="rounded border border-zinc-200 bg-zinc-50 p-2">
          <p className="text-[11px] text-zinc-500">비슷함</p>
          <p className="font-semibold text-zinc-700">{summary.similarCount}</p>
        </div>
        <div className="rounded border border-zinc-200 bg-zinc-50 p-2">
          <p className="text-[11px] text-zinc-500">데이터 부족</p>
          <p className="font-semibold text-zinc-700">{summary.needsMoreDataCount}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        평균 performance_score delta: {summary.averagePerformanceScoreDelta?.toFixed(2) ?? "-"}
      </p>
      {summary.bestRewriteSocialPostId && (
        <p className="mt-1 text-xs text-zinc-600">
          최고 rewrite version:{" "}
          {bestArticleId ? (
            <a href={socialPostHref(bestArticleId, summary.bestRewriteSocialPostId)} className="text-blue-600 hover:underline">
              {summary.bestRewriteSocialPostId}
            </a>
          ) : (
            summary.bestRewriteSocialPostId
          )}
        </p>
      )}
      {summary.bestPlatforms.length > 0 && (
        <p className="mt-1 text-xs text-zinc-600">rewrite가 잘 통한 플랫폼: {summary.bestPlatforms.join(", ")}</p>
      )}
      {summary.bestToneStyles.length > 0 && (
        <p className="mt-1 text-xs text-zinc-600">rewrite가 잘 통한 문체: {summary.bestToneStyles.join(", ")}</p>
      )}
    </section>
  );
}
