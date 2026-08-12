import type { SocialPerformanceDashboardSummary } from "@/lib/social/social-performance-dashboard-types";
import type { SocialPlatform, ToneStyle } from "@/lib/social/social-platform-types";

export function SocialPerformanceSummaryCards({
  summary,
  bestPlatform,
  bestToneStyle,
}: {
  summary: SocialPerformanceDashboardSummary;
  bestPlatform: SocialPlatform | null;
  bestToneStyle: ToneStyle | null;
}) {
  const cards = [
    { label: "전체 social post", value: summary.totalSocialPosts },
    { label: "수동 게시 완료", value: summary.manualPostedPosts },
    { label: "metrics 측정됨", value: summary.metricsMeasuredPosts },
    { label: "metrics 미측정(게시됨)", value: summary.metricsMissingPosts },
    { label: "평균 performance_score", value: summary.averagePerformanceScore?.toFixed(1) ?? "-" },
    { label: "최고 / 최저 점수", value: `${summary.bestPerformanceScore ?? "-"} / ${summary.worstPerformanceScore ?? "-"}` },
    { label: "평균 engagement_rate", value: summary.averageEngagementRate !== null ? `${(summary.averageEngagementRate * 100).toFixed(1)}%` : "-" },
    { label: "평균 CTR", value: summary.averageClickThroughRate !== null ? `${(summary.averageClickThroughRate * 100).toFixed(1)}%` : "-" },
    { label: "총 조회수", value: summary.totalViews },
    { label: "총 노출수", value: summary.totalImpressions },
    { label: "총 좋아요/댓글/공유/저장", value: `${summary.totalLikes}/${summary.totalComments}/${summary.totalShares}/${summary.totalSaves}` },
    { label: "총 클릭수", value: summary.totalClicks },
    { label: "rewrite version 수", value: summary.rewriteVersionsCount },
    { label: "rewrite 비교 수", value: summary.rewriteComparisonsCount },
    { label: "rewrite 승리 / 원본 승리 / 비슷함 / 데이터 부족", value: `${summary.rewriteWonCount}/${summary.originalWonCount}/${summary.similarCount}/${summary.needsMoreDataCount}` },
    { label: "best platform", value: bestPlatform ?? "-" },
    { label: "best tone_style", value: bestToneStyle ?? "-" },
  ];

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-700">Summary</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded border border-zinc-200 bg-zinc-50 p-2">
            <p className="text-[11px] text-zinc-500">{card.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-zinc-800">{card.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
