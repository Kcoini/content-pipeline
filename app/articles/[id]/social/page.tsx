import Link from "next/link";
import { notFound } from "next/navigation";
import { buildArticleSocialPageData } from "@/lib/social/article-social-page-service";
import { ArticleWorkflowNavigation } from "@/components/articles/article-workflow-navigation";
import { AdvancedDetails } from "@/components/common/advanced-details";
import { WorkflowStatusCard } from "@/components/workflow/workflow-status-card";
import { NextActionPanel } from "@/components/workflow/next-action-panel";
import { fromSocialPostCardActionStateToWorkflowStatus } from "@/lib/ui/workflow-status-view-model";
import { fromSocialPostCardActionState, type NextActionViewModel, type NextActionViewModelAction } from "@/lib/ui/next-action-view-model";
import { ContentGroupBadge, InfoBadge } from "@/components/social/content-group-badge";
import { DeepLinkNotice, getHighlightClassName, buildAnchorId } from "@/components/navigation/deep-link-highlight";
import { classifyContentGroup } from "@/lib/social/content-type-classifier";
import {
  buildArticleSocialUrl,
  buildMetricsDeepLink,
  buildRewriteVersionDeepLink,
  buildArticleOverviewUrl,
  buildSocialPostDetailUrl,
} from "@/lib/navigation/article-deep-links";
import { PaginationControls } from "@/components/navigation/pagination-controls";
import { parsePagination } from "@/lib/navigation/pagination";
import { checkPlatformApiReadiness } from "@/lib/social/platform-api-readiness-checker";
import { ApiReadinessBadge } from "@/components/platform-api/api-readiness-badge";
import { TONE_STYLES, type SocialPlatform, type SocialPostQualityChecklistItem } from "@/lib/social/social-platform-types";
import { getSocialPostDisplayBody } from "@/lib/social/social-post-display";
import { getUserFacingStatus } from "@/lib/social/social-post-user-facing-status";
import { getSocialPostCardActionState, type SocialPostCardAction } from "@/lib/social/social-post-card-action-state";
import { getSocialPostEditableField } from "@/lib/social/social-post-inline-edit-service";
import { SocialPostBodyPanel } from "@/components/social/social-post-body-panel";
import { RelatedPostLinks } from "@/components/navigation/related-post-links";
import { shouldShowPerformanceLink } from "@/lib/social/performance-link-visibility";
import { ContentProgressSteps } from "@/components/articles/content-progress-steps";
import { PLATFORM_LABELS } from "@/lib/social/platform-generation-recommendations";
import { TONE_STYLE_CONFIGS } from "@/lib/social/tone-style-config";
import { describeStatusValue, describeStatusField } from "@/lib/social/status-labels";
import { summarizeAutoReview, describeAutoReviewNotRunYet, summarizeUserFacingReview, type UserFacingReviewSummary } from "@/lib/social/social-post-auto-review";
import { AutoReviewSummaryCard } from "@/components/review/auto-review-summary-card";
import { getPlatformReviewCriteria } from "@/lib/social/platform-review-criteria";
import { hasOnlyImplementedAutoFixableIssues, summarizeReviewIssues } from "@/lib/social/review-issue-fixability";
import {
  summarizeMultiPlatformReview,
  getMultiPlatformReviewSortKey,
  type MultiPlatformReviewPostInput,
} from "@/lib/ui/multi-platform-review-summary";
import { MultiPlatformReviewSummaryCard } from "@/components/review/multi-platform-review-summary-card";
import {
  fromPostApprovalNextActionsToPublishPreparation,
  notApprovedPublishPreparation,
  type PublishPreparationAction,
} from "@/lib/ui/publish-preparation-view-model";
import {
  summarizeMultiPlatformPublishPreparation,
  getPublishPreparationSortKey,
  type MultiPlatformPublishPreparationPostInput,
} from "@/lib/ui/multi-platform-publish-preparation-summary";
import { PublishPreparationSummaryCard } from "@/components/publish/publish-preparation-summary-card";
import { PlatformPublishPreparationCard } from "@/components/publish/platform-publish-preparation-card";
import { getPostApprovalNextActions } from "@/lib/social/post-approval-next-actions";
import { CopyPostBodyButton } from "@/components/social/copy-post-body-button";
import {
  generatePlaceholderSocialPostAction,
  generateSocialDraftAction,
  runSocialPostQualityGateAction,
  requestSocialPostApprovalAction,
  approveSocialPostAction,
  bulkApproveSocialPostsAction,
  generateManualExportAction,
  runPlatformPublishingGuardAction,
  createPlatformPublishDryRunAction,
  completePlatformExportHandoffAction,
  prepareManualPostingRecordAction,
  recordManualPostingResultAction,
  recordSocialPostMetricsAction,
  archiveSocialPostAction,
  saveSocialPostInlineEditAction,
  saveSocialPostThreadInlineEditAction,
  runPostAutoFixAndRecheckAction,
} from "../actions";
import { PLATFORM_WRITING_CONFIGS } from "@/lib/social/platform-writing-config";
import { ConfirmSubmitButton } from "@/app/articles/[id]/confirm-submit-button";

