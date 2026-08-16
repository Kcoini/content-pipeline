// Phase 3-20: A/B Testing Draft Structure.
// A/B test 하나에 속한 variant 목록을 표로 보여준다. 이 컴포넌트는
// 읽기 전용이다 — 상태 변경은 ab-test-card.tsx의 action form이 담당한다.

import type { SocialAbTestVariant } from "@/lib/social/social-ab-testing-types";
import { buildSocialPostDetailUrl } from "@/lib/navigation/article-deep-links";

const VARIANT_STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  ready: "bg-blue-100 text-blue-700",
  posted: "bg-indigo-100 text-indigo-700",
  measured: "bg-amber-100 text-amber-700",
  winner: "bg-green-100 text-green-700",
  loser: "bg-zinc-100 text-zinc-500",
  inconclusive: "bg-zinc-100 text-zinc-500",
  blocked: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
};

export function AbTestVariantTable({ variants }: { variants: SocialAbTestVariant[] }) {
  if (variants.length === 0) {
    return <p className="mt-2 text-xs text-zinc-500">아직 추가된 variant가 없습니다.</p>;
  }

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead>
          <tr className="text-zinc-500">
            <th className="pr-3 py-1">variant</th>
            <th className="pr-3 py-1">role</th>
            <th className="pr-3 py-1">social_post</th>
            <th className="pr-3 py-1">platform/tone</th>
            <th className="pr-3 py-1">manual_post_status</th>
            <th className="pr-3 py-1">score</th>
            <th className="pr-3 py-1">metrics 측정 시각</th>
            <th className="pr-3 py-1">variant_status</th>
            <th className="pr-3 py-1">순위</th>
          </tr>
        </thead>
        <tbody className="text-zinc-700">
          {variants.map((v) => (
            <tr key={v.id} className="border-t border-zinc-100">
              <td className="pr-3 py-1">
                {v.variantLabel}
                {v.isControl && <span className="ml-1 rounded bg-zinc-100 px-1 text-[10px] text-zinc-500">control</span>}
              </td>
              <td className="pr-3 py-1">{v.variantRole}</td>
              <td className="pr-3 py-1">
                <a href={buildSocialPostDetailUrl(v.socialPostId)} className="font-mono text-[11px] text-blue-600 hover:underline">
                  {v.socialPostId}
                </a>
              </td>
              <td className="pr-3 py-1">
                {v.platform} / {v.toneStyle ?? "-"}
              </td>
              <td className="pr-3 py-1">
                {v.manualPostStatus ?? "-"}
                {v.postUrl && (
                  <>
                    {" "}
                    ·{" "}
                    <a href={v.postUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      열기
                    </a>
                  </>
                )}
              </td>
              <td className="pr-3 py-1">{v.latestPerformanceScore ?? "-"}</td>
              <td className="pr-3 py-1">{v.latestMetricsRecordedAt ?? "-"}</td>
              <td className="pr-3 py-1">
                <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${VARIANT_STATUS_STYLES[v.variantStatus] ?? "bg-zinc-100 text-zinc-600"}`}>
                  {v.variantStatus}
                </span>
              </td>
              <td className="pr-3 py-1">{v.resultRank ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
