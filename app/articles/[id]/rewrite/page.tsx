import Link from "next/link";
import { notFound } from "next/navigation";
import { buildArticleRewritePageData } from "@/lib/social/article-rewrite-page-service";
import { ArticleWorkflowNavigation } from "@/components/articles/article-workflow-navigation";
import { ContentGroupBadge, InfoBadge } from "@/components/social/content-group-badge";
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

export default async function ArticleRewritePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; publishMessage?: string }>;
}) {
  const { id } = await params;
  const { error, publishMessage } = await searchParams;

  const { article, originalPosts, rewriteVersions, suggestions } = await buildArticleRewritePageData(id);

  if (!article) {
    notFound();
  }

  const originalTitleById = new Map(originalPosts.map((p) => [p.id, p.postTitle || p.caption || p.id]));

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Link href={`/articles/${id}`} className="text-sm text-zinc-500 hover:underline">
          ← 기사 개요로
        </Link>

        <ArticleWorkflowNavigation articleId={id} active="rewrite" />

        <div className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
          Rewrite 관리 페이지입니다. 개선 제안, 개선 버전, 비교, 재승인, 재Export 흐름을 관리합니다. 이 페이지에서도 자동 게시는 하지 않습니다.
        </div>

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
              {suggestions.map((s) => (
                <li key={s.id} className="rounded border border-zinc-200 p-2">
                  <p className="font-medium text-zinc-700">
                    원본: {originalTitleById.get(s.socialPostId) ?? s.socialPostId} ({s.platform}/{s.toneStyle})
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    suggestion_status: {s.suggestionStatus} · application_status: {s.applicationStatus}
                    {s.appliedSocialPostId && (
                      <>
                        {" "}
                        · applied →{" "}
                        <a href={`/articles/${article.id}/rewrite#social-post-${s.appliedSocialPostId}`} className="text-blue-600 hover:underline">
                          {s.appliedSocialPostId}
                        </a>
                      </>
                    )}
                  </p>
                  {s.suggestedTitle && <p className="mt-1 text-zinc-600">제안 제목: {s.suggestedTitle}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <form action={approveRewriteSuggestionAction}>
                      <input type="hidden" name="articleId" value={article.id} />
                      <input type="hidden" name="suggestionId" value={s.id} />
                      <button type="submit" className="rounded border border-green-300 bg-green-50 px-2 py-1 font-medium text-green-700 hover:bg-green-100">
                        개선 제안 승인
                      </button>
                    </form>
                    <form action={rejectRewriteSuggestionAction} className="flex items-center gap-1">
                      <input type="hidden" name="articleId" value={article.id} />
                      <input type="hidden" name="suggestionId" value={s.id} />
                      <input name="reason" placeholder="반려 사유" className="rounded border border-zinc-300 px-1.5 py-1" />
                      <button type="submit" className="rounded border border-red-300 bg-red-50 px-2 py-1 font-medium text-red-700 hover:bg-red-100">
                        반려
                      </button>
                    </form>
                    <form action={applyRewriteSuggestionAction}>
                      <input type="hidden" name="articleId" value={article.id} />
                      <input type="hidden" name="suggestionId" value={s.id} />
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
              ))}
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
              {rewriteVersions.map((v) => (
                <li key={v.id} id={`social-post-${v.id}`} className="rounded border border-indigo-200 p-3">
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

                  <div className="mt-2 flex flex-wrap gap-2">
                    <form action={recheckRewriteVersionQualityAction}>
                      <input type="hidden" name="articleId" value={article.id} />
                      <input type="hidden" name="socialPostId" value={v.id} />
                      <button type="submit" className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100">
                        Version Quality Recheck
                      </button>
                    </form>
                    <form action={compareRewriteVersionAction}>
                      <input type="hidden" name="articleId" value={article.id} />
                      <input type="hidden" name="socialPostId" value={v.id} />
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
                      <button
                        type="submit"
                        disabled={v.rewriteReapprovalStatus !== "approved"}
                        className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        재Export 생성
                      </button>
                    </form>
                    <a
                      href={`/articles/${article.id}/performance#social-post-${v.id}`}
                      className="rounded border border-amber-300 bg-amber-50 px-2 py-1 font-medium text-amber-700 hover:bg-amber-100"
                    >
                      추천 버전 성과 열기
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