export const dynamic = "force-dynamic";

const SOCIAL_COMMUNITY_PLATFORMS: SocialPlatform[] = ["naver_cafe", "x", "threads", "instagram"];
const ANCHOR_PREFIX = "social-post";

export default async function ArticleSocialPage({
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

  const { article, posts, pagination, targetPage, allPosts } = await buildArticleSocialPageData(id, {
    includeRewriteVersions,
    page,
    perPage,
    targetSocialPostId,
  });

  if (!article) {
    notFound();
  }

  // Phase UX-04B: "플랫폼별 글 검토" 요약 카드는 현재 page로 잘려나가기
  // 전, 필터링만 끝난 전체 목록(allPosts) 기준으로 계산한다 — 사용자가
  // 몇 page에 있든 전체 상태를 정확히 파악할 수 있게 하기 위해서다.
  // 카드별 자동 검토 표시는 이미 summarizeUserFacingReview를 쓰고
  // 있으므로 그 결과를 여기서도 그대로 재사용한다(새 계산 로직을
  // 만들지 않는다).
  const reviewByPostId = new Map<string, UserFacingReviewSummary>(
    allPosts.map((post) => {
      const checklist = Array.isArray(post.qualitySummary?.checklist)
        ? (post.qualitySummary.checklist as unknown as SocialPostQualityChecklistItem[])
        : [];
      const review = summarizeAutoReview(checklist);
      return [post.id, summarizeUserFacingReview(post.qualityStatus, review, checklist)];
    })
  );
  const multiPlatformInputs: MultiPlatformReviewPostInput[] = allPosts.map((post) => ({
    id: post.id,
    approvalStatus: post.approvalStatus,
    review: reviewByPostId.get(post.id)!,
  }));
  const multiPlatformSummary = summarizeMultiPlatformReview(multiPlatformInputs);
  // 문제(차단/확인 필요/검토 실패/검토 중)가 있는 글을 먼저, 이미
  // 승인된 글을 가장 마지막으로 보여준다(getMultiPlatformReviewSortKey,
  // 새 정렬 기준이 아니라 UX-04B에서 이미 계산해 둔 우선순위를 그대로
  // 쓴다). 이 page에 보이는 posts에만 적용한다 — pagination 자체의
  // 동작(어느 글이 몇 page에 속하는지)은 바꾸지 않는다.
  const sortedPosts = [...posts].sort(
    (a, b) =>
      getMultiPlatformReviewSortKey({ id: a.id, approvalStatus: a.approvalStatus, review: reviewByPostId.get(a.id)! }) -
      getMultiPlatformReviewSortKey({ id: b.id, approvalStatus: b.approvalStatus, review: reviewByPostId.get(b.id)! })
  );

  // Phase UX-05A: "승인 완료 이후 무엇을 해야 하는지"를 검토
  // workspace와는 분리된 별도 요약으로 보여준다. 새 판단 로직을 만들지
  // 않는다 — 미승인 post는 notApprovedPublishPreparation, 승인된
  // post는 기존 getPostApprovalNextActions()(이미 wordpress_blog 외
  // 플랫폼의 "승인 후 다음 작업"을 계산하던 함수, 여기서는 platform이
  // 전부 naver_cafe/x/threads/instagram이라 wordpress_blog 분기는
  // 타지 않는다)를 그대로 재사용한다.
  const publishPreparationInputs: MultiPlatformPublishPreparationPostInput[] = allPosts.map((post) => {
    if (post.approvalStatus !== "approved") {
      return { id: post.id, viewModel: notApprovedPublishPreparation(post.platform) };
    }
    const nextActions = getPostApprovalNextActions({
      platform: post.platform,
      apiConfigured: checkPlatformApiReadiness(post.platform).configured,
    });
    const viewModel = fromPostApprovalNextActionsToPublishPreparation(post.platform, nextActions, post.publishStatus, post.manualPostStatus);
    // Phase UX-05B: "본문 복사"는 실제 게시 완료가 아니다(governance:
    // 복사와 완료를 절대 동일시하지 않는다) — 복사 성공만으로
    // manual_post_status/publish_status를 자동으로 바꾸지 않고, 이미
    // 존재하는 "게시 결과 기록"(recordManualPostingResultAction, 사용자의
    // 명시적 URL 입력 + 클릭이 필요) 섹션으로 안내하는 보조 action만
    // 추가한다 — 그 섹션의 guard(checkRecordable)는 전혀 바꾸지 않았다.
    if (viewModel.state === "ready") {
      viewModel.secondaryActions = [...(viewModel.secondaryActions ?? []), { type: "record_manual_result", label: "게시 완료로 표시" }];
    }
    return { id: post.id, viewModel };
  });
  const publishPreparationSummary = summarizeMultiPlatformPublishPreparation(publishPreparationInputs);
  const publishPreparationByPostId = new Map(publishPreparationInputs.map((p) => [p.id, p]));
  // 개별 카드는 이미 승인된 글만 보여준다 — 미승인 글의 "승인 필요"는
  // 위 검토 workspace(리뷰 카드/일괄 승인)에서 이미 다루므로 여기서
  // 다시 나열하지 않는다(같은 정보를 두 영역에서 중복 표시하지 않는다).
  const approvedPublishPreparationPosts = allPosts
    .filter((post) => post.approvalStatus === "approved")
    .map((post) => ({ post, entry: publishPreparationByPostId.get(post.id)! }))
    .sort((a, b) => getPublishPreparationSortKey(a.entry) - getPublishPreparationSortKey(b.entry));

  // Phase 3-17: action form이 "이 카드를 강조한 채 이 페이지로 돌아오기" 위해 사용하는 returnTo.
  const selfReturnToFor = (postId: string) => buildArticleSocialUrl(id, { socialPostId: postId, highlight: postId });
  const targetFound = targetSocialPostId ? posts.some((p) => p.id === targetSocialPostId) : true;
  const targetOnDifferentPage = targetSocialPostId && !targetFound && targetPage !== null && targetPage !== pagination.page;
  const basePath = `/articles/${id}/social`;
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

        <ContentProgressSteps
          current={
            posts.length === 0
              ? "generate"
              : posts.some((p) => p.approvalStatus === "approved")
                ? "publish_ready"
                : "review"
          }
        />

        <ArticleWorkflowNavigation articleId={id} active="social" returnTo={returnTo} />

        <div className="rounded border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-800">
          SNS/커뮤니티 글쓰기 페이지입니다. Naver Cafe, X, Threads, Instagram용 게시글을 관리합니다.
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
        {publishMessage && (
          <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            {publishMessage}
            {/* Phase UX-05B: 일괄 승인 직후 dead-end를 만들지 않는다 — 방금
                승인된 글의 다음 작업이 있는 "게시 준비" 섹션으로 바로
                이동할 수 있게 안내한다. */}
            {publishMessage.includes("승인 완료") && (
              <>
                {" "}
                <a href="#publish-preparation" className="font-medium underline">
                  게시 준비 보기 →
                </a>
              </>
            )}
          </div>
        )}

        {/* Phase UX-04B: 여러 플랫폼 글을 하나씩 열어보지 않고도 전체
            상태를 한눈에 볼 수 있는 요약 카드 — 이 article에 생성된 모든
            SNS/커뮤니티 글(allPosts) 기준. 승인 가능한 글이 있으면 바로
            아래에서 일괄 승인도 할 수 있다(사용자가 명시적으로 클릭 +
            확인해야만 실행된다 — 자동 승인 없음, 외부 게시도 실행하지
            않는다). */}
        {multiPlatformSummary.total > 0 && (
          <MultiPlatformReviewSummaryCard
            summary={multiPlatformSummary}
            renderBulkApprovalAction={(eligiblePostIds) => (
              <form action={bulkApproveSocialPostsAction} className="mt-2">
                <input type="hidden" name="articleId" value={article.id} />
                {eligiblePostIds.map((postId) => (
                  <input key={postId} type="hidden" name="socialPostId" value={postId} />
                ))}
                <input type="hidden" name="returnTo" value={buildArticleSocialUrl(id)} />
                <p className="mb-1 text-[11px] text-zinc-500">
                  확인할 사항이 없고 아직 승인되지 않은 글만 일괄 승인됩니다
                  {multiPlatformSummary.total - eligiblePostIds.length - multiPlatformSummary.approved > 0 &&
                    ` — 나머지 ${multiPlatformSummary.total - eligiblePostIds.length - multiPlatformSummary.approved}개는 확인이 필요해 제외됩니다`}
                  .
                </p>
                <ConfirmSubmitButton
                  confirmMessage={`${eligiblePostIds.length}개 글을 승인하시겠습니까?\n\n승인 후 게시 준비 단계로 이동할 수 있습니다. 외부 플랫폼에 자동으로 게시되지는 않습니다.`}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  {eligiblePostIds.length}개 글 승인하기
                </ConfirmSubmitButton>
              </form>
            )}
          />
        )}

        {/* Phase UX-05A: "검토 및 승인"과 "게시 준비"를 별도 섹션으로
            분리한다 — 같은 정보를 두 번 보여주지 않도록, 여기서는 이미
            승인된 글만 다룬다(미승인 글의 "승인 필요"는 위 요약
            카드/각 리뷰 카드에서 이미 안내됨). 일괄 승인 직후 이
            페이지로 돌아오면, 방금 승인된 글들이 바로 이 섹션에
            실제 다음 작업(본문 복사 등)과 함께 나타난다 — dead-end를
            만들지 않는다. */}
        {publishPreparationSummary.total > 0 && (
          <section id="publish-preparation" className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <PublishPreparationSummaryCard summary={publishPreparationSummary} />
            {approvedPublishPreparationPosts.length > 0 && (
              <ul className="mt-2 flex flex-col gap-2">
                {approvedPublishPreparationPosts.map(({ post, entry }) => {
                  const selfReturnTo = selfReturnToFor(post.id);
                  const displayBody = getSocialPostDisplayBody(post);
                  const renderPublishAction = (action: PublishPreparationAction, kind: "primary" | "secondary") => {
                    const className =
                      kind === "primary"
                        ? "rounded bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-500"
                        : "rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100";
                    switch (action.type) {
                      case "copy_body":
                        return (
                          <CopyPostBodyButton
                            articleId={article.id}
                            socialPostId={post.id}
                            text={displayBody ?? ""}
                            label={action.label}
                            className={className}
                            manualResultAnchorId={buildAnchorId("social-post-manual-result", post.id)}
                          />
                        );
                      case "check_api_readiness":
                        return (
                          <a href={`${buildSocialPostDetailUrl(post.id, selfReturnTo)}#api-publishing`} className={className}>
                            {action.label}
                          </a>
                        );
                      case "record_manual_result":
                        return (
                          <a href={`#${buildAnchorId("social-post-manual-result", post.id)}`} className={className}>
                            {action.label}
                          </a>
                        );
                      case "view_detail":
                      default:
                        return post.postUrl ? (
                          <a href={post.postUrl} target="_blank" rel="noopener noreferrer" className={className}>
                            {action.label}
                          </a>
                        ) : (
                          <a href={buildSocialPostDetailUrl(post.id, selfReturnTo)} className={className}>
                            {action.label}
                          </a>
                        );
                    }
                  };
                  return (
                    <li key={post.id}>
                      <PlatformPublishPreparationCard
                        viewModel={entry.viewModel}
                        platformLabel={PLATFORM_LABELS[post.platform]}
                        renderAction={renderPublishAction}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold">{article.title}</h1>
          {/* Phase 3-24: raw 상태값(article.status)을 그대로 노출하지 않는다. */}
          <p className="mt-1 text-xs text-zinc-500">상태: {describeStatusValue(article.status)}</p>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">SNS/커뮤니티 글 생성</h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            선택한 플랫폼과 문체에 맞춰 글을 생성합니다. 공개 게시는 하지 않습니다.
          </p>
          {/* Phase 3-24: platform/tone_style select가 raw enum("naver_cafe",
              "explanatory" 등)을 그대로 노출하던 문제를 고쳤다 — value는
              그대로 두고(서버 액션은 그대로 동작) 화면에 보이는 텍스트만
              한국어 라벨로 바꿨다. */}
          <form id="social-draft-form" action={generateSocialDraftAction} className="mt-2 flex flex-wrap items-end gap-2 text-xs">
            <input type="hidden" name="articleId" value={article.id} />
            <label className="flex flex-col text-zinc-600">
              플랫폼
              <select name="platform" className="mt-1 rounded border border-zinc-300 px-2 py-1" required>
                {SOCIAL_COMMUNITY_PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {PLATFORM_LABELS[platform]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-zinc-600">
              문체
              <select name="toneStyle" className="mt-1 rounded border border-zinc-300 px-2 py-1" required>
                {TONE_STYLES.map((toneStyle) => (
                  <option key={toneStyle} value={toneStyle}>
                    {TONE_STYLE_CONFIGS[toneStyle].label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500">
              선택한 플랫폼 글 생성
            </button>
          </form>

          {/* Phase 3-24: 예전 placeholder(임시) 초안 버튼은 일반 사용자에게 의미가
              불명확한 개발자용 기능이다 — 이름을 바꾸고 고급 옵션(기본
              접힘)으로 옮겼다. 위 폼(social-draft-form)의 platform/문체
              선택값을 그대로 재사용한다(form= 속성으로 연결). */}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-zinc-500">고급 옵션: 테스트용 임시 초안 만들기</summary>
            <p className="mt-1 text-[11px] text-zinc-500">
              AI 생성 없이, 위에서 선택한 플랫폼/문체로 내용이 비어 있는 임시 초안만 만듭니다. 실제 글 작성이 아니라
              화면 테스트용입니다.
            </p>
            <button
              type="submit"
              form="social-draft-form"
              formAction={generatePlaceholderSocialPostAction}
              className="mt-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              임시 초안 만들기
            </button>
          </details>

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
          <h2 className="text-sm font-semibold text-zinc-700">SNS/커뮤니티 글 ({posts.length})</h2>
          {posts.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">아직 생성된 SNS/커뮤니티 글이 없습니다.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-3">
              {sortedPosts.map((post) => {
                const selfReturnTo = selfReturnToFor(post.id);
                // Phase 4-28: "자동 수정 후 재검토"가 이 카드의 기본(primary)
                // 버튼이어야 하는지 미리 계산해 둔다 — 남은 문제가 전부 이미
                // 구현된 자동 수정기로 고칠 수 있는 항목뿐이면(hasOnlyImplemented
                // AutoFixableIssues), 사용자가 먼저 "문제 확인하기"를 누르게
                // 하지 않고 곧바로 자동 정리를 권한다. 사실/출처 확인이 필요한
                // 문제가 섞여 있으면 기존처럼 "문제 확인하기"가 기본이다.
                const postChecklist = Array.isArray(post.qualitySummary?.checklist)
                  ? (post.qualitySummary.checklist as unknown as SocialPostQualityChecklistItem[])
                  : [];
                const autoFixIsPrimary = post.qualityStatus === "needs_revision" && hasOnlyImplementedAutoFixableIssues(postChecklist);
                const implementedAutoFixableCount = summarizeReviewIssues(postChecklist).autoFixable.filter((i) => i.canAutoFix).length;
                return (
                  <li
                    key={post.id}
                    id={buildAnchorId(ANCHOR_PREFIX, post.id)}
                    className={`rounded border border-zinc-200 p-3 text-xs ${getHighlightClassName(post.id, targetSocialPostId)}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <ContentGroupBadge
                        group={post.isRewriteVersion ? "rewrite" : classifyContentGroup({ kind: "social_post", platform: post.platform, isRewriteVersion: false })}
                      />
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600">{PLATFORM_LABELS[post.platform]}</span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600">{TONE_STYLE_CONFIGS[post.toneStyle].label}</span>
                      {post.manualPostStatus === "posted" && <InfoBadge label="게시 완료" />}
                      {post.manualPostStatus === "posted" && post.latestMetricsRecordedAt === null && <InfoBadge label="성과 입력 필요" />}
                      {(post.performanceStatus === "low" || post.performanceStatus === "needs_review") && <InfoBadge label="반응 저조" />}
                      <form action={archiveSocialPostAction} className="ml-auto">
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={post.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo} />
                        <ConfirmSubmitButton
                          confirmMessage={[
                            "이 글을 삭제하시겠습니까?",
                            "",
                            "앱 내부의 생성 글과 상태만 삭제 또는 숨김 처리됩니다.",
                            "이미 외부 플랫폼에 게시된 내용이 있다면 자동 삭제되지 않습니다.",
                          ].join("\n")}
                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        >
                          삭제
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                    <p className="mt-1 font-medium text-zinc-700">{post.postTitle || post.caption || "(제목/캡션 없음)"}</p>

                    {/* Phase 4-14/4-15: 게시용 본문을 목록 카드 안에서 최대한 그대로
                        보여준다 — 자동 검토 결과보다 먼저 표시해, 사용자가 글을
                        먼저 읽고 판단할 수 있게 한다. 1,200자 이하면 전체 표시,
                        초과하면 카드 안에서만 접기/펼치기를 처리한다. [본문 수정]을
                        누르면 페이지 이동 없이 같은 카드 안에서 편집 모드로
                        바뀐다(SocialPostBodyPanel, "use client"). Phase UX-03B2:
                        x처럼 threadItems 배열 기반 플랫폼도 단일 textarea로
                        억지로 합치지 않고, item별 textarea로 구성된
                        mode="thread" 편집기를 같은 카드 안에서 연다(더 이상
                        상세 페이지로 보내지 않는다) — "본문 수정"은 시스템
                        전체에서 항상 "같은 카드 안 편집"을 의미한다. */}
                    {(() => {
                      const displayBody = getSocialPostDisplayBody(post);
                      if (!displayBody) {
                        return (
                          <p className="mt-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] text-zinc-500">
                            게시용 본문이 아직 없습니다 — {describeAutoReviewNotRunYet(post.qualityStatus)} 아래
                            &ldquo;품질검사&rdquo; 또는 &ldquo;본문 수정&rdquo;으로 먼저 본문을 준비하세요.
                          </p>
                        );
                      }
                      // Phase UX-03B2: x는 threadItems 배열 기반이라
                      // getSocialPostEditableField가 null을 반환하지만,
                      // SocialPostBodyPanel에 threadItems+saveThreadAction을
                      // 함께 넘기면 [본문 수정]이 상세 페이지 이동 없이
                      // 같은 카드 안에서 thread 편집기를 연다(다른
                      // 플랫폼과 동일한 "본문 수정=inline 편집" 동작).
                      const isThreadPlatform = PLATFORM_WRITING_CONFIGS[post.platform].supportsThreads;
                      // Phase UX-05B: 이미 게시 완료로 표시된(publishStatus
                      // ==="published") 글은 repository 단(saveSocialPostRevision)에서
                      // 이미 수정 자체를 막고 있다("이미 게시된 social post는
                      // 수정할 수 없습니다.") — 버튼을 그대로 두면 사용자가
                      // 클릭 후에야 오류로 알게 되므로, 여기서 미리 [본문
                      // 수정]을 감추고 이유를 안내한다(guard 자체는 바꾸지
                      // 않는다).
                      const isPublished = post.publishStatus === "published";
                      return (
                        <>
                          <SocialPostBodyPanel
                            articleId={article.id}
                            socialPostId={post.id}
                            returnTo={selfReturnTo}
                            displayBody={displayBody}
                            editable={!isPublished && getSocialPostEditableField(post.platform) !== null}
                            saveAction={saveSocialPostInlineEditAction}
                            platform={post.platform}
                            threadItems={isThreadPlatform && !isPublished ? post.threadItems : undefined}
                            saveThreadAction={isThreadPlatform && !isPublished ? saveSocialPostThreadInlineEditAction : undefined}
                            threadItemMaxLength={isThreadPlatform ? PLATFORM_WRITING_CONFIGS[post.platform].maxLength : undefined}
                          />
                          {isPublished && (
                            <p className="mt-1 text-[11px] text-zinc-500">
                              이미 게시 완료로 표시된 글입니다. 본문 수정은 외부 게시물에 자동 반영되지 않습니다.
                            </p>
                          )}
                        </>
                      );
                    })()}

                    {/* Phase 3-25: "사람이 모든 항목을 직접 검사"하는 대신
                        "자동 검토 리포트를 보고 최종 판단"하도록, quality
                        gate checklist(이미 저장돼 있음)를 통과/확인 필요/
                        수정 필요/차단 리포트로 다시 계산해서 보여준다. DB에
                        새로 쓰지 않는다 — 항상 현재 checklist로 다시
                        계산한다. Phase 4-14: 본문보다 먼저 보이지 않도록
                        본문 블록 다음으로 옮겼다. */}
                    {/* Phase 4-28: auto_fixable 문제만 있으면, 문제 목록을
                        보여주기 전에 "자동으로 정리할 수 있다"는 것부터 먼저
                        알린다 — 사용자가 직접 고치기 전에 AI가 안전하게
                        고칠 수 있는 문제라는 확신을 준다. 새 사실/수치를
                        추가하지 않는다는 점도 항상 함께 안내한다. */}
                    {autoFixIsPrimary && (
                      <div className="mt-2 rounded border border-indigo-200 bg-indigo-50 p-2 text-[11px] text-indigo-800">
                        자동으로 정리할 수 있는 항목 {implementedAutoFixableCount}개를 발견했습니다. AI가 게시용 본문을
                        자동으로 정리한 뒤 다시 검토할 수 있습니다. 새로운 사실이나 수치는 추가하지 않습니다.
                      </div>
                    )}
                    <div id={buildAnchorId("social-post-review", post.id)}>
                      {(() => {
                        const checklist = Array.isArray(post.qualitySummary?.checklist)
                          ? (post.qualitySummary.checklist as unknown as { key: string; status: string; message: string }[])
                          : null;
                        if (post.qualityStatus === "not_checked" || !checklist) {
                          return (
                            <p className="mt-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] text-zinc-500">
                              {describeAutoReviewNotRunYet(post.qualityStatus)} 아래 &ldquo;품질검사&rdquo; 버튼으로 자동 검토를 실행하세요.
                            </p>
                          );
                        }

                        const review = summarizeAutoReview(checklist as never);
                        const reviewCriteria = getPlatformReviewCriteria(post.platform);
                        // Phase UX-04A: AI가 안전하게 처리할 수 있는(auto_fixable)
                        // 문제는 사람이 확인할 목록이 아니다 — summarizeUserFacingReview로
                        // 사람이 봐야 하는 issue만 골라 기본 화면에 보여주고,
                        // 전체 목록(auto_fixable 포함)은 카드 안 "자동 검토 상세"
                        // 접힘으로 옮긴다(AutoReviewSummaryCard가 내부적으로 처리).
                        const userFacingSummary = summarizeUserFacingReview(post.qualityStatus, review, checklist as never);

                        return (
                          <AutoReviewSummaryCard
                            review={review}
                            userFacingSummary={userFacingSummary}
                            compact
                            labelPrefix="자동 검토 결과: "
                            maxIssues={5}
                            contextNote={
                              // Phase 4-5: 글 유형별 기준이 섞이지 않았음을 항상 먼저 보여준다.
                              <p className="text-zinc-600">
                                글 유형: {PLATFORM_LABELS[post.platform]} · 검토 기준: {reviewCriteria.criteriaSummary}
                              </p>
                            }
                          />
                        );
                      })()}
                    </div>

                    {/* Phase 3-22: raw 상태값을 그대로 나열하지 않고, 사용자 친화적
                        한 줄 요약을 보여준다. 개발자용 원문 상태값/API
                        readiness/성과는 "상세 상태 보기" 접힘 안으로 옮겼다. */}
                    <p className="mt-2 text-xs text-zinc-600">{getUserFacingStatus(post)}</p>

                    {/* Phase 4-14: "현재 상태 + 다음 버튼 1개" 원칙 — 품질검사/
                        승인 요청/승인/복사·export 준비를 동시에 같은 수준으로
                        나열하지 않는다. getSocialPostCardActionState가 지금
                        상태에 맞는 상태 배지 + primary 버튼 1개 + secondary
                        버튼을 계산한다. 승인 요청처럼 필수가 아닌 재실행용
                        action은 아래 "상세 상태 보기 / 보조 작업" 접힘 안에
                        그대로 남아 있다(삭제 없음). */}
                    {(() => {
                      const cardState = getSocialPostCardActionState(post);
                      const primaryClass = "rounded bg-indigo-600 px-2 py-1 font-medium text-white hover:bg-indigo-500";
                      const secondaryClass = "rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100";
                      // Phase 4-15: 이 플랫폼이 카드 안 inline 편집을 지원하면(위
                      // SocialPostBodyPanel이 이미 "본문 수정" 버튼을 자체적으로
                      // 보여준다) 여기 secondary 목록에서는 중복되는 edit_body
                      // action을 제외한다. x처럼 지원하지 않으면 기존대로
                      // 상세 페이지 링크를 보여준다.
                      const inlineEditable = getSocialPostEditableField(post.platform) !== null;
                      const visibleSecondaryActions = cardState.secondaryActions.filter(
                        (action) => !(action.actionType === "edit_body" && inlineEditable)
                      );

                      const renderAction = (action: SocialPostCardAction, className: string) => {
                        switch (action.actionType) {
                          case "run_quality_gate":
                            return (
                              <form action={runSocialPostQualityGateAction}>
                                <input type="hidden" name="articleId" value={article.id} />
                                <input type="hidden" name="socialPostId" value={post.id} />
                                <input type="hidden" name="returnTo" value={selfReturnTo} />
                                <button type="submit" className={className}>
                                  {action.label}
                                </button>
                              </form>
                            );
                          case "approve":
                            return (
                              <form action={approveSocialPostAction}>
                                <input type="hidden" name="articleId" value={article.id} />
                                <input type="hidden" name="socialPostId" value={post.id} />
                                <input type="hidden" name="returnTo" value={selfReturnTo} />
                                <button type="submit" className={className}>
                                  {action.label}
                                </button>
                              </form>
                            );
                          case "prepare_export":
                            return (
                              <form action={generateManualExportAction}>
                                <input type="hidden" name="articleId" value={article.id} />
                                <input type="hidden" name="socialPostId" value={post.id} />
                                <input type="hidden" name="returnTo" value={selfReturnTo} />
                                <button type="submit" className={className}>
                                  {action.label}
                                </button>
                              </form>
                            );
                          case "review_quality_issues":
                            return (
                              <a href={`#${buildAnchorId("social-post-review", post.id)}`} className={className}>
                                {action.label}
                              </a>
                            );
                          case "edit_body":
                            return (
                              <a href={buildSocialPostDetailUrl(post.id, selfReturnTo)} className={className}>
                                {action.label}
                              </a>
                            );
                          case "copy_or_view_export":
                            return (
                              <a href={`${buildSocialPostDetailUrl(post.id, selfReturnTo)}#publish-preview`} className={className}>
                                {action.label}
                              </a>
                            );
                          case "record_manual_result":
                            return (
                              <a href={`#${buildAnchorId("social-post-manual-result", post.id)}`} className={className}>
                                {action.label}
                              </a>
                            );
                          case "view_detail":
                          default:
                            return (
                              <a href={buildSocialPostDetailUrl(post.id, selfReturnTo)} className={className}>
                                {action.label}
                              </a>
                            );
                        }
                      };

                      // Phase UX-03B1: "자동 수정 후 재검토"는 cardState(기존
                      // helper)가 알지 못하는 이 화면 전용 action이다 — 공통
                      // NextActionViewModel을 여기서 조합할 때만 끼워 넣는다
                      // (helper 자체는 바꾸지 않는다). autoFixIsPrimary면 이
                      // action이 primary로, cardState의 원래 primary는
                      // secondary로 내려간다(카드 하나에 primary는 항상 하나).
                      const autoFixAction =
                        post.qualityStatus === "needs_revision"
                          ? { label: "자동 수정 후 재검토", actionType: "auto_fix_and_recheck" }
                          : null;
                      const baseViewModel = fromSocialPostCardActionState(cardState);
                      const viewModel: NextActionViewModel =
                        autoFixIsPrimary && autoFixAction
                          ? {
                              ...baseViewModel,
                              primaryAction: autoFixAction,
                              secondaryActions: [...visibleSecondaryActions, baseViewModel.primaryAction!],
                            }
                          : {
                              ...baseViewModel,
                              secondaryActions: autoFixAction
                                ? [...visibleSecondaryActions, autoFixAction]
                                : visibleSecondaryActions,
                            };

                      const renderActionForPanel = (action: NextActionViewModelAction, kind: "primary" | "secondary") =>
                        action.actionType === "auto_fix_and_recheck" ? (
                          <form action={runPostAutoFixAndRecheckAction}>
                            <input type="hidden" name="articleId" value={article.id} />
                            <input type="hidden" name="socialPostId" value={post.id} />
                            <input type="hidden" name="returnTo" value={selfReturnTo} />
                            <button type="submit" className={kind === "primary" ? primaryClass : secondaryClass}>
                              {action.label}
                            </button>
                          </form>
                        ) : (
                          renderAction(action as SocialPostCardAction, kind === "primary" ? primaryClass : secondaryClass)
                        );

                      return (
                        <>
                          <WorkflowStatusCard
                            viewModel={fromSocialPostCardActionStateToWorkflowStatus(cardState)}
                            heading="상태"
                          />
                          <NextActionPanel
                            viewModel={{ ...viewModel, message: undefined }}
                            renderAction={renderActionForPanel}
                            title="다음 작업"
                          />
                          {/* Phase 4-20: 화살표를 이어붙여(성과 보기/기사 개요)
                              primary/secondary action과 나란히 보이던
                              이동 링크를 "관련 화면 보기" 접힘으로 뺀다 — 기능은
                              그대로, primary action보다 강조되지 않는 위치로만
                              옮긴다. */}
                          <RelatedPostLinks
                            links={[
                              ...(shouldShowPerformanceLink(post)
                                ? [{ label: "성과 확인", href: buildMetricsDeepLink(article.id, post.id, selfReturnTo) }]
                                : []),
                              ...(post.isRewriteVersion
                                ? [{ label: "재작성 관리에서 보기", href: buildRewriteVersionDeepLink(article.id, post.id, selfReturnTo) }]
                                : []),
                              { label: "원본 기사 개요", href: buildArticleOverviewUrl(article.id) },
                            ]}
                          />
                        </>
                      );
                    })()}

                    <AdvancedDetails title="상세 상태 보기 / 보조 작업 (관리자용, 기본 접힘)">
                      <p className="text-[11px] text-zinc-400">
                        {describeStatusField("quality_status")}: {describeStatusValue(post.qualityStatus)} ·{" "}
                        {describeStatusField("approval_status")}: {describeStatusValue(post.approvalStatus)} ·{" "}
                        {describeStatusField("export_status")}: {describeStatusValue(post.exportStatus)} ·{" "}
                        {describeStatusField("platform_publish_guard_status")}: {describeStatusValue(post.platformPublishGuardStatus)} ·{" "}
                        게시 전 미리보기: {describeStatusValue(post.platformPublishDryRunStatus)} ·{" "}
                        {describeStatusField("handoff_status")}: {describeStatusValue(post.handoffStatus)} ·{" "}
                        {describeStatusField("manual_post_status")}: {describeStatusValue(post.manualPostStatus)}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        API 게시 준비: <ApiReadinessBadge status={checkPlatformApiReadiness(post.platform).status} />
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        성과 측정 상태: {describeStatusValue(post.performanceStatus)} ({post.latestPerformanceScore ?? "-"}) {post.postUrl && (
                          <>
                            ·{" "}
                            <a href={post.postUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              게시글 열기
                            </a>
                          </>
                        )}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        {/* Phase 4-14: 품질검사 재실행/승인 요청은 기본 흐름에서
                            필수가 아니다(자동 검토가 이미 통과했으면 primary는
                            바로 "승인"이고, approveSocialPost()는 pending_review를
                            요구하지 않는다) — 재실행이 필요한 경우를 위해
                            여기 보조 영역에 그대로 남겨둔다(기능 삭제 없음). */}
                        <form action={runSocialPostQualityGateAction}>
                          <input type="hidden" name="articleId" value={article.id} />
                          <input type="hidden" name="socialPostId" value={post.id} />
                          <input type="hidden" name="returnTo" value={selfReturnTo} />
                          <button type="submit" className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100">
                            품질검사 다시 실행
                          </button>
                        </form>
                        <form action={requestSocialPostApprovalAction}>
                          <input type="hidden" name="articleId" value={article.id} />
                          <input type="hidden" name="socialPostId" value={post.id} />
                          <input type="hidden" name="returnTo" value={selfReturnTo} />
                          <button type="submit" className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100">
                            승인 요청
                          </button>
                        </form>
                        <form action={runPlatformPublishingGuardAction}>
                          <input type="hidden" name="articleId" value={article.id} />
                          <input type="hidden" name="socialPostId" value={post.id} />
                          <input type="hidden" name="returnTo" value={selfReturnTo} />
                          <button type="submit" className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100">
                            게시 준비 확인
                          </button>
                        </form>
                        <form action={createPlatformPublishDryRunAction}>
                          <input type="hidden" name="articleId" value={article.id} />
                          <input type="hidden" name="socialPostId" value={post.id} />
                          <input type="hidden" name="returnTo" value={selfReturnTo} />
                          <button type="submit" className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100">
                            게시 전 미리보기 만들기
                          </button>
                        </form>
                        <form action={completePlatformExportHandoffAction}>
                          <input type="hidden" name="articleId" value={article.id} />
                          <input type="hidden" name="socialPostId" value={post.id} />
                          <input type="hidden" name="returnTo" value={selfReturnTo} />
                          <button type="submit" className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100">
                            수동 게시 준비 완료
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
                    </AdvancedDetails>

                    <details className="mt-2" id={buildAnchorId("social-post-manual-result", post.id)}>
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
                        <input name="shares" type="number" placeholder="shares" className="w-20 rounded border border-zinc-300 px-1.5 py-1" />
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
