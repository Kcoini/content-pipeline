import Link from "next/link";
import { notFound } from "next/navigation";
import { buildArticleBlogPageData } from "@/lib/social/article-blog-page-service";
import { ArticleWorkflowNavigation } from "@/components/articles/article-workflow-navigation";
import { ContentGroupBadge, InfoBadge } from "@/components/social/content-group-badge";
import { WordPressFeaturedImageFilePicker } from "@/components/social/wordpress-featured-image-file-picker";
import { CopyUrlButton } from "@/components/social/copy-url-button";
import { DeepLinkNotice, getHighlightClassName, buildAnchorId } from "@/components/navigation/deep-link-highlight";
import { TransientNotice } from "@/components/ui/transient-notice";
import {
  buildArticleBlogUrl,
  buildMetricsDeepLink,
  buildRewriteVersionDeepLink,
  buildArticleOverviewUrl,
  buildSocialPostDetailUrl,
} from "@/lib/navigation/article-deep-links";
import { PaginationControls } from "@/components/navigation/pagination-controls";
import { parsePagination } from "@/lib/navigation/pagination";
import { checkPlatformApiReadiness } from "@/lib/social/platform-api-readiness-checker";
import { ApiReadinessBadge } from "@/components/platform-api/api-readiness-badge";
import { TONE_STYLES, type SocialPlatform } from "@/lib/social/social-platform-types";
import { checkNaverBlogContentSafety } from "@/lib/social/naver-blog-content-safety-checks";
import {
  buildWordPressBlogPublishPreparationSummary,
  checkFeaturedImageAttachEligibility,
} from "@/lib/social/wordpress-blog-publish-preparation-summary";
import { FEATURED_IMAGE_WAIVER_REASONS } from "@/lib/social/wordpress-blog-featured-image-waiver-service";
import { WordPressPublishingPanel } from "@/components/wordpress/wordpress-publishing-panel";
import { WORDPRESS_BLOG_SEO_PLUGIN_PROVIDERS } from "@/lib/social/wordpress-blog-seo-plugin-service";
import { readWordPressBlogImageGenerationState } from "@/lib/social/wordpress-blog-image-generation-service";
import {
  getWordPressBlogWorkflowStatusSummary,
  getWordPressBlogNextRecommendedAction,
} from "@/lib/social/wordpress-blog-workflow-steps";
import { buildWordPressBlogPostPreview } from "@/lib/social/wordpress-blog-post-preview-builder";
import {
  WORDPRESS_BLOG_CARD_TABS,
  normalizeWordPressBlogCardTab,
  getTabForWorkflowStep,
  getWordPressBlogCardTabBadges,
} from "@/lib/social/wordpress-blog-card-tabs";
import { getLogsByArticleId } from "@/lib/repositories/log-repository";
import {
  buildWordPressBlogProcessLogEntries,
  filterWordPressBlogProcessLogEntries,
  filterWordPressBlogProcessLogEntriesByPost,
  sortWordPressBlogProcessLogEntriesForDisplay,
  WORDPRESS_BLOG_LOG_CATEGORY_LABELS,
  type WordPressBlogLogFilter,
  type WordPressBlogProcessLogEntry,
} from "@/lib/social/wordpress-blog-process-log-view";
import {
  getWordPressBlogPreparationStepLabel,
  getWordPressBlogPreparationStepStatusLabel,
  type WordPressBlogPreparationStep,
  type WordPressBlogPreparationStepResult,
} from "@/lib/social/wordpress-blog-publish-preparation-orchestrator";
import {
  computeManualPostingChecklistItemStatus,
  summarizeManualPostingChecklistStatus,
  getChecklistHandoffMismatchNotice,
  getChecklistGuidanceMessage,
  MANUAL_POSTING_CHECKLIST_ITEM_STATUS_LABELS,
  MANUAL_POSTING_CHECKLIST_ITEM_STATUS_DESCRIPTIONS,
  MANUAL_POSTING_CHECKLIST_ITEM_GUIDES,
  URL_RECORDED_CHECKLIST_ITEM_KEYS,
  CONFIRMABLE_MANUAL_CHECKLIST_ITEM_KEYS,
  type ManualPostingChecklistStatusInput,
  type ManualChecklistConfirmations,
} from "@/lib/social/manual-posting-checklist-status";
import {
  generatePlaceholderSocialPostAction,
  generateSocialDraftAction,
  runSocialPostQualityGateAction,
  requestSocialPostApprovalAction,
  approveSocialPostAction,
  generateManualExportAction,
  prepareManualPostingRecordAction,
  markManualChecklistItemConfirmedAction,
  recordManualPostingResultAction,
  recordSocialPostMetricsAction,
  runPlatformPublishingGuardAction,
  createPlatformPublishDryRunAction,
  completePlatformExportHandoffAction,
  createWordPressDraftFromBlogPostAction,
  updateWordPressDraftFromBlogPostAction,
  updateWordPressSeoMetadataFromBlogPostAction,
  updateWordPressSeoPluginMetadataFromBlogPostAction,
  saveWordPressFeaturedImageMediaForBlogPostAction,
  uploadWordPressFeaturedImageFromBlogPostAction,
  attachWordPressFeaturedImageFromBlogPostAction,
  waiveWordPressFeaturedImageForBlogPostAction,
  regenerateWordPressBlogMetadataAction,
  generateWordPressBlogFeaturedImagePromptAction,
  generateWordPressBlogFeaturedImageAction,
  prepareWordPressBlogPostForPublishingAction,
} from "../actions";

export const dynamic = "force-dynamic";

const BLOG_PLATFORMS: SocialPlatform[] = ["wordpress_blog", "naver_blog"];
const ANCHOR_PREFIX = "social-post";
const PROCESS_LOG_VISIBLE_COUNT = 20;

const LOG_FILTER_OPTIONS: { key: WordPressBlogLogFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "wordpress", label: "WordPress" },
  { key: "seo", label: "SEO" },
  { key: "image", label: "대표 이미지" },
  { key: "publish_guard", label: "게시 준비" },
  { key: "handoff", label: "Handoff" },
  { key: "failed_only", label: "실패만 보기" },
];

