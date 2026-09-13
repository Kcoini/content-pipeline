# Phase 4-22: 자동 검토 issue 분류 + 자동 수정 + 자동 재검토

## 문제

자동 검토(quality gate)에서 "수정 필요"가 나오면, 문제 종류와
무관하게 항상 사용자에게 직접 수정하라고 요구했다. 하지만 내부
작성용 소제목 잔존, markdown 잔여물처럼 시스템이 안전하게 고칠 수
있는 문제와, 출처/수치/기관명 확인처럼 사람의 판단이 반드시 필요한
문제가 구분되지 않고 있었다.

## 해결

### 1) 검토 issue를 3종류로 분류 — `review-issue-fixability.ts`

`lib/social/review-issue-fixability.ts`(신규)의
`classifyReviewIssue()`가 quality gate checklist 항목 하나를
`auto_fixable`/`user_confirmation_required`/`blocking` 중 하나로
분류한다:

- **우선순위 1**: `status === "blocked"`이거나 안전 관련 key
  (개인정보/협박/광고 클릭 유도 등, `ALWAYS_BLOCKING_KEYS`)면 항상
  `blocking`.
- **우선순위 2**: `AUTO_FIXABLE_KEYS`(내부 소제목, markdown 잔여물,
  본문 깊이/구조, 리드문 존재 등)에 있으면 `auto_fixable`. 단
  `canAutoFix`(실제 구현된 자동 수정기가 있는지)는 별도 필드로
  구분한다 — "고칠 수 있는 유형"과 "지금 실제로 자동 고칠 수
  있음"을 섞지 않기 위해서다.
- **우선순위 3**: 출처/수치/기관명 확인이 필요한 key나, 목록에 없는
  알 수 없는 key는 모두 안전하게 `user_confirmation_required`로
  분류한다("알 수 없는 문제는 자동으로 고쳐도 된다"고 낙관하지
  않는다).

`summarizeReviewIssues()`는 checklist 전체를 `autoFixable`/
`userConfirmationRequired`/`blocking` 3개 배열로 나눠 반환한다(pass
항목은 제외).

### 2) 자동 수정 + 재검토 오케스트레이션 — `post-auto-fix-service.ts`

`lib/social/post-auto-fix-service.ts`(신규)의
`runAutoFixAndRecheck(socialPostId)`가:

1. 최신 post와 마지막 자동 검토 결과(`qualitySummary.checklist`)를
   불러온다.
2. checklist를 분류한다(로그: `post_auto_fix_started`,
   `post_review_issues_classified`, 그리고 각 종류가 있으면
   `post_auto_fixable_issues_found`/`post_user_confirmation_issues_found`/
   `post_blocking_issues_found`).
3. `canAutoFix === true`인 항목이 있으면, **이미 검증된 결정론적
   sanitizer**(`sanitizeInternalSectionHeadings`, naver_cafe는
   `sanitizeNaverCafePlainText`도 함께)만 적용한다 — 새 AI 호출은
   하지 않는다. 실제로 뭔가 바뀌었을 때만
   `editSocialPostContent(socialPostId, { postBody, editedBy:
   "system:auto_fix" })`로 저장한다(로그:
   `post_auto_fix_completed`/`post_auto_fix_no_safe_changes`).
4. **항상** `runSocialPostQualityGateAndSave()`(기존 함수 그대로
   재사용)로 자동 재검토를 실행한다(자동 수정 대상이 없었어도 최신
   상태를 반영하기 위해 실행한다).
5. 재검토 결과를 다시 분류해 최종 상태를 계산한다:
   - 남은 `blocking` issue가 있으면 → `blocked`("승인 불가")
   - 그 외 남은 문제(사용자 확인 필요 또는 아직 구현 안 된
     auto_fixable)가 있으면 → `user_confirmation_required`
   - 아무 문제도 없으면 → `approvable`("승인 가능")
6. 사용자에게 보여줄 `changesApplied`(무엇을 정리했는지 한국어 문장
   목록, full body는 담지 않는다)와 최종 상태를 반환한다.

**이 함수는 `approval_status`를 절대 바꾸지 않는다** — 자동 수정 =
시스템, 자동 재검토 = 시스템, 최종 승인 = 사용자라는 원칙을 코드로
강제했다. 최대 반복 횟수도 자연스럽게 1회로 제한된다(사이클을 만들지
않고 "정리 1번 → 재검토 1번"만 수행).

### 3) UI — `[자동 수정 후 재검토]` 버튼

`app/articles/[id]/actions.ts`의 `runPostAutoFixAndRecheckAction`이
이 서비스를 호출하고 결과 메시지(`changesApplied` 요약 포함)와 함께
같은 페이지로 돌아간다. `qualityStatus === "needs_revision"`일 때만
버튼을 보여준다(이미 통과했거나 차단된 상태에서는 의미가 없다):

