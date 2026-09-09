import Link from "next/link";
import { listSocialPostsForDashboard } from "@/lib/repositories/social-performance-dashboard-repository";
import { logDashboardInformationArchitectureLoaded } from "@/lib/social/social-performance-dashboard-service";
import { DEFAULT_DASHBOARD_FILTER } from "@/lib/social/social-performance-dashboard-types";
import { classifyContentType, getContentTypeLabel } from "@/lib/social/content-type-classifier";
import { ContentGroupBadge, InfoBadge } from "@/components/social/content-group-badge";
import { socialPostHref } from "@/components/social-performance-dashboard/badges";
import {
  isSocialPlatform,
  type SocialPlatform,
  type SocialPerformanceStatus,
  type SocialPostApprovalStatus,
  type SocialPostQualityStatus,
  type SocialPostPublishStatus,
} from "@/lib/social/social-platform-types";
import { PLATFORM_LABELS } from "@/lib/social/platform-generation-recommendations";
import { TONE_STYLE_CONFIGS } from "@/lib/social/tone-style-config";
import { describeStatusValue, describeStatusField } from "@/lib/social/status-labels";

export const dynamic = "force-dynamic";

const BLOG_PLATFORMS: SocialPlatform[] = ["wordpress_blog", "naver_blog"];

