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
} as const;
