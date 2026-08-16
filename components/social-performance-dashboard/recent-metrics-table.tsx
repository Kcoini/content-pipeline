import type { SocialPostMetrics } from "@/lib/social/social-metrics-types";
import { socialPostHref } from "./badges";
import { buildSocialPostDetailUrl } from "@/lib/navigation/article-deep-links";
import { getHighlightClassName } from "@/lib/navigation/highlight-target";

export function RecentMetricsTable({
  metrics,
  highlightedSocialPostId,
}: {
  metrics: SocialPostMetrics[];
  /** Phase 3-18: metricsTargetId/socialPostId deep link로 강조할 social_post id. */
  highlightedSocialPostId?: string | null;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-700">Recent Metrics</h2>
      <p className="mt-1 text-[11px] text-zinc-500">metrics는 외부 API가 아니라 수동 입력값입니다.</p>
      {metrics.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">입력된 metrics가 없습니다.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="text-zinc-500">
                <th className="pr-3 py-1">social post</th>
                <th className="pr-3 py-1">측정 시각</th>
                <th className="pr-3 py-1">views/likes/comments</th>
                <th className="pr-3 py-1">score</th>
                <th className="pr-3 py-1">이동</th>
              </tr>
            </thead>
            <tbody className="text-zinc-700">
              {metrics.map((m) => (
                <tr key={m.id} className={`border-t border-zinc-100 ${getHighlightClassName(m.socialPostId, highlightedSocialPostId)}`}>
                  <td className="pr-3 py-1 font-mono text-[11px]">{m.socialPostId}</td>
                  <td className="pr-3 py-1">{m.measuredAt}</td>
                  <td className="pr-3 py-1">
                    {m.views}/{m.likes}/{m.comments}
                  </td>
                  <td className="pr-3 py-1">{m.performanceScore ?? "-"}</td>
                  <td className="pr-3 py-1">
                    <a href={socialPostHref(m.articleId, m.socialPostId, { platform: m.platform })} className="text-blue-600 hover:underline">
                      열기
                    </a>{" "}
                    ·{" "}
                    <a href={buildSocialPostDetailUrl(m.socialPostId)} className="text-zinc-600 hover:underline">
                      상세
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
