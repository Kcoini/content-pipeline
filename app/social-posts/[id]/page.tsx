import Link from "next/link";
import { getSocialPostDetail } from "@/lib/social/social-post-detail-service";
import { SocialPostDetailNavigation } from "@/components/social-posts/social-post-detail-navigation";
import { ContentGroupBadge, InfoBadge } from "@/components/social/content-group-badge";
import { getContentGroupLabel, getContentTypeLabel } from "@/lib/social/content-type-classifier";
import { getSafeReturnTo } from "@/lib/navigation/return-to";
import { buildArticleOverviewUrl } from "@/lib/navigation/article-deep-links";
import { logEvent } from "@/lib/harness/logger";

export const dynamic = "force-dynamic";

const PREVIEW_LENGTH = 300;

function truncate(text: string | null, length = PREVIEW_LENGTH): { preview: string; truncated: boolean } {
  const value = text ?? "";
  if (value.length <= length) return { preview: value, truncated: false };
  return { preview: `${value.slice(0, length)}…`, truncated: true };
}

export default async function SocialPostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo } = await searchParams;

  const detail = await getSocialPostDetail(id);

  if (!detail) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <Link href="/articles" className="text-sm text-zinc-500 hover:underline">
            ← 기사 목록으로
          </Link>
          <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            social post를 찾을 수 없습니다 (id: {id}).
          </section>
        </div>
      </div>
    );
  }

  const { socialPost: p, article, contentGroup, contentType, latestMetrics, recentMetrics, versionChain, rewriteSuggestions, latestVersionComparison, latestRewritePerformanceComparison, relatedLinks } = detail;

  const fallbackReturnTo = buildArticleOverviewUrl(p.articleId);
  const safeReturnTo = getSafeReturnTo(returnTo, fallbackReturnTo);

  const bodyPreview = truncate(p.postBody);
  const captionPreview = truncate(p.caption);
  const threadPreview = p.threadItems.slice(0, 3);
  const cardPreview = p.cardItems.slice(0, 3);

  // Phase 3-18: full post_body/caption/API key 등은 details_json에 남기지 않는다 — 상태값만 기록.
  await logEvent({
    type: "social_post_detail_view_loaded",
    status: "success",
    message: `social post(${p.id}) 상세 페이지를 조회했습니다.`,
    articleId: p.articleId,
    targetType: "article",
    targetId: p.articleId,
    details: {
      socialPostId: p.id,
      articleId: p.articleId,
      platform: p.platform,
      toneStyle: p.toneStyle,
      isRewriteVersion: p.isRewriteVersion,
      contentGroup,
      hasReturnTo: Boolean(returnTo),
    },
  }).catch(() => undefined);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {/* Phase 3-18: returnTo가 안전하면 그 위치로, 아니면 기사 개요로 돌아간다. */}
        <Link href={safeReturnTo} className="text-sm text-zinc-500 hover:underline">
          ← {returnTo ? "이전 위치로" : "기사 개요로"}
        </Link>

        <SocialPostDetailNavigation
          articleId={p.articleId}
          platform={p.platform}
          isRewriteVersion={p.isRewriteVersion}
          links={relatedLinks}
          returnTo={returnTo}
        />

        <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
          이 페이지는 social_post 하나의 상세 정보를 읽기 전용으로 보여줍니다. 승인/게시/재승인 등 작업은 위 링크의 하위 페이지에서 실행하세요.
        </div>

        <header className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <ContentGroupBadge group={contentGroup} />
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono text-zinc-600">{p.platform}</span>
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono text-zinc-600">{p.toneStyle}</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">{getContentTypeLabel(contentType)}</span>
            {p.recommendedForRepost && <InfoBadge label="재게시 추천" />}
            {p.manualPostStatus === "posted" && <InfoBadge label="게시 완료" />}
            {p.manualPostStatus === "posted" && p.latestMetricsRecordedAt === null && <InfoBadge label="Metrics 필요" />}
            {(p.performanceStatus === "low" || p.performanceStatus === "needs_review") && <InfoBadge label="Low Performance" />}
          </div>
          <h1 className="mt-2 text-lg font-semibold">{p.postTitle || p.caption || "(제목/캡션 없음)"}</h1>
          <p className="mt-1 text-xs text-zinc-500">
            social_post id: <span className="font-mono">{p.id}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            기사: {article ? (
              <Link href={relatedLinks.articleOverview} className="text-blue-600 hover:underline">
                {article.title}
              </Link>
            ) : (
              "(알 수 없음)"
            )}{" "}
            (article_id: <span className="font-mono">{p.articleId}</span>)
          </p>
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">버전 정보</h2>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-600">is_rewrite_version</dt>
              <dd className="text-zinc-500">{p.isRewriteVersion ? "예" : "아니오"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">version_number</dt>
              <dd className="text-zinc-500">{p.versionNumber}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">parent_social_post_id</dt>
              <dd className="font-mono text-zinc-500">
                {p.parentSocialPostId ? (
                  relatedLinks.parentSocialPostDetail ? (
                    <Link href={relatedLinks.parentSocialPostDetail} className="text-blue-600 hover:underline">
                      {p.parentSocialPostId}
                    </Link>
                  ) : (
                    p.parentSocialPostId
                  )
                ) : (
                  "-"
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">root_social_post_id</dt>
              <dd className="font-mono text-zinc-500">
                {p.rootSocialPostId ? (
                  relatedLinks.rootSocialPostDetail ? (
                    <Link href={relatedLinks.rootSocialPostDetail} className="text-blue-600 hover:underline">
                      {p.rootSocialPostId}
                    </Link>
                  ) : (
                    p.rootSocialPostId
                  )
                ) : (
                  "-"
                )}
              </dd>
            </div>
          </dl>
          {versionChain.length > 0 && (
            <div className="mt-3 text-xs">
              <p className="font-medium text-zinc-600">버전 체인 ({versionChain.length}개)</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {versionChain.map((v) => (
                  <li key={v.id} className={v.socialPostId === p.id ? "font-semibold text-zinc-800" : "text-zinc-500"}>
                    v{v.versionNumber} · {v.versionStatus} · {v.socialPostId}
                    {v.socialPostId === p.id && " (현재)"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">콘텐츠 미리보기</h2>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-600">post_title</dt>
              <dd className="text-zinc-500">{p.postTitle || "-"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">excerpt</dt>
              <dd className="text-zinc-500">{p.excerpt || "-"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">hashtags</dt>
              <dd className="text-zinc-500">{p.hashtags.length > 0 ? p.hashtags.map((t) => `#${t}`).join(" ") : "-"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">post_url</dt>
              <dd className="text-zinc-500 break-all">
                {p.postUrl ? (
                  <a href={p.postUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {p.postUrl}
                  </a>
                ) : (
                  "-"
                )}
              </dd>
            </div>
          </dl>

          {p.postBody && (
            <div className="mt-3 text-xs">
              <p className="font-medium text-zinc-600">post_body preview</p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-600">{bodyPreview.preview}</p>
              {bodyPreview.truncated && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-[11px] text-zinc-400">전체 본문 펼치기</summary>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-600">{p.postBody}</p>
                </details>
              )}
            </div>
          )}

          {p.caption && (
            <div className="mt-3 text-xs">
              <p className="font-medium text-zinc-600">caption preview</p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-600">{captionPreview.preview}</p>
              {captionPreview.truncated && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-[11px] text-zinc-400">전체 caption 펼치기</summary>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-600">{p.caption}</p>
                </details>
              )}
            </div>
          )}

          {threadPreview.length > 0 && (
            <div className="mt-3 text-xs">
              <p className="font-medium text-zinc-600">thread_items preview ({p.threadItems.length}개 중 {threadPreview.length}개)</p>
              <ul className="mt-1 flex flex-col gap-1">
                {threadPreview.map((item) => (
                  <li key={item.order} className="text-zinc-600">
                    #{item.order} {truncate(item.text, 100).preview}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cardPreview.length > 0 && (
            <div className="mt-3 text-xs">
              <p className="font-medium text-zinc-600">card_items preview ({p.cardItems.length}개 중 {cardPreview.length}개)</p>
              <ul className="mt-1 flex flex-col gap-1">
                {cardPreview.map((item) => (
                  <li key={item.order} className="text-zinc-600">
                    slide {item.order}: {item.heading} — {truncate(item.body, 80).preview}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-[11px] text-zinc-400">export/dry-run/handoff payload 요약 (기본 접힘)</summary>
            <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <dt className="font-medium text-zinc-600">export_payload 키 개수</dt>
                <dd className="text-zinc-500">{Object.keys(p.exportPayload ?? {}).length}개</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">platform_publish_dry_run_payload 키 개수</dt>
                <dd className="text-zinc-500">{Object.keys(p.platformPublishDryRunPayload ?? {}).length}개</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">handoff_payload 키 개수</dt>
                <dd className="text-zinc-500">{Object.keys(p.handoffPayload ?? {}).length}개</dd>
              </div>
            </dl>
            <p className="mt-1 text-[11px] text-zinc-400">전체 payload 원문은 이 페이지에서 노출하지 않습니다.</p>
          </details>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">상태</h2>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-600">quality_status / quality_score</dt>
              <dd className="text-zinc-500">{p.qualityStatus} ({p.qualityScore ?? "-"})</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">approval_status</dt>
              <dd className="text-zinc-500">{p.approvalStatus}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">publish_status</dt>
              <dd className="text-zinc-500">{p.publishStatus}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">export_status</dt>
              <dd className="text-zinc-500">{p.exportStatus}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">platform_publish_guard_status</dt>
              <dd className="text-zinc-500">{p.platformPublishGuardStatus}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">platform_publish_dry_run_status</dt>
              <dd className="text-zinc-500">{p.platformPublishDryRunStatus}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">handoff_status</dt>
              <dd className="text-zinc-500">{p.handoffStatus}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">manual_post_status</dt>
              <dd className="text-zinc-500">{p.manualPostStatus}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">성과</h2>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-600">performance_status</dt>
              <dd className="text-zinc-500">{p.performanceStatus}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">latest_performance_score</dt>
              <dd className="text-zinc-500">{p.latestPerformanceScore ?? "-"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">latest_metrics_recorded_at</dt>
              <dd className="text-zinc-500">{p.latestMetricsRecordedAt ?? "-"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs">
            <Link href={relatedLinks.performanceDeepLink} className="text-amber-700 hover:underline">
              성과 페이지에서 이 글 보기 →
            </Link>
          </p>

          {recentMetrics.length > 0 && (
            <div className="mt-3 overflow-x-auto text-xs">
              <p className="font-medium text-zinc-600">최근 metrics ({recentMetrics.length}개)</p>
              <table className="mt-1 w-full min-w-[480px] text-left">
                <thead>
                  <tr className="text-zinc-500">
                    <th className="pr-3 py-1">측정 시각</th>
                    <th className="pr-3 py-1">views/likes/comments</th>
                    <th className="pr-3 py-1">score</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-700">
                  {recentMetrics.map((m) => (
                    <tr key={m.id} className="border-t border-zinc-100">
                      <td className="pr-3 py-1">{m.measuredAt}</td>
                      <td className="pr-3 py-1">
                        {m.views}/{m.likes}/{m.comments}
                      </td>
                      <td className="pr-3 py-1">{m.performanceScore ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {latestMetrics && <p className="mt-1 text-[11px] text-zinc-400">최신 측정: {latestMetrics.measuredAt}</p>}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">Rewrite 관련 상태</h2>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-600">rewrite_suggestion_status</dt>
              <dd className="text-zinc-500">{p.rewriteSuggestionStatus}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">version_comparison_status</dt>
              <dd className="text-zinc-500">
                {p.versionComparisonStatus}
                {p.versionComparisonScore != null ? ` (${p.versionComparisonScore})` : ""}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">recommended_for_repost</dt>
              <dd className="text-zinc-500">{p.recommendedForRepost ? "예" : "아니오"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">rewrite_reapproval_status</dt>
              <dd className="text-zinc-500">{p.rewriteReapprovalStatus}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">rewrite_reexport_status</dt>
              <dd className="text-zinc-500">{p.rewriteReexportStatus}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">rewrite_republish_workflow_status</dt>
              <dd className="text-zinc-500">{p.rewriteRepublishWorkflowStatus}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">rewrite_performance_comparison_status</dt>
              <dd className="text-zinc-500">
                {p.rewritePerformanceComparisonStatus}
                {p.rewritePerformanceWinner ? ` · winner: ${p.rewritePerformanceWinner}` : ""}
              </dd>
            </div>
          </dl>

          {latestVersionComparison && (
            <p className="mt-3 text-xs text-zinc-500">
              최근 version 비교: {latestVersionComparison.comparisonStatus} · score {latestVersionComparison.comparisonScore ?? "-"}
            </p>
          )}
          {latestRewritePerformanceComparison && (
            <p className="mt-1 text-xs text-zinc-500">
              최근 성과 비교: {latestRewritePerformanceComparison.comparisonStatus} · winner{" "}
              {latestRewritePerformanceComparison.winner ?? "-"}
            </p>
          )}

          <p className="mt-3 text-xs">
            <Link href={relatedLinks.rewriteDeepLink} className="text-indigo-700 hover:underline">
              Rewrite 관리 페이지에서 이 버전 보기 →
            </Link>
          </p>

          {rewriteSuggestions.length > 0 && (
            <div className="mt-3 text-xs">
              <p className="font-medium text-zinc-600">이 글에서 생성된 개선 제안 ({rewriteSuggestions.length}개)</p>
              <ul className="mt-1 flex flex-col gap-0.5 text-zinc-500">
                {rewriteSuggestions.map((s) => (
                  <li key={s.id}>
                    {s.id}: {s.suggestionStatus} / {s.applicationStatus}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">메타데이터</h2>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-600">content_group</dt>
              <dd className="text-zinc-500">{getContentGroupLabel(contentGroup)}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">content_type</dt>
              <dd className="text-zinc-500">{getContentTypeLabel(contentType)}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">created_at</dt>
              <dd className="text-zinc-500">{new Date(p.createdAt).toLocaleString("ko-KR")}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">updated_at</dt>
              <dd className="text-zinc-500">{new Date(p.updatedAt).toLocaleString("ko-KR")}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
