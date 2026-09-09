import Link from "next/link";
import { listSocialPostsForDashboard } from "@/lib/repositories/social-performance-dashboard-repository";
import { logDashboardInformationArchitectureLoaded } from "@/lib/social/social-performance-dashboard-service";
import { DEFAULT_DASHBOARD_FILTER } from "@/lib/social/social-performance-dashboard-types";
import { ContentGroupBadge, InfoBadge } from "@/components/social/content-group-badge";
import { socialPostHref } from "@/components/social-performance-dashboard/badges";
import { RewriteComparisonStatusBadge } from "@/components/social-performance-dashboard/badges";
import { isSocialPlatform, type SocialPlatform, type SocialPerformanceStatus } from "@/lib/social/social-platform-types";
import { PLATFORM_LABELS } from "@/lib/social/platform-generation-recommendations";
import { TONE_STYLE_CONFIGS } from "@/lib/social/tone-style-config";
import { describeStatusValue, describeStatusField } from "@/lib/social/status-labels";

export const dynamic = "force-dynamic";

export default async function RewriteDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    platform?: string;
    performanceStatus?: string;
    onlyRecommendedForRepost?: string;
    versionComparisonStatus?: string;
    rewriteReapprovalStatus?: string;
    rewriteReexportStatus?: string;
  }>;
}) {
  const params = await searchParams;
  const platform = isSocialPlatform(params.platform) ? (params.platform as SocialPlatform) : undefined;
  const performanceStatus = (params.performanceStatus || undefined) as SocialPerformanceStatus | undefined;
  const onlyRecommendedForRepost = params.onlyRecommendedForRepost === "true";
  const versionComparisonStatus = params.versionComparisonStatus || undefined;
  const rewriteReapprovalStatus = params.rewriteReapprovalStatus || undefined;
  const rewriteReexportStatus = params.rewriteReexportStatus || undefined;

  const posts = await listSocialPostsForDashboard({
    ...DEFAULT_DASHBOARD_FILTER,
    platform,
    performanceStatus,
    onlyRewriteVersions: true,
    includeRewriteVersions: true,
    onlyRecommendedForRepost,
    contentGroup: "rewrite",
  });

  const rewriteVersions = posts
    .filter((p) => !versionComparisonStatus || p.versionComparisonStatus === versionComparisonStatus)
    .filter((p) => !rewriteReapprovalStatus || p.rewriteReapprovalStatus === rewriteReapprovalStatus)
    .filter((p) => !rewriteReexportStatus || p.rewriteReexportStatus === rewriteReexportStatus);

  await logDashboardInformationArchitectureLoaded({
    ...DEFAULT_DASHBOARD_FILTER,
    contentGroup: "rewrite",
    platform,
    performanceStatus,
  });

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            {/* Phase 3-24: 영어 제목을 한국어로 바꾸고, 이 화면에서 할 수
                있는 일을 한 문장으로 안내한다. */}
            <h1 className="text-2xl font-bold">재작성 관리</h1>
            <p className="mt-1 text-sm text-zinc-600">
              성과가 낮거나 개선이 필요한 글의 재작성 제안과 버전을 관리합니다. 재작성 버전은 원본을 덮어쓰지 않고
              새 버전으로 생성된 개선 글입니다. 자동 재게시나 자동 원본 교체는 없습니다.
            </p>
          </div>
          <Link href="/dashboard/social-performance" className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
            소셜 성과 분석으로
          </Link>
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <form method="get" className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-6">
            <label className="flex flex-col gap-1">
              플랫폼
              <select name="platform" defaultValue={platform ?? ""} className="rounded border border-zinc-300 px-2 py-1">
                <option value="">전체</option>
                {(["wordpress_blog", "naver_blog", "naver_cafe", "x", "threads", "instagram"] as SocialPlatform[]).map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {describeStatusField("version_comparison_status")}
              <select name="versionComparisonStatus" defaultValue={versionComparisonStatus ?? ""} className="rounded border border-zinc-300 px-2 py-1">
                <option value="">전체</option>
                {["not_compared", "original_better", "rewrite_better", "similar", "needs_review", "blocked", "failed"].map((s) => (
                  <option key={s} value={s}>
                    {describeStatusValue(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {describeStatusField("rewrite_reapproval_status")}
              <select name="rewriteReapprovalStatus" defaultValue={rewriteReapprovalStatus ?? ""} className="rounded border border-zinc-300 px-2 py-1">
                <option value="">전체</option>
                {["not_requested", "pending_review", "approved", "rejected", "revoked", "blocked", "failed"].map((s) => (
                  <option key={s} value={s}>
                    {describeStatusValue(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {describeStatusField("rewrite_reexport_status")}
              <select name="rewriteReexportStatus" defaultValue={rewriteReexportStatus ?? ""} className="rounded border border-zinc-300 px-2 py-1">
                <option value="">전체</option>
                {["not_started", "ready", "exported", "blocked", "failed"].map((s) => (
                  <option key={s} value={s}>
                    {describeStatusValue(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {describeStatusField("performance_status")}
              <select name="performanceStatus" defaultValue={performanceStatus ?? ""} className="rounded border border-zinc-300 px-2 py-1">
                <option value="">전체</option>
                {["not_measured", "low", "average", "good", "excellent", "needs_review"].map((s) => (
                  <option key={s} value={s}>
                    {describeStatusValue(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" name="onlyRecommendedForRepost" value="true" defaultChecked={onlyRecommendedForRepost} />
              재게시 추천만
            </label>
            <div>
              <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700">
                적용
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">
            <ContentGroupBadge group="rewrite" /> 재작성 버전 ({rewriteVersions.length})
          </h2>
          {rewriteVersions.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">조건에 맞는 재작성 버전이 없습니다.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-xs">
                <thead>
                  <tr className="text-zinc-500">
                    <th className="pr-3 py-1">글</th>
                    <th className="pr-3 py-1">버전</th>
                    <th className="pr-3 py-1">원본/이전 버전</th>
                    <th className="pr-3 py-1">버전 비교</th>
                    <th className="pr-3 py-1">재승인/재내보내기</th>
                    <th className="pr-3 py-1">성과 비교</th>
                    <th className="pr-3 py-1">점수</th>
                    <th className="pr-3 py-1">안내</th>
                    <th className="pr-3 py-1">이동</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-700">
                  {rewriteVersions.map((p) => (
                    <tr key={p.id} className="border-t border-zinc-100">
                      <td className="pr-3 py-1">
                        <p className="font-medium">{p.postTitle || p.caption || "(제목 없음)"}</p>
                        <p className="text-[11px] text-zinc-400">{PLATFORM_LABELS[p.platform]} · {TONE_STYLE_CONFIGS[p.toneStyle].label}</p>
                      </td>
                      <td className="pr-3 py-1">
                        버전 {p.versionNumber} ({describeStatusValue(p.versionStatus)})
                      </td>
                      <td className="pr-3 py-1 font-mono text-[11px]">
                        {p.rootSocialPostId ?? "-"} / {p.parentSocialPostId ?? "-"}
                      </td>
                      <td className="pr-3 py-1">
                        {describeStatusValue(p.versionComparisonStatus)}
                        {p.versionComparisonScore != null ? ` (${p.versionComparisonScore})` : ""}
                      </td>
                      <td className="pr-3 py-1">
                        {describeStatusValue(p.rewriteReapprovalStatus)} / {describeStatusValue(p.rewriteReexportStatus)}
                      </td>
                      <td className="pr-3 py-1">
                        <RewriteComparisonStatusBadge status={p.rewritePerformanceComparisonStatus} />
                        {p.rewritePerformanceWinner ? ` · 더 좋은 쪽: ${describeStatusValue(p.rewritePerformanceWinner)}` : ""}
                      </td>
                      <td className="pr-3 py-1">{p.latestPerformanceScore ?? "-"}</td>
                      <td className="pr-3 py-1">{p.recommendedForRepost && <InfoBadge label="재게시 추천" />}</td>
                      <td className="pr-3 py-1">
                        <a href={socialPostHref(p.articleId, p.id, { isRewriteVersion: true })} className="text-blue-600 hover:underline">
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
      </div>
    </div>
  );
}
