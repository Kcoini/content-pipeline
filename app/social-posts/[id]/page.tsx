import Link from "next/link";
import { getSocialPostDetail } from "@/lib/social/social-post-detail-service";
import { SocialPostDetailNavigation } from "@/components/social-posts/social-post-detail-navigation";
import { ContentGroupBadge, InfoBadge } from "@/components/social/content-group-badge";
import { getContentGroupLabel, getContentTypeLabel } from "@/lib/social/content-type-classifier";
import { getSafeReturnTo } from "@/lib/navigation/return-to";
import { buildArticleOverviewUrl, buildArticleBlogUrl } from "@/lib/navigation/article-deep-links";
import { logEvent } from "@/lib/harness/logger";
import { getPlatformApiCapability } from "@/lib/social/platform-api-capabilities";
import { checkPlatformApiReadiness } from "@/lib/social/platform-api-readiness-checker";
import { checkPlatformApiPublishEligibility } from "@/lib/social/platform-api-publish-eligibility-guard";
import { buildPlatformApiPublishDryRunPayload } from "@/lib/social/platform-api-publish-payload-builder";
import { ApiReadinessSummary } from "@/components/platform-api/api-readiness-summary";
import { ApiDryRunPayloadPreview } from "@/components/platform-api/api-dry-run-payload-preview";
import { sanitizeNaverCafePlainText } from "@/lib/social/naver-cafe-plain-text-sanitizer";
import { preparePlatformApiPublishingAction } from "./actions";
import { editSocialPostAction, runSocialPostQualityGateAction, approveSocialPostAction } from "@/app/articles/[id]/actions";
import { PLATFORM_LABELS } from "@/lib/social/platform-generation-recommendations";
import { TONE_STYLE_CONFIGS } from "@/lib/social/tone-style-config";
import { describeStatusValue, describeStatusField } from "@/lib/social/status-labels";
import {
  summarizeAutoReview,
  describeAutoReviewRiskLevel,
  describeApprovalReadiness,
  describeAutoReviewNotRunYet,
  getApprovalGateStatus,
  getSocialPostWorkspacePrimaryAction,
} from "@/lib/social/social-post-auto-review";
import type { SocialPostQualityChecklistItem } from "@/lib/social/social-platform-types";
import { getSocialPostDisplayBody } from "@/lib/social/social-post-display";
import {
  getPlatformPreviewMode,
  getPlatformBodyLabel,
  getPlatformBodyWarnings,
  hasDisplayableBody,
} from "@/lib/social/social-post-platform-preview";
import { ensureWordPressHtmlContent } from "@/lib/wordpress/markdown-to-wordpress-html";
import { PLATFORM_WRITING_CONFIGS } from "@/lib/social/platform-writing-config";
import { getPlatformReviewCriteria } from "@/lib/social/platform-review-criteria";
import { detectContentTypeMismatch } from "@/lib/social/content-type-mismatch";

export const dynamic = "force-dynamic";

const PREVIEW_LENGTH = 300;

type WorkspaceTab = "preview" | "edit" | "raw";

function truncate(text: string | null, length = PREVIEW_LENGTH): { preview: string; truncated: boolean } {
  const value = text ?? "";
  if (value.length <= length) return { preview: value, truncated: false };
  return { preview: `${value.slice(0, length)}…`, truncated: true };
}

/** Phase 3-26: 3개 탭(게시용 미리보기/수정하기/내부 원문 보기)을 오가는 링크를 만든다. */
function buildTabHref(id: string, tab: WorkspaceTab, returnTo?: string): string {
  const params = new URLSearchParams();
  if (tab !== "preview") params.set("tab", tab);
  if (returnTo) params.set("returnTo", returnTo);
  const query = params.toString();
  return `/social-posts/${id}${query ? `?${query}` : ""}`;
}

