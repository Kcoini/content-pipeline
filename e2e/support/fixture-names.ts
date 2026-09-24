// QA-01: Vitest(e2e/generate-fixtures.setup.test.tsx)가 실제로 만드는
// fixture 파일 이름과, Playwright *.spec.ts가 여는 파일 이름을 하나의
// 목록으로 공유한다(오타로 인한 불일치 방지). 이 파일은 순수 문자열
// 상수만 가지므로 어느 프로세스에서 import해도 안전하다.
export const FIXTURE_NAMES = {
  guardFix1NotBlocked: "guard-fix1-not-blocked",
  guardBlockedNaturalLanguage: "guard-blocked-natural-language",
  guardExecutionFailure: "guard-execution-failure",
  wordpressNextActionReady: "wordpress-next-action-ready",
  multiPlatformReviewSummary: "multi-platform-review-summary",
  publishPreparationSummary: "publish-preparation-summary",
  xThreadInlineEditor: "x-thread-inline-editor",
  postBodyActionRow: "post-body-action-row",
  // PRODUCT-01C: navigation trigger("메뉴")가 실제로 렌더링되는지 확인.
  // 드롭다운은 client-side useState로 열리므로(hydration 없이는 동작
  // 안 함 — render-fixture.ts 주석 참고) 기본(닫힘) 상태만 굽는다.
  dashboardTopNavClosed: "dashboard-top-nav-closed",
  // PRODUCT-01D: 첫 사용(welcome) 빈 상태 — app/dashboard/page.tsx의
  // !selectedTheme 분기와 동일한 JSX를 그대로 재현한다(DB 의존 없는
  // 부분만 분리 — page.tsx 자체는 Supabase를 직접 조회하는 서버
  // 컴포넌트라 fixture로 통째로 구울 수 없다).
  dashboardWelcomeEmptyState: "dashboard-welcome-empty-state",
  // PRODUCT-01D: /dashboard/settings는 DB를 조회하지 않는 순수
  // 컴포넌트라(getContentServiceReadiness는 env만 읽음) 실제 페이지
  // 컴포넌트를 그대로 굽는다. env를 다르게 설정해 두 시나리오를 만든다.
  settingsReady: "settings-ready",
  settingsPartial: "settings-partial",
  // PRODUCT-01E 섹션 28: Content Creation Experience의 6개 대표 상태.
  // 전부 기존 workflowState(lib/dashboard/dashboard-workflow-presentation.ts)
  // 값을 그대로 넣어 만든다 — 새 fixture 전용 상태를 만들지 않는다.
  creationStepTheme: "creation-step-theme",
  creationStepSources: "creation-step-sources",
  creationStepSourcesReady: "creation-step-sources-ready",
  creationStepGenerateReady: "creation-step-generate-ready",
  creationStepGenerating: "creation-step-generating",
  creationStepGenerated: "creation-step-generated",
  // PRODUCT-01F 섹션 31: Publish & Connection UX 6개 대표 상태.
  publishApprovalRequired: "publish-approval-required",
  publishWordpressReady: "publish-wordpress-ready",
  publishWordpressDraftComplete: "publish-wordpress-draft-complete",
  publishCopyReady: "publish-copy-ready",
  publishManualReady: "publish-manual-ready",
  publishBlocked: "publish-blocked",
  // PRODUCT-01G 섹션 31: Friendly Errors & Empty States 대표 상태.
  // "no-content-empty-state"는 PRODUCT-01D의 dashboardWelcomeEmptyState를
  // 그대로 재사용한다(새로 굽지 않음).
  errorSourceFetchPartialFailure: "error-source-fetch-partial-failure",
  errorGenerationFailure: "error-generation-failure",
  errorStructuredOutputFailure: "error-structured-output-failure",
  errorWordpressDraftFailure: "error-wordpress-draft-failure",
  errorJobStalled: "error-job-stalled",
  errorNotFound: "error-not-found",
} as const;