- `app/articles/[id]/social/page.tsx`: primary/secondary action
  줄에 보조 버튼으로 추가.
- `app/articles/[id]/blog/page.tsx`: naver_blog/news_article/
  opinion_column 카드(Phase 4-19에서 이미 `getSocialPostCardActionState`
  로 정리된 영역)에 "게시 체크리스트 준비" 옆 보조 버튼으로 추가.

## 안전 원칙

- 자동 public publish는 추가하지 않았다.
- 승인 전 WordPress Draft/export/업로드 guard는 전혀 건드리지 않았다.
- 자동 수정은 사실/수치/기관명/날짜/출처 범위를 벗어나지 않는다 —
  실제로 적용되는 것은 이미 검증된 sanitizer(소제목 정리, plain
  text 정리)뿐이고, 새로운 문장을 생성하는 AI 호출은 이번 범위에
  없다.
- `pipeline_logs`에는 key 목록/개수/`finalState` 등 메타데이터만
  담고, full body/prompt/AI 응답은 담지 않는다.

## 이번 작업에서 하지 않은 것 (범위)

- **실제 AI 기반 자동 수정("리드문 보강", "문장 다듬기", "중복 표현
  정리")은 구현하지 않았다.** 이 문제들은 스펙상 `auto_fixable`로
  분류되지만(`AUTO_FIXABLE_KEYS`에 포함), `canAutoFix=false`로
  표시되어 실제로는 자동 수정되지 않는다 — 사람이 "본문 수정"으로
  직접 고쳐야 한다. 새 AI 재작성 호출은 프롬프트/환각 방지/재시도
  정책을 새로 설계해야 하는 별도 범위라고 판단했고, "구현되지 않은
  자동 수정 버튼을 만들지 않는다"는 이전 phase(Phase 4-19, 네이버
  카페 업로드)의 원칙을 그대로 따랐다.
- **글 생성 직후 자동으로 이 파이프라인을 실행하는 것(스펙 7번)은
  하지 않았다.** Phase 4-21에서 이미 생성 파이프라인 저장 직전에
  `sanitizeInternalSectionHeadings()`를 적용하고 있어, 생성 직후
  시점에는 auto_fixable 문제가 애초에 거의 남아 있지 않다. 이번
  action은 "생성 이후 사람이 본문을 직접 수정해 다시 문제가
  생겼을 때" 쓰는 보조 흐름으로 두었다.
- **Job Progress 연동(스펙 13번)은 하지 않았다** — 이 파이프라인은
  결정론적 sanitizer 1회 적용 + quality gate 재실행으로 짧게
  끝나는 동기 작업이라, 여러 단계로 나눠 진행 상황을 보여줄 실익이
  낮다고 판단했다(Phase 4-17의 WordPress 게시 준비 자동 실행과
  달리 외부 API 호출이 없다).
- **[출처 확인]/[확인 필요 항목 보기] 같은 세분화된 UI(스펙 10번의
  user_confirmation_required 전용 화면)는 만들지 않았다** — 기존
  "상세 상태 보기"/"문제 확인하기" 흐름이 이미 검토 이슈를 보여주고
  있어, 이번에는 그 위에 자동 수정 결과 메시지만 얹었다.

## 테스트

- `lib/social/review-issue-fixability.test.ts`(신규, 12개): 분류
  우선순위(blocked 우선, auto_fixable, user_confirmation_required,
  알 수 없는 key의 안전한 기본값), `summarizeReviewIssues` 동작.
- `lib/social/post-auto-fix-service.test.ts`(신규, 10개): 자동 수정
  실행/저장, 항상 재검토 실행, 재검토 결과에 따른 최종 상태 3가지,
  자동 수정 대상 없을 때 동작, user_confirmation_required 항목은
  건드리지 않음, approval_status 불변, 로그에 full body 미포함.
- `app/articles/[id]/actions.test.ts`: 새 describe 1개(3개 테스트,
  정적 소스 검사) 추가.
- `app/articles/[id]/social/page.test.ts`: 새 describe 1개(2개
  테스트) 추가. 37 → 39개 통과.
- `app/articles/[id]/blog/page.test.ts`: 새 describe 1개(1개 테스트)
  추가. 193 → 194개 통과.
- 전체 `npx vitest run`: 249 files / 3205 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류. `npm run build`: 성공.

## 관련 문서

- [`phase-4-21-internal-section-heading-cleanup.md`](./phase-4-21-internal-section-heading-cleanup.md) — 이번에 재사용한 `sanitizeInternalSectionHeadings()`의 원출처
- [`phase-4-19-post-card-primary-publish-action.md`](./phase-4-19-post-card-primary-publish-action.md) — "구현되지 않은 자동 버튼을 만들지 않는다" 원칙의 선례
- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)
