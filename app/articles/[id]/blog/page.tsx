import Link from "next/link";
import { notFound } from "next/navigation";
import { buildArticleBlogPageData } from "@/lib/social/article-blog-page-service";
import { ArticleWorkflowNavigation } from "@/components/articles/article-workflow-navigation";
import { ContentGroupBadge, InfoBadge } from "@/components/social/content-group-badge";
import { DeepLinkNotice, getHighlightClassName, buildAnchorId } from "@/components/navigation/deep-link-highlight";
import {
  buildArticleBlogUrl,
  buildMetricsDeepLink,
  buildRewriteVersionDeepLink,
  buildArticleOverviewUrl,
  buildSocialPostDetailUrl,
} from "@/lib/navigation/article-deep-links";
import { PaginationControls } from "@/components/navigation/pagination-controls";
import { parsePagination } from "@/lib/navigation/pagination";
import { TONE_STYLES, type SocialPlatform } from "@/lib/social/social-platform-types";
import {
  generatePlaceholderSocialPostAction,
  generateSocialDraftAction,
  runSocialPostQualityGateAction,
  requestSocialPostApprovalAction,
  approveSocialPostAction,
  generateManualExportAction,
  prepareManualPostingRecordAction,
  recordManualPostingResultAction,
  recordSocialPostMetricsAction,
} from "../actions";

export const dynamic = "force-dynamic";

const BLOG_PLATFORMS: SocialPlatform[] = ["wordpress_blog", "naver_blog"];
const ANCHOR_PREFIX = "social-post";

