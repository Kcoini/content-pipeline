import type { LowPerformanceSocialPost } from "@/lib/social/social-performance-dashboard-types";
import { PerformanceStatusBadge, RecommendationBadge, socialPostHref } from "./badges";

export function LowPerformancePostsTable({ posts }: { posts: LowPerformanceSocialPost[] }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-700">
        Low Performance Social Posts <RecommendationBadge label="Low Performance" />
      </h2>
      <p className="mt-1 text-[11px] text-zinc-500">
        성과가 낮은 글은 Phase 3-10 rewrite suggestion 대상으로 볼 수 있습니다.
      </p>
      {posts.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">성과가 낮은 social post가 없습니다.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="text-zinc-500">
                <th className="pr-3 py-1">social post</th>
                <th className="pr-3 py-1">platform/tone</th>
                <th className="pr-3 py-1">상태</th>
                <th className="pr-3 py-1">score</th>
                <th className="pr-3 py-1">views/clicks/engagement</th>
                <th className="pr-3 py-1">rewrite suggestion</th>
                <th className="pr-3 py-1">이동</th>
              </tr>
            </thead>
            <tbody className="text-zinc-700">
              {posts.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="pr-3 py-1 font-mono text-[11px]">{p.id}</td>
                  <td className="pr-3 py-1">
                    {p.platform} / {p.toneStyle}
                  </td>
                  <td className="pr-3 py-1">
                    <PerformanceStatusBadge status={p.performanceStatus} />
                  </td>
                  <td className="pr-3 py-1">{p.performanceScore ?? "-"}</td>
                  <td className="pr-3 py-1">
                    {p.latestViews}/{p.latestClicks}/{p.latestEngagementRate !== null ? `${(p.latestEngagementRate * 100).toFixed(1)}%` : "-"}
                  </td>
                  <td className="pr-3 py-1">{p.rewriteSuggestionStatus}</td>
                  <td className="pr-3 py-1">
                    <a href={socialPostHref(p.articleId, p.id)} className="text-blue-600 hover:underline">
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
