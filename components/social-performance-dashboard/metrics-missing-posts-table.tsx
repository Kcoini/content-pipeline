import type { MetricsMissingSocialPost } from "@/lib/social/social-performance-dashboard-types";
import { ManualPostStatusBadge, RecommendationBadge, socialPostHref } from "./badges";
import { buildSocialPostDetailUrl } from "@/lib/navigation/article-deep-links";

export function MetricsMissingPostsTable({ posts }: { posts: MetricsMissingSocialPost[] }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-700">
        Metrics Missing Social Posts <RecommendationBadge label="Metrics Missing" />
      </h2>
      <p className="mt-1 text-[11px] text-zinc-500">수동 게시는 완료되었지만 아직 metrics가 입력되지 않은 글입니다.</p>
      {posts.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">metrics 입력이 누락된 social post가 없습니다.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="text-zinc-500">
                <th className="pr-3 py-1">social post</th>
                <th className="pr-3 py-1">platform/tone</th>
                <th className="pr-3 py-1">manual_post_status</th>
                <th className="pr-3 py-1">게시일</th>
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
                    <ManualPostStatusBadge status={p.manualPostStatus} />
                  </td>
                  <td className="pr-3 py-1">{p.manualPostedAt ?? "-"}</td>
                  <td className="pr-3 py-1">
                    <a href={socialPostHref(p.articleId, p.id, { platform: p.platform })} className="text-blue-600 hover:underline">
                      metrics 입력으로 이동
                    </a>{" "}
                    ·{" "}
                    <a href={buildSocialPostDetailUrl(p.id)} className="text-zinc-600 hover:underline">
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
