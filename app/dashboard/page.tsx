import type { ReactNode } from "react";
import Link from "next/link";
import { DashboardTopNav } from "@/components/navigation/dashboard-top-nav";
import { ThemeSearchList } from "@/components/dashboard/theme-search-list";
import { addSource, archiveThemeAction, createTheme, generateArticleDraft } from "./actions";
import { getLogs } from "@/lib/harness/logger";
import { getLatestContractCheck, type ContractCheckRecord } from "@/lib/repositories/log-repository";
import { getThemes, getThemeRelatedCounts } from "@/lib/repositories/theme-repository";
import { getSourcesByThemeId } from "@/lib/repositories/source-repository";
import { getArticleByThemeId } from "@/lib/repositories/article-repository";
import { listSocialPostsByArticle } from "@/lib/repositories/social-posts-repository";
import { extractDomain, summarizeSourceStatus, resolveDashboardWorkflowState } from "@/lib/dashboard/source-display";
import {
  getWorkflowStateTone,
  getDashboardStatusSummary,
  getDashboardSectionExpansion,
  getDashboardCurrentStepArea,
  describeThemeStageLabel,
} from "@/lib/dashboard/dashboard-workflow-presentation";
import type { Article, Source } from "@/lib/types/domain";
import { ARTICLE_MODE_CONFIGS, ARTICLE_MODE_LIST, DEFAULT_ARTICLE_MODE, isArticleMode } from "@/lib/articles/article-modes";
import { TransientNotice } from "@/components/ui/transient-notice";
import { ContentProgressSteps } from "@/components/articles/content-progress-steps";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/social/social-platform-types";
import {
  PLATFORM_LABELS,
  PLATFORM_SHORT_DESCRIPTIONS,
  PLATFORM_COST_LEVELS,
  type PlatformCostLevel,
  getRecommendedPlatforms,
  getRecommendedToneForPlatform,
} from "@/lib/social/platform-generation-recommendations";
import { TONE_STYLE_CONFIGS } from "@/lib/social/tone-style-config";
import { PlatformSelectionCheckboxes } from "@/components/articles/platform-selection-checkboxes";
import { generateSelectedPlatformPostsAction, generateAllPlatformPostsAction } from "@/app/articles/[id]/actions";
import { ConfirmSubmitButton } from "@/app/articles/[id]/confirm-submit-button";

export const dynamic = "force-dynamic";

const MIN_SOURCE_COUNT = 3;

const COST_LEVEL_LABELS: Record<PlatformCostLevel, string> = {
  low: "낮음",
  medium: "중간",
  high: "높음",
};

/** Phase 3-23-4: 플랫폼 카드 상태 배지 색상 — 5색 체계(회색/노랑/초록)만 사용한다. */
const PLATFORM_CARD_TONE_CLASSES = {
  none: "bg-zinc-100 text-zinc-600",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
} as const;

