import Link from "next/link";
import { notFound } from "next/navigation";
import { buildArticleSocialPageData } from "@/lib/social/article-social-page-service";
import { ArticleWorkflowNavigation } from "@/components/articles/article-workflow-navigation";
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
import { TONE_STYLES, type SocialPlatform } from "@/lib/social/social-platform-types";
import { getSocialPostDisplayBody } from "@/lib/social/social-post-display";
import { getUserFacingStatus } from "@/lib/social/social-post-user-facing-status";
import { getSocialPostCardActionState, type SocialPostCardAction } from "@/lib/social/social-post-card-action-state";
import { ExpandableText } from "@/components/social/expandable-text";
import { ContentProgressSteps } from "@/components/articles/content-progress-steps";
import { PLATFORM_LABELS } from "@/lib/social/platform-generation-recommendations";
import { TONE_STYLE_CONFIGS } from "@/lib/social/tone-style-config";
import { describeStatusValue, describeStatusField } from "@/lib/social/status-labels";
import {
  summarizeAutoReview,
  describeAutoReviewRiskLevel,
  describeApprovalReadiness,
  describeAutoReviewNotRunYet,
} from "@/lib/social/social-post-auto-review";
import { getPlatformReviewCriteria } from "@/lib/social/platform-review-criteria";
import {
  generatePlaceholderSocialPostAction,
  generateSocialDraftAction,
  runSocialPostQualityGateAction,
  requestSocialPostApprovalAction,
  approveSocialPostAction,
  generateManualExportAction,
  runPlatformPublishingGuardAction,
  createPlatformPublishDryRunAction,
  completePlatformExportHandoffAction,
  prepareManualPostingRecordAction,
  recordManualPostingResultAction,
  recordSocialPostMetricsAction,
  archiveSocialPostAction,
} from "../actions";
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

  const { article, posts, pagination, targetPage } = await buildArticleSocialPageData(id, {
    includeRewriteVersions,
    page,
    perPage,
    targetSocialPostId,
  });

  if (!article) {
    notFound();
  }

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
        {publishMessage && <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{publishMessage}</div>}

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
              {posts.map((post) => {
                const selfReturnTo = selfReturnToFor(post.id);
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

                    {/* Phase 4-14: 게시용 본문을 목록 카드 안에서 최대한 그대로
                        보여준다 — 자동 검토 결과보다 먼저 표시해, 사용자가 글을
                        먼저 읽고 판단할 수 있게 한다. 1,200자 이하면 전체 표시,
                        초과하면 ExpandableText가 카드 안에서만 접기/펼치기를
                        처리한다(페이지 이동/서버 action 없음). */}
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
                      return (
                        <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-2">
                          <p className="text-[10px] font-medium text-zinc-500">게시용 본문</p>
                          <ExpandableText text={displayBody} className="mt-1 text-[12px] text-zinc-800" />
                        </div>
                      );
                    })()}

                    {/* Phase 3-25: "사람이 모든 항목을 직접 검사"하는 대신
                        "자동 검토 리포트를 보고 최종 판단"하도록, quality
                        gate checklist(이미 저장돼 있음)를 통과/확인 필요/
                        수정 필요/차단 리포트로 다시 계산해서 보여준다. DB에
                        새로 쓰지 않는다 — 항상 현재 checklist로 다시
                        계산한다. Phase 4-14: 본문보다 먼저 보이지 않도록
                        본문 블록 다음으로 옮겼다. */}
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
                        const toneClass =
                          review.overallStatus === "blocked"
                            ? "border-red-200 bg-red-50 text-red-800"
                            : review.overallStatus === "needs_fix"
                              ? "border-orange-200 bg-orange-50 text-orange-800"
                              : review.overallStatus === "needs_check"
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-green-200 bg-green-50 text-green-800";

                        const reviewCriteria = getPlatformReviewCriteria(post.platform);

                        return (
                          <div className={`mt-2 rounded border p-2 text-[11px] ${toneClass}`}>
                            {/* Phase 4-5: 글 유형별 기준이 섞이지 않았음을 항상 먼저 보여준다. */}
                            <p className="text-zinc-600">
                              글 유형: {PLATFORM_LABELS[post.platform]} · 검토 기준: {reviewCriteria.criteriaSummary}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
                              <p className="font-semibold">자동 검토 결과: {review.overallLabel}</p>
                              <span className="rounded-full bg-white/60 px-1.5 py-0.5 font-medium">
                                위험도 {describeAutoReviewRiskLevel(review.riskLevel)}
                              </span>
                            </div>
                            <p className="mt-1">
                              통과 {review.counts.passed}개 · 확인 필요 {review.counts.needsCheck}개 · 수정 필요{" "}
                              {review.counts.needsFix}개 · 차단 {review.counts.blocked}개
                            </p>
                            <p className="mt-1">{describeApprovalReadiness(review)}</p>
                            {review.issues.length > 0 && (
                              <ul className="mt-1.5 flex flex-col gap-0.5">
                                {review.issues.slice(0, 5).map((issue) => (
                                  <li key={issue.key}>
                                    · [{issue.axisLabel}] {issue.message}
                                  </li>
                                ))}
                                {review.issues.length > 5 && <li>· 그 외 {review.issues.length - 5}건 (상세 상태 보기 참고)</li>}
                              </ul>
                            )}
                          </div>
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

                      return (
                        <>
                          <p className="mt-2 text-[11px] text-zinc-500">
                            상태: <span className="font-medium text-zinc-700">{cardState.statusBadge}</span>
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                            {renderAction(cardState.primaryAction, primaryClass)}
                            {cardState.secondaryActions.map((action, i) => (
                              <span key={`${action.actionType}-${i}`}>{renderAction(action, secondaryClass)}</span>
                            ))}
                            <a href={buildArticleOverviewUrl(article.id)} className="text-zinc-500 hover:underline">
                              기사 개요 →
                            </a>
                          </div>
                        </>
                      );
                    })()}

                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] text-zinc-400">상세 상태 보기 / 보조 작업 (관리자용, 기본 접힘)</summary>
                      <p className="mt-1 text-[11px] text-zinc-400">
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
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                        <a href={buildMetricsDeepLink(article.id, post.id, selfReturnTo)} className="text-amber-700 hover:underline">
                          성과 보기 →
                        </a>
                        {post.isRewriteVersion && (
                          <a href={buildRewriteVersionDeepLink(article.id, post.id, selfReturnTo)} className="text-indigo-700 hover:underline">
                            재작성 관리에서 보기 →
                          </a>
                        )}
                      </div>
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
                    </details>

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
