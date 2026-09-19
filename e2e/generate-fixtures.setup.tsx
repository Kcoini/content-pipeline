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

import { describePublishGuardIssues } from "@/lib/social/publish-guard-issue-view";
import { getWordPressPublishPrepState } from "@/lib/social/wordpress-blog-publish-prep-state";
import { fromWordPressPublishPrepState, type NextActionViewModelAction } from "@/lib/ui/next-action-view-model";
import type { MultiPlatformReviewSummary } from "@/lib/ui/multi-platform-review-summary";
import type { MultiPlatformPublishPreparationSummary } from "@/lib/ui/multi-platform-publish-preparation-summary";

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
});