interface PlatformCardInfo {
  platform: SocialPlatform;
  label: string;
  recommended: boolean;
  costLevel: PlatformCostLevel;
  statusLabel: string;
  toneClass: string;
  nextActionLabel: string;
  actionNode: ReactNode;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    themeId?: string;
    sourceError?: string;
    deleteMessage?: string;
    deleteError?: string;
    error?: string;
    publishMessage?: string;
    generated?: string;
    generatedMode?: string;
    regenerateConfirm?: string;
    pendingMode?: string;
    existingMode?: string;
  }>;
}) {
  const {
    themeId,
    sourceError,
    deleteMessage,
    deleteError,
    error: generationError,
    publishMessage,
    generated,
    generatedMode,
    regenerateConfirm,
    pendingMode,
    existingMode,
  } = await searchParams;
  const themes = await getThemes();
  const themeRelatedCounts = await Promise.all(themes.map((theme) => getThemeRelatedCounts(theme.id)));
  // Phase 3-23-3: 동일 제목 테마도 구분할 수 있도록 출처 수/진행 단계/등록일을 함께 계산한다.
  const themeListEntries = themes.map((theme, index) => ({
    theme,
    articleCount: themeRelatedCounts[index].articleCount,
    sourceCount: themeRelatedCounts[index].sourceCount,
    stageLabel: describeThemeStageLabel(themeRelatedCounts[index]),
    dateLabel: new Date(theme.createdAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }),
  }));

  const selectedTheme =
    (themeId && themes.find((theme) => theme.id === themeId)) ||
    themes[themes.length - 1];

  let sources: Source[] = [];
  let article: Article | undefined;
  let sourceCheck: ContractCheckRecord | undefined;
  let articleCheck: ContractCheckRecord | undefined;

  if (selectedTheme) {
    [sources, article, sourceCheck, articleCheck] = await Promise.all([
      getSourcesByThemeId(selectedTheme.id),
      getArticleByThemeId(selectedTheme.id),
      getLatestContractCheck(selectedTheme.id, "source"),
      getLatestContractCheck(selectedTheme.id, "article"),
    ]);
  }

  // Phase 3-23: "다음 작업" 카드와 "플랫폼별 글 생성" 영역에서 쓰기 위해
  // 이 테마의 기사로 생성된 플랫폼별 글(social_posts) 현황을 조회한다.
  // article이 없으면 조회할 대상이 없으므로 빈 배열로 둔다.
  const existingSocialPosts = article ? await listSocialPostsByArticle(article.id) : [];
  const approvedSocialPostCount = existingSocialPosts.filter((post) => post.approvalStatus === "approved").length;
  const pendingReviewSocialPostCount = existingSocialPosts.filter(
    (post) => post.approvalStatus !== "approved"
  ).length;

  const logs = await getLogs(20);

  const sourceStatus = summarizeSourceStatus(sources, MIN_SOURCE_COUNT);

  // Phase 3-23-2: 대시보드의 상태 판단 기준은 이 workflowState 하나뿐이다.
  // 예전에 있던 nextActionState(3단계)와 나란히 두면 두 상태가 서로 다른
  // 결론을 낼 수 있어(예: "기사 작성 가능"과 "검토 대기"가 동시에 보임)
  // 완전히 제거했다 — 화면의 모든 요약 문구/색상/CTA/섹션 접힘 여부는
  // 반드시 workflowState에서만 파생한다.
  const workflowState = resolveDashboardWorkflowState({
    hasTheme: Boolean(selectedTheme),
    sourceCount: sources.length,
    minRequired: MIN_SOURCE_COUNT,
    hasArticle: Boolean(article),
    socialPostCount: existingSocialPosts.length,
    approvedSocialPostCount,
  });
  const workflowTone = getWorkflowStateTone(workflowState);
  const statusSummary = selectedTheme
    ? getDashboardStatusSummary(workflowState, {
        themeId: selectedTheme.id,
        articleId: article?.id,
        sourceCount: sources.length,
        minSourceCount: MIN_SOURCE_COUNT,
        pendingReviewCount: pendingReviewSocialPostCount,
        approvedCount: approvedSocialPostCount,
      })
    : null;
  const sectionExpansion = getDashboardSectionExpansion(workflowState);
  // Phase 3-23-4: "현재 단계"에 해당하는 관리 영역만 상단에 크게 펼치고,
  // 나머지는 "다른 단계 관리 보기" accordion 안으로 옮긴다 — 대시보드가
  // "긴 폼을 세로로 나열한 화면"처럼 보이지 않게 하기 위함이다.
  const currentStepArea = getDashboardCurrentStepArea(workflowState);

  const existingPlatforms = new Set(existingSocialPosts.map((post) => post.platform));
  const recommendedPlatformsForDashboard = new Set(getRecommendedPlatforms());
  const platformSelectionOptions = SOCIAL_PLATFORMS.map((platform) => ({
    value: platform,
    label: PLATFORM_LABELS[platform],
    description: PLATFORM_SHORT_DESCRIPTIONS[platform],
    costLevel: PLATFORM_COST_LEVELS[platform],
    statusLabel: existingPlatforms.has(platform)
      ? `이미 생성됨 (건너뜀) · 권장 문체 ${TONE_STYLE_CONFIGS[getRecommendedToneForPlatform(platform)].label}`
      : `아직 생성되지 않음 · 권장 문체 ${TONE_STYLE_CONFIGS[getRecommendedToneForPlatform(platform)].label}`,
    recommended: recommendedPlatformsForDashboard.has(platform),
  }));

  // Phase 2-22: 기사초안 생성 결과(성공/실패)를 항상 눈에 보이는 메시지로
  // 표시한다 — "버튼을 눌러도 반응이 없다"는 문제의 재발을 막기 위해서다.
  const generatedModeLabel =
    generated === "1" && generatedMode && isArticleMode(generatedMode)
      ? ARTICLE_MODE_CONFIGS[generatedMode].label
      : null;
  const generationSuccessMessage = generatedModeLabel
    ? `${generatedModeLabel} 기사초안이 생성되었습니다.`
    : null;

  // Phase 3-23-2: 대시보드에서 실행한 플랫폼별 글 생성 결과를 대시보드
  // 자기 자신으로 돌아와 보여주기 위한 메시지(성공 시 publishMessage,
  // 실패 시 error — error는 위 generationError와 같은 배너를 공유한다).
  const platformGenerationMessage = typeof publishMessage === "string" && publishMessage.length > 0 ? publishMessage : null;

  // Phase 3-23-2: "플랫폼별 글 생성" 폼이 결과 확인을 위해 다른 페이지로
  // 강제 이동시키지 않도록, returnTo를 대시보드 자기 자신(+ 현재 테마 +
  // 플랫폼 생성 섹션 앵커)으로 지정한다. lib/navigation/return-to.ts의
  // allowlist에 `/dashboard` 루트를 추가해 두었다.
  const dashboardPlatformGenerationReturnTo = selectedTheme
    ? `/dashboard?themeId=${encodeURIComponent(selectedTheme.id)}#platform-generation`
    : "/dashboard";

  // 재생성 확인 배너에 쓸 라벨. mode 값이 올바르지 않으면(과거 링크 등)
  // 배너를 표시하지 않는다 — 잘못된 값으로 안내하는 것보다 안전하다.
  const pendingModeLabel = pendingMode && isArticleMode(pendingMode) ? ARTICLE_MODE_CONFIGS[pendingMode].label : null;
  const existingModeLabel =
    existingMode && isArticleMode(existingMode) ? ARTICLE_MODE_CONFIGS[existingMode].label : existingMode ?? null;
  const showRegenerateConfirm = regenerateConfirm === "1" && Boolean(pendingModeLabel) && Boolean(selectedTheme);

  // Phase 3-23-4: 플랫폼별 글 생성 영역을 "폼"이 아니라 "카드"로 보여주기
  // 위해, 플랫폼마다 현재 상태/다음 작업/주요 버튼 1개를 미리 계산해
  // 둔다. article이 없으면 카드도 없다(플랫폼별 글 생성 자체가 아직
  // 불가능하므로).
  const platformCards: PlatformCardInfo[] = article
    ? SOCIAL_PLATFORMS.map((platform) => {
        const post = existingSocialPosts.find((p) => p.platform === platform);
        const recommended = recommendedPlatformsForDashboard.has(platform);
        const costLevel = PLATFORM_COST_LEVELS[platform];
        const label = PLATFORM_LABELS[platform];

        if (!post) {
          return {
            platform,
            label,
            recommended,
            costLevel,
            statusLabel: "생성 전",
            toneClass: PLATFORM_CARD_TONE_CLASSES.none,
            nextActionLabel: "글 생성",
            actionNode: (
              <form action={generateSelectedPlatformPostsAction}>
                <input type="hidden" name="articleId" value={article.id} />
                <input type="hidden" name="platforms" value={platform} />
                <input type="hidden" name="toneMode" value="auto_recommended" />
                <input type="hidden" name="returnTo" value={dashboardPlatformGenerationReturnTo} />
                <button
                  type="submit"
                  className="w-full rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  글 생성하기
                </button>
              </form>
            ),
          };
        }

        if (post.approvalStatus !== "approved") {
          return {
            platform,
            label,
            recommended,
            costLevel,
            statusLabel: "검토 대기",
            toneClass: PLATFORM_CARD_TONE_CLASSES.pending,
            nextActionLabel: "글 검토",
            actionNode: (
              <Link
                href={`/articles/${article.id}/social`}
                className="block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-center text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                글 검토하기
              </Link>
            ),
          };
        }

        const isWordPress = platform === "wordpress_blog";
        return {
          platform,
          label,
          recommended,
          costLevel,
          statusLabel: "승인 완료",
          toneClass: PLATFORM_CARD_TONE_CLASSES.approved,
          nextActionLabel: isWordPress ? "WordPress Draft 반영" : "수동 export",
          actionNode: (
            <Link
              href={isWordPress ? `/articles/${article.id}/blog` : `/articles/${article.id}/social`}
              className="block w-full rounded bg-zinc-900 px-2 py-1 text-center text-xs font-medium text-white hover:bg-zinc-700"
            >
              {isWordPress ? "WordPress Draft 반영" : "수동 export 보기"}
            </Link>
          ),
        };
      })
    : [];

  // Phase 3-23-4: workflowState가 ready_for_publish_prep이면 이 섹션을
  // 다른 관리 영역보다 먼저(상단에) 보여준다 — "게시 준비"가 이 단계의
  // 유일한 현재 작업이기 때문이다.
  const publishPrepSection =
    workflowState === "ready_for_publish_prep" && article ? (
      <section className="rounded-lg border border-green-200 bg-green-50 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-green-900">게시 준비</h2>
          <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
            게시 준비 가능
          </span>
        </div>
        <p className="mt-1 break-keep text-sm text-green-800">
          승인된 글이 {approvedSocialPostCount}개 있습니다. WordPress Draft 반영 또는 수동 export를 진행할 수
          있습니다.
        </p>
        {platformCards.filter((card) => card.statusLabel !== "생성 전").length > 0 && (
          <ul className="mt-3 flex flex-col gap-1">
            {platformCards
              .filter((card) => card.statusLabel !== "생성 전")
              .map((card) => (
                <li
                  key={card.platform}
                  className="flex items-center justify-between rounded bg-white px-2 py-1 text-xs text-zinc-700"
                >
                  <span className="font-medium">{card.label}</span>
                  <span className="text-zinc-500">
                    {card.statusLabel} · {card.nextActionLabel}
                  </span>
                </li>
              ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/articles/${article.id}/blog`}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            WordPress Draft 반영
          </Link>
          <Link
            href={`/articles/${article.id}/social`}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            수동 export 보기
          </Link>
          <Link
            href={`/articles/${article.id}/social`}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            플랫폼 글 관리
          </Link>
        </div>
      </section>
    ) : null;

  // Phase 3-23-4: "출처 관리"(출처 상태 요약/출처 등록/출처 목록)를
  // 하나의 블록으로 합쳤다. 출처 목록은 어떤 단계에서도 기본으로 전체를
  // 펼치지 않는다 — 개수/최근 1~2개 제목만 보여주고 "전체 출처 보기"
  // 토글로 펼친다(원래 목록 UI는 그대로 두고 <details>로만 감쌌다).
  const recentSources = sources.slice(0, 2);
  const sourceManagementBlock = selectedTheme ? (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-700">출처 관리</h2>
      <p className="mt-1 text-xs text-zinc-600">
        출처 {sourceStatus.total}개 등록됨 · 최소 {sourceStatus.minRequired}개{" "}
        {sourceStatus.isReady ? "충족" : "미충족"} · 본문 수집 완료 {sourceStatus.fetchSuccessCount}개 · 요약 완료{" "}
        {sourceStatus.summarySuccessCount}개
        {sourceStatus.fetchFailedCount + sourceStatus.summaryFailedCount > 0 &&
          ` · 실패 ${sourceStatus.fetchFailedCount + sourceStatus.summaryFailedCount}개`}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            sourceStatus.isReady ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {sourceStatus.isReady ? "조건 충족" : "출처 부족"}
        </span>
      </div>

      {/* 출처 추가 — 기본은 "+ 출처 추가"만 보이고, 열면 URL 중심의
          compact 폼이 나온다. 제목/출판사/발행일/요약은 "추가 정보
          입력(선택)" 안에 접어둔다(URL만 입력해도 서버에서 본문/요약을
          자동 수집한다). */}
      {sourceError && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {sourceError}
        </div>
      )}
      <details className="group mt-3" open={Boolean(sourceError) || sectionExpansion.sourceAddExpanded}>
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-zinc-700 [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">+ 출처 추가</span>
          <span className="hidden group-open:inline">출처 추가 폼 접기</span>
        </summary>
        <form action={addSource} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="themeId" value={selectedTheme.id} />
          <label className="flex flex-col gap-1 text-xs text-zinc-600">
            URL
            <input
              id="source-url-input"
              name="url"
              type="url"
              placeholder="https://example.com/article (URL만 입력해도 본문/요약이 자동 수집됩니다)"
              className="rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </label>
          <details className="mt-1">
            <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-800">
              추가 정보 입력 (선택)
            </summary>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                제목
                <input name="title" placeholder="출처 제목" className="rounded border border-zinc-300 px-2 py-1 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                출판사 / 기관명
                <input
                  name="publisher"
                  placeholder="예: OpenAI Blog"
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                발행일
                <input name="publishedAt" type="date" className="rounded border border-zinc-300 px-2 py-1 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600 sm:col-span-2">
                요약
                <textarea
                  name="summary"
                  rows={2}
                  placeholder="출처 내용 요약"
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                />
              </label>
            </div>
          </details>
          <div className="mt-1">
            <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
              출처 추가
            </button>
          </div>
        </form>
      </details>

      {/* 출처 목록 — Phase 3-23-4: 기본으로 전체를 펼치지 않는다. 최근
          1~2개 제목만 미리 보여주고, "전체 출처 보기"를 눌러야 전체
          목록(도메인/요약/본문/뱃지 등 기존 UI 그대로)이 펼쳐진다. */}
      <div className="mt-3">
        {sources.length === 0 ? (
          <p className="text-xs text-zinc-500">아직 등록된 출처가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-0.5 text-xs text-zinc-500">
            {recentSources.map((source) => (
              <li key={source.id} className="truncate">
                · {source.title || "(제목 없음)"}
              </li>
            ))}
          </ul>
        )}
        <details className="mt-1.5">
          <summary className="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-800">
            전체 출처 보기 ({sources.length}개)
          </summary>
          {sources.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">아직 등록된 출처가 없습니다.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {sources.map((source, index) => (
                <li key={source.id} className="rounded border border-zinc-200 px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 break-keep font-medium">
                      {index + 1}. {source.title || "(제목 없음)"}
                    </p>
                    <div className="flex shrink-0 gap-1">
                      <FetchStatusBadge status={source.fetchStatus} error={source.fetchError} />
                      <SummaryStatusBadge status={source.summaryStatus} summarizedAt={source.summarizedAt} />
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {extractDomain(source.url)}
                    {source.publishedAt && ` · ${source.publishedAt}`}
                  </p>
                  {source.summary && (
                    <p className="mt-1 line-clamp-2 break-keep text-xs leading-relaxed text-zinc-600">{source.summary}</p>
                  )}
                  {source.fetchStatus === "failed" && source.fetchError && (
                    <p className="mt-1 text-xs text-red-600">수집 오류: {source.fetchError}</p>
                  )}
                  {source.summaryStatus === "failed" && source.summaryError && (
                    <p className="mt-0.5 text-xs text-orange-600">요약 오류: {source.summaryError}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        원문 열기
                      </a>
                    )}
                    {/* 삭제 기능은 이번 작업에서 추가하지 않았다 — sources 테이블에는
                        soft delete용 archived_at 컬럼이 없고, 이 작업의 원칙(DB
                        schema 변경 금지)상 새 컬럼을 추가할 수 없다. hard delete는
                        이 프로젝트 전반의 soft-delete 우선 원칙과 맞지 않아
                        의도적으로 보류했다(문서 참고). */}
                  </div>
                  {source.summary && (
                    <details className="mt-1 text-xs">
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800">요약 전체 보기</summary>
                      <p className="mt-1 break-keep leading-relaxed text-zinc-600">{source.summary}</p>
                    </details>
                  )}
                  {source.rawContent && (
                    <details className="mt-1 text-xs">
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800">본문 보기</summary>
                      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-2 text-xs leading-relaxed text-zinc-700">
                        {source.rawContent}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </details>
      </div>
    </section>
  ) : null;

  // Phase 3-23-4: "계약 검사 & 기사 초안 생성"과 "기사 초안" 두 섹션을
  // "출처 기반 원고" 하나로 합쳤다. article이 없으면 생성 폼을 그대로
  // 보여주고, article이 있으면 요약 카드 + "재생성 옵션" 토글(기본 접힘)
  // 안에 같은 폼을 넣는다 — 라디오 버튼이 계속 노출되어 혼란을 주지
  // 않게 하기 위함이다.
  const draftModeLabel = article
    ? ARTICLE_MODE_LIST.find((m) => m.id === article.articleMode)?.label ?? article.articleMode
    : null;
  const draftManagementBlock = selectedTheme ? (
    <section
      id="generate-draft"
      tabIndex={-1}
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-indigo-500"
    >
      <h2 className="text-sm font-semibold text-zinc-700">출처 기반 원고</h2>

      {/* Phase 2-22: 이미 이 테마로 생성된 기사가 있는 상태에서 기사초안
          생성을 누르면, 조용히 덮어쓰거나 무반응으로 끝나지 않고 항상
          이 확인 배너를 먼저 보여준다. */}
      {showRegenerateConfirm && (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">이미 이 테마로 생성된 기사초안이 있습니다.</p>
          <p className="mt-1 break-keep">
            현재 초안: <span className="font-medium">{existingModeLabel ?? "알 수 없음"}</span> · 선택한 유형:{" "}
            <span className="font-medium">{pendingModeLabel}</span>
          </p>
          <p className="mt-1 break-keep text-xs text-amber-700">
            {existingModeLabel === pendingModeLabel
              ? "같은 유형으로 다시 생성하면 기존 미승인 초안(draft)은 새 초안으로 교체됩니다(이미 검토·승인된 기사는 유지됩니다)."
              : `기존 초안을 유지하고 ${pendingModeLabel} 초안을 새로 생성하시겠습니까? 기존 미승인 초안(draft)은 새 초안으로 교체됩니다(이미 검토·승인된 기사는 유지됩니다).`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/dashboard?themeId=${selectedTheme.id}`}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              취소
            </Link>
            <form action={generateArticleDraft}>
              <input type="hidden" name="themeId" value={selectedTheme.id} />
              <input type="hidden" name="articleMode" value={pendingMode} />
              <input type="hidden" name="confirmed" value="true" />
              <button type="submit" className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500">
                새 초안으로 생성
              </button>
            </form>
          </div>
        </div>
      )}

      {!article ? (
        <form action={generateArticleDraft} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="themeId" value={selectedTheme.id} />
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-medium text-zinc-600">글쓰기 모드</legend>
            {ARTICLE_MODE_LIST.map((modeConfig) => (
              <label
                key={modeConfig.id}
                className="flex items-start gap-2 rounded border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
              >
                <input
                  type="radio"
                  name="articleMode"
                  value={modeConfig.id}
                  defaultChecked={modeConfig.id === DEFAULT_ARTICLE_MODE}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-zinc-800">{modeConfig.label}</span>
                  <span className="block text-xs text-zinc-500">{modeConfig.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div>
            <button
              type="submit"
              disabled={sources.length < MIN_SOURCE_COUNT}
              title={
                sources.length < MIN_SOURCE_COUNT
                  ? `출처가 부족합니다 (${sources.length}/${MIN_SOURCE_COUNT}개 등록됨).`
                  : undefined
              }
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300"
            >
              기사 초안 생성
            </button>
            {/* Phase 2-22: disabled 버튼에 이유 없이 회색으로만 표시되던
                문제를 고친다 — title(hover) 뿐 아니라 항상 보이는 텍스트로도
                알려준다. */}
            {sources.length < MIN_SOURCE_COUNT && (
              <p className="mt-1 text-xs text-amber-600">
                출처가 부족합니다 ({sources.length}/{MIN_SOURCE_COUNT}개 등록됨) — 출처를 더 등록해야 기사초안을
                생성할 수 있습니다.
              </p>
            )}
          </div>
        </form>
      ) : (
        <>
          <p className="mt-1 break-keep text-sm text-zinc-600">
            상태: <span className="font-medium text-zinc-800">원고 생성 완료</span> · 유형: {draftModeLabel}
          </p>
          <p className="mt-0.5 break-keep text-sm text-zinc-600">
            제목: <span className="font-medium text-zinc-800">{article.title}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/articles/${article.id}`}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
            >
              원고 보기
            </Link>
          </div>

          {/* Phase 3-23-4: 이미 초안이 있으면 라디오 버튼을 기본으로
              노출하지 않는다 — "재생성 옵션"을 펼쳤을 때만 보인다. */}
          <details className="group mt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-zinc-500 [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">재생성 옵션</span>
              <span className="hidden group-open:inline">재생성 옵션 접기</span>
            </summary>
            <form action={generateArticleDraft} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="themeId" value={selectedTheme.id} />
              <fieldset className="flex flex-col gap-2">
                <legend className="text-xs font-medium text-zinc-600">글쓰기 모드</legend>
                {ARTICLE_MODE_LIST.map((modeConfig) => (
                  <label
                    key={modeConfig.id}
                    className="flex items-start gap-2 rounded border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    <input
                      type="radio"
                      name="articleMode"
                      value={modeConfig.id}
                      defaultChecked={modeConfig.id === article.articleMode}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium text-zinc-800">{modeConfig.label}</span>
                      <span className="block text-xs text-zinc-500">{modeConfig.description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div>
                <button
                  type="submit"
                  className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  기사 초안 재생성
                </button>
                <p className="mt-1 text-xs text-zinc-500">
                  다시 누르면 재생성 여부를 먼저 확인합니다(조용히 덮어쓰지 않습니다).
                </p>
              </div>
            </form>
          </details>
        </>
      )}
    </section>
  ) : null;

  // Phase 3-23-4: "플랫폼별 글 생성"을 체크박스 폼 중심에서 카드 중심으로
  // 바꿨다. 각 카드는 플랫폼명/상태/다음 작업/주요 버튼 1개만 보여준다.
  // 여러 플랫폼을 한 번에 선택해 생성하는 기존 체크박스 폼은 "여러
  // 플랫폼 한 번에 선택해 생성"(고급) 안으로, 전체 생성은 그 안의
  // "고급 옵션"으로 한 번 더 접었다.
  const platformManagementBlock = selectedTheme ? (
    <section
      id="platform-generation"
      tabIndex={-1}
      className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 shadow-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-indigo-500"
    >
      <h2 className="text-sm font-semibold text-zinc-700">플랫폼별 글 생성</h2>
      {!article ? (
        <p className="mt-2 text-xs text-zinc-500">먼저 기사 초안(출처 기반 원고)을 생성해야 플랫폼별 글을 만들 수 있습니다.</p>
      ) : (
        <>
          {/* Phase 3-23-2: 대시보드에서 실행한 생성 결과를 대시보드
              안에서 바로 확인할 수 있게, 결과 메시지를 토스트뿐 아니라
              이 섹션에도 그대로 남겨둔다(새로고침해도 토스트처럼
              사라지지 않는다). */}
          {platformGenerationMessage && (
            <div className="mt-2 rounded border border-green-200 bg-green-50 p-3 text-xs text-green-800">
              <p className="font-medium">플랫폼 글 생성 결과</p>
              <p className="mt-1 break-keep">{platformGenerationMessage}</p>
              <Link href={`/articles/${article.id}/social`} className="mt-2 inline-block text-blue-600 hover:text-blue-800">
                생성된 글 보기
              </Link>
            </div>
          )}

          {/* 플랫폼 카드 — 이 화면의 핵심 영역. */}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {platformCards.map((card) => (
              <div key={card.platform} className="rounded border border-zinc-200 bg-white p-3 text-xs">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium text-zinc-800">{card.label}</span>
                  {card.recommended && (
                    <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                      추천
                    </span>
                  )}
                </div>
                <p className="mt-1.5">
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${card.toneClass}`}>
                    상태: {card.statusLabel}
                  </span>
                </p>
                <p className="mt-1 text-zinc-500">다음 작업: {card.nextActionLabel}</p>
                <p className="text-zinc-400">예상 비용: {COST_LEVEL_LABELS[card.costLevel]}</p>
                <div className="mt-2">{card.actionNode}</div>
              </div>
            ))}
          </div>

          {/* 여러 플랫폼을 한 번에 선택해 생성하고 싶을 때만 펼치는 고급
              선택 폼 — needs_platform_posts(아직 아무것도 생성 안 됨)
              단계에서는 기본으로 펼쳐 둔다. */}
          <details className="mt-3" open={sectionExpansion.platformGenerationExpanded}>
            <summary className="cursor-pointer text-xs font-medium text-zinc-500">여러 플랫폼 한 번에 선택해 생성</summary>
            <p className="mt-1 break-keep text-xs text-zinc-500">
              필요한 플랫폼만 선택해 글을 생성할 수 있습니다. 전체 생성은 API 사용량이 늘어날 수 있으므로 필요한
              플랫폼만 선택하는 것을 권장합니다. 기본 추천: WordPress 블로그 · 네이버 블로그 · 네이버 카페 (X ·
              Threads · Instagram은 기본 제외).
            </p>

            <form action={generateSelectedPlatformPostsAction} className="mt-3">
              <input type="hidden" name="articleId" value={article.id} />
              {/* Phase 3-23-2: 결과 확인을 위해 /articles/[id]로 강제
                  이동시키지 않는다 — 대시보드 자기 자신(+ 현재 테마 +
                  플랫폼 생성 섹션 앵커)으로 돌아온다. */}
              <input type="hidden" name="returnTo" value={dashboardPlatformGenerationReturnTo} />
              <input type="hidden" name="toneMode" value="auto_recommended" />

              <PlatformSelectionCheckboxes options={platformSelectionOptions} />

              <p className="mt-2 text-[11px] text-zinc-400">
                문체 설정: 추천 문체 자동 적용(기본값) — 플랫폼마다 어울리는 문체가 자동으로 적용됩니다. 문체를
                직접 고르고 싶다면 기사 상세 페이지의 플랫폼별 글 생성 영역에서 고급 옵션을 사용하세요.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  선택한 플랫폼 글 생성
                </button>
                <span className="text-[11px] text-zinc-400">
                  이미 생성된 플랫폼은 자동으로 건너뜁니다(조용히 덮어쓰지 않습니다).
                </span>
              </div>
            </form>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-zinc-500">고급 옵션: 전체 플랫폼 글 생성</summary>
              <form action={generateAllPlatformPostsAction} className="mt-2">
                <input type="hidden" name="articleId" value={article.id} />
                <input type="hidden" name="returnTo" value={dashboardPlatformGenerationReturnTo} />
                <input type="hidden" name="toneMode" value="auto_recommended" />
                <input type="hidden" name="confirmed" value="true" />
                <ConfirmSubmitButton
                  confirmMessage={[
                    "전체 플랫폼 글을 생성하면 WordPress 블로그, 네이버 블로그, 네이버 카페, X, Threads, Instagram 글을 한 번에 생성합니다.",
                    "긴 블로그 글과 카드형 글이 포함될 경우 API 사용량이 증가할 수 있습니다.",
                    "필요한 플랫폼만 선택해서 생성하는 것을 권장합니다.",
                    "그래도 전체 생성하시겠습니까?",
                  ].join("\n\n")}
                  className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  전체 플랫폼 글 생성
                </ConfirmSubmitButton>
              </form>
            </details>
          </details>

          {existingSocialPosts.length > 0 && (
            <p className="mt-3 text-xs text-zinc-500">
              생성된 글 {existingSocialPosts.length}개 · 검토 대기 {pendingReviewSocialPostCount}개 · 승인 완료{" "}
              {approvedSocialPostCount}개 —{" "}
              <Link href={`/articles/${article.id}/social`} className="text-blue-600 hover:text-blue-800">
                검토/승인하러 가기
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  ) : null;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <ContentProgressSteps
            current={
              workflowState === "needs_theme"
                ? "theme"
                : workflowState === "needs_source"
                  ? "sources"
                  : workflowState === "ready_for_publish_prep"
                    ? "publish_ready"
                    : workflowState === "needs_review"
                      ? "review"
                      : "generate"
            }
          />
          {/* 항상 보이는 버튼은 "자동 테마 찾기"/"기사 목록" + 대시보드 메뉴
              뿐이다 — 나머지(콘텐츠/블로그/리라이트/성과/운영 설정)는
              드롭다운 메뉴 안에서 확인한다(Phase 1-22). */}
          <DashboardTopNav active={null} />
        </header>

        <TransientNotice message={deleteMessage} variant="success" />
        <TransientNotice message={deleteError} variant="error" />
        <TransientNotice message={generationSuccessMessage} variant="success" />
        <TransientNotice message={generationError} variant="error" />
        <TransientNotice message={platformGenerationMessage} variant="success" />

        {/*
          Phase 1-23: "선택한 테마 중심 작업형 대시보드"로 재구성.
          Phase 3-23-4: 우측 작업 영역은 이제 "현재 단계만 크게, 나머지는
          접힘"으로 재배열된다 — 고정된 세로 나열이 아니라 workflowState에
          따라 순서/펼침 상태가 바뀐다(자세한 내용은 아래 <main> 참고).
          모바일에서는 이 grid가 flex-col로 바뀌어 위 순서 그대로 1열로
          쌓인다 — 왼쪽 사이드바(테마 목록)는 항상 맨 아래로 밀린다.
        */}
        <div className="flex flex-col-reverse gap-6 lg:grid lg:grid-cols-[280px_1fr]">
          {/* 좌측: 테마 검색/선택 + 새 테마 입력(기본 접힘) */}
          <aside className="flex flex-col gap-6">
            <details className="group rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-zinc-700 [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">+ 새 테마</span>
                <span className="hidden group-open:inline">새 테마 입력 접기</span>
              </summary>
              <form action={createTheme} className="mt-3 flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-xs text-zinc-600">
                  제목 *
                  <input
                    name="title"
                    required
                    placeholder="예: 2026년 AI 에이전트 동향"
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-600">
                  설명
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="기사에서 다룰 내용을 간단히 설명하세요."
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-600">
                  키워드 (쉼표로 구분)
                  <input
                    name="keywords"
                    placeholder="AI, 에이전트, 자동화"
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-600">
                  언어
                  <select
                    name="language"
                    defaultValue="ko"
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  >
                    <option value="ko">한국어 (ko)</option>
                    <option value="en">English (en)</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="mt-1 rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  테마 생성
                </button>
              </form>
            </details>

            <section
              id="theme-list"
              tabIndex={-1}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-indigo-500"
            >
              <h2 className="text-sm font-semibold text-zinc-700">테마 목록</h2>
              <div className="mt-2">
                <ThemeSearchList
                  items={themeListEntries}
                  selectedThemeId={selectedTheme?.id}
                  archiveAction={archiveThemeAction}
                />
              </div>
            </section>
          </aside>

          {/* 우측: 선택된 테마 작업 영역 */}
          <main className="flex flex-col gap-6">
            {!selectedTheme ? (
              <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
                {/* Phase 3-23-2: "왼쪽에서"는 데스크톱 grid 레이아웃에서만
                    맞는 표현이다 — 모바일에서는 flex-col-reverse로 테마
                    목록/생성 폼이 화면 맨 아래로 밀리므로, 방향에 의존하지
                    않는 중립적인 문구로 바꾼다. */}
                아직 선택된 테마가 없습니다. 테마 목록에서 기존 테마를 선택하거나 새 테마를 추가하세요.
                <div className="mt-3">
                  <a
                    href="#theme-list"
                    className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                  >
                    테마 생성/선택하기
                  </a>
                </div>
              </section>
            ) : (
              <>
                {/* 1. 선택된 테마 요약 카드 */}
                <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="break-keep text-lg font-semibold">{selectedTheme.title}</h2>
                      {selectedTheme.description && (
                        <p className="mt-1 break-keep text-sm text-zinc-600">{selectedTheme.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                        {selectedTheme.keywords.map((keyword) => (
                          <span key={keyword} className="rounded-full bg-zinc-100 px-2 py-0.5">
                            #{keyword}
                          </span>
                        ))}
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5">언어: {selectedTheme.language}</span>
                      </div>
                    </div>
                    {/* Phase 3-23-2: "관련 기사 URL 수집" 버튼이 여기와 아래
                        "현재 상태 / 다음 작업" 카드(needs_source 상태)에
                        중복 표시되던 문제를 없앴다 — 이 화면의 primary/secondary
                        action은 모두 "현재 상태 / 다음 작업" 카드 하나에만
                        둔다. 여기서는 순수 정보(테마 요약)만 보여준다. */}
                  </div>
                  {/* Phase 3-23-2: "기사 작성 가능/불가" 문구는 삭제했다 —
                      이 정보는 바로 아래 "현재 상태 / 다음 작업" 카드가
                      workflowState 하나로 더 정확하게 알려준다. */}
                  <p className="mt-3 text-xs text-zinc-500">
                    출처 {sources.length}개 등록됨 · {sourceStatus.isReady ? "조건 충족" : "출처 부족"}
                  </p>
                </section>

                {/* 2. 현재 상태 / 다음 작업 카드 — 이 화면의 유일한 상태
                    판단 기준인 workflowState 하나로만 문구/색상/CTA를
                    렌더링한다(getDashboardStatusSummary/getWorkflowStateTone). */}
                {statusSummary && (
                  <section className={`rounded-lg border p-4 shadow-sm ${workflowTone.containerClassName}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className={`text-sm font-semibold ${workflowTone.headingClassName}`}>현재 상태 / 다음 작업</h2>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${workflowTone.badgeClassName}`}>
                        {workflowTone.badgeLabel}
                      </span>
                    </div>
                    <p className={`mt-1 break-keep text-sm font-medium ${workflowTone.headingClassName}`}>
                      현재 상태: {statusSummary.headline}
                    </p>
                    <p className={`mt-0.5 break-keep text-sm ${workflowTone.bodyClassName}`}>
                      다음 작업: {statusSummary.nextAction}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {statusSummary.primaryActionHref.startsWith("#") ? (
                        <a
                          href={statusSummary.primaryActionHref}
                          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                        >
                          {statusSummary.primaryActionLabel}
                        </a>
                      ) : (
                        <Link
                          href={statusSummary.primaryActionHref}
                          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                        >
                          {statusSummary.primaryActionLabel}
                        </Link>
                      )}
                      {statusSummary.secondaryActionHref && statusSummary.secondaryActionLabel && (
                        <Link
                          href={statusSummary.secondaryActionHref}
                          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          {statusSummary.secondaryActionLabel}
                        </Link>
                      )}
                    </div>
                  </section>
                )}

                {/* 3. 게시 준비(ready_for_publish_prep 전용) → 4. 현재 단계
                    관리 영역(출처/원고/플랫폼 중 하나만) → 5. 다른 단계
                    관리 보기(접힘) 순서로 배치한다. Phase 3-23-4: 대시보드가
                    "긴 폼을 세로로 나열한 화면"처럼 보이지 않도록, 현재
                    단계가 아닌 영역은 전부 접어서 하나의 accordion에
                    모은다. */}
                {publishPrepSection}
                {currentStepArea === "source" && sourceManagementBlock}
                {currentStepArea === "draft" && draftManagementBlock}
                {currentStepArea === "platform" && platformManagementBlock}

                {/* 세 관리 영역(출처/원고/플랫폼) 중 "현재 단계"가 아닌
                    것들은 모두 여기 하나의 접힘 영역에 모은다 — 항상
                    최소 2개(currentStepArea가 null이면 3개 전부)가
                    여기 들어가므로 이 accordion은 항상 렌더링한다. */}
                <details className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
                    다른 단계 관리 보기 (출처 관리 · 출처 기반 원고 · 플랫폼별 글 생성)
                  </summary>
                  <div className="mt-3 flex flex-col gap-4">
                    {currentStepArea !== "source" && sourceManagementBlock}
                    {currentStepArea !== "draft" && draftManagementBlock}
                    {currentStepArea !== "platform" && platformManagementBlock}
                  </div>
                </details>

                {/* 상세 관리 — 내부 상태값/원문 미리보기/실행 이력처럼 판단에는
                    필요 없지만 확인이 필요할 때만 펼쳐보는 정보(정보 우선순위
                    4순위)를 한 곳에 모은다. */}
                <details className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
                    상세 관리 (계약 검사 결과 · 기사 본문 미리보기 · 실행 이력)
                  </summary>

                  <div className="mt-3 flex flex-col gap-3">
                    <ContractCheckResult label="출처 계약 (source.contract.yaml)" check={sourceCheck} />
                    <ContractCheckResult label="기사 계약 (article.contract.yaml)" check={articleCheck} />
                  </div>

                  {article && (
                    <div className="mt-4">
                      <h3 className="text-xs font-semibold text-zinc-600">기사 본문 미리보기</h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        인용된 출처: {article.citedSourceIds.length}개 · 본문 길이: {article.content.length}자
                      </p>
                      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700">
                        {article.content}
                      </pre>
                    </div>
                  )}

                  <div className="mt-4">
                    <h3 className="text-xs font-semibold text-zinc-600">파이프라인 로그 (실행 이력)</h3>
                    {logs.length === 0 ? (
                      <p className="mt-2 text-xs text-zinc-500">아직 기록된 로그가 없습니다.</p>
                    ) : (
                      <ul className="mt-2 flex flex-col gap-1">
                        {logs.map((log) => (
                          <li key={log.id} className="flex items-start gap-2 rounded px-2 py-1 text-xs">
                            <span
                              className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 font-medium ${
                                log.status === "failed"
                                  ? "bg-red-100 text-red-700"
                                  : log.status === "success"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-zinc-100 text-zinc-700"
                              }`}
                            >
                              {log.type}
                            </span>
                            <span className="text-zinc-600">{log.message}</span>
                            <span className="ml-auto shrink-0 text-zinc-400">
                              {new Date(log.createdAt).toLocaleTimeString("ko-KR")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function SummaryStatusBadge({
  status,
  summarizedAt,
}: {
  status: "pending" | "success" | "failed" | "skipped";
  summarizedAt: string | null;
}) {
  if (status === "success") {
    const time = summarizedAt ? new Date(summarizedAt).toLocaleTimeString("ko-KR") : "";
    return (
      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700" title={`요약 완료: ${time}`}>
        요약 완료
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
        요약 실패
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
        요약 건너뜀
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
      요약 대기
    </span>
  );
}

function FetchStatusBadge({
  status,
  error,
}: {
  status: "pending" | "success" | "failed";
  error: string | null;
}) {
  if (status === "success") {
    return (
      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        본문 수집 완료
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
        title={error ?? undefined}
      >
        수집 실패
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      수집 대기
    </span>
  );
}

function ContractCheckResult({
  label,
  check,
}: {
  label: string;
  check?: ContractCheckRecord;
}) {
  if (!check) {
    return (
      <div className="rounded border border-zinc-200 px-3 py-2 text-xs text-zinc-500">
        {label}: 아직 검사하지 않았습니다.
      </div>
    );
  }

  const { passed, violations } = check;

  return (
    <div
      className={`rounded border px-3 py-2 text-xs ${
        passed ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className={passed ? "text-green-700" : "text-red-700"}>
          {passed ? "통과" : `실패 (${violations.length}건)`}
        </span>
      </div>
      {!passed && (
        <ul className="mt-1 list-inside list-disc text-red-700">
          {violations.map((violation, index) => (
            <li key={`${violation.ruleId}-${index}`}>{violation.message}</li>
          ))}
        </ul>
      )}
      <div className="mt-1 text-zinc-400">
        검사 시각: {new Date(check.checkedAt).toLocaleTimeString("ko-KR")}
      </div>
    </div>
  );
}
