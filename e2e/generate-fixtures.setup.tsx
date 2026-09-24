// QA-01: browser smoke test용 정적 HTML fixture를 실제로 굽는(bake)
// 단계. Playwright 프로세스 안에서는 JSX를 로드할 수 없어(playwright
// 자체 jsx-runtime과 충돌 — e2e/support/render-fixture.ts 주석 참고)
// Vitest(이미 프로젝트 전체가 검증된 JSX/경로 alias 파이프라인)로 미리
// HTML을 만들어 e2e/.generated/에 저장한다. `it`은 파일을 쓰는 부수
// 효과만 갖고, "파일이 실제로 생성됐다"만 최소 확인한다 — 실제 browser
// 검증(Playwright)은 별도 *.spec.ts에서 그 결과 파일을 연다.

import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { writeFixtureFile, GENERATED_DIR } from "./support/render-fixture";
import { FIXTURE_NAMES } from "./support/fixture-names";

import { PublishGuardIssueList } from "@/components/wordpress/publish-guard-issue-list";
import { ProcessLogEntryItem } from "@/components/wordpress/process-log-entry-item";
import { NextActionPanel } from "@/components/workflow/next-action-panel";
import { MultiPlatformReviewSummaryCard } from "@/components/review/multi-platform-review-summary-card";
import { PublishPreparationSummaryCard } from "@/components/publish/publish-preparation-summary-card";
import { InlinePostBodyEditor } from "@/components/social/inline-post-body-editor";
import { PostBodyActionRow } from "@/components/social/post-body-action-row";
import { DashboardTopNav } from "@/components/navigation/dashboard-top-nav";
import SettingsPage from "@/app/dashboard/settings/page";
import { ContentProgressSteps, type ContentProgressStep } from "@/components/articles/content-progress-steps";
import {
  getDashboardStatusSummary,
  getWorkflowStateTone,
} from "@/lib/dashboard/dashboard-workflow-presentation";
import type { DashboardWorkflowState } from "@/lib/dashboard/source-display";
import { getJobStatusLabel } from "@/lib/job-progress/job-progress-labels";

import { describePublishGuardIssues } from "@/lib/social/publish-guard-issue-view";
import { getWordPressPublishPrepState } from "@/lib/social/wordpress-blog-publish-prep-state";
import { fromWordPressPublishPrepState, type NextActionViewModelAction } from "@/lib/ui/next-action-view-model";
import type { MultiPlatformReviewSummary } from "@/lib/ui/multi-platform-review-summary";
import type { MultiPlatformPublishPreparationSummary } from "@/lib/ui/multi-platform-publish-preparation-summary";
import {
  notApprovedPublishPreparation,
  fromPostApprovalNextActionsToPublishPreparation,
} from "@/lib/ui/publish-preparation-view-model";
import { getPostApprovalNextActions } from "@/lib/social/post-approval-next-actions";
import { PlatformPublishPreparationCard } from "@/components/publish/platform-publish-preparation-card";
import { getContentServiceReadiness } from "@/lib/ui/content-service-readiness";
import { describeUnexpectedError } from "@/lib/errors/describe-unexpected-error";
import { JobProgressCard, type JobProgressCardData } from "@/components/job-progress/job-progress-card";
import NotFound from "@/app/not-found";

// PRODUCT-01E 섹션 28: app/dashboard/page.tsx의 workflowState→ContentProgressStep
// 매핑을 fixture QA용으로 그대로 재현한다(로직은 page.tsx가 실제로 쓰는 것과
// 동일 — 새 step 상태를 만들지 않는다).
function toProgressStep(state: DashboardWorkflowState): ContentProgressStep {
  if (state === "needs_theme") return "theme";
  if (state === "needs_source") return "sources";
  if (state === "ready_for_publish_prep") return "publish_ready";
  if (state === "needs_review") return "review";
  return "generate";
}