/** WordPress 게시 준비 단계형 UI의 상태 badge 색상. 새 디자인 시스템을 추가하지 않고 기존 tailwind 팔레트만 사용한다. */
function stepBadgeClass(status: string): string {
  if (["완료", "승인됨", "생성됨", "준비됨", "연결됨", "ready", "handoff 완료", "성공"].includes(status)) {
    return "bg-green-100 text-green-800";
  }
  if (["실패", "차단됨", "없음"].includes(status)) {
    return "bg-red-100 text-red-800";
  }
  if (["필요", "승인 필요", "누락", "미확인", "경고", "미준비", "이미지 없이 진행", "확인 필요", "대기중"].includes(status)) {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-zinc-100 text-zinc-600";
}

function logStatusBadgeClass(status: string): string {
  if (status === "success") return "bg-green-100 text-green-800";
  if (status === "failed") return "bg-red-100 text-red-800";
  return "bg-zinc-100 text-zinc-600";
}

/**
 * 페이지 하단 "프로세스 로그 / 실행 이력" 섹션의 로그 항목 하나를 렌더링한다.
 * event_name/status/message/created_at과 짧은 details 요약만 기본으로
 * 보여주고, raw JSON은 "상세 JSON 보기"로 따로 접어둔다.
 */
function renderProcessLogEntry(entry: WordPressBlogProcessLogEntry) {
  return (
    <li key={entry.id} className="rounded border border-zinc-100 p-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-zinc-700">{entry.eventName}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${logStatusBadgeClass(entry.status)}`}>
          {entry.status}
        </span>
      </div>
      <p className="mt-0.5 text-zinc-600">{entry.message}</p>
      <p className="mt-0.5 text-zinc-400">
        {entry.createdAt} · {WORDPRESS_BLOG_LOG_CATEGORY_LABELS[entry.category]} · {entry.detailsSummary}
      </p>
      <details className="mt-0.5">
        <summary className="cursor-pointer text-zinc-400">상세 JSON 보기</summary>
        <pre className="mt-0.5 overflow-x-auto rounded bg-zinc-50 p-1 text-[9px] text-zinc-600">
          {JSON.stringify(entry.rawDetails, null, 2)}
        </pre>
      </details>
    </li>
  );
}

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
    /** wordpress_blog 카드 내부 탭(글 내용/미리보기/품질승인/WordPress 반영/대표 이미지/체크리스트). */
    tab?: string;
    /** 페이지 하단 "프로세스 로그 / 실행 이력" 섹션 필터(전체/WordPress/SEO/대표 이미지/게시 준비/Handoff/실패만). */
    logFilter?: string;
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
    tab,
    logFilter: logFilterParam,
    returnTo,
    page: pageParam,
    perPage: perPageParam,
  } = await searchParams;
  const activeTab = normalizeWordPressBlogCardTab(tab);
  const logFilter: WordPressBlogLogFilter =
    logFilterParam === "wordpress" ||
    logFilterParam === "seo" ||
    logFilterParam === "image" ||
    logFilterParam === "publish_guard" ||
    logFilterParam === "handoff" ||
    logFilterParam === "failed_only"
      ? logFilterParam
      : "all";
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

  // wordpress_blog 카드의 "WordPress 게시 준비" 섹션에서 쓸 요약을 미리 계산한다
  // (draft/SEO/featured image/guard 상태 — 읽기 전용, API 호출 없음).
  const wordpressBlogSummaries = new Map(
    await Promise.all(
      posts
        .filter((post) => post.platform === "wordpress_blog")
        .map(async (post) => [post.id, await buildWordPressBlogPublishPreparationSummary(article.id, post)] as const)
    )
  );

  // wordpress_blog 카드 안에는 프로세스 로그/실행 이력을 두지 않고, 페이지 하단
  // "프로세스 로그 / 실행 이력" 섹션으로 모은다(카드 안에는 짧은 요약 + 링크만 남긴다).
  const wordpressBlogPostIds = new Set(posts.filter((post) => post.platform === "wordpress_blog").map((post) => post.id));
  const allProcessLogs = wordpressBlogPostIds.size > 0 ? await getLogsByArticleId(article.id, 100) : [];
  const wordpressBlogProcessLogEntries = buildWordPressBlogProcessLogEntries(allProcessLogs, wordpressBlogPostIds);
  const filteredProcessLogEntries = filterWordPressBlogProcessLogEntries(wordpressBlogProcessLogEntries, logFilter);

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

        {/* "선택한 항목을 강조 표시했습니다." 같은 확인 메시지는 표시하지 않는다 —
            카드 자체의 강조 표시(getHighlightClassName)만으로 충분하다. 항목을
            찾지 못했을 때의 경고는 실제로 필요한 정보이므로 그대로 둔다. */}
        {targetSocialPostId && !targetFound && <DeepLinkNotice targetId={targetSocialPostId} found={false} />}
        {targetOnDifferentPage && (
          <div className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            선택한 항목이 현재 page에 없습니다.{" "}
            <a href={`${basePath}?${new URLSearchParams({ ...currentSearchParams, page: String(targetPage) }).toString()}`} className="underline">
              해당 항목이 있는 {targetPage} page로 이동 →
            </a>
          </div>
        )}

        {/* action 실행 결과(성공/실패)는 본문 중간에 계속 남는 alert box 대신
            잠깐 떴다 사라지는 toast로 보여준다. 상세 기록은 여전히 로그에 남고
            (harness logger), 상태 자체는 각 카드의 상태 요약에 남는다. */}
        <TransientNotice message={error ?? null} variant="error" />
        <TransientNotice message={publishMessage ?? null} variant="success" />

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
                    {post.platform === "wordpress_blog" && (
                      <p className="mt-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] text-indigo-800">
                        이 글은 WordPress 게시용 블로그 글입니다.
                      </p>
                    )}
                    {post.platform === "naver_blog" && (
                      <p className="mt-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">
                        이 글은 네이버 블로그 수동 게시용 글입니다.
                      </p>
                    )}
                    <p className="mt-1 font-medium text-zinc-700">{post.postTitle || "(제목 없음)"}</p>
                    <p className="mt-1 text-zinc-500">{(post.excerpt || post.postBody || "").slice(0, 140) || "(본문 없음)"}{(post.excerpt || post.postBody || "").length > 140 ? "…" : ""}</p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      quality: {post.qualityStatus} · approval: {post.approvalStatus} · publish: {post.publishStatus} · export: {post.exportStatus} ·
                      manual_post: {post.manualPostStatus}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      API 게시 준비: <ApiReadinessBadge status={checkPlatformApiReadiness(post.platform).status} />{" "}
                      <a href={buildSocialPostDetailUrl(post.id, selfReturnTo)} className="text-indigo-700 hover:underline">
                        상세에서 확인 →
                      </a>
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
                          {post.platform === "wordpress_blog" ? "수동 게시용 Draft 내보내기" : "Naver Blog Export"}
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

                    {post.platform === "wordpress_blog" &&
                      (() => {
                        const summary = wordpressBlogSummaries.get(post.id);
                        if (!summary) return null;
                        const { readiness, draft, seo, featuredImage, guardStatus, blogMetadata } = summary;
                        const seoPluginProvider =
                          typeof post.platformMetadata.seoPluginProvider === "string"
                            ? post.platformMetadata.seoPluginProvider
                            : "none";
                        const seoPluginWriteRaw =
                          typeof post.platformMetadata.seoPluginWrite === "object" && post.platformMetadata.seoPluginWrite !== null
                            ? (post.platformMetadata.seoPluginWrite as Record<string, unknown>)
                            : null;
                        const seoPluginWriteStatus = typeof seoPluginWriteRaw?.status === "string" ? seoPluginWriteRaw.status : "not_ready";
                        const seoPluginWriteUpdatedAt = typeof seoPluginWriteRaw?.updatedAt === "string" ? seoPluginWriteRaw.updatedAt : null;
                        const seoPluginWriteError = typeof seoPluginWriteRaw?.errorMessage === "string" ? seoPluginWriteRaw.errorMessage : null;
                        const imageGeneration = readWordPressBlogImageGenerationState(post.platformMetadata);
                        const featuredImageAttached = featuredImage.attachStatus === "attached";
                        const checklistStatusInput: ManualPostingChecklistStatusInput = {
                          qualityStatus: post.qualityStatus,
                          approvalStatus: post.approvalStatus,
                          exportStatus: post.exportStatus,
                          platformPublishGuardStatus: post.platformPublishGuardStatus,
                          platformPublishReady: post.platformPublishReady,
                          platformPublishDryRunStatus: post.platformPublishDryRunStatus,
                          handoffStatus: post.handoffStatus,
                          manualPostStatus: post.manualPostStatus,
                          postUrl: post.postUrl,
                          manualPostUrl: post.manualPostUrl,
                        };
                        const checklistConfirmationsRaw =
                          typeof post.platformMetadata.manualChecklistConfirmations === "object" &&
                          post.platformMetadata.manualChecklistConfirmations !== null
                            ? (post.platformMetadata.manualChecklistConfirmations as ManualChecklistConfirmations)
                            : {};
                        const checklistDisplay = post.manualPostChecklist.map((item, i) => {
                          const key = typeof item.key === "string" ? item.key : `checklist-item-${i}`;
                          const label = typeof item.label === "string" ? item.label : key;
                          const storedStatus = typeof item.status === "string" ? item.status : "pending";
                          return {
                            key,
                            label,
                            status: computeManualPostingChecklistItemStatus(
                              key,
                              storedStatus,
                              checklistStatusInput,
                              checklistConfirmationsRaw
                            ),
                          };
                        });
                        const checklistSummary = summarizeManualPostingChecklistStatus(checklistDisplay);
                        const checklistMismatchNotice = getChecklistHandoffMismatchNotice(post.handoffStatus, checklistSummary);
                        const checklistGuidanceMessage = getChecklistGuidanceMessage(checklistSummary);
                        const checklistUrlMissing = !post.manualPostUrl && !post.postUrl;
                        const checklistNeedsReviewItems = checklistDisplay.filter((item) => item.status === "needs_review");
                        const attachEligibility = checkFeaturedImageAttachEligibility(summary);
                        const workflowInput = {
                          qualityStatus: post.qualityStatus,
                          approvalStatus: post.approvalStatus,
                          draftExists: draft.exists,
                          seoTitle: blogMetadata.seoTitle,
                          metaDescription: blogMetadata.metaDescription,
                          targetKeyword: blogMetadata.targetKeyword,
                          featuredImageAttached,
                          featuredImageWaived: featuredImage.waived,
                          featuredImageMediaIdPresent: Boolean(featuredImage.wordpressMediaId),
                          publishGuardStatus: guardStatus,
                          checklistPrepared: post.manualPostChecklist.length > 0,
                          handoffStatus: post.handoffStatus,
                          checklistNeedsReviewCount: checklistSummary.needsReview,
                          checklistUrlMissing,
                        };
                        const workflowStatus = getWordPressBlogWorkflowStatusSummary(workflowInput);
                        const nextAction = getWordPressBlogNextRecommendedAction(workflowInput);
                        const postPreview = buildWordPressBlogPostPreview({
                          postTitle: post.postTitle,
                          postBody: post.postBody,
                          seoTitle: blogMetadata.seoTitle,
                          metaDescription: blogMetadata.metaDescription,
                          targetKeyword: blogMetadata.targetKeyword,
                          featuredImageUrl: featuredImage.wordpressUrl,
                        });
                        const lastRunRaw =
                          typeof post.platformMetadata.lastPublishPreparationRun === "object" &&
                          post.platformMetadata.lastPublishPreparationRun !== null
                            ? (post.platformMetadata.lastPublishPreparationRun as Record<string, unknown>)
                            : null;
                        const lastRunSteps: WordPressBlogPreparationStepResult[] = Array.isArray(lastRunRaw?.steps)
                          ? (lastRunRaw.steps as WordPressBlogPreparationStepResult[])
                          : [];
                        const lastRunSuccess = lastRunRaw?.success === true;
                        const lastRunFailedStep = typeof lastRunRaw?.failedStep === "string" ? (lastRunRaw.failedStep as WordPressBlogPreparationStep) : null;
                        const lastRunMessage = typeof lastRunRaw?.message === "string" ? lastRunRaw.message : null;
                        const lastRunAt = typeof lastRunRaw?.ranAt === "string" ? lastRunRaw.ranAt : null;
                        // wordpress_blog 카드 안 탭 이동 시에도 지금 보고 있는 탭(activeTab)을
                        // 유지한 채 같은 카드로 돌아오도록, 이 IIFE 안에서만 selfReturnTo를
                        // tab을 포함한 값으로 새로 정의한다(바깥 selfReturnTo — 카드 상단 공통
                        // 버튼용 — 는 그대로 둔다. 이 지역 변수가 아래 JSX 전체에서 selfReturnTo를 가린다).
                        const selfReturnTo = buildArticleBlogUrl(id, { socialPostId: post.id, highlight: post.id, tab: activeTab });
                        const tabBadges = getWordPressBlogCardTabBadges({
                          qualityStatus: workflowStatus.quality,
                          approvalStatus: workflowStatus.approval,
                          draftStatus: workflowStatus.draft,
                          seoStatus: workflowStatus.seo,
                          publishGuardStatus: workflowStatus.publishGuard,
                          featuredImageStatus: workflowStatus.featuredImage,
                          checklistStatus: workflowStatus.checklist,
                          checklistNeedsReviewCount: checklistSummary.needsReview,
                        });
                        const nextActionTab = getTabForWorkflowStep(nextAction.step);
                        return (
                          <WordPressPublishingPanel
                            targetType="wordpress_blog"
                            isPrimaryWorkflow
                            summary={{
                              qualityStatus: post.qualityStatus,
                              approvalStatus: post.approvalStatus,
                              draftStatus: draft.exists ? "생성됨" : "아직 생성되지 않음",
                              draftId: draft.postId,
                              draftUrl: draft.postUrl,
                              seoMetadataStatus: seo.status,
                              // wordpress_blog 자신의 metadata만 표시한다 — article 값으로
                              // fallback하지 않는다(blogMetadata는 post.platformMetadata 전용).
                              seoTitle: blogMetadata.seoTitle,
                              metaDescription: blogMetadata.metaDescription,
                              targetKeyword: blogMetadata.targetKeyword,
                              secondaryKeywords: blogMetadata.secondaryKeywords,
                              featuredImageStatus: featuredImage.status,
                              featuredImageMediaId: featuredImage.wordpressMediaId,
                              featuredImageUrl: featuredImage.wordpressUrl,
                              featuredImageAttachStatus: featuredImage.attachStatus,
                              featuredImageErrorMessage: featuredImage.attachError ?? featuredImage.uploadError,
                              featuredImageWaived: featuredImage.waived,
                              featuredImageWaiverReason: featuredImage.waivedReasonCode,
                              publishGuardStatus: guardStatus,
                              lastActionResult: null,
                              lastUpdatedAt: post.updatedAt,
                            }}
                          >
                            {/* 고정 상태 요약 — 탭과 무관하게 항상 보인다(탭 위에 위치). 카드가 길어서
                                생기는 스크롤 부담을 줄이기 위해, 카드 안의 나머지 내용은 아래 탭
                                내비게이션으로 분리한다. */}
                            <div className="rounded border border-indigo-200 bg-white p-2">
                              <p className="text-[11px] font-semibold text-indigo-900">단계별 상태 요약</p>
                              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-indigo-800 sm:grid-cols-4">
                                <div className="flex items-center justify-between gap-1">
                                  <dt>품질검사</dt>
                                  <dd className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stepBadgeClass(workflowStatus.quality)}`}>{workflowStatus.quality}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                  <dt>승인</dt>
                                  <dd className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stepBadgeClass(workflowStatus.approval)}`}>{workflowStatus.approval}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                  <dt>Draft</dt>
                                  <dd className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stepBadgeClass(workflowStatus.draft)}`}>{workflowStatus.draft}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                  <dt>SEO Metadata</dt>
                                  <dd className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stepBadgeClass(workflowStatus.seo)}`}>{workflowStatus.seo}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                  <dt>대표 이미지</dt>
                                  <dd className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stepBadgeClass(workflowStatus.featuredImage)}`}>{workflowStatus.featuredImage}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                  <dt>게시 준비</dt>
                                  <dd className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stepBadgeClass(workflowStatus.publishGuard)}`}>{workflowStatus.publishGuard}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                  <dt>체크리스트</dt>
                                  <dd className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stepBadgeClass(workflowStatus.checklist)}`}>{workflowStatus.checklist}</dd>
                                </div>
                              </dl>
                            </div>

                            {/* 다음 추천 작업 — 지금 상태 기준으로 다음에 눌러야 할 버튼 하나를 안내하고,
                                해당 작업이 있는 탭으로 바로 이동하는 버튼을 함께 보여준다. */}
                            <div className="mt-2 rounded border border-indigo-300 bg-indigo-100/70 p-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-[11px] font-semibold text-indigo-900">{nextAction.title}</p>
                                  <p className="mt-1 text-[10px] text-zinc-600">{nextAction.description}</p>
                                </div>
                                <a
                                  href={buildArticleBlogUrl(id, { socialPostId: post.id, highlight: post.id, tab: nextActionTab })}
                                  className="shrink-0 rounded border border-indigo-400 bg-white px-2 py-1 text-[10px] font-medium text-indigo-700 hover:bg-indigo-50"
                                >
                                  {WORDPRESS_BLOG_CARD_TABS.find((t) => t.key === nextActionTab)?.label} 탭으로 이동
                                </a>
                              </div>
                            </div>

                            {/* WordPress에 반영하기 — primary button. Draft/SEO/대표 이미지/게시 가능
                                확인을 순서대로 실행한다(prepareWordPressBlogPostForPublishingAction 재사용,
                                공개 게시 아님). 탭과 무관하게 항상 보인다. */}
                            <form action={prepareWordPressBlogPostForPublishingAction} className="mt-2">
                              <input type="hidden" name="articleId" value={article.id} />
                              <input type="hidden" name="socialPostId" value={post.id} />
                              <input type="hidden" name="returnTo" value={selfReturnTo} />
                              <button
                                type="submit"
                                disabled={!readiness.ready}
                                className="w-full rounded bg-indigo-800 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                WordPress에 반영하기
                              </button>
                            </form>
                            <p className="mt-1 text-[10px] text-zinc-500">
                              wordpress_blog 글을 WordPress Draft에 반영합니다. 공개 게시는 하지 않습니다.
                            </p>
                            <details className="mt-1">
                              <summary className="cursor-pointer text-[10px] text-zinc-400">자세히 보기</summary>
                              <p className="mt-1 text-[10px] text-zinc-500">
                                Draft 생성/업데이트, SEO metadata, 대표 이미지를 가능한 범위에서 함께
                                반영합니다. 실패 단계가 있으면 그 단계에서 중단됩니다. 이 버튼은 WordPress
                                Draft 생성/업데이트까지만 실행합니다. 공개 게시 버튼은 누르지 않습니다.
                                최종 공개는 WordPress 관리자 화면에서 확인 후 진행하세요.
                              </p>
                              <p className="mt-1 text-[10px] text-zinc-500">개별 단계만 다시 실행하려면 아래 탭에서 보조 버튼을 사용하세요.</p>
                            </details>

                            {/* 탭 내비게이션 — 카드 안에서 sticky로 상단에 고정된 것처럼 배치한다.
                                새 라이브러리 없이 기존 Tailwind만 사용한다. 좁은 화면에서는
                                overflow-x-auto로 가로 스크롤된다. */}
                            <nav className="sticky top-0 z-10 mt-3 -mx-1 flex gap-1 overflow-x-auto border-b border-indigo-200 bg-white/95 px-1 py-1 text-[11px] backdrop-blur">
                              {WORDPRESS_BLOG_CARD_TABS.map((t) => {
                                const badge =
                                  t.key === "quality"
                                    ? tabBadges.quality
                                    : t.key === "wordpress"
                                      ? tabBadges.wordpress
                                      : t.key === "image"
                                        ? tabBadges.image
                                        : t.key === "checklist"
                                          ? tabBadges.checklist
                                          : null;
                                const isActive = activeTab === t.key;
                                return (
                                  <a
                                    key={t.key}
                                    href={buildArticleBlogUrl(id, { socialPostId: post.id, highlight: post.id, tab: t.key })}
                                    className={`shrink-0 whitespace-nowrap rounded-t px-2 py-1 font-medium ${
                                      isActive ? "border-b-2 border-indigo-700 text-indigo-900" : "text-indigo-500 hover:text-indigo-700"
                                    }`}
                                  >
                                    {t.label}
                                    {badge && (
                                      <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${stepBadgeClass(badge)}`}>
                                        {badge}
                                      </span>
                                    )}
                                  </a>
                                );
                              })}
                            </nav>

                            {/* 검사가 많은 이유 — 품질·승인 탭. 왜 이렇게 단계가 많은지 한 번에 설명한다. */}
                            {activeTab === "quality" && (
                              <div className="mt-2 rounded border border-indigo-200 bg-indigo-50 p-2 text-[10px] text-indigo-800">
                                검사가 많은 이유는 자동 생성 글을 바로 공개하지 않고, WordPress에 올리기
                                전에 제목·본문·SEO·대표 이미지·정책 위험을 나누어 확인하기 위해서입니다.
                                이 과정은 중복 게시, 잘못된 메타데이터, 누락된 대표 이미지, 광고 정책
                                위반 가능성을 줄이기 위한 안전장치입니다.
                              </div>
                            )}

                            {/* 글 내용 — content 탭. wordpress_blog 자신의 제목/본문 요약(전체 본문은
                                접어둔다). SEO/게시용 자체 생성 metadata는 이 탭 아래쪽에 있다. */}
                            {activeTab === "content" && (
                              <div className="mt-2 rounded border border-indigo-200 bg-white p-2">
                                <p className="text-[11px] font-semibold text-indigo-900">글 내용</p>
                                <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] text-indigo-800">
                                  <div>
                                    <dt className="font-medium">제목</dt>
                                    <dd>{post.postTitle ?? "-"}</dd>
                                  </div>
                                </dl>
                                <div className="mt-2">
                                  <p className="text-[10px] font-medium text-indigo-800">본문 요약</p>
                                  <p className="mt-1 whitespace-pre-wrap text-[10px] text-zinc-700">
                                    {postPreview.bodyPreviewText || "본문이 아직 없습니다."}
                                    {postPreview.bodyTruncated && "…"}
                                  </p>
                                  {postPreview.bodyTruncated && (
                                    <details className="mt-1">
                                      <summary className="cursor-pointer text-[10px] text-indigo-600">
                                        전체 본문 보기 (전체 {postPreview.bodyFullLength}자)
                                      </summary>
                                      <p className="mt-1 whitespace-pre-wrap text-[10px] text-zinc-700">{post.postBody}</p>
                                    </details>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* WordPress 게시 미리보기 — WordPress에 실제로 반영되기 전에 이 wordpress_blog
                                글이 어떤 모양으로 올라갈지 미리 보여준다. article 원문이 아니라 이 글
                                자신의 내용(postPreview)만 사용한다. preview 탭. */}
                            {activeTab === "preview" && (
                              <>
                            <div className="mt-2 rounded border border-indigo-200 bg-white p-2">
                              <p className="text-[11px] font-semibold text-indigo-900">WordPress 게시 미리보기</p>
                              <p className="mt-1 text-[10px] text-zinc-600">
                                WordPress에 실제로 반영되기 전에 이 wordpress_blog 글이 어떤 모양으로
                                올라갈지 미리 확인합니다. article 원문이 아니라 이 글 자체의 내용입니다.
                              </p>
                              <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] text-indigo-800 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                  <dt className="font-medium">WordPress 제목</dt>
                                  <dd>{postPreview.title}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium">SEO 제목</dt>
                                  <dd>{postPreview.seoTitle ?? "-"}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium">Target Keyword</dt>
                                  <dd>{postPreview.targetKeyword ?? "-"}</dd>
                                </div>
                                <div className="sm:col-span-2">
                                  <dt className="font-medium">Meta Description</dt>
                                  <dd>{postPreview.metaDescription ?? "-"}</dd>
                                </div>
                              </dl>
                              <div className="mt-2">
                                <p className="text-[10px] font-medium text-indigo-800">대표 이미지 미리보기</p>
                                {postPreview.featuredImageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={postPreview.featuredImageUrl}
                                    alt="대표 이미지 미리보기"
                                    className="mt-1 h-24 w-24 rounded border border-indigo-200 object-cover"
                                  />
                                ) : (
                                  <p className="mt-1 text-[10px] text-zinc-500">대표 이미지가 아직 없습니다.</p>
                                )}
                              </div>
                              <div className="mt-2">
                                <p className="text-[10px] font-medium text-indigo-800">본문 미리보기</p>
                                <p className="mt-1 whitespace-pre-wrap text-[10px] text-zinc-700">
                                  {postPreview.bodyPreviewText || "본문이 아직 없습니다."}
                                  {postPreview.bodyTruncated && "…"}
                                </p>
                                {postPreview.bodyTruncated && (
                                  <details className="mt-1">
                                    <summary className="cursor-pointer text-[10px] text-indigo-600">
                                      전체 미리보기 보기 (전체 {postPreview.bodyFullLength}자)
                                    </summary>
                                    <p className="mt-1 whitespace-pre-wrap text-[10px] text-zinc-700">{post.postBody}</p>
                                  </details>
                                )}
                              </div>
                              <div className="mt-2">
                                <p className="text-[10px] font-medium text-indigo-800">FAQ 영역 미리보기</p>
                                <p className="mt-1 whitespace-pre-wrap text-[10px] text-zinc-700">
                                  {postPreview.faqPreviewText ?? "FAQ 영역이 감지되지 않았습니다."}
                                </p>
                              </div>
                              <div className="mt-2">
                                <p className="text-[10px] font-medium text-indigo-800">광고 위치 (AD_SLOT)</p>
                                {postPreview.adSlotMarkers.length > 0 ? (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {postPreview.adSlotMarkers.map((slot) => (
                                      <span
                                        key={slot.marker}
                                        className="rounded-full bg-zinc-200 px-2 py-0.5 text-[9px] font-medium text-zinc-700"
                                      >
                                        [광고 위치 예정: {slot.label}]
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-1 text-[10px] text-zinc-500">감지된 광고 위치가 없습니다.</p>
                                )}
                              </div>
                              <div className="mt-2">
                                <p className="text-[10px] font-medium text-indigo-800">참고자료/출처 미리보기</p>
                                <p className="mt-1 whitespace-pre-wrap text-[10px] text-zinc-700">
                                  {postPreview.sourcesPreviewText ?? "참고자료/출처 영역이 감지되지 않았습니다."}
                                </p>
                              </div>
                            </div>

                            {/* WordPress 반영 데이터 — 실제로 WordPress에 전송되는 값 요약. */}
                            <div className="mt-2 rounded border border-indigo-200 bg-white p-2">
                              <p className="text-[11px] font-semibold text-indigo-900">WordPress 반영 데이터</p>
                              <p className="mt-1 text-[10px] text-zinc-600">
                                아래 정보가 WordPress에 반영됩니다. 기사 원문 article이 아니라 이
                                wordpress_blog 글 기준으로 전송됩니다.
                              </p>
                              <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] text-indigo-800 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                  <dt className="font-medium">제목</dt>
                                  <dd>{post.postTitle ?? "-"}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium">SEO title</dt>
                                  <dd>{blogMetadata.seoTitle ?? "-"}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium">Meta description</dt>
                                  <dd>{blogMetadata.metaDescription ?? "-"}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium">Target keyword</dt>
                                  <dd>{blogMetadata.targetKeyword ?? "-"}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium">대표 이미지</dt>
                                  <dd>{featuredImage.wordpressMediaId ? `media ID: ${featuredImage.wordpressMediaId}` : "이미지 없음"}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium">WordPress Post ID</dt>
                                  <dd>{draft.postId ?? "-"}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium">업데이트 대상</dt>
                                  <dd>{draft.exists ? "기존 Draft 업데이트" : "새 Draft 생성"}</dd>
                                </div>
                              </dl>
                            </div>
                            </>
                            )}

                            {/* 최근 WordPress 반영 결과 — WordPress 반영 탭. "WordPress에 반영하기" 실행
                                결과를 platformMetadata.lastPublishPreparationRun에서 읽어 보여준다.
                                페이지를 새로고침해도(redirect 이후) 마지막 실행 결과를 계속 볼 수 있다. */}
                            {activeTab === "wordpress" && lastRunRaw && (
                              <div className="mt-2 rounded border border-indigo-200 bg-white p-2">
                                <p className="text-[11px] font-semibold text-indigo-900">최근 WordPress 반영 결과</p>
                                <p className="mt-1 text-[10px] text-zinc-600">
                                  {lastRunSuccess ? "성공" : "실패"} · 실행 시간: {lastRunAt ?? "-"}
                                </p>
                                <ul className="mt-1 space-y-0.5 text-[10px] text-zinc-700">
                                  {lastRunSteps.map((step, i) => (
                                    <li key={i} className="flex items-center justify-between gap-2">
                                      <span>{getWordPressBlogPreparationStepLabel(step.step)}</span>
                                      <span
                                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${stepBadgeClass(
                                          getWordPressBlogPreparationStepStatusLabel(step.status)
                                        )}`}
                                      >
                                        {getWordPressBlogPreparationStepStatusLabel(step.status)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                                {!lastRunSuccess && lastRunFailedStep && (
                                  <p className="mt-1 text-[10px] text-red-600">
                                    실패 단계: {getWordPressBlogPreparationStepLabel(lastRunFailedStep)}
                                    {lastRunMessage ? ` — ${lastRunMessage}` : ""}
                                  </p>
                                )}
                                <p className="mt-1 text-[10px] text-zinc-500">
                                  상세 실행 로그는 페이지 하단에서 확인할 수 있습니다.{" "}
                                  <a href={`#${buildAnchorId("process-log-group", post.id)}`} className="text-indigo-600 underline hover:text-indigo-700">
                                    상세 로그 보기
                                  </a>
                                </p>
                              </div>
                            )}

                            {/* 내부 상태값 보기 — raw DB 상태값(quality_status 등)을 접어서 보여준다.
                                WordPress 반영 탭. 일반 사용자는 상단의 한국어 상태 요약만 보면 되고,
                                필요할 때만 펼쳐서 원본 status 문자열을 확인한다. */}
                            {activeTab === "wordpress" && (
                              <details className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-2">
                                <summary className="cursor-pointer text-[10px] font-medium text-zinc-500">내부 상태값 보기</summary>
                                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-zinc-600 sm:grid-cols-3">
                                  <div>
                                    <dt className="font-medium text-zinc-700">quality_status</dt>
                                    <dd>{post.qualityStatus}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-zinc-700">approval_status</dt>
                                    <dd>{post.approvalStatus}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-zinc-700">publish_status</dt>
                                    <dd>{post.publishStatus}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-zinc-700">export_status</dt>
                                    <dd>{post.exportStatus}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-zinc-700">manual_post_status</dt>
                                    <dd>{post.manualPostStatus}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-zinc-700">updatedAt</dt>
                                    <dd>{post.updatedAt}</dd>
                                  </div>
                                </dl>
                              </details>
                            )}

                            {/* Step 1. 품질검사 (버튼은 카드 상단의 공통 '품질검사' 버튼을 그대로 사용 — 중복 배치하지 않음) + Step 2. 승인. quality 탭. */}
                            {activeTab === "quality" && (
                              <>
                                <div className="mt-3 rounded border border-indigo-200 bg-white p-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-semibold text-indigo-900">Step 1. 품질검사</p>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stepBadgeClass(workflowStatus.quality)}`}>{workflowStatus.quality}</span>
                                  </div>
                                  <p className="mt-1 text-[10px] text-zinc-600">
                                    본문 구조, SEO 요소, 정책 위험, 광고 슬롯 위치를 확인합니다. WordPress에
                                    보내기 전에 글 자체가 게시 가능한 상태인지 점검합니다. 위쪽의
                                    &ldquo;품질검사&rdquo; 버튼을 사용하세요.
                                  </p>
                                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-indigo-800">
                                    <div>
                                      <dt className="font-medium">score</dt>
                                      <dd>{post.qualityScore ?? "-"}</dd>
                                    </div>
                                    <div>
                                      <dt className="font-medium">마지막 실행 시간</dt>
                                      <dd>{post.lastQualityCheckedAt ?? "-"}</dd>
                                    </div>
                                  </dl>
                                </div>

                                {/* Step 2. 승인 (버튼은 카드 상단의 공통 '승인 요청'/'승인' 버튼을 그대로 사용 — 중복 배치하지 않음) */}
                                <div className="mt-2 rounded border border-indigo-200 bg-white p-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-semibold text-indigo-900">Step 2. 승인</p>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stepBadgeClass(workflowStatus.approval)}`}>{workflowStatus.approval}</span>
                                  </div>
                                  <p className="mt-1 text-[10px] text-zinc-600">
                                    자동 생성 글을 바로 게시하지 않기 위해 사람이 한 번 확인하는 단계입니다.
                                    위쪽의 &ldquo;승인 요청&rdquo;/&ldquo;승인&rdquo; 버튼을 사용하세요.
                                  </p>
                                </div>
                              </>
                            )}

                            {/* Step 3. WordPress Draft — WordPress 반영 탭. */}
                            {activeTab === "wordpress" && (
                              <>
                            <div className="mt-2 rounded border border-indigo-200 bg-white p-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold text-indigo-900">Step 3. WordPress Draft</p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stepBadgeClass(workflowStatus.draft)}`}>{workflowStatus.draft}</span>
                              </div>
                              <p className="mt-1 text-[10px] text-zinc-600">
                                이 단계에서 wordpress_blog 글의 제목과 본문이 실제 WordPress Draft로
                                생성되거나 업데이트됩니다(article 원문 아님).
                              </p>
                              <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] text-indigo-800 sm:grid-cols-2">
                                <div>
                                  <dt className="font-medium">WordPress Post ID</dt>
                                  <dd>{draft.postId ?? "-"}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium">WordPress URL</dt>
                                  <dd className="break-all">
                                    {draft.postUrl ? (
                                      <a href={draft.postUrl} target="_blank" rel="noopener noreferrer" className="underline">
                                        {draft.postUrl}
                                      </a>
                                    ) : (
                                      "-"
                                    )}
                                  </dd>
                                </div>
                                <div className="sm:col-span-2">
                                  <dt className="font-medium">마지막 업데이트</dt>
                                  <dd>{draft.lastUpdatedAt ?? "-"}</dd>
                                </div>
                              </dl>
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                <form action={createWordPressDraftFromBlogPostAction}>
                                  <input type="hidden" name="articleId" value={article.id} />
                                  <input type="hidden" name="socialPostId" value={post.id} />
                                  <input type="hidden" name="returnTo" value={selfReturnTo} />
                                  <button
                                    type="submit"
                                    disabled={!readiness.ready}
                                    className="rounded bg-indigo-600 px-2 py-1 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    WordPress Draft 생성
                                  </button>
                                </form>
                                <form action={updateWordPressDraftFromBlogPostAction}>
                                  <input type="hidden" name="articleId" value={article.id} />
                                  <input type="hidden" name="socialPostId" value={post.id} />
                                  <input type="hidden" name="returnTo" value={selfReturnTo} />
                                  <button
                                    type="submit"
                                    disabled={!readiness.ready || !draft.exists}
                                    className="rounded border border-indigo-300 bg-white px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    WordPress Draft 업데이트
                                  </button>
                                </form>
                                {draft.postUrl ? (
                                  <a
                                    href={draft.postUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded border border-indigo-300 bg-white px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50"
                                  >
                                    WordPress에서 Draft 보기
                                  </a>
                                ) : (
                                  <span className="cursor-not-allowed rounded border border-zinc-200 bg-zinc-100 px-2 py-1 font-medium text-zinc-400">
                                    WordPress에서 Draft 보기
                                  </span>
                                )}
                              </div>
                              {!draft.postUrl && (
                                <p className="mt-1 text-[10px] text-zinc-500">아직 WordPress Draft가 생성되지 않았습니다.</p>
                              )}
                              {!readiness.ready && (
                                <p className="mt-1 text-[10px] text-red-600">
                                  {workflowStatus.approval !== "승인됨"
                                    ? "승인 후 Draft를 생성할 수 있습니다."
                                    : "게시 준비 조건을 먼저 확인하세요(아래 Step 6 참고)."}
                                </p>
                              )}
                              {readiness.ready && !draft.exists && (
                                <p className="mt-1 text-[10px] text-amber-600">먼저 Draft를 생성하세요.</p>
                              )}
                            </div>

                            <div className="mt-2 rounded border border-indigo-200 bg-white p-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold text-indigo-900">Step 4. SEO Metadata</p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stepBadgeClass(workflowStatus.seo)}`}>{workflowStatus.seo}</span>
                              </div>
                              <p className="mt-1 text-[10px] text-zinc-600">
                                Rank Math, Yoast, AIOSEO 등 SEO plugin에 SEO title, meta description,
                                target keyword를 반영합니다.
                              </p>
                            </div>
                              </>
                            )}

                            {/* SEO/게시용 metadata — 이 wordpress_blog 글 자신이 생성한 값. 글 내용 탭. */}
                            {activeTab === "content" && (
                            <div className="mt-2 rounded border border-indigo-200 bg-white p-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold text-indigo-900">SEO/게시용 metadata</p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stepBadgeClass(workflowStatus.seo)}`}>{workflowStatus.seo}</span>
                              </div>
                              <p className="mt-1 text-[10px] text-zinc-600">
                                article에는 없을 수 있는 WordPress 게시용 정보를 이 wordpress_blog 글
                                자신이 생성합니다(article 값으로 대체하지 않습니다).
                              </p>
                              <details className="mt-2">
                                <summary className="cursor-pointer text-[10px] font-medium text-zinc-500">SEO Metadata 상세 보기</summary>
                                <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] text-zinc-600 sm:grid-cols-2">
                                  <div>
                                    <dt className="font-medium text-zinc-700">seoTitle</dt>
                                    <dd>{blogMetadata.seoTitle ?? "-"}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-zinc-700">metaDescription</dt>
                                    <dd>{blogMetadata.metaDescription ?? "-"}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-zinc-700">targetKeyword</dt>
                                    <dd>{blogMetadata.targetKeyword ?? "-"}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-zinc-700">secondaryKeywords</dt>
                                    <dd>{blogMetadata.secondaryKeywords.length > 0 ? blogMetadata.secondaryKeywords.join(", ") : "-"}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-zinc-700">searchIntent</dt>
                                    <dd>{blogMetadata.searchIntent ?? "-"}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-zinc-700">monetizationScore</dt>
                                    <dd>{blogMetadata.monetizationScore ?? "-"}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-zinc-700">policyRiskScore</dt>
                                    <dd>{blogMetadata.policyRiskScore ?? "-"}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-zinc-700">adSlots</dt>
                                    <dd>{blogMetadata.adSlots.length > 0 ? `${blogMetadata.adSlots.length}개` : "-"}</dd>
                                  </div>
                                  <div className="sm:col-span-2">
                                    <dt className="font-medium text-zinc-700">answerSummary</dt>
                                    <dd>{blogMetadata.answerSummary ?? "-"}</dd>
                                  </div>
                                  <div className="sm:col-span-2">
                                    <dt className="font-medium text-zinc-700">eeatNotes 요약</dt>
                                    <dd>{blogMetadata.eeatNotes ? JSON.stringify(blogMetadata.eeatNotes) : "-"}</dd>
                                  </div>
                                  <div className="sm:col-span-2">
                                    <dt className="font-medium text-zinc-700">geoSummary 요약</dt>
                                    <dd>
                                      {blogMetadata.geoSummary && typeof blogMetadata.geoSummary.directAnswer === "string"
                                        ? blogMetadata.geoSummary.directAnswer
                                        : "-"}
                                    </dd>
                                  </div>
                                </dl>
                              </details>
                              <form action={regenerateWordPressBlogMetadataAction} className="mt-2">
                                <input type="hidden" name="articleId" value={article.id} />
                                <input type="hidden" name="socialPostId" value={post.id} />
                                <input type="hidden" name="returnTo" value={selfReturnTo} />
                                <button type="submit" className="rounded border border-indigo-300 bg-white px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50">
                                  SEO Metadata 재생성
                                </button>
                              </form>
                            </div>
                            )}

                            {/* SEO Plugin Metadata — 실제 WordPress SEO plugin 반영. WordPress 반영 탭. */}
                            {activeTab === "wordpress" && (
                              <>
                            <div className="mt-3 rounded border border-indigo-200 bg-white p-2">
                              <p className="text-[11px] font-semibold text-indigo-900">SEO Plugin Metadata</p>
                              <p className="mt-1 text-[10px] text-zinc-600">
                                Rank Math/Custom Endpoint는 실제로 WordPress에 반영되고, Yoast/AIOSEO도
                                표준 REST 경로로 반영을 시도합니다. article과 같은 WordPress post를
                                대상으로 하지만, wordpress_blog 자신의 seoTitle/metaDescription/
                                targetKeyword만 사용하며 결과도 이 글 기준으로 별도 표시합니다.
                              </p>
                              <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] text-indigo-800 sm:grid-cols-2">
                                <div>
                                  <dt className="font-medium">현재 provider</dt>
                                  <dd>{seoPluginProvider}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium">SEO Plugin update status</dt>
                                  <dd>{seoPluginWriteStatus}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium">last updated at</dt>
                                  <dd>{seoPluginWriteUpdatedAt ?? "-"}</dd>
                                </div>
                                {seoPluginWriteError && (
                                  <div className="sm:col-span-2">
                                    <dt className="font-medium text-red-700">error message</dt>
                                    <dd className="text-red-700">{seoPluginWriteError}</dd>
                                  </div>
                                )}
                              </dl>
                              <form action={updateWordPressSeoPluginMetadataFromBlogPostAction} className="mt-2 flex flex-wrap items-end gap-2 text-[11px]">
                                <input type="hidden" name="articleId" value={article.id} />
                                <input type="hidden" name="socialPostId" value={post.id} />
                                <input type="hidden" name="returnTo" value={selfReturnTo} />
                                <label className="flex flex-col text-indigo-700">
                                  SEO Plugin Provider
                                  <select
                                    name="seoPluginProvider"
                                    defaultValue={seoPluginProvider}
                                    className="mt-1 w-40 rounded border border-zinc-300 px-1.5 py-1"
                                  >
                                    {WORDPRESS_BLOG_SEO_PLUGIN_PROVIDERS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <button type="submit" className="rounded border border-indigo-300 bg-white px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50">
                                  SEO Plugin Metadata 반영
                                </button>
                              </form>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                              <form action={updateWordPressSeoMetadataFromBlogPostAction}>
                                <input type="hidden" name="articleId" value={article.id} />
                                <input type="hidden" name="socialPostId" value={post.id} />
                                <input type="hidden" name="returnTo" value={selfReturnTo} />
                                <button
                                  type="submit"
                                  disabled={!readiness.ready || workflowStatus.seo === "누락"}
                                  className="rounded border border-indigo-300 bg-white px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  SEO Metadata 업데이트
                                </button>
                              </form>
                              {workflowStatus.seo === "누락" && (
                                <span className="text-[10px] text-red-600">
                                  SEO metadata가 없습니다. metadata 재생성이 필요합니다.
                                </span>
                              )}
                            </div>
                              </>
                            )}

                            {/* Step 5. 대표 이미지 — 대표 이미지 탭. */}
                            {activeTab === "image" && (
                            <div className="mt-2 rounded border border-indigo-200 bg-white p-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold text-indigo-900">Step 5. 대표 이미지</p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stepBadgeClass(workflowStatus.featuredImage)}`}>{workflowStatus.featuredImage}</span>
                              </div>
                              <p className="mt-1 text-[10px] text-zinc-600">
                                WordPress 목록, 공유 링크, 본문 상단에 표시될 대표 이미지를 설정합니다.
                                이미지가 없으면 CTR이 낮아질 수 있어 확인이 필요합니다. 대표 이미지 연결
                                전, 먼저 WordPress Media Library에 있는 이미지의 media ID를 입력하세요.
                                media ID는 WordPress 관리자 &gt; 미디어에서 확인할 수 있습니다.
                              </p>

                              <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] text-zinc-600 sm:grid-cols-2">
                                <div>
                                  <dt className="font-medium text-zinc-700">현재 대표 이미지 상태</dt>
                                  <dd>{featuredImage.status}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium text-zinc-700">WordPress media ID</dt>
                                  <dd>{featuredImage.wordpressMediaId ?? "-"}</dd>
                                </div>
                              </dl>
                              {(featuredImage.attachError || featuredImage.uploadError) && (
                                <p className="mt-1 text-[10px] font-medium text-red-700">
                                  {featuredImage.waived
                                    ? "참고: 이전 Media ID 연결 시도 실패 기록 있음(현재는 이미지 없이 진행 중)."
                                    : `오류: ${featuredImage.attachError ?? featuredImage.uploadError}`}
                                </p>
                              )}
                              <details className="mt-2">
                                <summary className="cursor-pointer text-[10px] font-medium text-zinc-500">대표 이미지 상세 보기</summary>
                                <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] text-zinc-600 sm:grid-cols-2">
                                  <div>
                                    <dt className="font-medium text-zinc-700">WordPress media URL</dt>
                                    <dd className="break-all">{featuredImage.wordpressUrl ?? "-"}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-zinc-700">연결 상태</dt>
                                    <dd>{featuredImage.attachStatus}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-zinc-700">업로드 상태</dt>
                                    <dd>{featuredImage.uploadStatus}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-zinc-700">마지막 연결</dt>
                                    <dd>{featuredImage.attachedAt ?? "-"}</dd>
                                  </div>
                                  {(featuredImage.attachError || featuredImage.uploadError) && (
                                    <div className="sm:col-span-2">
                                      <dt className="font-medium text-red-700">오류 메시지 원문</dt>
                                      <dd className="text-red-700">{featuredImage.attachError ?? featuredImage.uploadError}</dd>
                                    </div>
                                  )}
                                </dl>
                              </details>

                              <form action={saveWordPressFeaturedImageMediaForBlogPostAction} className="mt-2 flex flex-wrap items-end gap-2 text-[11px]">
                                <input type="hidden" name="articleId" value={article.id} />
                                <input type="hidden" name="socialPostId" value={post.id} />
                                <input type="hidden" name="returnTo" value={selfReturnTo} />
                                <label className="flex flex-col text-indigo-700">
                                  WordPress Media ID
                                  <input
                                    type="number"
                                    name="mediaId"
                                    min={1}
                                    step={1}
                                    required
                                    defaultValue={featuredImage.wordpressMediaId ?? undefined}
                                    className="mt-1 w-28 rounded border border-zinc-300 px-1.5 py-1"
                                  />
                                </label>
                                <label className="flex flex-col text-indigo-700">
                                  이미지 URL (선택)
                                  <input
                                    type="text"
                                    name="mediaUrl"
                                    placeholder="https://..."
                                    defaultValue={featuredImage.wordpressUrl ?? undefined}
                                    className="mt-1 w-48 rounded border border-zinc-300 px-1.5 py-1"
                                  />
                                </label>
                                <button type="submit" className="rounded border border-indigo-300 bg-white px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50">
                                  대표 이미지 정보 저장
                                </button>
                              </form>
                              <p className="mt-1 text-[10px] text-indigo-500">
                                이미지 URL만 입력한 경우에는 WordPress media ID가 필요합니다. URL 업로드
                                기능은 이후 단계에서 추가할 수 있습니다.
                              </p>

                              <div className="mt-3 rounded border border-indigo-100 bg-indigo-50/40 p-2">
                                <p className="text-[11px] font-semibold text-indigo-900">내 컴퓨터에서 이미지 업로드</p>
                                <p className="mt-1 text-[10px] text-zinc-600">
                                  내 컴퓨터의 이미지를 선택하면 WordPress Media Library에 업로드됩니다. 업로드가
                                  완료되면 media ID가 자동으로 저장되고, 이후 대표 이미지로 연결할 수 있습니다.
                                </p>
                                <form
                                  action={uploadWordPressFeaturedImageFromBlogPostAction}
                                  className="mt-2 flex flex-wrap items-end gap-2 text-[11px]"
                                >
                                  <input type="hidden" name="articleId" value={article.id} />
                                  <input type="hidden" name="socialPostId" value={post.id} />
                                  <input type="hidden" name="returnTo" value={selfReturnTo} />
                                  <WordPressFeaturedImageFilePicker />
                                </form>
                                <p className="mt-1 text-[10px] text-indigo-500">
                                  허용 형식: JPEG/PNG/WEBP, 최대 5MB. alt text/caption은 이번 버전에서는
                                  저장되지 않습니다(추후 지원 예정).
                                </p>
                              </div>

                              <div className="mt-3 rounded border border-indigo-100 bg-indigo-50/40 p-2">
                                <p className="text-[11px] font-semibold text-indigo-900">AI 대표 이미지 생성</p>
                                <p className="mt-1 text-[10px] text-zinc-600">
                                  IMAGE_GENERATION_ENABLED=false이면 실제 이미지 생성 없이 mock으로
                                  처리됩니다. 생성된 이미지는 article이 아니라 이 wordpress_blog 글
                                  기준으로만 저장됩니다.
                                </p>
                                <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] text-indigo-800 sm:grid-cols-2">
                                  <div>
                                    <dt className="font-medium">이미지 생성 상태</dt>
                                    <dd>{imageGeneration.status}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium">imagePrompt</dt>
                                    <dd>{imageGeneration.prompt ?? "-"}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium">imageAltText</dt>
                                    <dd>{imageGeneration.altText ?? "-"}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium">imageCaption</dt>
                                    <dd>{imageGeneration.caption ?? "-"}</dd>
                                  </div>
                                  {imageGeneration.error && (
                                    <div className="sm:col-span-2">
                                      <dt className="font-medium text-red-700">오류 메시지</dt>
                                      <dd className="text-red-700">{imageGeneration.error}</dd>
                                    </div>
                                  )}
                                </dl>
                                {imageGeneration.imageUrl && (
                                  <p className="mt-2 text-[10px] text-indigo-700 break-all">
                                    preview: <a href={imageGeneration.imageUrl} target="_blank" rel="noopener noreferrer" className="underline">{imageGeneration.imageUrl}</a>
                                  </p>
                                )}
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                  <form action={generateWordPressBlogFeaturedImagePromptAction}>
                                    <input type="hidden" name="articleId" value={article.id} />
                                    <input type="hidden" name="socialPostId" value={post.id} />
                                    <input type="hidden" name="returnTo" value={selfReturnTo} />
                                    <button type="submit" className="rounded border border-indigo-300 bg-white px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50">
                                      이미지 프롬프트 생성
                                    </button>
                                  </form>
                                  <form action={generateWordPressBlogFeaturedImageAction}>
                                    <input type="hidden" name="articleId" value={article.id} />
                                    <input type="hidden" name="socialPostId" value={post.id} />
                                    <input type="hidden" name="returnTo" value={selfReturnTo} />
                                    <button
                                      type="submit"
                                      disabled={!imageGeneration.prompt}
                                      className="rounded bg-indigo-700 px-2 py-1 font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      AI 이미지 생성
                                    </button>
                                  </form>
                                </div>
                                <p className="mt-1 text-[10px] text-indigo-500">
                                  알려진 한계: 생성된 이미지를 WordPress Media Library에 자동으로
                                  업로드하는 연결은 아직 없습니다 — 이미지 URL을 확인한 뒤 필요하면
                                  직접 다운로드해 위 &ldquo;내 컴퓨터에서 이미지 업로드&rdquo;를 사용하세요.
                                </p>
                              </div>

                              <div className="mt-3 rounded border border-indigo-100 bg-indigo-50/40 p-2">
                                <p className="text-[11px] font-semibold text-indigo-900">대표 이미지 없이 진행</p>
                                {featuredImage.waived ? (
                                  <>
                                    <p className="mt-1 text-[10px] text-zinc-600">
                                      상태: <span className="font-medium">대표 이미지 없음으로 진행</span> — 사용자가
                                      대표 이미지 없이 게시 준비를 진행하도록 선택했습니다.
                                      {featuredImage.waivedReasonCode &&
                                        ` (사유: ${
                                          FEATURED_IMAGE_WAIVER_REASONS.find((r) => r.code === featuredImage.waivedReasonCode)
                                            ?.label ?? featuredImage.waivedReasonCode
                                        })`}
                                      {featuredImage.waivedMemo && ` — ${featuredImage.waivedMemo}`}
                                    </p>
                                    <p className="mt-1 text-[10px] text-indigo-500">
                                      대표 이미지 없이 진행하도록 선택되었습니다. 이 상태는 warning으로 처리됩니다.
                                    </p>
                                    <p className="mt-1 text-[10px] text-indigo-500">
                                      위 media ID 입력 또는 로컬 업로드로 대표 이미지를 다시 추가하면 이 선택은
                                      자동으로 해제됩니다.
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="mt-1 text-[10px] text-zinc-600">
                                      대표 이미지 없이 진행할 수 있습니다. 다만 검색 결과 클릭률, SNS 공유 미리보기,
                                      블로그 가독성에 영향을 줄 수 있습니다.
                                    </p>
                                    <form action={waiveWordPressFeaturedImageForBlogPostAction} className="mt-2 flex flex-wrap items-end gap-2 text-[11px]">
                                      <input type="hidden" name="articleId" value={article.id} />
                                      <input type="hidden" name="socialPostId" value={post.id} />
                                      <input type="hidden" name="returnTo" value={selfReturnTo} />
                                      <label className="flex flex-col text-indigo-700">
                                        사유
                                        <select
                                          name="reasonCode"
                                          required
                                          defaultValue=""
                                          className="mt-1 w-44 rounded border border-zinc-300 px-1.5 py-1"
                                        >
                                          <option value="" disabled>
                                            사유를 선택하세요
                                          </option>
                                          {FEATURED_IMAGE_WAIVER_REASONS.map((reason) => (
                                            <option key={reason.code} value={reason.code}>
                                              {reason.label}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <label className="flex flex-col text-indigo-700">
                                        메모 (사유가 &quot;기타&quot;일 때)
                                        <input
                                          type="text"
                                          name="memo"
                                          placeholder="상세 사유"
                                          className="mt-1 w-40 rounded border border-zinc-300 px-1.5 py-1"
                                        />
                                      </label>
                                      <button type="submit" className="rounded border border-indigo-300 bg-white px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50">
                                        대표 이미지 없이 진행
                                      </button>
                                    </form>
                                  </>
                                )}
                              </div>

                              <form action={attachWordPressFeaturedImageFromBlogPostAction} className="mt-2">
                                <input type="hidden" name="articleId" value={article.id} />
                                <input type="hidden" name="socialPostId" value={post.id} />
                                <input type="hidden" name="returnTo" value={selfReturnTo} />
                                <button
                                  type="submit"
                                  disabled={!attachEligibility.eligible}
                                  className="rounded bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  대표 이미지 연결
                                </button>
                              </form>
                              {attachEligibility.reasons.length > 0 && (
                                <ul className="mt-1 list-inside list-disc text-[10px] text-amber-700">
                                  {attachEligibility.reasons.map((reason, i) => (
                                    <li key={i}>{reason}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            )}

                            {/* Step 6. 게시 가능 상태 확인 — 체크리스트 탭. */}
                            {activeTab === "checklist" && (
                              <>
                            <div className="mt-2 rounded border border-indigo-200 bg-white p-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold text-indigo-900">Step 6. 게시 가능 상태 확인</p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stepBadgeClass(workflowStatus.publishGuard)}`}>{workflowStatus.publishGuard}</span>
                              </div>
                              <p className="mt-1 text-[10px] text-zinc-600">
                                Draft, SEO metadata, 대표 이미지, 승인 상태가 모두 준비되었는지 최종
                                확인합니다.
                              </p>
                              <p className="mt-1 text-[11px] font-medium text-indigo-800">
                                게시 준비 상태: {readiness.ready ? "준비됨" : "차단됨"}
                              </p>
                              {readiness.blockers.length > 0 && (
                                <ul className="mt-1 list-inside list-disc text-[11px] text-red-700">
                                  {readiness.blockers.map((b, i) => (
                                    <li key={i}>{b}</li>
                                  ))}
                                </ul>
                              )}
                              {readiness.warnings.length > 0 && (
                                <ul className="mt-1 list-inside list-disc text-[11px] text-amber-700">
                                  {readiness.warnings.map((w, i) => (
                                    <li key={i}>{w}</li>
                                  ))}
                                </ul>
                              )}
                              <p className="mt-1 text-[11px] text-indigo-700">
                                policyRiskScore: {summary.policyRiskScore ?? "해당 없음"}
                              </p>
                              <form action={runPlatformPublishingGuardAction} className="mt-2">
                                <input type="hidden" name="articleId" value={article.id} />
                                <input type="hidden" name="socialPostId" value={post.id} />
                                <input type="hidden" name="returnTo" value={selfReturnTo} />
                                <button type="submit" className="rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100">
                                  게시 가능 상태 확인
                                </button>
                              </form>
                            </div>

                            {/* Step 7. 게시 체크리스트 / Handoff (게시 체크리스트 만들기는 카드 상단의 공통 버튼을 사용 — 중복 배치하지 않음) */}
                            <div className="mt-2 rounded border border-indigo-200 bg-white p-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold text-indigo-900">Step 7. 게시 체크리스트 / Handoff</p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stepBadgeClass(workflowStatus.checklist)}`}>{workflowStatus.checklist}</span>
                              </div>
                              <p className="mt-1 text-[10px] text-zinc-600">
                                WordPress 관리자 화면에서 최종 확인하기 위한 체크리스트와 handoff를
                                준비합니다. 위쪽의 &ldquo;게시 체크리스트 준비&rdquo; 버튼으로 체크리스트를
                                만들 수 있습니다.
                              </p>
                              {checklistMismatchNotice && (
                                <p className="mt-1 text-[10px] font-medium text-amber-700">{checklistMismatchNotice}</p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                <form action={createPlatformPublishDryRunAction}>
                                  <input type="hidden" name="articleId" value={article.id} />
                                  <input type="hidden" name="socialPostId" value={post.id} />
                                  <input type="hidden" name="returnTo" value={selfReturnTo} />
                                  <button type="submit" className="rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100">
                                    게시 전 미리보기 생성
                                  </button>
                                </form>
                                <form action={completePlatformExportHandoffAction}>
                                  <input type="hidden" name="articleId" value={article.id} />
                                  <input type="hidden" name="socialPostId" value={post.id} />
                                  <input type="hidden" name="returnTo" value={selfReturnTo} />
                                  <button type="submit" className="rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100">
                                    수동 게시 완료 표시
                                  </button>
                                </form>
                              </div>

                              {checklistDisplay.length > 0 && (
                                <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800">
                                  확인 필요 항목은 오류가 아닙니다. 시스템이 자동으로 판단하기 어려운
                                  부분을 사람이 직접 확인해야 한다는 뜻입니다. WordPress 관리자 화면
                                  또는 미리보기에서 확인한 뒤 완료 표시를 하세요.
                                </div>
                              )}

                              {checklistDisplay.length > 0 && (
                                <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-2 text-[10px] text-zinc-700">
                                  <p>
                                    완료 {checklistSummary.completed}개 · 확인 필요 {checklistSummary.needsReview}개 · 대기중{" "}
                                    {checklistSummary.pending}개 · 실패 {checklistSummary.failed}개
                                    {checklistSummary.blocked > 0 && ` · 차단됨 ${checklistSummary.blocked}개`}
                                    {checklistSummary.skipped > 0 && ` · 생략 ${checklistSummary.skipped}개`}
                                  </p>
                                  {checklistGuidanceMessage && (
                                    <p className="mt-1 font-medium text-zinc-800">{checklistGuidanceMessage}</p>
                                  )}
                                </div>
                              )}

                              {checklistNeedsReviewItems.length > 0 && (
                                <div className="mt-2 space-y-2">
                                  <p className="text-[10px] font-semibold text-indigo-900">지금 확인이 필요한 항목</p>
                                  {checklistNeedsReviewItems.map((item) => {
                                    const guide = MANUAL_POSTING_CHECKLIST_ITEM_GUIDES[item.key];
                                    const isUrlItem = URL_RECORDED_CHECKLIST_ITEM_KEYS.has(item.key);
                                    const isConfirmable = CONFIRMABLE_MANUAL_CHECKLIST_ITEM_KEYS.has(item.key);
                                    return (
                                      <div key={item.key} className="rounded border border-amber-200 bg-amber-50/40 p-2">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-[11px] font-medium text-zinc-800">{item.label}</span>
                                          <span
                                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${stepBadgeClass(
                                              MANUAL_POSTING_CHECKLIST_ITEM_STATUS_LABELS[item.status]
                                            )}`}
                                          >
                                            {MANUAL_POSTING_CHECKLIST_ITEM_STATUS_LABELS[item.status]}
                                          </span>
                                        </div>
                                        <p className="mt-1 text-[10px] text-zinc-500">
                                          {MANUAL_POSTING_CHECKLIST_ITEM_STATUS_DESCRIPTIONS[item.status]}
                                        </p>
                                        {guide && (
                                          <>
                                            <p className="mt-1 text-[10px] text-zinc-600">{guide.description}</p>
                                            <p className="mt-1 text-[10px] text-zinc-500">해야 할 일: {guide.userAction}</p>
                                          </>
                                        )}
                                        {item.key === "record_url_after_posting" ? (
                                          <form
                                            action={recordManualPostingResultAction}
                                            className="mt-2 flex flex-wrap items-end gap-2 text-[11px]"
                                          >
                                            <input type="hidden" name="articleId" value={article.id} />
                                            <input type="hidden" name="socialPostId" value={post.id} />
                                            <input type="hidden" name="returnTo" value={selfReturnTo} />
                                            <label className="flex flex-col text-zinc-700">
                                              게시 URL
                                              <input
                                                type="url"
                                                name="manualPostUrl"
                                                required
                                                placeholder="https://..."
                                                pattern="https?://.*"
                                                className="mt-1 w-56 rounded border border-zinc-300 px-1.5 py-1"
                                              />
                                            </label>
                                            <button type="submit" className="rounded border border-green-300 bg-green-50 px-2 py-1 font-medium text-green-700 hover:bg-green-100">
                                              게시 URL 저장
                                            </button>
                                          </form>
                                        ) : isUrlItem ? (
                                          <p className="mt-2 text-[10px] text-zinc-500">
                                            위 &ldquo;게시 URL 저장&rdquo;에 URL을 입력하면 이 항목도 함께 완료 처리됩니다.
                                          </p>
                                        ) : isConfirmable ? (
                                          <form action={markManualChecklistItemConfirmedAction} className="mt-2">
                                            <input type="hidden" name="articleId" value={article.id} />
                                            <input type="hidden" name="socialPostId" value={post.id} />
                                            <input type="hidden" name="checklistItemKey" value={item.key} />
                                            <input type="hidden" name="returnTo" value={selfReturnTo} />
                                            <button type="submit" className="rounded border border-indigo-300 bg-white px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50">
                                              확인 완료 표시
                                            </button>
                                          </form>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {(post.manualPostUrl || post.postUrl) && (
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-zinc-600">
                                  <span>
                                    게시 URL 기록 완료:{" "}
                                    <a
                                      href={post.manualPostUrl ?? post.postUrl ?? undefined}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="break-all underline"
                                    >
                                      {post.manualPostUrl ?? post.postUrl}
                                    </a>
                                  </span>
                                  <CopyUrlButton
                                    url={post.manualPostUrl ?? post.postUrl ?? ""}
                                    className="rounded border border-indigo-300 bg-white px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50"
                                  />
                                </div>
                              )}

                              {checklistDisplay.length > 0 && (
                                <details className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-2">
                                  <summary className="cursor-pointer text-[10px] font-medium text-zinc-500">
                                    전체 체크리스트 보기 ({checklistDisplay.length}개)
                                  </summary>
                                  <ul className="mt-1 space-y-1 text-[10px] text-zinc-700">
                                    {checklistDisplay.map((item) => (
                                      <li key={item.key} className="flex items-center justify-between gap-2">
                                        <span>{item.label}</span>
                                        <span
                                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${stepBadgeClass(
                                            MANUAL_POSTING_CHECKLIST_ITEM_STATUS_LABELS[item.status]
                                          )}`}
                                        >
                                          {MANUAL_POSTING_CHECKLIST_ITEM_STATUS_LABELS[item.status]}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              )}
                            </div>
                              </>
                            )}
                          </WordPressPublishingPanel>
                        );
                      })()}

                    {post.platform === "naver_blog" &&
                      (() => {
                        const safety = checkNaverBlogContentSafety(`${post.postTitle ?? ""} ${post.postBody ?? ""}`);
                        return safety.findings.length > 0 ? (
                          <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                            <p className="font-medium">네이버 블로그 콘텐츠 안전 점검</p>
                            <ul className="mt-1 list-inside list-disc">
                              {safety.findings.map((f, i) => (
                                <li key={i}>{f}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null;
                      })()}

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

        {/* 프로세스 로그 / 실행 이력 — wordpress_blog 카드 안에서 프로세스 로그/실행
            이력/raw details_json 같은 디버그성 정보를 빼서 여기로 모은다. 카드
            안에는 짧은 요약 + "상세 로그 보기" 링크만 남긴다(위 카드의 "최근
            WordPress 반영 결과" 참고). 기본은 접힌 상태다. */}
        {wordpressBlogPostIds.size > 0 && (
          <section id="process-logs" className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
                프로세스 로그 / 실행 이력 ({filteredProcessLogEntries.length}개)
              </summary>
              <p className="mt-2 text-xs text-zinc-500">
                문제가 발생했을 때만 로그를 확인하세요. 일반적인 글 작성과 WordPress 반영 작업에는 필요하지
                않습니다.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                이 영역은 시스템 실행 기록입니다. WordPress 반영 실패나 상태 확인이 필요할 때 참고하세요.
              </p>

              <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                {LOG_FILTER_OPTIONS.map((opt) => (
                  <a
                    key={opt.key}
                    href={`${basePath}?${new URLSearchParams({ ...currentSearchParams, logFilter: opt.key }).toString()}#process-logs`}
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      logFilter === opt.key ? "bg-indigo-700 text-white" : "border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {opt.label}
                  </a>
                ))}
              </div>

              {posts
                .filter((post) => post.platform === "wordpress_blog")
                .map((post) => {
                  const groupEntries = sortWordPressBlogProcessLogEntriesForDisplay(
                    filterWordPressBlogProcessLogEntriesByPost(filteredProcessLogEntries, post.id)
                  );
                  const visible = groupEntries.slice(0, PROCESS_LOG_VISIBLE_COUNT);
                  const rest = groupEntries.slice(PROCESS_LOG_VISIBLE_COUNT);
                  return (
                    <div
                      key={post.id}
                      id={buildAnchorId("process-log-group", post.id)}
                      className="mt-3 rounded border border-zinc-200 p-2"
                    >
                      <p className="text-xs font-medium text-zinc-700">
                        {post.postTitle || "(제목 없음)"} · wordpress_blog · {post.id}
                      </p>
                      {groupEntries.length === 0 ? (
                        <p className="mt-1 text-[11px] text-zinc-400">표시할 로그가 없습니다.</p>
                      ) : (
                        <>
                          <ul className="mt-1 space-y-1 text-[11px]">{visible.map((entry) => renderProcessLogEntry(entry))}</ul>
                          {rest.length > 0 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-[11px] text-indigo-600">더 보기 ({rest.length}개)</summary>
                              <ul className="mt-1 space-y-1 text-[11px]">{rest.map((entry) => renderProcessLogEntry(entry))}</ul>
                            </details>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
            </details>
          </section>
        )}
      </div>
    </div>
  );
}

