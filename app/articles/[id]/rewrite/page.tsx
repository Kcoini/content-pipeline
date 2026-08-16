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
          Rewrite 관리 페이지입니다. 개선 제안, 개선 버전, 비교, 재승인, 재Export 흐름을 관리합니다. 이 페이지에서도 자동 게시는 하지 않습니다.
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
                return (
                  <li
                    key={s.id}
                    id={buildAnchorId(SUGGESTION_ANCHOR_PREFIX, s.id)}
                    className={`rounded border border-zinc-200 p-2 ${getHighlightClassName(s.id, targetSuggestionId)}`}
                  >
                    <p className="font-medium text-zinc-700">
                      원본: {originalTitleById.get(s.socialPostId) ?? s.socialPostId} ({s.platform}/{s.toneStyle})
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      suggestion_status: {s.suggestionStatus} · application_status: {s.applicationStatus}
                      {s.appliedSocialPostId && (
                        <>
                          {" "}
                          · applied →{" "}
                          <a href={buildArticleRewriteUrl(article.id, { rewriteVersionId: s.appliedSocialPostId, highlight: s.appliedSocialPostId })} className="text-blue-600 hover:underline">
                            {s.appliedSocialPostId}
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
                    <div className="mt-2 flex flex-wrap gap-2">
                      <form action={approveRewriteSuggestionAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="suggestionId" value={s.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button type="submit" className="rounded border border-green-300 bg-green-50 px-2 py-1 font-medium text-green-700 hover:bg-green-100">
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
                          disabled={s.suggestionStatus !== "approved" || s.applicationStatus === "applied"}
                          className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          개선안 적용
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">
            <ContentGroupBadge group="rewrite" /> Rewrite Versions ({rewriteVersions.length})
          </h2>
          {rewriteVersions.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">아직 생성된 rewrite version이 없습니다.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-3 text-xs">
              {rewriteVersions.map((v) => {
                const selfReturnTo = selfReturnToForVersion(v.id);
                const isComparisonHighlighted = Boolean(targetComparisonId) && v.latestVersionComparisonId === targetComparisonId;
                return (
                  <li
                    key={v.id}
                    id={buildAnchorId(ANCHOR_PREFIX, v.id)}
                    className={`rounded border border-indigo-200 p-3 ${getHighlightClassName(v.id, targetVersionId) || (isComparisonHighlighted ? "ring-2 ring-indigo-500 ring-offset-2" : "")}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-600">{v.platform}</span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-600">v{v.versionNumber}</span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">{v.versionStatus}</span>
                      {v.recommendedForRepost && <InfoBadge label="재게시 추천" />}
                    </div>
                    <p className="mt-1 font-medium text-zinc-700">{v.postTitle || v.caption || "(제목 없음)"}</p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      root: {v.rootSocialPostId ?? "-"} · parent: {v.parentSocialPostId ?? "-"}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      version 비교: {v.versionComparisonStatus}
                      {v.versionComparisonScore != null ? ` (${v.versionComparisonScore})` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      재승인: {v.rewriteReapprovalStatus} · 재export: {v.rewriteReexportStatus} · workflow: {v.rewriteRepublishWorkflowStatus}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      성과 비교: {v.rewritePerformanceComparisonStatus}
                      {v.rewritePerformanceWinner ? ` · winner: ${v.rewritePerformanceWinner}` : ""}
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
                      <a href={buildArticleOverviewUrl(article.id)} className="text-zinc-500 hover:underline">
                        기사 개요 →
                      </a>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <form action={recheckRewriteVersionQualityAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={v.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button type="submit" className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100">
                          Version Quality Recheck
                        </button>
                      </form>
                      <form action={compareRewriteVersionAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={v.id} />
                        {/* Phase 3-17: 비교 결과가 생성되면 action이 comparisonId로 이 페이지에 강조 이동시킨다. */}
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button
                          type="submit"
                          disabled={!v.parentSocialPostId && !v.rewriteAppliedFromSocialPostId}
                          className="rounded border border-green-300 bg-green-50 px-2 py-1 font-medium text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          원본과 Rewrite 비교
                        </button>
                      </form>
                      <form action={requestRewriteReapprovalAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={v.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button
                          type="submit"
                          disabled={v.rewriteReapprovalStatus !== "not_requested"}
                          className="rounded border border-blue-300 bg-blue-50 px-2 py-1 font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
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
                          disabled={v.rewriteReapprovalStatus !== "pending_review"}
                          className="rounded border border-green-300 bg-green-50 px-2 py-1 font-medium text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          재승인 승인
                        </button>
                      </form>
                      <form action={prepareRewriteReexportAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={v.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button
                          type="submit"
                          disabled={v.rewriteReapprovalStatus !== "approved"}
                          className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          재Export 준비
                        </button>
                      </form>
                      <form action={generateRewriteReexportPayloadAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={v.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button
                          type="submit"
                          disabled={v.rewriteReapprovalStatus !== "approved"}
                          className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          재Export 생성
                        </button>
                      </form>
                      <a
                        href={buildMetricsDeepLink(article.id, v.id, selfReturnTo)}
                        className="rounded border border-amber-300 bg-amber-50 px-2 py-1 font-medium text-amber-700 hover:bg-amber-100"
                      >
                        추천 버전 성과 열기
                      </a>
                    </div>
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
