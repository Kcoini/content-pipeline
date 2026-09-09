import Link from "next/link";
import { notFound } from "next/navigation";
import { buildArticleRewritePageData } from "@/lib/social/article-rewrite-page-service";
import { ArticleWorkflowNavigation } from "@/components/articles/article-workflow-navigation";
import { ContentGroupBadge, InfoBadge } from "@/components/social/content-group-badge";
import { DeepLinkNotice, getHighlightClassName, buildAnchorId } from "@/components/navigation/deep-link-highlight";
import {
  buildArticleRewriteUrl,
  buildSocialPostDeepLink,
  buildMetricsDeepLink,
  buildArticleOverviewUrl,
  buildSocialPostDetailUrl,
  buildArticleAbTestsUrl,
} from "@/lib/navigation/article-deep-links";
import { PaginationControls } from "@/components/navigation/pagination-controls";
import { parsePagination } from "@/lib/navigation/pagination";
import {
  generatePerformanceRewriteSuggestionAction,
  approveRewriteSuggestionAction,
  rejectRewriteSuggestionAction,
  applyRewriteSuggestionAction,
  recheckRewriteVersionQualityAction,
  compareRewriteVersionAction,
  requestRewriteReapprovalAction,
  approveRewriteReapprovalAction,
  prepareRewriteReexportAction,
  generateRewriteReexportPayloadAction,
} from "../actions";
import { PLATFORM_LABELS } from "@/lib/social/platform-generation-recommendations";
import { TONE_STYLE_CONFIGS } from "@/lib/social/tone-style-config";
import { describeStatusValue, describeStatusField } from "@/lib/social/status-labels";
import {
  getRewriteSuggestionNextAction,
  getRewriteVersionNextAction,
  describeRequestReapprovalDisabledReason,
  describeApproveReapprovalDisabledReason,
  describePrepareReexportDisabledReason,
  describeGenerateReexportDisabledReason,
  describeCompareDisabledReason,
} from "@/lib/social/rewrite-version-user-facing-status";

export const dynamic = "force-dynamic";

const ANCHOR_PREFIX = "social-post";
const SUGGESTION_ANCHOR_PREFIX = "rewrite-suggestion";