export default async function SocialPostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string; error?: string; publishMessage?: string; showDryRun?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { returnTo, error, publishMessage, showDryRun, tab: tabRaw } = await searchParams;
  const tab: WorkspaceTab = tabRaw === "edit" ? "edit" : tabRaw === "raw" ? "raw" : "preview";

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

  const {
    socialPost: p,
    article,
    contentGroup,
    contentType,
    latestMetrics,
    recentMetrics,
    versionChain,
    rewriteSuggestions,
    latestVersionComparison,
    latestRewritePerformanceComparison,
    relatedLinks,
    relatedAbTests,
  } = detail;

  const fallbackReturnTo = buildArticleOverviewUrl(p.articleId);
  const safeReturnTo = getSafeReturnTo(returnTo, fallbackReturnTo);
  const selfReturnTo = (targetTab: WorkspaceTab) => buildTabHref(p.id, targetTab, returnTo);

  // Phase 3-20: naver_cafe는 게시용 plain text 글이므로, 기존에 저장된
  // 글에 escape된 markdown(\##, \**, &#x20; 등)이 남아 있어도 화면에는
  // 항상 정리된 형태로 보여준다. 다른 플랫폼은 markdown 원문을 그대로
  // 보여준다(wordpress_blog/naver_blog는 markdown이 정상 형식이다).
  const displayPostBody = p.platform === "naver_cafe" ? sanitizeNaverCafePlainText(p.postBody) : p.postBody;
  const bodyPreview = truncate(displayPostBody);
  const captionPreview = truncate(p.caption);
  const threadPreview = p.threadItems.slice(0, 3);
  const cardPreview = p.cardItems.slice(0, 3);

  // Phase 3-26: 게시용 미리보기(어떤 필드를 "본문"으로 보여줄지)와 자동
  // 검토 리포트/승인 가능 여부는 모두 이미 저장된 데이터에서 다시 계산한다
  // (DB에 새로 쓰지 않는다).
  const displayBody = getSocialPostDisplayBody(p);
  const previewMode = getPlatformPreviewMode(p.platform);
  const bodyLabel = getPlatformBodyLabel(p.platform);
  const bodyWarnings = getPlatformBodyWarnings(p);
  const writingConfig = PLATFORM_WRITING_CONFIGS[p.platform];

  const checklist = Array.isArray(p.qualitySummary?.checklist)
    ? (p.qualitySummary.checklist as unknown as SocialPostQualityChecklistItem[])
    : null;
  const hasRunReview = p.qualityStatus !== "not_checked" && checklist !== null;
  const review = summarizeAutoReview(checklist ?? []);
  const hasBlockingChecklistIssues = review.counts.blocked + review.counts.needsFix > 0;
  const gate = getApprovalGateStatus({
    qualityStatus: p.qualityStatus,
    approvalStatus: p.approvalStatus,
    publishStatus: p.publishStatus,
    hasContent: hasDisplayableBody(p),
    hasBlockingIssues: hasBlockingChecklistIssues,
  });
  const primaryAction = getSocialPostWorkspacePrimaryAction(p.qualityStatus, p.approvalStatus, review);

  // Phase 4-5: 글 유형별 생성·검토 기준 분리 — 자동 검토 결과에 "이 글이
  // 어떤 유형/기준으로 검토됐는지"를 항상 먼저 보여주고, 본문 형태가
  // 설정된 글 유형과 맞지 않아 보이면 "글 유형 확인 필요"로 안내한다.
  const reviewCriteria = getPlatformReviewCriteria(p.platform);
  const contentTypeMismatch = detectContentTypeMismatch(p.platform, p.postBody);

  // Phase 3-21: capability/readiness는 순수 계산(환경변수 존재 여부만 확인)이라 렌더링 중 호출해도 안전하다 — DB를 바꾸지 않는다.
  const apiCapability = getPlatformApiCapability(p.platform);
  const apiReadiness = checkPlatformApiReadiness(p.platform);
  const apiEligibility = await checkPlatformApiPublishEligibility(p.id);
  const apiDryRunPayload = showDryRun === "true" ? await buildPlatformApiPublishDryRunPayload(p.id) : null;

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
      tab,
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

        {/* Phase 3-26: 이 페이지는 더 이상 읽기 전용이 아니다 — 단일 글의
            최종 검토·수정·승인 화면이다. */}
        <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
          이 페이지는 social_post 하나를 최종 검토·수정·승인하는 화면입니다. 게시용 미리보기를 확인하고, 필요하면
          바로 수정한 뒤, 자동 검토를 통과하면 최종 승인하세요. 최종 승인 전에는 export/Draft 반영이 불가능합니다.
        </div>

        {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {publishMessage && <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{publishMessage}</div>}

        <header className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <ContentGroupBadge group={contentGroup} />
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">{PLATFORM_LABELS[p.platform]}</span>
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">{TONE_STYLE_CONFIGS[p.toneStyle].label}</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">{getContentTypeLabel(contentType)}</span>
            {p.recommendedForRepost && <InfoBadge label="재게시 추천" />}
            {p.manualPostStatus === "posted" && <InfoBadge label="게시 완료" />}
            {p.manualPostStatus === "posted" && p.latestMetricsRecordedAt === null && <InfoBadge label="성과 입력 필요" />}
            {(p.performanceStatus === "low" || p.performanceStatus === "needs_review") && <InfoBadge label="반응 저조" />}
          </div>
          <h1 className="mt-2 text-lg font-semibold">{p.postTitle || p.caption || "(제목/캡션 없음)"}</h1>
          {/* Phase 3-24: social_post id/article_id 같은 내부 id는 기본
              화면에 크게 노출하지 않는다 — "내부 원문 보기" 탭 안으로
              옮겼다. 여기서는 기사로 가는 행동 링크만 남긴다. */}
          <p className="mt-1 text-xs text-zinc-500">
            기사:{" "}
            {article ? (
              <Link href={relatedLinks.articleOverview} className="text-blue-600 hover:underline">
                {article.title}
              </Link>
            ) : (
              "(알 수 없음)"
            )}
          </p>
        </header>

        {/* Phase 3-26: 상단 요약 카드 — 플랫폼/문체/제목/상태/자동 검토
            요약/다음 작업을 한 눈에 보여주고, 지금 눌러야 할 주요 버튼
            "하나만" 강조한다(여러 primary action이 경쟁하지 않게 한다). */}
        <section className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">지금 상태 요약</h2>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-600">플랫폼 / 문체</dt>
              <dd className="text-zinc-600">
                {PLATFORM_LABELS[p.platform]} · {TONE_STYLE_CONFIGS[p.toneStyle].label}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">현재 상태</dt>
              <dd className="text-zinc-600">
                {describeStatusValue(p.approvalStatus)} · {describeStatusValue(p.publishStatus)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium text-zinc-600">자동 검토 결과</dt>
              <dd className="text-zinc-600">
                {hasRunReview
                  ? `${review.overallLabel} (통과 ${review.counts.passed} · 확인 필요 ${review.counts.needsCheck} · 수정 필요 ${review.counts.needsFix} · 차단 ${review.counts.blocked})`
                  : describeAutoReviewNotRunYet(p.qualityStatus)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium text-zinc-600">다음 작업</dt>
              <dd className="text-zinc-600">{primaryAction.label}</dd>
            </div>
          </dl>

          <div className="mt-3">
            {primaryAction.kind === "run_review" ? (
              <form action={runSocialPostQualityGateAction}>
                <input type="hidden" name="articleId" value={p.articleId} />
                <input type="hidden" name="socialPostId" value={p.id} />
                <input type="hidden" name="returnTo" value={selfReturnTo(tab)} />
                <button
                  type="submit"
                  className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
                >
                  {primaryAction.label}
                </button>
              </form>
            ) : primaryAction.kind === "view_body" || primaryAction.kind === "edit" ? (
              <Link
                href={`${buildTabHref(p.id, primaryAction.kind === "edit" ? "edit" : "preview", returnTo)}#${
                  primaryAction.kind === "edit" ? "edit-panel" : "preview-panel"
                }`}
                className="inline-block rounded bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
              >
                {primaryAction.label}
              </Link>
            ) : (
              <a
                href={`${buildTabHref(p.id, tab, returnTo)}#final-approval-panel`}
                className="inline-block rounded bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
              >
                {primaryAction.label}
              </a>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">버전 정보</h2>
          {/* Phase 3-24: is_rewrite_version/parent_social_post_id/
              root_social_post_id 같은 DB 컬럼명과 raw id 문자열을 그대로
              라벨/텍스트로 쓰지 않는다 — 한 줄 요약 + 행동 링크로
              바꾼다("원본 글 보기"/"이전 버전 보기"). raw id 값 자체는
              아래 "내부 원문 보기" 탭 안에 남겨둔다. */}
          <p className="mt-1 text-sm text-zinc-600">
            {p.isRewriteVersion ? `재작성 버전입니다 (버전 ${p.versionNumber}).` : "원본 글입니다."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {p.parentSocialPostId && relatedLinks.parentSocialPostDetail && (
              <Link
                href={relatedLinks.parentSocialPostDetail}
                className="rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100"
              >
                이전 버전 글 보기 →
              </Link>
            )}
            {p.rootSocialPostId && relatedLinks.rootSocialPostDetail && (
              <Link
                href={relatedLinks.rootSocialPostDetail}
                className="rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100"
              >
                원본 글 보기 →
              </Link>
            )}
          </div>
          {versionChain.length > 0 && (
            <div className="mt-3 text-xs">
              <p className="font-medium text-zinc-600">버전 흐름 ({versionChain.length}개)</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {versionChain.map((v) => (
                  <li key={v.id} className={v.socialPostId === p.id ? "font-semibold text-zinc-800" : "text-zinc-500"}>
                    버전 {v.versionNumber} · {describeStatusValue(v.versionStatus)}
                    {v.socialPostId === p.id && " (현재 보고 있는 글)"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Phase 3-26: 탭 네비게이션 — 게시용 미리보기(기본)/수정하기/내부
            원문 보기. client state 없이 ?tab= searchParam으로 구현한다. */}
        <nav role="tablist" aria-label="글 보기 방식" className="flex gap-2 border-b border-zinc-200 text-sm">
          {(
            [
              ["preview", "게시용 미리보기"],
              ["edit", "수정하기"],
              ["raw", "내부 원문 보기"],
            ] as [WorkspaceTab, string][]
          ).map(([value, label]) => (
            <Link
              key={value}
              href={buildTabHref(p.id, value, returnTo)}
              role="tab"
              aria-selected={tab === value}
              className={`-mb-px border-b-2 px-3 py-2 font-medium ${
                tab === value ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {tab === "preview" && (
          <div id="preview-panel" tabIndex={-1} className="flex flex-col gap-6 outline-none">
            {/* Phase 3-25/3-26: 자동 검토 리포트 — 각 이슈에 [수정하기]/
                [본문 위치 보기] 액션 링크를 붙여 수정 흐름과 연결한다. */}
            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-700">자동 검토 결과</h2>

              {/* Phase 4-5: 글 유형(platform)과 본문 형태가 서로 다른
                  기준을 요구하는 조합으로 보이면(예: news_article인데
                  칼럼형 본문), 자동 검토 점수와 별개로 항상 안내한다 —
                  "선택 불가"로 끝내지 않고 보완 방향과 수정 탭 링크를
                  함께 제공한다. */}
              {contentTypeMismatch.mismatched && (
                <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-medium">글 유형 확인 필요</p>
                  <p className="mt-1 break-keep">{contentTypeMismatch.message}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href={`${buildTabHref(p.id, "edit", returnTo)}#edit-panel`}
                      className="rounded border border-amber-400 bg-white px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
                    >
                      본문 수정하기
                    </Link>
                    {contentTypeMismatch.suggestedPlatform && (
                      <span className="rounded border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-amber-700">
                        참고: {PLATFORM_LABELS[contentTypeMismatch.suggestedPlatform]} 기준에 더 가까워 보입니다
                      </span>
                    )}
                  </div>
                </div>
              )}

              {!hasRunReview ? (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-xs text-zinc-500">{describeAutoReviewNotRunYet(p.qualityStatus)}</p>
                  <form action={runSocialPostQualityGateAction}>
                    <input type="hidden" name="articleId" value={p.articleId} />
                    <input type="hidden" name="socialPostId" value={p.id} />
                    <input type="hidden" name="returnTo" value={selfReturnTo("preview")} />
                    <button
                      type="submit"
                      className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      자동 검토 실행
                    </button>
                  </form>
                </div>
              ) : (
                (() => {
                  const toneClass =
                    review.overallStatus === "blocked"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : review.overallStatus === "needs_fix"
                        ? "border-orange-200 bg-orange-50 text-orange-800"
                        : review.overallStatus === "needs_check"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-green-200 bg-green-50 text-green-800";

                  return (
                    <div className={`mt-2 rounded border p-3 text-xs ${toneClass}`}>
                      {/* Phase 4-5: 글 유형/적용 기준을 항상 먼저 보여준다 —
                          기사 본문에 블로그 기준(FAQ/체크리스트 등)이
                          잘못 적용되지 않았음을 사용자가 확인할 수 있게 한다. */}
                      <p className="font-medium">글 유형: {PLATFORM_LABELS[p.platform]}</p>
                      <p className="mt-0.5">
                        검토 기준: {reviewCriteria.criteriaSummary}을(를) 중심으로 검토했습니다.
                      </p>
                      {reviewCriteria.notEnforced && <p className="mt-0.5">주의: {reviewCriteria.notEnforced}</p>}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
                        <p className="font-semibold">{review.overallLabel}</p>
                        <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[11px] font-medium">
                          위험도 {describeAutoReviewRiskLevel(review.riskLevel)}
                        </span>
                      </div>
                      <p className="mt-1">
                        통과 {review.counts.passed}개 · 확인 필요 {review.counts.needsCheck}개 · 수정 필요{" "}
                        {review.counts.needsFix}개 · 차단 {review.counts.blocked}개
                      </p>
                      <p className="mt-1">{describeApprovalReadiness(review)}</p>
                      {review.issues.length > 0 && (
                        <ul className="mt-1.5 flex flex-col gap-1">
                          {review.issues.map((issue) => (
                            <li key={issue.key} className="flex flex-wrap items-center gap-2">
                              <span>
                                · [{issue.axisLabel}] {issue.message}
                              </span>
                              <Link
                                href={`${buildTabHref(p.id, "edit", returnTo)}#edit-panel`}
                                className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100"
                              >
                                수정하기
                              </Link>
                              <Link
                                href={`${buildTabHref(p.id, "preview", returnTo)}#publish-preview`}
                                className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100"
                              >
                                본문 위치 보기
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                      <form action={runSocialPostQualityGateAction} className="mt-2">
                        <input type="hidden" name="articleId" value={p.articleId} />
                        <input type="hidden" name="socialPostId" value={p.id} />
                        <input type="hidden" name="returnTo" value={selfReturnTo("preview")} />
                        <button
                          type="submit"
                          className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          자동 재검토 실행
                        </button>
                      </form>
                    </div>
                  );
                })()
              )}
            </section>

            {/* Phase 3-26: 플랫폼별 게시용 미리보기 — raw markdown/HTML/JSON을
                노출하지 않고, 실제 게시 형태에 가깝게 렌더링한다. */}
            <section id="publish-preview" tabIndex={-1} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm outline-none">
              <h2 className="text-sm font-semibold text-zinc-700">게시용 미리보기 ({bodyLabel})</h2>
              <p className="mt-1 text-xs text-zinc-500">제목: {p.postTitle || "(제목 없음)"}</p>

              {bodyWarnings.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  {bodyWarnings.map((warning) => (
                    <li key={warning}>· {warning}</li>
                  ))}
                </ul>
              )}

              {!hasDisplayableBody(p) ? (
                <p className="mt-3 text-xs text-zinc-500">아직 게시용 본문이 없습니다.</p>
              ) : previewMode === "wordpress_html" ? (
                <div
                  className="prose prose-sm mt-3 max-w-none rounded border border-zinc-100 bg-zinc-50 p-3"
                  // WordPress HTML 미리보기: ensureWordPressHtmlContent가 sanitize한 안전한 HTML만 렌더링한다.
                  dangerouslySetInnerHTML={{ __html: ensureWordPressHtmlContent(displayBody) }}
                />
              ) : previewMode === "mobile_blog" ? (
                <div className="mx-auto mt-3 max-w-sm rounded border border-zinc-200 bg-white p-3 text-sm leading-relaxed text-zinc-700 shadow-inner">
                  {displayBody.split(/\n{2,}/).map((paragraph, index) => (
                    <p key={index} className="mb-3 whitespace-pre-wrap last:mb-0">
                      {paragraph.trim()}
                    </p>
                  ))}
                </div>
              ) : previewMode === "plain_text" ? (
                <p className="mt-3 whitespace-pre-wrap rounded border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-700">
                  {displayBody}
                </p>
              ) : previewMode === "short_text" ? (
                p.platform === "x" && p.threadItems.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-2">
                    {p.threadItems.map((item) => (
                      <li key={item.order} className="rounded border border-zinc-200 bg-zinc-50 p-2 text-sm text-zinc-700">
                        <p className="mb-1 text-[11px] font-medium text-zinc-400">
                          {item.order}번째 · {item.text.length}자
                        </p>
                        <p className="whitespace-pre-wrap">{item.text}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                    <p className="mb-1 text-[11px] font-medium text-zinc-400">{displayBody.length}자</p>
                    <p className="whitespace-pre-wrap">{displayBody}</p>
                  </div>
                )
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  <div>
                    <p className="text-xs font-medium text-zinc-600">캡션</p>
                    <p className="mt-1 whitespace-pre-wrap rounded border border-zinc-100 bg-zinc-50 p-2 text-sm text-zinc-700">
                      {p.caption || "(캡션 없음)"}
                    </p>
                  </div>
                  {p.hashtags.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-zinc-600">해시태그</p>
                      <p className="mt-1 text-sm text-zinc-600">{p.hashtags.map((t) => `#${t}`).join(" ")}</p>
                    </div>
                  )}
                  {p.cardItems.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-zinc-600">카드 문구 ({p.cardItems.length}개)</p>
                      <ul className="mt-1 flex flex-col gap-1">
                        {p.cardItems.map((item) => (
                          <li key={item.order} className="rounded border border-zinc-100 bg-zinc-50 p-2 text-sm text-zinc-700">
                            <p className="font-medium">
                              카드 {item.order}: {item.heading}
                            </p>
                            <p className="mt-0.5 whitespace-pre-wrap text-zinc-600">{item.body}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "edit" && (
          <div id="edit-panel" tabIndex={-1} className="outline-none">
            {/* Phase 3-26: 기존 editSocialPostAction을 그대로 재사용한다
                (returnTo 지원을 추가해 이 페이지로 다시 돌아오게 했다).
                저장하면 quality_status가 자동으로 초기화되므로(서비스에서
                처리) 저장 직후 "자동 재검토가 필요합니다" 상태가 된다. */}
            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-700">수정하기</h2>
              <p className="mt-1 text-xs text-zinc-500">
                저장하면 자동 검토가 초기화됩니다. 저장 후 아래 &ldquo;자동 재검토 실행&rdquo;을 눌러 다시 확인하세요.
              </p>

              <form action={editSocialPostAction} className="mt-3 flex flex-col gap-3">
                <input type="hidden" name="articleId" value={p.articleId} />
                <input type="hidden" name="socialPostId" value={p.id} />
                <input type="hidden" name="returnTo" value={selfReturnTo("edit")} />

                {writingConfig.supportsTitle && (
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-zinc-600">제목</span>
                    <input
                      type="text"
                      name="postTitle"
                      defaultValue={p.postTitle ?? ""}
                      className="rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-800"
                    />
                  </label>
                )}

                {writingConfig.supportsBody && p.platform !== "x" && (
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-zinc-600">본문</span>
                    <textarea
                      name="postBody"
                      defaultValue={p.postBody ?? ""}
                      rows={12}
                      className="rounded border border-zinc-300 px-2 py-1.5 font-mono text-xs text-zinc-800"
                    />
                  </label>
                )}

                {p.platform === "x" && (
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-zinc-600">스레드 (JSON 배열 — order/text)</span>
                    <textarea
                      name="threadItems"
                      defaultValue={JSON.stringify(p.threadItems, null, 2)}
                      rows={10}
                      className="rounded border border-zinc-300 px-2 py-1.5 font-mono text-xs text-zinc-800"
                    />
                  </label>
                )}

                {writingConfig.supportsCaption && (
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-zinc-600">캡션</span>
                    <textarea
                      name="caption"
                      defaultValue={p.caption ?? ""}
                      rows={6}
                      className="rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-800"
                    />
                  </label>
                )}

                {writingConfig.supportsHashtags && (
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-zinc-600">해시태그 (쉼표로 구분)</span>
                    <input
                      type="text"
                      name="hashtags"
                      defaultValue={p.hashtags.join(", ")}
                      className="rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-800"
                    />
                  </label>
                )}

                {p.platform === "instagram" && (
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-zinc-600">카드 문구 (JSON 배열 — order/heading/body)</span>
                    <textarea
                      name="cardItems"
                      defaultValue={JSON.stringify(p.cardItems, null, 2)}
                      rows={10}
                      className="rounded border border-zinc-300 px-2 py-1.5 font-mono text-xs text-zinc-800"
                    />
                  </label>
                )}

                <button
                  type="submit"
                  className="self-start rounded bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
                >
                  저장
                </button>
              </form>
            </section>
          </div>
        )}

        {tab === "raw" && (
          <div id="raw-panel" tabIndex={-1} className="flex flex-col gap-6 outline-none">
            {/* Phase 3-26: "관리 정보 보기" 접힘을 별도 탭으로 옮겼다 —
                내부 원문/raw 상태값은 기본 화면(게시용 미리보기)에는 절대
                노출하지 않고, 이 탭을 직접 선택했을 때만 보여준다. */}
            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-700">내부 원문 (raw)</h2>
              <div className="mt-2 text-xs">
                <p className="font-medium text-zinc-600">post_body</p>
                <p className="mt-1 whitespace-pre-wrap rounded border border-zinc-100 bg-zinc-50 p-2 font-mono text-zinc-600">
                  {p.postBody || "(null)"}
                </p>
              </div>
              {p.caption && (
                <div className="mt-2 text-xs">
                  <p className="font-medium text-zinc-600">caption</p>
                  <p className="mt-1 whitespace-pre-wrap rounded border border-zinc-100 bg-zinc-50 p-2 font-mono text-zinc-600">
                    {p.caption}
                  </p>
                </div>
              )}
              {p.threadItems.length > 0 && (
                <div className="mt-2 text-xs">
                  <p className="font-medium text-zinc-600">thread_items</p>
                  <pre className="mt-1 overflow-x-auto rounded border border-zinc-100 bg-zinc-50 p-2 font-mono text-zinc-600">
                    {JSON.stringify(p.threadItems, null, 2)}
                  </pre>
                </div>
              )}
              {p.cardItems.length > 0 && (
                <div className="mt-2 text-xs">
                  <p className="font-medium text-zinc-600">card_items</p>
                  <pre className="mt-1 overflow-x-auto rounded border border-zinc-100 bg-zinc-50 p-2 font-mono text-zinc-600">
                    {JSON.stringify(p.cardItems, null, 2)}
                  </pre>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-700">콘텐츠 미리보기 (기존 필드)</h2>
              <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-zinc-600">{describeStatusField("post_title")}</dt>
                  <dd className="text-zinc-500">{p.postTitle || "-"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-600">{describeStatusField("excerpt")}</dt>
                  <dd className="text-zinc-500">{p.excerpt || "-"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-600">{describeStatusField("hashtags")}</dt>
                  <dd className="text-zinc-500">{p.hashtags.length > 0 ? p.hashtags.map((t) => `#${t}`).join(" ") : "-"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-600">{describeStatusField("post_url")}</dt>
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

              {displayPostBody && (
                <div className="mt-3 text-xs">
                  <p className="font-medium text-zinc-600">
                    본문 미리보기{p.platform === "naver_cafe" && " (텍스트 정리됨)"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-600">{bodyPreview.preview}</p>
                  {bodyPreview.truncated && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[11px] text-zinc-400">전체 본문 펼치기</summary>
                      <p className="mt-1 whitespace-pre-wrap text-zinc-600">{displayPostBody}</p>
                    </details>
                  )}
                </div>
              )}

              {p.caption && (
                <div className="mt-3 text-xs">
                  <p className="font-medium text-zinc-600">캡션 미리보기</p>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-600">{captionPreview.preview}</p>
                  {captionPreview.truncated && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[11px] text-zinc-400">전체 캡션 펼치기</summary>
                      <p className="mt-1 whitespace-pre-wrap text-zinc-600">{p.caption}</p>
                    </details>
                  )}
                </div>
              )}

              {threadPreview.length > 0 && (
                <div className="mt-3 text-xs">
                  <p className="font-medium text-zinc-600">스레드 미리보기 ({p.threadItems.length}개 중 {threadPreview.length}개)</p>
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
                  <p className="font-medium text-zinc-600">카드 미리보기 ({p.cardItems.length}개 중 {cardPreview.length}개)</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {cardPreview.map((item) => (
                      <li key={item.order} className="text-zinc-600">
                        카드 {item.order}: {item.heading} — {truncate(item.body, 80).preview}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Phase 3-20: 게시용 본문과 내부 관리 정보를 명확히 분리한다 —
                상태/성과/Rewrite/A-B Test/API Publishing/메타데이터/payload
                요약은 모두 "관리자용" 정보다. 복사/export/handoff
                payload에는 이 정보가 들어가지 않는다(각 payload 빌더가
                title/body만 담는다). */}
            <details className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 shadow-sm" open>
              <summary className="cursor-pointer text-sm font-semibold text-zinc-600">
                관리 정보 보기 (관리자용 — 상태/성과/Rewrite/A-B Test/API/메타데이터)
              </summary>
              <p className="mt-2 text-[11px] text-zinc-400">
                아래 정보는 내부 운영/디버깅용이며 게시용 본문이 아닙니다. 복사/export/handoff에는 포함되지 않습니다.
              </p>

              <div className="mt-3 text-xs">
                <p className="font-medium text-zinc-600">내보내기 / 게시 전 미리보기 / 수동 게시 준비 자료 요약</p>
                <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-zinc-600">내보내기 자료 항목 수</dt>
                    <dd className="text-zinc-500">{Object.keys(p.exportPayload ?? {}).length}개</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">게시 전 미리보기 자료 항목 수</dt>
                    <dd className="text-zinc-500">{Object.keys(p.platformPublishDryRunPayload ?? {}).length}개</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">수동 게시 준비 자료 항목 수</dt>
                    <dd className="text-zinc-500">{Object.keys(p.handoffPayload ?? {}).length}개</dd>
                  </div>
                </dl>
                <p className="mt-1 text-[11px] text-zinc-400">전체 자료 원문은 이 페이지에서 노출하지 않습니다.</p>
              </div>

              <section className="mt-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-zinc-700">상태</h2>
                <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("quality_status")} / {describeStatusField("quality_score")}</dt>
                    <dd className="text-zinc-500">{describeStatusValue(p.qualityStatus)} ({p.qualityScore ?? "-"})</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("approval_status")}</dt>
                    <dd className="text-zinc-500">{describeStatusValue(p.approvalStatus)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("publish_status")}</dt>
                    <dd className="text-zinc-500">{describeStatusValue(p.publishStatus)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("export_status")}</dt>
                    <dd className="text-zinc-500">{describeStatusValue(p.exportStatus)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("platform_publish_guard_status")}</dt>
                    <dd className="text-zinc-500">{describeStatusValue(p.platformPublishGuardStatus)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("platform_publish_dry_run_status")}</dt>
                    <dd className="text-zinc-500">{describeStatusValue(p.platformPublishDryRunStatus)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("handoff_status")}</dt>
                    <dd className="text-zinc-500">{describeStatusValue(p.handoffStatus)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("manual_post_status")}</dt>
                    <dd className="text-zinc-500">{describeStatusValue(p.manualPostStatus)}</dd>
                  </div>
                </dl>
              </section>

              <section className="mt-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-zinc-700">성과</h2>
                <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("performance_status")}</dt>
                    <dd className="text-zinc-500">{describeStatusValue(p.performanceStatus)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("latest_performance_score")}</dt>
                    <dd className="text-zinc-500">{p.latestPerformanceScore ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("latest_metrics_recorded_at")}</dt>
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

              <section className="mt-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-zinc-700">재작성 관련 상태</h2>
                <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("rewrite_suggestion_status")}</dt>
                    <dd className="text-zinc-500">{describeStatusValue(p.rewriteSuggestionStatus)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("version_comparison_status")}</dt>
                    <dd className="text-zinc-500">
                      {describeStatusValue(p.versionComparisonStatus)}
                      {p.versionComparisonScore != null ? ` (점수 ${p.versionComparisonScore})` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("recommended_for_repost")}</dt>
                    <dd className="text-zinc-500">{p.recommendedForRepost ? "예" : "아니오"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("rewrite_reapproval_status")}</dt>
                    <dd className="text-zinc-500">{describeStatusValue(p.rewriteReapprovalStatus)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("rewrite_reexport_status")}</dt>
                    <dd className="text-zinc-500">{describeStatusValue(p.rewriteReexportStatus)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("rewrite_republish_workflow_status")}</dt>
                    <dd className="text-zinc-500">{describeStatusValue(p.rewriteRepublishWorkflowStatus)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("rewrite_performance_comparison_status")}</dt>
                    <dd className="text-zinc-500">
                      {describeStatusValue(p.rewritePerformanceComparisonStatus)}
                      {p.rewritePerformanceWinner ? ` · 더 좋은 쪽: ${describeStatusValue(p.rewritePerformanceWinner)}` : ""}
                    </dd>
                  </div>
                </dl>

                {latestVersionComparison && (
                  <p className="mt-3 text-xs text-zinc-500">
                    최근 버전 비교: {describeStatusValue(latestVersionComparison.comparisonStatus)} · 점수{" "}
                    {latestVersionComparison.comparisonScore ?? "-"}
                  </p>
                )}
                {latestRewritePerformanceComparison && (
                  <p className="mt-1 text-xs text-zinc-500">
                    최근 성과 비교: {describeStatusValue(latestRewritePerformanceComparison.comparisonStatus)} · 더 좋은 쪽{" "}
                    {latestRewritePerformanceComparison.winner ? describeStatusValue(latestRewritePerformanceComparison.winner) : "-"}
                  </p>
                )}

                <p className="mt-3 text-xs">
                  <Link href={relatedLinks.rewriteDeepLink} className="text-indigo-700 hover:underline">
                    재작성 관리 페이지에서 이 버전 보기 →
                  </Link>
                </p>

                {rewriteSuggestions.length > 0 && (
                  <div className="mt-3 text-xs">
                    <p className="font-medium text-zinc-600">이 글에서 생성된 개선 제안 ({rewriteSuggestions.length}개)</p>
                    <ul className="mt-1 flex flex-col gap-0.5 text-zinc-500">
                      {rewriteSuggestions.map((s) => (
                        <li key={s.id}>
                          {describeStatusValue(s.suggestionStatus)} / {describeStatusValue(s.applicationStatus)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              <section className="mt-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-zinc-700">글 반응 비교(A/B Test)</h2>
                <p className="mt-1 text-[11px] text-zinc-500">
                  비교 실험 상태: {describeStatusValue(p.abTestStatus)}
                  {p.abTestVariantRole ? ` · 역할: ${describeStatusValue(p.abTestVariantRole)}` : ""}
                  {p.abTestVariantLabel ? ` (${p.abTestVariantLabel})` : ""}
                </p>
                {relatedAbTests.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1 text-xs text-zinc-600">
                    {relatedAbTests.map((t) => (
                      <li key={t.id}>
                        <Link href={relatedLinks.articleAbTests} className="text-purple-700 hover:underline">
                          {t.testName}
                        </Link>{" "}
                        ({describeStatusValue(t.testStatus)})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-zinc-500">아직 이 글이 속한 비교 실험이 없습니다.</p>
                )}
                <p className="mt-2 text-xs">
                  <a href={relatedLinks.createAbTestDeepLink} className="text-purple-700 hover:underline">
                    비교 실험에 추가/새로 만들기 →
                  </a>
                </p>
              </section>

              <section className="mt-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-zinc-700">API 게시 준비 상태</h2>
                <p className="mt-1 text-[11px] text-zinc-500">
                  이번 단계는 실제 API 게시가 아니라 API 게시 준비 상태 확인입니다. 현재 자동 게시 기능은 비활성화되어 있습니다.
                  토큰이나 API key 값은 화면에 표시하지 않습니다. 수동 export/수동 게시 준비 흐름은 계속 사용할 수 있습니다.
                </p>

                <div className="mt-2">
                  <ApiReadinessSummary capability={apiCapability} readiness={apiReadiness} eligibility={apiEligibility} />
                </div>

                <p className="mt-2 text-[11px] text-zinc-400">
                  마지막 저장된 준비 상태: {describeStatusValue(p.apiPublishPreparationStatus)}
                  {p.apiPublishPreparedAt ? ` (${new Date(p.apiPublishPreparedAt).toLocaleString("ko-KR")})` : " (아직 확인하지 않음)"}
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <form action={preparePlatformApiPublishingAction}>
                    <input type="hidden" name="socialPostId" value={p.id} />
                    <button type="submit" className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100">
                      API 게시 준비 상태 확인
                    </button>
                  </form>
                  <a
                    href={`${buildTabHref(p.id, "raw", returnTo)}${
                      buildTabHref(p.id, "raw", returnTo).includes("?") ? "&" : "?"
                    }showDryRun=${showDryRun === "true" ? "false" : "true"}`}
                    className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    {showDryRun === "true" ? "게시 전 미리보기 숨기기" : "게시 전 미리보기 보기"}
                  </a>
                </div>

                {showDryRun === "true" && (
                  <div className="mt-3">
                    {apiDryRunPayload ? (
                      <ApiDryRunPayloadPreview payload={apiDryRunPayload} />
                    ) : (
                      <p className="text-xs text-zinc-500">
                        게시 전 미리보기를 생성할 수 없습니다(API 게시 준비가 지원되지 않거나 글을 찾을 수 없습니다).
                      </p>
                    )}
                  </div>
                )}
              </section>

              <section className="mt-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-zinc-700">메타데이터</h2>
                <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-zinc-600">글 ID</dt>
                    <dd className="font-mono text-zinc-500">{p.id}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">기사 ID</dt>
                    <dd className="font-mono text-zinc-500">{p.articleId}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("is_rewrite_version")}</dt>
                    <dd className="text-zinc-500">{p.isRewriteVersion ? "예" : "아니오"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("version_number")}</dt>
                    <dd className="text-zinc-500">{p.versionNumber}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("parent_social_post_id")}(id)</dt>
                    <dd className="font-mono text-zinc-500">{p.parentSocialPostId ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("root_social_post_id")}(id)</dt>
                    <dd className="font-mono text-zinc-500">{p.rootSocialPostId ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("content_group")}</dt>
                    <dd className="text-zinc-500">{getContentGroupLabel(contentGroup)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("content_type")}</dt>
                    <dd className="text-zinc-500">{getContentTypeLabel(contentType)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("created_at")}</dt>
                    <dd className="text-zinc-500">{new Date(p.createdAt).toLocaleString("ko-KR")}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">{describeStatusField("updated_at")}</dt>
                    <dd className="text-zinc-500">{new Date(p.updatedAt).toLocaleString("ko-KR")}</dd>
                  </div>
                </dl>
              </section>
            </details>
          </div>
        )}

        {/* Phase 3-26: 최종 승인 패널 — 어느 탭에 있든 항상 보인다. 자동
            검토 통과만으로는 approval_status가 approved로 바뀌지 않는다 —
            사람이 이 버튼을 직접 눌러야 한다. 승인 전에는 export/Draft
            반영을 차단한다(버튼을 아예 보여주지 않는다). */}
        <section id="final-approval-panel" tabIndex={-1} className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm outline-none">
          <h2 className="text-sm font-semibold text-zinc-700">최종 승인</h2>
          <p className="mt-1 text-xs text-zinc-500">
            이 승인은 게시 준비를 허용하는 단계입니다. 자동 공개 게시는 실행하지 않습니다.
          </p>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-600">자동 검토 결과</dt>
              <dd className="text-zinc-600">{hasRunReview ? review.overallLabel : describeAutoReviewNotRunYet(p.qualityStatus)}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">확인 필요 / 수정 필요 / 차단</dt>
              <dd className="text-zinc-600">
                {review.counts.needsCheck}개 / {review.counts.needsFix}개 / {review.counts.blocked}개
              </dd>
            </div>
          </dl>

          {p.approvalStatus === "approved" ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <p className="w-full text-zinc-600">이미 승인된 글입니다. 아래에서 다음 작업을 진행하세요.</p>
              {p.platform === "wordpress_blog" && (
                <Link
                  href={buildArticleBlogUrl(p.articleId, { socialPostId: p.id, highlight: p.id })}
                  className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  WordPress Draft 반영하기 →
                </Link>
              )}
              {p.platform === "naver_blog" && (
                <Link
                  href={buildTabHref(p.id, "raw", returnTo)}
                  className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  수동 export 보기 →
                </Link>
              )}
              {p.platform === "naver_cafe" && (
                <Link
                  href={`${buildTabHref(p.id, "preview", returnTo)}#publish-preview`}
                  className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  복사용 본문 보기 →
                </Link>
              )}
              {(p.platform === "x" || p.platform === "threads" || p.platform === "instagram") && (
                <Link
                  href={`${buildTabHref(p.id, "preview", returnTo)}#publish-preview`}
                  className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  게시 전 미리보기 →
                </Link>
              )}
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {!gate.canApprove && gate.reason && (
                <p className="text-xs font-medium text-red-700">{gate.reason}</p>
              )}
              <form action={approveSocialPostAction}>
                <input type="hidden" name="articleId" value={p.articleId} />
                <input type="hidden" name="socialPostId" value={p.id} />
                <input type="hidden" name="returnTo" value={selfReturnTo(tab)} />
                <button
                  type="submit"
                  disabled={!gate.canApprove}
                  aria-disabled={!gate.canApprove}
                  className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
                >
                  최종 승인
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