export default async function ArticleBlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    publishMessage?: string;
    includeRewriteVersions?: string;
    socialPostId?: string;
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
    includeRewriteVersions: includeRewriteVersionsParam,
    socialPostId: targetSocialPostId,
    returnTo,
    page: pageParam,
    perPage: perPageParam,
  } = await searchParams;
  const includeRewriteVersions = includeRewriteVersionsParam === "true";
  const { page, perPage } = parsePagination({ page: pageParam, perPage: perPageParam });

  const { article, posts, pagination, targetPage } = await buildArticleBlogPageData(id, {
    includeRewriteVersions,
    page,
    perPage,
    targetSocialPostId,
  });

  if (!article) {
    notFound();
  }

  // Phase 3-17: action form이 "이 카드를 강조한 채 이 페이지로 돌아오기" 위해 사용하는 returnTo.
  const selfReturnToFor = (postId: string) => buildArticleBlogUrl(id, { socialPostId: postId, highlight: postId });
  const targetFound = targetSocialPostId ? posts.some((p) => p.id === targetSocialPostId) : true;
  // Phase 3-18: target이 현재 page에 없지만 다른 page에 있으면 그 page로 가는 링크를 보여준다.
  const targetOnDifferentPage = targetSocialPostId && !targetFound && targetPage !== null && targetPage !== pagination.page;
  const basePath = `/articles/${id}/blog`;
  const currentSearchParams: Record<string, string> = {
    ...(includeRewriteVersionsParam ? { includeRewriteVersions: includeRewriteVersionsParam } : {}),
    ...(targetSocialPostId ? { socialPostId: targetSocialPostId } : {}),
    ...(returnTo ? { returnTo } : {}),
    perPage: String(perPage),
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Link href={`/articles/${id}`} className="text-sm text-zinc-500 hover:underline">
          ← 기사 개요로
        </Link>

        <ArticleWorkflowNavigation articleId={id} active="blog" returnTo={returnTo} />

        <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          블로그 글쓰기 페이지입니다. WordPress와 Naver Blog용 글, SEO, 승인, 게시 준비 상태를 관리합니다.
          작업 후 이 페이지로 돌아오도록 returnTo가 적용됩니다.
        </div>

        {targetSocialPostId && <DeepLinkNotice targetId={targetSocialPostId} found={targetFound} />}
        {targetOnDifferentPage && (
          <div className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            선택한 항목이 현재 page에 없습니다.{" "}
            <a href={`${basePath}?${new URLSearchParams({ ...currentSearchParams, page: String(targetPage) }).toString()}`} className="underline">
              해당 항목이 있는 {targetPage} page로 이동 →
            </a>
          </div>
        )}

        {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {publishMessage && <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{publishMessage}</div>}

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold">{article.title}</h1>
          <p className="mt-1 text-xs text-zinc-500">article status: {article.status}</p>
          {(article.seoTitle || article.metaDescription || article.targetKeyword) && (
            <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-600">
              <p className="font-medium text-zinc-700">기사 SEO 정보 (monetized_blog)</p>
              {article.seoTitle && <p className="mt-1">SEO title: {article.seoTitle}</p>}
              {article.metaDescription && <p className="mt-1">meta description: {article.metaDescription}</p>}
              {article.targetKeyword && <p className="mt-1">target keyword: {article.targetKeyword}</p>}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">블로그 글 생성</h2>
          <form action={generatePlaceholderSocialPostAction} className="mt-2 flex flex-wrap items-end gap-2 text-xs">
            <input type="hidden" name="articleId" value={article.id} />
            <label className="flex flex-col text-zinc-600">
              platform
              <select name="platform" className="mt-1 rounded border border-zinc-300 px-2 py-1" required>
                {BLOG_PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-zinc-600">
              tone_style
              <select name="toneStyle" className="mt-1 rounded border border-zinc-300 px-2 py-1" required>
                {TONE_STYLES.map((toneStyle) => (
                  <option key={toneStyle} value={toneStyle}>
                    {toneStyle}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" formAction={generateSocialDraftAction} className="rounded bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500">
              블로그 글 초안 생성
            </button>
            <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700">
              placeholder 초안 생성
            </button>
          </form>
          <form method="get" className="mt-2">
            <label className="flex items-center gap-1 text-xs text-zinc-600">
              <input type="checkbox" name="includeRewriteVersions" value="true" defaultChecked={includeRewriteVersions} />
              rewrite 포함
              <button type="submit" className="ml-2 rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] hover:bg-zinc-100">
                적용
              </button>
            </label>
          </form>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">블로그 글 ({posts.length})</h2>
          {posts.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">아직 생성된 블로그 글이 없습니다. WordPress/Naver Blog는 platform=wordpress_blog/naver_blog로 생성하세요.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-3">
              {posts.map((post) => {
                const selfReturnTo = selfReturnToFor(post.id);
                return (
                  <li
                    key={post.id}
                    id={buildAnchorId(ANCHOR_PREFIX, post.id)}
                    className={`rounded border border-zinc-200 p-3 text-xs ${getHighlightClassName(post.id, targetSocialPostId)}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <ContentGroupBadge group={post.isRewriteVersion ? "rewrite" : "blog"} />
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-600">{post.platform}</span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-600">{post.toneStyle}</span>
                      {post.manualPostStatus === "posted" && <InfoBadge label="게시 완료" />}
                      {post.manualPostStatus === "posted" && post.latestMetricsRecordedAt === null && <InfoBadge label="Metrics 필요" />}
                      {(post.performanceStatus === "low" || post.performanceStatus === "needs_review") && <InfoBadge label="Low Performance" />}
                    </div>
                    <p className="mt-1 font-medium text-zinc-700">{post.postTitle || "(제목 없음)"}</p>
                    <p className="mt-1 text-zinc-500">{(post.excerpt || post.postBody || "").slice(0, 140) || "(본문 없음)"}{(post.excerpt || post.postBody || "").length > 140 ? "…" : ""}</p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      quality: {post.qualityStatus} · approval: {post.approvalStatus} · publish: {post.publishStatus} · export: {post.exportStatus} ·
                      manual_post: {post.manualPostStatus}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      performance: {post.performanceStatus} ({post.latestPerformanceScore ?? "-"}) {post.postUrl && (
                        <>
                          ·{" "}
                          <a href={post.postUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            게시글 열기
                          </a>
                        </>
                      )}
                    </p>

                    <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                      <a href={buildSocialPostDetailUrl(post.id, selfReturnTo)} className="font-medium text-zinc-700 hover:underline">
                        상세 보기 →
                      </a>
                      <a href={buildMetricsDeepLink(article.id, post.id, selfReturnTo)} className="text-amber-700 hover:underline">
                        성과 보기 →
                      </a>
                      {post.isRewriteVersion && (
                        <a href={buildRewriteVersionDeepLink(article.id, post.id, selfReturnTo)} className="text-indigo-700 hover:underline">
                          Rewrite 관리에서 보기 →
                        </a>
                      )}
                      <a href={buildArticleOverviewUrl(article.id)} className="text-zinc-500 hover:underline">
                        기사 개요 →
                      </a>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <form action={runSocialPostQualityGateAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={post.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button type="submit" className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100">
                          품질검사
                        </button>
                      </form>
                      <form action={requestSocialPostApprovalAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={post.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button type="submit" className="rounded border border-blue-300 bg-blue-50 px-2 py-1 font-medium text-blue-700 hover:bg-blue-100">
                          승인 요청
                        </button>
                      </form>
                      <form action={approveSocialPostAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={post.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button type="submit" className="rounded border border-green-300 bg-green-50 px-2 py-1 font-medium text-green-700 hover:bg-green-100">
                          승인
                        </button>
                      </form>
                      <form action={generateManualExportAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={post.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button type="submit" className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100">
                          {post.platform === "wordpress_blog" ? "WordPress Draft Export" : "Naver Blog Export"}
                        </button>
                      </form>
                      <form action={prepareManualPostingRecordAction}>
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={post.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <button type="submit" className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100">
                          게시 체크리스트 준비
                        </button>
                      </form>
                    </div>

                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] text-zinc-400">게시 결과 기록 / Metrics 입력</summary>
                      <form action={recordManualPostingResultAction} className="mt-1 flex flex-wrap items-end gap-1">
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={post.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <input name="manualPostUrl" placeholder="게시된 URL" className="rounded border border-zinc-300 px-1.5 py-1" />
                        <button type="submit" className="rounded border border-green-300 bg-green-50 px-2 py-1 font-medium text-green-700 hover:bg-green-100">
                          게시 결과 기록
                        </button>
                      </form>
                      <form action={recordSocialPostMetricsAction} className="mt-1 flex flex-wrap items-end gap-1">
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={post.id} />
                        {/* Phase 3-17: metrics 저장 후에는 성과 페이지에서 바로 결과를 확인할 수 있게 이동한다. */}
                        <input type="hidden" name="returnTo" value={buildMetricsDeepLink(article.id, post.id)} />
                        <input name="views" type="number" placeholder="views" className="w-20 rounded border border-zinc-300 px-1.5 py-1" />
                        <input name="likes" type="number" placeholder="likes" className="w-20 rounded border border-zinc-300 px-1.5 py-1" />
                        <input name="comments" type="number" placeholder="comments" className="w-24 rounded border border-zinc-300 px-1.5 py-1" />
                        <input name="clicks" type="number" placeholder="clicks" className="w-20 rounded border border-zinc-300 px-1.5 py-1" />
                        <button type="submit" className="rounded border border-amber-300 bg-amber-50 px-2 py-1 font-medium text-amber-700 hover:bg-amber-100">
                          Metrics 입력
                        </button>
                      </form>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
          <PaginationControls basePath={basePath} searchParams={currentSearchParams} pagination={pagination} />
        </section>
      </div>
    </div>
  );
}