export default async function BlogDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    platform?: string;
    qualityStatus?: string;
    approvalStatus?: string;
    publishStatus?: string;
    performanceStatus?: string;
    includeRewriteVersions?: string;
  }>;
}) {
  const params = await searchParams;
  const platform = isSocialPlatform(params.platform) ? (params.platform as SocialPlatform) : undefined;
  const qualityStatus = (params.qualityStatus || undefined) as SocialPostQualityStatus | undefined;
  const approvalStatus = (params.approvalStatus || undefined) as SocialPostApprovalStatus | undefined;
  const publishStatus = (params.publishStatus || undefined) as SocialPostPublishStatus | undefined;
  const performanceStatus = (params.performanceStatus || undefined) as SocialPerformanceStatus | undefined;
  const includeRewriteVersions = params.includeRewriteVersions === "true";

  const posts = await listSocialPostsForDashboard({
    ...DEFAULT_DASHBOARD_FILTER,
    platform,
    performanceStatus,
    includeRewriteVersions: true,
    onlyRewriteVersions: false,
    contentGroup: "all",
  });

  const blogPosts = posts
    .filter((p) => (platform ? p.platform === platform : BLOG_PLATFORMS.includes(p.platform) || (p.isRewriteVersion && BLOG_PLATFORMS.includes(p.platform))))
    .filter((p) => !p.isRewriteVersion || includeRewriteVersions)
    .filter((p) => !qualityStatus || p.qualityStatus === qualityStatus)
    .filter((p) => !approvalStatus || p.approvalStatus === approvalStatus)
    .filter((p) => !publishStatus || p.publishStatus === publishStatus);

  await logDashboardInformationArchitectureLoaded({
    ...DEFAULT_DASHBOARD_FILTER,
    contentGroup: "blog",
    platform,
    performanceStatus,
    includeRewriteVersions,
  });

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            {/* Phase 3-24: 영어 제목을 한국어로 바꾸고, 이 화면에서 할 수
                있는 일을 한 문장으로 안내한다. */}
            <h1 className="text-2xl font-bold">블로그 현황</h1>
            <p className="mt-1 text-sm text-zinc-600">
              WordPress와 네이버 블로그 글의 생성, 검토, 게시 준비 상태를 확인합니다. 네이버 카페/X/Threads/Instagram은
              기본 제외됩니다.
            </p>
          </div>
          <Link href="/dashboard/social-performance" className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
            소셜 성과 분석으로
          </Link>
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <form method="get" className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            {/* Phase 3-24: 필터 select도 raw enum이 아니라 한국어 라벨을 보여준다. */}
            <label className="flex flex-col gap-1">
              플랫폼
              <select name="platform" defaultValue={platform ?? ""} className="rounded border border-zinc-300 px-2 py-1">
                <option value="">전체(블로그)</option>
                {BLOG_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {describeStatusField("quality_status")}
              <select name="qualityStatus" defaultValue={qualityStatus ?? ""} className="rounded border border-zinc-300 px-2 py-1">
                <option value="">전체</option>
                {["not_checked", "ready", "needs_revision", "blocked", "failed"].map((s) => (
                  <option key={s} value={s}>
                    {describeStatusValue(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {describeStatusField("approval_status")}
              <select name="approvalStatus" defaultValue={approvalStatus ?? ""} className="rounded border border-zinc-300 px-2 py-1">
                <option value="">전체</option>
                {["not_requested", "pending_review", "approved", "rejected", "revoked"].map((s) => (
                  <option key={s} value={s}>
                    {describeStatusValue(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {describeStatusField("publish_status")}
              <select name="publishStatus" defaultValue={publishStatus ?? ""} className="rounded border border-zinc-300 px-2 py-1">
                <option value="">전체</option>
                {["not_published", "dry_run", "exported", "scheduled", "published", "failed", "blocked"].map((s) => (
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
              <input type="checkbox" name="includeRewriteVersions" value="true" defaultChecked={includeRewriteVersions} />
              재작성 버전 포함
            </label>
            <div>
              <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700">
                적용
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">블로그 글 목록 ({blogPosts.length})</h2>
          {blogPosts.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">조건에 맞는 블로그 글이 없습니다.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead>
                  <tr className="text-zinc-500">
                    <th className="pr-3 py-1">글</th>
                    <th className="pr-3 py-1">유형</th>
                    <th className="pr-3 py-1">{describeStatusField("quality_status")}</th>
                    <th className="pr-3 py-1">{describeStatusField("approval_status")}</th>
                    <th className="pr-3 py-1">{describeStatusField("publish_status")}</th>
                    <th className="pr-3 py-1">{describeStatusField("manual_post_status")}</th>
                    <th className="pr-3 py-1">{describeStatusField("performance_status")}</th>
                    <th className="pr-3 py-1">안내</th>
                    <th className="pr-3 py-1">이동</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-700">
                  {blogPosts.map((p) => {
                    const type = classifyContentType({ kind: "social_post", platform: p.platform, isRewriteVersion: p.isRewriteVersion });
                    const metricsMissing = p.manualPostStatus === "posted" && p.latestMetricsRecordedAt === null;
                    return (
                      <tr key={p.id} className="border-t border-zinc-100">
                        <td className="pr-3 py-1">
                          <p className="font-medium">{p.postTitle || p.caption || "(제목 없음)"}</p>
                          <p className="text-[11px] text-zinc-400">{PLATFORM_LABELS[p.platform]} · {TONE_STYLE_CONFIGS[p.toneStyle].label}</p>
                        </td>
                        <td className="pr-3 py-1">
                          <ContentGroupBadge group={p.isRewriteVersion ? "rewrite" : "blog"} /> {getContentTypeLabel(type)}
                        </td>
                        <td className="pr-3 py-1">{describeStatusValue(p.qualityStatus)}</td>
                        <td className="pr-3 py-1">{describeStatusValue(p.approvalStatus)}</td>
                        <td className="pr-3 py-1">{describeStatusValue(p.publishStatus)}</td>
                        <td className="pr-3 py-1">{describeStatusValue(p.manualPostStatus)}</td>
                        <td className="pr-3 py-1">{describeStatusValue(p.performanceStatus)} ({p.latestPerformanceScore ?? "-"})</td>
                        <td className="pr-3 py-1">
                          {p.manualPostStatus === "posted" && <InfoBadge label="게시 완료" />}
                          {metricsMissing && <InfoBadge label="성과 입력 필요" />}
                          {(p.performanceStatus === "low" || p.performanceStatus === "needs_review") && <InfoBadge label="반응 저조" />}
                          {p.recommendedForRepost && <InfoBadge label="재게시 추천" />}
                        </td>
                        <td className="pr-3 py-1">
                          <a
                            href={socialPostHref(p.articleId, p.id, { platform: p.platform, isRewriteVersion: p.isRewriteVersion })}
                            className="text-blue-600 hover:underline"
                          >
                            열기
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
