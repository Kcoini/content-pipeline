import type { RewritePerformanceComparison } from "@/lib/social/social-platform-types";
import { RewriteComparisonStatusBadge, socialPostHref } from "./badges";

export function RecentRewriteComparisonsTable({ comparisons }: { comparisons: RewritePerformanceComparison[] }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-700">Recent Rewrite Comparisons</h2>
      <p className="mt-1 text-[11px] text-zinc-500">
        동일 조건의 A/B 테스트가 아니므로 참고 지표로만 사용하세요. 자동 재게시/자동 수정으로 이어지지 않습니다.
      </p>
      {comparisons.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">rewrite 성과 비교 결과가 없습니다.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="text-zinc-500">
                <th className="pr-3 py-1">원본 → rewrite</th>
                <th className="pr-3 py-1">platform</th>
                <th className="pr-3 py-1">score delta</th>
                <th className="pr-3 py-1">comparison_status</th>
                <th className="pr-3 py-1">비교 시각</th>
                <th className="pr-3 py-1">이동</th>
              </tr>
            </thead>
            <tbody className="text-zinc-700">
              {comparisons.map((c) => (
                <tr key={c.id} className="border-t border-zinc-100">
                  <td className="pr-3 py-1 font-mono text-[11px]">
                    {c.originalSocialPostId} → {c.rewriteSocialPostId}
                  </td>
                  <td className="pr-3 py-1">{c.platform}</td>
                  <td className="pr-3 py-1">{c.performanceScoreDelta?.toFixed(2) ?? "-"}</td>
                  <td className="pr-3 py-1">
                    <RewriteComparisonStatusBadge status={c.comparisonStatus} />
                  </td>
                  <td className="pr-3 py-1">{c.comparedAt ?? "-"}</td>
                  <td className="pr-3 py-1">
                    <a href={socialPostHref(c.articleId, c.rewriteSocialPostId)} className="text-blue-600 hover:underline">
                      열기
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