export default async function ArticleRewritePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    publishMessage?: string;
    rewriteSuggestionId?: string;
    rewriteVersionId?: string;
    comparisonId?: string;
    section?: string;
    returnTo?: string;
    page?: string;
    perPage?: string;
  }>;
}) {
  const { id } = await params;
  const {
    error,
    publishMessage,
    rewriteSuggestionId: targetSuggestionId,
    rewriteVersionId: targetVersionId,
    comparisonId: targetComparisonId,
    returnTo,
    page: pageParam,
    perPage: perPageParam,
  } = await searchParams;
  const { page, perPage } = parsePagination({ page: pageParam, perPage: perPageParam });

  const { article, originalPosts, rewriteVersions, versionPagination, versionTargetPage, suggestions } = await buildArticleRewritePageData(id, {
    page,
    perPage,
    targetVersionId,
  });

  if (!article) {
    notFound();
  }

  const originalTitleById = new Map(originalPosts.map((p) => [p.id, p.postTitle || p.caption || p.id]));

  // Phase 3-17: action form이 "이 카드를 강조한 채 이 페이지로 돌아오기" 위해 사용하는 returnTo.
  const selfReturnToForVersion = (versionId: string) => buildArticleRewriteUrl(id, { rewriteVersionId: versionId, highlight: versionId });
  const selfReturnToForSuggestion = (suggestionId: string) => buildArticleRewriteUrl(id, { rewriteSuggestionId: suggestionId, highlight: suggestionId });

  const suggestionTargetFound = targetSuggestionId ? suggestions.some((s) => s.id === targetSuggestionId) : true;
  const versionTargetFound = targetVersionId ? rewriteVersions.some((v) => v.id === targetVersionId) : true;
  const versionTargetOnDifferentPage =
    targetVersionId && !versionTargetFound && versionTargetPage !== null && versionTargetPage !== versionPagination.page;
  const basePath = `/articles/${id}/rewrite`;
  const currentSearchParams: Record<string, string> = {
    ...(targetVersionId ? { rewriteVersionId: targetVersionId } : {}),
    ...(targetSuggestionId ? { rewriteSuggestionId: targetSuggestionId } : {}),
    ...(targetComparisonId ? { comparisonId: targetComparisonId } : {}),
    ...(returnTo ? { returnTo } : {}),
    perPage: String(perPage),
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Link href={`/articles/${id}`} className="text-sm text-zinc-500 hover:underline">
          ← 기사 개요로
        </Link>

        <ArticleWorkflowNavigation articleId={id} active="rewrite" returnTo={returnTo} />

        <div className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
          재작성 관리 페이지입니다. 개선 제안, 개선 버전, 비교, 재승인, 재내보내기 흐름을 관리합니다. 이 페이지에서도 자동 게시는 하지 않습니다.
          특정 글이나 비교 결과로 이동하면 해당 카드가 강조 표시됩니다.
        </div>

        {targetSuggestionId && <DeepLinkNotice targetId={targetSuggestionId} found={suggestionTargetFound} />}
        {targetVersionId && <DeepLinkNotice targetId={targetVersionId} found={versionTargetFound} />}
        {versionTargetOnDifferentPage && (
          <div className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            선택한 rewrite version이 현재 page에 없습니다.{" "}
            <a
              href={`${basePath}?${new URLSearchParams({ ...currentSearchParams, page: String(versionTargetPage) }).toString()}`}
              className="underline"
            >
              해당 항목이 있는 {versionTargetPage} page로 이동 →
            </a>
          </div>
        )}

        {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {publishMessage && <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{publishMessage}</div>}

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold">{article.title}</h1>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">개선 제안 생성</h2>
          <p className="mt-1 text-[11px] text-zinc-500">성과가 낮은 원본 글을 골라 개선 제안을 생성합니다.</p>
          <form action={generatePerformanceRewriteSuggestionAction} className="mt-2 flex flex-wrap items-end gap-2 text-xs">
            <input type="hidden" name="articleId" value={article.id} />
            <label className="flex flex-col text-zinc-600">
              대상 원본 글
              <select name="socialPostId" className="mt-1 rounded border border-zinc-300 px-2 py-1" required>
                {originalPosts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.platform} · {p.postTitle || p.caption || p.id}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500">
              개선 제안 생성
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">개선 제안 ({suggestions.length})</h2>
          {suggestions.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">아직 생성된 개선 제안이 없습니다.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2 text-xs">
              {suggestions.map((s) => {
                const selfReturnTo = selfReturnToForSuggestion(s.id);
                const originalPost = originalPosts.find((p) => p.id === s.socialPostId);
                const nextAction = getRewriteSuggestionNextAction(s);
                const primaryClass = "rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100";
                const secondaryClass = "rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100";
                const applyDisabled = s.suggestionStatus !== "approved" || s.applicationStatus === "applied";
                const applyDisabledReason =
                  s.applicationStatus === "applied"
                    ? "이미 적용된 제안입니다."
                    : s.suggestionStatus !== "approved"
                      ? "이 제안을 먼저 승인해야 적용할 수 있습니다."
                      : null;
                return (
                  <li
                    key={s.id}
                    id={buildAnchorId(SUGGESTION_ANCHOR_PREFIX, s.id)}
                    className={`rounded border border-zinc-200 p-2 ${getHighlightClassName(s.id, targetSuggestionId)}`}
                  >
                    <p className="font-medium text-zinc-700">
                      원본: {originalTitleById.get(s.socialPostId) ?? s.socialPostId} (
                      {PLATFORM_LABELS[s.platform]}/{TONE_STYLE_CONFIGS[s.toneStyle].label})
                    </p>
                    {/* Phase 3-24: raw enum(suggestion_status/application_status)을
                        직접 노출하지 않는다 — 사용자 친화적 한 줄 요약 + 다음
                        작업만 먼저 보여주고, 원문 상태값은 "내부 상태값 보기"
                        접힘 안에 둔다. */}
                    <p className="mt-1 text-xs text-zinc-600">
                      {describeStatusValue(s.suggestionStatus)} · 적용: {describeStatusValue(s.applicationStatus)}
                      {s.appliedSocialPostId && (
                        <>
                          {" "}
                          ·{" "}
                          <a
                            href={buildArticleRewriteUrl(article.id, { rewriteVersionId: s.appliedSocialPostId, highlight: s.appliedSocialPostId })}
                            className="text-blue-600 hover:underline"
                          >
                            적용된 버전 보기 →
                          </a>
                        </>
                      )}
                    </p>
                    {s.suggestedTitle && <p className="mt-1 text-zinc-600">제안 제목: {s.suggestedTitle}</p>}
                    {originalPost && (
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                        <a href={buildSocialPostDetailUrl(originalPost.id, selfReturnTo)} className="font-medium text-zinc-700 hover:underline">
                          원본 상세 보기 →
                        </a>
                        <a href={buildSocialPostDeepLink(article.id, originalPost.platform, originalPost.id, selfReturnTo)} className="text-blue-700 hover:underline">
                          원본 글 열기 →
                        </a>
                        <a href={buildMetricsDeepLink(article.id, originalPost.id, selfReturnTo)} className="text-amber-700 hover:underline">
                          원본 성과 보기 →
                        </a>
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <form action={approveRewriteSuggestionAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="suggestionId" value={s.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button type="submit" className={nextAction.kind === "approve_suggestion" ? primaryClass : secondaryClass}>
                          개선 제안 승인
                        </button>
                      </form>
                      <form action={rejectRewriteSuggestionAction} className="flex items-center gap-1">
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="suggestionId" value={s.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <input name="reason" placeholder="반려 사유" className="rounded border border-zinc-300 px-1.5 py-1" />
                        <button type="submit" className="rounded border border-red-300 bg-red-50 px-2 py-1 font-medium text-red-700 hover:bg-red-100">
                          반려
                        </button>
                      </form>
                      <form action={applyRewriteSuggestionAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="suggestionId" value={s.id} />
                        {/* Phase 3-17: 적용 후 생성되는 새 rewrite version이 있으면 action이 그 버전으로 우선 이동한다 (없으면 이 제안 카드로). */}
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button
                          type="submit"
                          disabled={applyDisabled}
                          title={applyDisabledReason ?? undefined}
                          className={`${nextAction.kind === "apply_suggestion" ? primaryClass : secondaryClass} disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          개선안 적용
                        </button>
                      </form>
                      {/* Phase 3-24: disabled 버튼에는 반드시 이유를 표시한다(hover title뿐 아니라 항상 보이는 텍스트로도). */}
                      {applyDisabledReason && <span className="text-[11px] text-zinc-400">{applyDisabledReason}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">
            <ContentGroupBadge group="rewrite" /> 재작성 버전 ({rewriteVersions.length})
          </h2>
          {rewriteVersions.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">아직 생성된 재작성 버전이 없습니다.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-3 text-xs">
              {rewriteVersions.map((v) => {
                const selfReturnTo = selfReturnToForVersion(v.id);
                const isComparisonHighlighted = Boolean(targetComparisonId) && v.latestVersionComparisonId === targetComparisonId;
                const hasComparisonTarget = Boolean(v.parentSocialPostId || v.rewriteAppliedFromSocialPostId);
                const nextAction = getRewriteVersionNextAction({
                  rewriteReapprovalStatus: v.rewriteReapprovalStatus,
                  rewriteReexportStatus: v.rewriteReexportStatus,
                  hasComparisonTarget,
                });
                const primaryClass = "rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100";
                const secondaryClass = "rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100";
                const disabledClass = "disabled:cursor-not-allowed disabled:opacity-50";
                const compareDisabledReason = describeCompareDisabledReason(hasComparisonTarget);
                const requestReapprovalDisabledReason = describeRequestReapprovalDisabledReason(v.rewriteReapprovalStatus);
                const approveReapprovalDisabledReason = describeApproveReapprovalDisabledReason(v.rewriteReapprovalStatus);
                const prepareReexportDisabledReason = describePrepareReexportDisabledReason(v.rewriteReapprovalStatus);
                const generateReexportDisabledReason = describeGenerateReexportDisabledReason(v.rewriteReapprovalStatus);
                return (
                  <li
                    key={v.id}
                    id={buildAnchorId(ANCHOR_PREFIX, v.id)}
                    className={`rounded border border-indigo-200 p-3 ${getHighlightClassName(v.id, targetVersionId) || (isComparisonHighlighted ? "ring-2 ring-indigo-500 ring-offset-2" : "")}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600">{PLATFORM_LABELS[v.platform]}</span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600">버전 {v.versionNumber}</span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">{describeStatusValue(v.versionStatus)}</span>
                      {v.recommendedForRepost && <InfoBadge label="재게시 추천" />}
                    </div>
                    <p className="mt-1 font-medium text-zinc-700">{v.postTitle || v.caption || "(제목 없음)"}</p>
                    {/* Phase 3-24: raw 상태값(재승인/재export/workflow/버전비교 등)을
                        카드 본문에 직접 노출하지 않는다 — 사용자 친화적 한 줄
                        요약 + 다음 작업만 먼저 보여주고, 원문 상태값/내부 id는
                        "내부 상태값 보기" 접힘 안에 둔다. */}
                    <p className="mt-1 text-xs text-zinc-600">
                      {describeStatusValue(v.rewriteReapprovalStatus)} · 다음 작업: <span className="font-medium">{nextAction.label}</span>
                    </p>

                    <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                      <a href={buildSocialPostDetailUrl(v.id, selfReturnTo)} className="font-medium text-zinc-700 hover:underline">
                        상세 보기 →
                      </a>
                      {v.parentSocialPostId && (
                        <a href={buildSocialPostDeepLink(article.id, v.platform, v.parentSocialPostId, selfReturnTo)} className="text-blue-700 hover:underline">
                          원본 글 열기 →
                        </a>
                      )}
                      <a href={buildMetricsDeepLink(article.id, v.id, selfReturnTo)} className="text-amber-700 hover:underline">
                        성과 보기 →
                      </a>
                      {v.recommendedForRepost && v.parentSocialPostId && (
                        <a
                          href={buildArticleAbTestsUrl(article.id, { originalSocialPostId: v.parentSocialPostId, rewriteSocialPostId: v.id, returnTo: selfReturnTo })}
                          className="text-purple-700 hover:underline"
                        >
                          비교 실험 만들기 →
                        </a>
                      )}
                      <a href={buildArticleOverviewUrl(article.id)} className="text-zinc-500 hover:underline">
                        기사 개요 →
                      </a>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <form action={compareRewriteVersionAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={v.id} />
                        {/* Phase 3-17: 비교 결과가 생성되면 action이 comparisonId로 이 페이지에 강조 이동시킨다. */}
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button
                          type="submit"
                          disabled={compareDisabledReason !== null}
                          title={compareDisabledReason ?? undefined}
                          className={`${nextAction.kind === "compare" ? primaryClass : secondaryClass} ${disabledClass}`}
                        >
                          원본과 비교
                        </button>
                      </form>
                      <form action={requestRewriteReapprovalAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={v.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button
                          type="submit"
                          disabled={requestReapprovalDisabledReason !== null}
                          title={requestReapprovalDisabledReason ?? undefined}
                          className={`${nextAction.kind === "request_reapproval" ? primaryClass : secondaryClass} ${disabledClass}`}
                        >
                          재승인 요청
                        </button>
                      </form>
                      <form action={approveRewriteReapprovalAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={v.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button
                          type="submit"
                          disabled={approveReapprovalDisabledReason !== null}
                          title={approveReapprovalDisabledReason ?? undefined}
                          className={`${nextAction.kind === "approve_reapproval" ? primaryClass : secondaryClass} ${disabledClass}`}
                        >
                          재승인 승인하기
                        </button>
                      </form>
                      <form action={prepareRewriteReexportAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={v.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button
                          type="submit"
                          disabled={prepareReexportDisabledReason !== null}
                          title={prepareReexportDisabledReason ?? undefined}
                          className={`${nextAction.kind === "prepare_reexport" ? primaryClass : secondaryClass} ${disabledClass}`}
                        >
                          재내보내기 준비
                        </button>
                      </form>
                      <form action={generateRewriteReexportPayloadAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={v.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button
                          type="submit"
                          disabled={generateReexportDisabledReason !== null}
                          title={generateReexportDisabledReason ?? undefined}
                          className={`${nextAction.kind === "generate_reexport" ? primaryClass : secondaryClass} ${disabledClass}`}
                        >
                          재내보내기 만들기
                        </button>
                      </form>
                      <a
                        href={buildMetricsDeepLink(article.id, v.id, selfReturnTo)}
                        className={nextAction.kind === "view_performance" ? primaryClass : secondaryClass}
                      >
                        성과 보기
                      </a>
                    </div>
                    {/* Phase 3-24: disabled 버튼 이유는 hover title뿐 아니라
                        항상 보이는 텍스트로도 알려준다(카드 안에 여러 버튼이
                        있어 어떤 버튼의 이유인지 헷갈리지 않도록 라벨을
                        붙인다). */}
                    {(requestReapprovalDisabledReason || approveReapprovalDisabledReason || prepareReexportDisabledReason || generateReexportDisabledReason || compareDisabledReason) && (
                      <ul className="mt-1 flex flex-col gap-0.5 text-[11px] text-zinc-400">
                        {compareDisabledReason && <li>원본과 비교: {compareDisabledReason}</li>}
                        {requestReapprovalDisabledReason && <li>재승인 요청: {requestReapprovalDisabledReason}</li>}
                        {approveReapprovalDisabledReason && <li>재승인 승인하기: {approveReapprovalDisabledReason}</li>}
                        {prepareReexportDisabledReason && <li>재내보내기 준비: {prepareReexportDisabledReason}</li>}
                        {generateReexportDisabledReason && <li>재내보내기 만들기: {generateReexportDisabledReason}</li>}
                      </ul>
                    )}

                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] text-zinc-400">내부 상태값 보기 (관리자용, 기본 접힘)</summary>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {describeStatusField("versionNumber")}: {v.versionNumber} · {describeStatusField("rootSocialPostId")}:{" "}
                        {v.rootSocialPostId ?? "-"} · {describeStatusField("parentSocialPostId")}: {v.parentSocialPostId ?? "-"}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {describeStatusField("versionComparisonStatus")}: {describeStatusValue(v.versionComparisonStatus)}
                        {v.versionComparisonScore != null ? ` (점수 ${v.versionComparisonScore})` : ""}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {describeStatusField("rewriteReapprovalStatus")}: {describeStatusValue(v.rewriteReapprovalStatus)} ·{" "}
                        {describeStatusField("rewriteReexportStatus")}: {describeStatusValue(v.rewriteReexportStatus)} ·{" "}
                        {describeStatusField("rewriteRepublishWorkflowStatus")}: {describeStatusValue(v.rewriteRepublishWorkflowStatus)}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        성과 비교: {describeStatusValue(v.rewritePerformanceComparisonStatus)}
                        {v.rewritePerformanceWinner ? ` · 더 좋은 쪽: ${describeStatusValue(v.rewritePerformanceWinner)}` : ""}
                      </p>
                      <div className="mt-2">
                        <form action={recheckRewriteVersionQualityAction}>
                          <input type="hidden" name="articleId" value={article.id} />
                          <input type="hidden" name="socialPostId" value={v.id} />
                          <input type="hidden" name="returnTo" value={selfReturnTo} />
                          <button type="submit" className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100">
                            버전 품질 재검사
                          </button>
                        </form>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
          <PaginationControls basePath={basePath} searchParams={currentSearchParams} pagination={versionPagination} />
        </section>
      </div>
    </div>
  );
}