// app/dashboard/page.tsx의 "현재 상태 / 다음 작업" 카드와 동일한 마크업을
// fixture QA용으로 재현한다 — 문구/색상은 실제 helper(getDashboardStatusSummary/
// getWorkflowStateTone)가 그대로 계산한다(fixture가 문구를 새로 만들지 않는다).
function StatusCardFixture({ state, ctx }: { state: DashboardWorkflowState; ctx: Parameters<typeof getDashboardStatusSummary>[1] }) {
  const summary = getDashboardStatusSummary(state, ctx);
  const tone = getWorkflowStateTone(state);
  return (
    <div>
      <ContentProgressSteps current={toProgressStep(state)} />
      <section className={`mt-3 rounded-lg border p-4 shadow-sm ${tone.containerClassName}`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={`text-sm font-semibold ${tone.headingClassName}`}>현재 상태 / 다음 작업</h2>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone.badgeClassName}`}>{tone.badgeLabel}</span>
        </div>
        <p className={`mt-1 break-keep text-sm font-medium ${tone.headingClassName}`}>현재 상태: {summary.headline}</p>
        <p className={`mt-0.5 break-keep text-sm ${tone.bodyClassName}`}>다음 작업: {summary.nextAction}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white">{summary.primaryActionLabel}</span>
        </div>
      </section>
    </div>
  );
}

function renderAction(action: NextActionViewModelAction, kind: "primary" | "secondary") {
  return (
    <button
      key={action.actionType}
      type="button"
      className={
        kind === "primary"
          ? "rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white"
          : "rounded border border-zinc-300 px-3 py-1.5 text-xs"
      }
    >
      {action.label}
    </button>
  );
}

describe("QA-01: browser fixture 생성", () => {
  it("FIX1 재현 케이스: quality=ready/approval=approved/manual export 미실행이어도 guard가 차단하지 않는다(PublishGuardIssueList issues=[])", () => {
    // 실제 서비스에서 manual export를 실행하지 않은 wordpress_blog는
    // requiresManualExportPrecondition(false)이므로 export_status/
    // export_payload 항목 자체가 checklist에 없다 — 즉 checklist가
    // 비어 있어도(guard를 아직 실행하지 않았어도) blocked 항목이 없다.
    writeFixtureFile(
      FIXTURE_NAMES.guardFix1NotBlocked,
      <div>
        <p className="text-xs text-zinc-500">FIX1 재현: wordpress_blog, quality=ready, approval=approved, manual export 미실행</p>
        <PublishGuardIssueList issues={describePublishGuardIssues([])} />
        <p data-testid="no-issues-marker">확인할 사항 없음(guard가 차단하지 않음)</p>
      </div>
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.guardFix1NotBlocked}.html`))).toBe(true);
  });

  it("정상 blocked 케이스: 실제 blocker 1개를 자연어로 보여준다(raw checklist key 노출 없음)", () => {
    writeFixtureFile(
      FIXTURE_NAMES.guardBlockedNaturalLanguage,
      <PublishGuardIssueList
        issues={describePublishGuardIssues([
          { key: "approval_status_approved", label: "approval_status가 approved", status: "blocked", message: "approval_status가 approved가 아닙니다(pending_review)." },
        ])}
      />
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.guardBlockedNaturalLanguage}.html`))).toBe(true);
  });

  it("guard 실행 예외(social_platform_publish_guard_failed)와 정상 차단(social_platform_publish_guard_blocked)을 나란히 보여준다(라벨이 서로 다름)", () => {
    writeFixtureFile(
      FIXTURE_NAMES.guardExecutionFailure,
      <ul>
        <ProcessLogEntryItem
          entry={{
            id: "log-blocked",
            eventName: "social_platform_publish_guard_blocked",
            status: "success",
            message: "platform publishing guard가 완료되었습니다 (status: blocked).",
            createdAt: "2026-09-19T09:00:00.000Z",
            socialPostId: "post-1",
            category: "publish_guard",
            detailsSummary: "guardStatus=blocked, blockedCount=1",
            rawDetails: { guardStatus: "blocked", guardScore: 82, ready: false, blockedCount: 1 },
          }}
        />
        <ProcessLogEntryItem
          entry={{
            id: "log-failed",
            eventName: "social_platform_publish_guard_failed",
            status: "failed",
            message: "platform publishing guard 실행 실패: DB 연결 실패",
            createdAt: "2026-09-19T09:05:00.000Z",
            socialPostId: "post-1",
            category: "publish_guard",
            detailsSummary: "-",
            rawDetails: { error: "DB 연결 실패" },
          }}
        />
      </ul>
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.guardExecutionFailure}.html`))).toBe(true);
  });

  it("wordpress_blog 승인 완료 상태의 다음 작업은 'WordPress Draft 만들기'다(공개 게시 버튼 아님, primary 1개, dead-end 없음)", () => {
    const prep = getWordPressPublishPrepState({
      bodyExists: true,
      qualityStatus: "ready",
      approvalStatus: "approved",
      draftExists: false,
      featuredImageAttached: false,
      featuredImageWaived: true,
      featuredImageMediaIdPresent: false,
      checklistPrepared: true,
      publishGuardStatus: "not_checked",
    });
    const viewModel = fromWordPressPublishPrepState(prep);
    writeFixtureFile(
      FIXTURE_NAMES.wordpressNextActionReady,
      <NextActionPanel viewModel={viewModel} renderAction={renderAction} />
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.wordpressNextActionReady}.html`))).toBe(true);
  });

  it("Multi-platform 검토 요약 카드", () => {
    const summary: MultiPlatformReviewSummary = {
      total: 4,
      checking: 0,
      ready: 2,
      needsConfirmation: 1,
      blocked: 1,
      failed: 0,
      approved: 1,
      readyPostIds: ["post-1", "post-2"],
      needsConfirmationPostIds: ["post-3"],
      blockedPostIds: ["post-4"],
      failedPostIds: [],
      checkingPostIds: [],
      approvedPostIds: ["post-1"],
      bulkApprovalEligiblePostIds: ["post-2"],
    };
    writeFixtureFile(FIXTURE_NAMES.multiPlatformReviewSummary, <MultiPlatformReviewSummaryCard summary={summary} />);
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.multiPlatformReviewSummary}.html`))).toBe(true);
  });

  it("게시 준비 요약 카드", () => {
    const summary: MultiPlatformPublishPreparationSummary = {
      total: 3,
      notApproved: 0,
      needsAttention: 1,
      needsSetup: 0,
      ready: 1,
      inProgress: 0,
      completed: 1,
      failed: 0,
      postIdsByState: {
        not_approved: [],
        needs_attention: ["post-1"],
        needs_setup: [],
        ready: ["post-2"],
        in_progress: [],
        completed: ["post-3"],
        failed: [],
      },
    };
    writeFixtureFile(FIXTURE_NAMES.publishPreparationSummary, <PublishPreparationSummaryCard summary={summary} />);
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.publishPreparationSummary}.html`))).toBe(true);
  });

  it("X thread inline 편집기(mode=thread) — 페이지 이동 없이 카드 안에서 편집", () => {
    writeFixtureFile(
      FIXTURE_NAMES.xThreadInlineEditor,
      <form>
        <InlinePostBodyEditor
          mode="thread"
          items={[{ text: "첫 번째 트윗입니다." }, { text: "두 번째 트윗입니다." }]}
          maxLengthPerItem={280}
          articleId="article-1"
          socialPostId="post-1"
          returnTo="/articles/article-1/social"
          title="게시용 본문 수정"
          saveAction={async () => {}}
          onCancel={() => {}}
        />
      </form>
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.xThreadInlineEditor}.html`))).toBe(true);
  });

  it("본문 복사/전체 보기/본문 수정 버튼 행(항상 같은 줄, 같은 순서)", () => {
    writeFixtureFile(
      FIXTURE_NAMES.postBodyActionRow,
      <PostBodyActionRow
        articleId="article-1"
        socialPostId="post-1"
        copyText="게시용 본문입니다."
        showExpandToggle={true}
        expanded={false}
        onToggleExpand={() => {}}
        editable={true}
        onEdit={() => {}}
      />
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.postBodyActionRow}.html`))).toBe(true);
  });

  it("PRODUCT-01C: 상단 navigation 트리거 — '메뉴' 라벨, 좁은 화면에서도 줄바꿈/overflow 없음", () => {
    writeFixtureFile(
      FIXTURE_NAMES.dashboardTopNavClosed,
      <header className="flex items-center justify-between gap-3">
        {/* PRODUCT-01H: PRODUCT-01E에서 통일한 사용자 언어(주제/참고자료/
            콘텐츠 만들기)와 일치시킨다 — 이 줄은 실제 페이지 코드가
            아니라 QA fixture용 placeholder 제목이라 프로덕션 동작에는
            영향이 없지만, 용어 일관성 점검(Journey 18) 중 발견되어 함께
            맞춘다. */}
        <p className="text-lg font-semibold">주제 선택 → 참고자료 확인 → 콘텐츠 만들기 → 결과 확인 → 게시 준비</p>
        <DashboardTopNav active={null} />
      </header>
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.dashboardTopNavClosed}.html`))).toBe(true);
  });

  it("PRODUCT-01D: 첫 사용(welcome) 빈 상태 — app/dashboard/page.tsx의 !selectedTheme 분기와 동일한 JSX(DB 의존 없음)", () => {
    // app/dashboard/page.tsx는 Supabase를 직접 조회하는 async 서버
    // 컴포넌트라 fixture 파이프라인(renderToStaticMarkup)으로 통째로
    // 구울 수 없다 — 해당 분기의 JSX를 QA 목적으로만 그대로 재현한다.
    writeFixtureFile(
      FIXTURE_NAMES.dashboardWelcomeEmptyState,
      <section
        data-testid="dashboard-welcome-empty-state"
        className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600"
      >
        <p className="text-base font-semibold text-zinc-800">환영합니다.</p>
        <p className="mt-2 break-keep">주제를 입력하고 참고자료를 확인하면 블로그와 SNS용 콘텐츠를 만들 수 있습니다.</p>
        <ol className="mx-auto mt-4 flex max-w-sm flex-col gap-1.5 text-left text-xs text-zinc-500">
          <li>1. 주제 선택</li>
          <li>2. 참고자료 확인</li>
          <li>3. 콘텐츠 생성</li>
          <li>4. 확인이 필요한 내용 검토</li>
          <li>5. 게시 준비</li>
        </ol>
        <div className="mt-4">
          <a href="#theme-list" className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
            첫 콘텐츠 만들기
          </a>
        </div>
      </section>
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.dashboardWelcomeEmptyState}.html`))).toBe(true);
  });

  it("PRODUCT-01D: /dashboard/settings — 서비스가 정상 준비된 상태(모두 '사용 가능'/'연결됨')", () => {
    const originalEnv = { ...process.env };
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
      process.env.SUPABASE_SECRET_KEY = "secret-key-value";
      process.env.AI_GENERATION_ENABLED = "true";
      process.env.ANTHROPIC_API_KEY = "sk-test-key";
      process.env.WORDPRESS_PUBLISH_ENABLED = "true";
      process.env.WORDPRESS_BASE_URL = "https://example.com";
      process.env.WORDPRESS_USERNAME = "admin";
      process.env.WORDPRESS_APP_PASSWORD = "app-password";
      writeFixtureFile(FIXTURE_NAMES.settingsReady, <SettingsPage />);
    } finally {
      process.env = originalEnv;
    }
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.settingsReady}.html`))).toBe(true);
  });

  it("PRODUCT-01D: /dashboard/settings — WordPress 확인 필요 상태('연결 안 됨'으로 단정하지 않고 확인 요청 문구를 보여준다)", () => {
    const originalEnv = { ...process.env };
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
      process.env.SUPABASE_SECRET_KEY = "secret-key-value";
      process.env.AI_GENERATION_ENABLED = "true";
      process.env.ANTHROPIC_API_KEY = "sk-test-key";
      process.env.WORDPRESS_PUBLISH_ENABLED = "true";
      delete process.env.WORDPRESS_BASE_URL;
      delete process.env.WORDPRESS_USERNAME;
      delete process.env.WORDPRESS_APP_PASSWORD;
      writeFixtureFile(FIXTURE_NAMES.settingsPartial, <SettingsPage />);
    } finally {
      process.env = originalEnv;
    }
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.settingsPartial}.html`))).toBe(true);
  });

  // PRODUCT-01E 섹션 28: Content Creation Experience의 6개 대표 상태.
  const baseCtx = { themeId: "theme-1", articleId: "article-1", sourceCount: 0, minSourceCount: 3, pendingReviewCount: 0, approvedCount: 0 };

  it("PRODUCT-01E A. Step 1 — 주제 없음(needs_theme)", () => {
    writeFixtureFile(FIXTURE_NAMES.creationStepTheme, <StatusCardFixture state="needs_theme" ctx={baseCtx} />);
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.creationStepTheme}.html`))).toBe(true);
  });

  it("PRODUCT-01E B. Step 2 — 주제 있음, 참고자료 없음(needs_source, sourceCount=0)", () => {
    writeFixtureFile(FIXTURE_NAMES.creationStepSources, <StatusCardFixture state="needs_source" ctx={{ ...baseCtx, sourceCount: 0 }} />);
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.creationStepSources}.html`))).toBe(true);
  });

  it("PRODUCT-01E C. Step 3 — 참고자료 준비 완료, 콘텐츠 생성 전(ready_to_generate)", () => {
    writeFixtureFile(
      FIXTURE_NAMES.creationStepSourcesReady,
      <StatusCardFixture state="ready_to_generate" ctx={{ ...baseCtx, sourceCount: 3 }} />
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.creationStepSourcesReady}.html`))).toBe(true);
  });

  it("PRODUCT-01E D. Step 4 — 콘텐츠(플랫폼 글) 생성 준비 완료(needs_platform_posts)", () => {
    writeFixtureFile(
      FIXTURE_NAMES.creationStepGenerateReady,
      <StatusCardFixture state="needs_platform_posts" ctx={{ ...baseCtx, sourceCount: 3 }} />
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.creationStepGenerateReady}.html`))).toBe(true);
  });

  it("PRODUCT-01E E. Generating — 실제 상태 기반 표현(완료/진행 중/대기)만 쓰고 임의 progress %는 없다(섹션 15)", () => {
    writeFixtureFile(
      FIXTURE_NAMES.creationStepGenerating,
      <div>
        <ContentProgressSteps current="generate" />
        <NextActionPanel
          viewModel={{ state: "in_progress", message: "콘텐츠를 만들고 있습니다." }}
          renderAction={renderAction}
          progressContent={
            <ul className="flex flex-col gap-1 text-xs text-zinc-600">
              <li>참고자료 확인: {getJobStatusLabel("completed")}</li>
              <li>본문 작성: {getJobStatusLabel("running")}</li>
              <li>플랫폼별 콘텐츠 준비: {getJobStatusLabel("not_started")}</li>
            </ul>
          }
        />
      </div>
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.creationStepGenerating}.html`))).toBe(true);
  });

  it("PRODUCT-01E F. Generated / next action — 결과 확인 단계(needs_review)", () => {
    writeFixtureFile(
      FIXTURE_NAMES.creationStepGenerated,
      <StatusCardFixture state="needs_review" ctx={{ ...baseCtx, sourceCount: 3, pendingReviewCount: 2 }} />
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.creationStepGenerated}.html`))).toBe(true);
  });

  // PRODUCT-01F 섹션 31: Publish & Connection UX 6개 대표 상태. 전부
  // 기존 helper(getPostApprovalNextActions/fromPostApprovalNextActionsToPublishPreparation/
  // notApprovedPublishPreparation/getWordPressPublishPrepState/
  // getContentServiceReadiness)로 계산한 실제 값을 그대로 구운다.

  it("PRODUCT-01F A. 승인 전 — publish action이 없고 안내만 있다", () => {
    writeFixtureFile(
      FIXTURE_NAMES.publishApprovalRequired,
      <PlatformPublishPreparationCard
        viewModel={notApprovedPublishPreparation("x")}
        platformLabel="X"
        renderAction={(action) => <button type="button">{action.label}</button>}
      />
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.publishApprovalRequired}.html`))).toBe(true);
  });

  it("PRODUCT-01F B. WordPress 승인 완료 — 게시 준비(Draft 만들기)", () => {
    const prep = getWordPressPublishPrepState({
      bodyExists: true,
      qualityStatus: "ready",
      approvalStatus: "approved",
      draftExists: false,
      featuredImageAttached: false,
      featuredImageWaived: true,
      featuredImageMediaIdPresent: false,
      checklistPrepared: true,
      publishGuardStatus: "not_checked",
    });
    const viewModel = fromWordPressPublishPrepState(prep);
    const readiness = getContentServiceReadiness().wordpressAvailable;
    writeFixtureFile(
      FIXTURE_NAMES.publishWordpressReady,
      <div>
        <p className="text-xs text-zinc-600">
          게시 방식: 초안으로 저장 · WordPress 연결: <span className="font-medium">{readiness.message}</span>
        </p>
        <NextActionPanel viewModel={viewModel} renderAction={renderAction} />
      </div>
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.publishWordpressReady}.html`))).toBe(true);
  });

  it("PRODUCT-01F C. WordPress Draft 성공 — '초안 저장 완료', 공개 게시로 오해하지 않음", () => {
    writeFixtureFile(
      FIXTURE_NAMES.publishWordpressDraftComplete,
      <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        <p className="font-medium">✓ WordPress 초안이 저장되었습니다.</p>
        <p className="mt-1 text-xs text-green-700">공개 게시는 하지 않았습니다 — WordPress 관리자 화면에서 직접 게시해야 공개됩니다.</p>
        <a href="#" className="mt-2 inline-block rounded border border-green-300 bg-white px-2 py-1 text-xs font-medium text-green-700">
          WordPress에서 초안 보기
        </a>
      </div>
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.publishWordpressDraftComplete}.html`))).toBe(true);
  });

  it("PRODUCT-01F D. Copy 플랫폼(X) — 본문 복사 후 외부 직접 게시 안내", () => {
    const nextActions = getPostApprovalNextActions({ platform: "x", apiConfigured: false });
    const viewModel = fromPostApprovalNextActionsToPublishPreparation("x", nextActions, "not_published");
    writeFixtureFile(
      FIXTURE_NAMES.publishCopyReady,
      <PlatformPublishPreparationCard
        viewModel={viewModel}
        platformLabel="X"
        renderAction={(action) => <button type="button">{action.label}</button>}
      />
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.publishCopyReady}.html`))).toBe(true);
  });

  it("PRODUCT-01F E. Manual 플랫폼(네이버 블로그) — 콘텐츠 확인 후 외부 게시 안내", () => {
    const nextActions = getPostApprovalNextActions({ platform: "naver_blog" });
    const viewModel = fromPostApprovalNextActionsToPublishPreparation("naver_blog", nextActions, "not_published");
    writeFixtureFile(
      FIXTURE_NAMES.publishManualReady,
      <PlatformPublishPreparationCard
        viewModel={viewModel}
        platformLabel="네이버 블로그"
        renderAction={(action) => <button type="button">{action.label}</button>}
      />
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.publishManualReady}.html`))).toBe(true);
  });

  it("PRODUCT-01F F. Blocked — 게시 전 확인할 사항이 primary action보다 먼저 보인다", () => {
    writeFixtureFile(
      FIXTURE_NAMES.publishBlocked,
      <PublishGuardIssueList
        issues={describePublishGuardIssues([
          { key: "approval_status_approved", label: "approval_status가 approved", status: "blocked", message: "approval_status가 approved가 아닙니다(pending_review)." },
        ])}
      />
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.publishBlocked}.html`))).toBe(true);
  });

  // PRODUCT-01G 섹션 31: Friendly Errors & Empty States 대표 상태.
  // 전부 실제 helper(describeUnexpectedError/JobProgressCard/NotFound)로
  // 계산·렌더링한 결과를 그대로 굽는다.

  it("PRODUCT-01G A. 참고자료 일부 수집 실패 — 성공/실패 건수를 구분하고 raw 오류를 감춘다", () => {
    writeFixtureFile(
      FIXTURE_NAMES.errorSourceFetchPartialFailure,
      <div className="max-w-md text-xs text-zinc-600">
        <p>본문 수집 완료 1개 · 실패 1개</p>
        <ul className="mt-2 flex flex-col gap-2">
          <li className="rounded border border-zinc-200 px-3 py-2">
            <p className="font-medium">성공한 참고자료</p>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">본문 수집 완료</span>
          </li>
          <li className="rounded border border-zinc-200 px-3 py-2">
            <p className="font-medium">실패한 참고자료</p>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">수집 실패</span>
            <p className="mt-1 text-xs text-red-600">
              수집 오류:{" "}
              {describeUnexpectedError("TypeError: Failed to fetch", "이 참고자료를 불러오지 못했습니다.").userMessage}
            </p>
          </li>
        </ul>
      </div>
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.errorSourceFetchPartialFailure}.html`))).toBe(true);
  });

  it("PRODUCT-01G B. AI 콘텐츠 생성 실패 — 행동 중심 메시지로 변환된다", () => {
    const friendly = describeUnexpectedError(
      "Cannot read properties of undefined (reading 'content')",
      "콘텐츠를 만드는 중 문제가 발생했습니다. 작성되지 않은 콘텐츠는 저장되지 않았으며, 기존 자료와 콘텐츠는 그대로 유지됩니다."
    ).userMessage;
    writeFixtureFile(
      FIXTURE_NAMES.errorGenerationFailure,
      <div className="max-w-md rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{friendly}</div>
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.errorGenerationFailure}.html`))).toBe(true);
  });

  it("PRODUCT-01G C. Structured output 실패 — JSON/schema 같은 기술 용어가 사용자 화면에 없다", () => {
    const friendly = describeUnexpectedError(
      "AI 응답을 JSON으로 파싱하지 못했습니다.",
      "콘텐츠 생성 결과를 정상적으로 처리하지 못했습니다."
    ).userMessage;
    writeFixtureFile(
      FIXTURE_NAMES.errorStructuredOutputFailure,
      <div className="max-w-md rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{friendly}</div>
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.errorStructuredOutputFailure}.html`))).toBe(true);
  });

  it("PRODUCT-01G D. WordPress Draft 실패 — 공개 여부와 데이터 보존을 함께 안내한다", () => {
    writeFixtureFile(
      FIXTURE_NAMES.errorWordpressDraftFailure,
      <div className="max-w-md rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        <p className="font-medium">WordPress에 초안을 저장하지 못했습니다.</p>
        <p className="mt-1 text-xs text-red-700">작성한 콘텐츠는 앱에 그대로 저장되어 있습니다. 콘텐츠는 공개되지 않았습니다.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white">
            다시 시도
          </button>
          <a href="/dashboard/settings" className="rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700">
            설정에서 상태 확인
          </a>
        </div>
      </div>
    );
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.errorWordpressDraftFailure}.html`))).toBe(true);
  });

  it("PRODUCT-01G E. Job stalled — failed로 오표시하지 않는다", () => {
    const jobRun: JobProgressCardData = {
      id: "job-run-1",
      jobType: "wordpress_auto_prep",
      status: "running",
      currentStepLabel: "대표 이미지 상태 확인 중",
      totalSteps: 10,
      completedSteps: 4,
      progressPercent: 40,
      userMessage: null,
      errorMessage: null,
      errorCategory: null,
      retryable: false,
      nextActionLabel: null,
      nextActionHref: null,
      lastHeartbeatAt: new Date().toISOString(),
      steps: [],
    };
    writeFixtureFile(FIXTURE_NAMES.errorJobStalled, <JobProgressCard jobRun={jobRun} isStalled />);
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.errorJobStalled}.html`))).toBe(true);
  });

  it("PRODUCT-01G H. Not found — raw framework 404 대신 행동 중심 안내(app/not-found.tsx 그대로 재사용)", () => {
    writeFixtureFile(FIXTURE_NAMES.errorNotFound, <NotFound />);
    expect(existsSync(path.join(GENERATED_DIR, `${FIXTURE_NAMES.errorNotFound}.html`))).toBe(true);
  });
});
