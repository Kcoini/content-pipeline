# UX-03B2: Interaction Consistency + Rewrite Terminology

- 작성일: 2026-09-18
- 범위: 같은 기능(본문 수정)이 카드/플랫폼마다 다르게 동작하는 문제(X
  카드), `/articles/[id]/rewrite`의 "승인" 계열 용어 3종 혼동, 그리고
  `app/social-posts/[id]/page.tsx` 상단 요약 카드가 쓰는 4번째
  next-action helper(`getSocialPostWorkspacePrimaryAction`)의 중복
  여부를 정리했다. `docs/ux/full-ux-audit.md`,
  `docs/ux/ux-refactor-roadmap.md`, `docs/ux/ux-03a-common-ux-foundation.md`,
  `docs/ux/ux-03b1-workflow-next-action.md`, `docs/ui-ux-governance-rules.md`를
  먼저 읽고 작업했다.
- 이번 Phase에서 하지 않은 것: DB migration, publish logic 변경,
  approval state machine 변경, public publish 변경, WordPress logic
  변경, 전체 dashboard 변경, `/articles/[id]` 전체 레이아웃 변경,
  PlatformBadge 전체 통합, 신규 자동 게시 기능, 전체 디자인 rewrite,
  우선순위 2 route(`/articles/[id]`, `/dashboard/blog`, `/dashboard`,
  대시보드 rewrite/social-performance, trends) 확대 적용. 이 항목들은
  모두 **UX-03C**로 남겼다.

---

## 1. X 인라인 편집기 구조

기존 `InlinePostBodyEditor`는 단일 문자열(`value: string`) 편집만
지원했다. X는 데이터 모델 자체가 `threadItems: ThreadItem[]`(배열)이라,
이 계약을 그대로 쓰면 여러 항목을 하나의 문자열로 합치거나(순서/항목
경계 정보 손실) 상세 페이지로 우회(H9의 실제 원인)할 수밖에 없었다.

해결: `InlinePostBodyEditorProps`를 discriminated union으로 확장했다.

```ts
interface CommonProps { articleId: string; socialPostId: string; returnTo: string; title: string; saveAction: (formData: FormData) => Promise<void>; onCancel: () => void; }
export interface InlinePostBodyEditorSingleModeProps extends CommonProps { mode?: "single"; value: string; }
export interface InlinePostBodyEditorThreadModeProps extends CommonProps { mode: "thread"; items: Array<{ text: string }>; maxLengthPerItem?: number; }
export type InlinePostBodyEditorProps = InlinePostBodyEditorSingleModeProps | InlinePostBodyEditorThreadModeProps;
```

`mode` 생략 시 기존 단일 모드와 100% 동일하게 동작한다(렌더링 결과
불변 — 기존 사용처는 코드 변경 없이 그대로 작동).

## 2. Thread 모드 설계

`mode === "thread"`일 때는 **하나의 textarea에 억지로 합치지 않고**,
항목마다 별도 `<textarea name="threadItemText">`를 렌더링한다.

- 각 항목 위에 `"{순번}/{전체 개수}"`와(있으면) `"({길이}/{최대 길이}자)"`를
  표시한다. 최대 길이는 새로 만들지 않고 기존
  `PLATFORM_WRITING_CONFIGS[platform].maxLength`(X는 280자, 이미
  존재하는 규칙)를 그대로 재사용한다.
- 저장 시 `FormData.getAll("threadItemText")`로 모든 textarea 값을
  **DOM 순서 그대로** 배열로 받는다 — 별도 순서 필드(hidden input
  등)가 필요 없다(HTML form 표준 동작).
- 저장/검토/승인 버튼 4개(저장 후 승인/저장 후 자동 검토/저장만
  하기/취소)는 단일 모드와 완전히 동일한 계약을 공유한다
  (`SaveButtons` 내부 컴포넌트로 추출해 두 모드가 함께 쓴다).

서비스 레이어(`lib/social/social-post-inline-edit-service.ts`)는 기존
`saveSocialPostBodyAndProcess`의 저장 이후 처리(save_only/save_and_review/
save_review_and_approve 분기)를 `continueAfterSave()`로 추출해 공유하고,
새 `saveSocialPostThreadAndProcess()`가 이를 재사용한다 — 승인/검토
로직을 중복 구현하지 않는다.

```ts
export async function saveSocialPostThreadAndProcess(
  socialPostId: string, threadItemTexts: string[],
  saveMode: SocialPostBodySaveMode, approvedBy: string
): Promise<SaveSocialPostBodyResult> { /* ... */ }
```

- 빈 항목은 저장 전에 걸러내고(trim 후 length 0 제외) 남은 항목만
  1부터 다시 번호를 매긴다.
- **모든 항목이 비어 있으면 저장 자체를 막는다**("본문이 비어 있어
  저장할 수 없습니다.") — 완전히 빈 thread가 저장되는 것을 방지한다.
- 지원하지 않는 플랫폼으로 호출되면 명확한 오류 메시지를 반환한다
  (`PLATFORM_WRITING_CONFIGS[platform].supportsThreads`로 판정).
- 로그(`logInlineEditEvent`)에는 `threadItemCount`만 남기고, 실제 본문
  텍스트는 남기지 않는다(기존 단일 모드 로그 정책과 동일).

새 서버 액션 `saveSocialPostThreadInlineEditAction`(`app/articles/[id]/actions.ts`)이
`formData.getAll("threadItemText")`를 모아 이 서비스 함수를 호출하고,
기존 `saveSocialPostInlineEditAction`과 동일한 `revalidatePath`/redirect
패턴을 따른다.

## 3. 복사(copy) 텍스트 처리

X thread를 "복사"할 때 항목을 어떤 순서/구분자로 합칠지가 별도
문제였다. 기존 `getSocialPostDisplayBody`(공백 한 칸으로 join, 여러
화면에서 이미 널리 쓰이고 `social-post-display.test.ts`에 고정 형식으로
테스트됨)를 바꾸면 영향 범위가 넓어지므로 건드리지 않았다. 대신 thread
전용의 별도 함수를 새로 만들었다.

```ts
// lib/social/thread-item-formatter.ts
export function formatThreadItemsForCopy(items: readonly ThreadItem[]): string {
  return items.slice().sort((a, b) => a.order - b.order).map((item) => item.text.trim()).filter((text) => text.length > 0).join("\n\n");
}
```

order 기준 정렬 후 빈 값 제거, 줄바꿈 2개로 구분해 붙여넣었을 때
바로 읽을 수 있는 형태로 합친다. `SocialPostBodyPanel`은 thread 모드일
때(`threadItems`+`saveThreadAction` 둘 다 있을 때)만 이 함수 결과를
복사 텍스트로 쓰고, 그 외에는 기존 `displayBody`를 그대로 쓴다.

## 4. X 카드 적용

`app/articles/[id]/social/page.tsx`에서 X처럼 `supportsThreads`인
플랫폼에는 `SocialPostBodyPanel`에 `threadItems`/`saveThreadAction`/
`threadItemMaxLength`를 넘긴다.

```tsx
const isThreadPlatform = PLATFORM_WRITING_CONFIGS[post.platform].supportsThreads;
<SocialPostBodyPanel
  articleId={article.id} socialPostId={post.id} returnTo={selfReturnTo}
  displayBody={displayBody}
  editable={getSocialPostEditableField(post.platform) !== null}
  saveAction={saveSocialPostInlineEditAction}
  platform={post.platform}
  threadItems={isThreadPlatform ? post.threadItems : undefined}
  saveThreadAction={isThreadPlatform ? saveSocialPostThreadInlineEditAction : undefined}
  threadItemMaxLength={isThreadPlatform ? PLATFORM_WRITING_CONFIGS[post.platform].maxLength : undefined}
/>
```

`SocialPostBodyPanel` 내부에서는 `threadItems`와 `saveThreadAction`이
**둘 다** 있을 때만 thread 모드로 전환한다(`isThreadMode`). 이때는
기존 `getSocialPostEditableField`가 X에 반환하던 `null`(기존
"편집 불가" 판정)과 무관하게 `effectiveEditable = true`로 강제한다 —
`getSocialPostEditableField`의 다른 호출처(단일 모드 판정에 여전히
쓰이는 곳)는 전혀 건드리지 않았다. 결과: **X 카드도 다른 플랫폼과
똑같이 `[본문 수정]` 버튼이 같은 카드 안에서 인라인 편집기를 연다.**

## 5. Rewrite 용어 정리 (before/after)

`app/articles/[id]/rewrite/page.tsx` 한 화면에 실제로 의미가 다른 3개의
"승인"류 action이 있었다.

| 항목 | 이전 라벨 | 실제로 바뀌는 값 | 새 라벨 | 판단 근거 |
|---|---|---|---|---|
| ① 제안 채택 | "개선 제안 승인" | `suggestion_status: draft/ready/needs_review → approved` (되돌릴 수 없는 게이트 아님, 이후 "적용" 단계가 남아 있음) | **"개선안 선택"** | 아직 아무 글도 만들어지지 않은 단계 — "선택"이 실제 행동에 가장 가깝다 |
| ② 재검토 요청 | "재승인 요청" | `rewrite_reapproval_status: not_requested → pending_review` (검토 대상으로 올리는 요청일 뿐, 아직 확정 아님) | **"재검토 요청"** | 사람에게 "다시 봐달라"고 요청하는 단계 |
| ③ 최종 확정 | "재승인 승인하기" | `rewrite_reapproval_status: pending_review → approved` + quality/forbidden-pattern guard 통과가 조건 — 유일하게 되돌리기 어려운 실질적 게이트 | **"최종 승인"** | 실제로 게시 가능 여부를 확정하는 유일한 action |

세 단계 모두 "승인"이라는 단어를 썼을 때는 어느 버튼이 진짜 최종
승인인지 구분할 방법이 없었다. `"승인"`은 이제 ③에만 쓴다.

**state machine/DB 필드/action 함수명은 이 Phase에서 바꾸지 않았다** —
`approveRewriteSuggestionAction`/`requestRewriteReapprovalAction`/
`approveRewriteReapprovalAction`이라는 함수 이름, `suggestion_status`/
`rewrite_reapproval_status` 컬럼, 상태 값(`approved`/`pending_review`
등)은 그대로다. 바뀐 것은 사용자에게 보이는 버튼 라벨과 안내 문구뿐이다.

## 6. Rewrite state machine의 실제 의미 (해설)

- `suggestion_status`의 `"approved"`는 "이 개선안을 다음 단계로
  넘기기로 골랐다"는 뜻이지, 최종 승인이 아니다. `applicationStatus`가
  `"applied"`가 되어야 실제로 재작성 버전이 만들어진다.
- `rewrite_reapproval_status`의 `"approved"`가 이 화면에서 유일하게
  게시 가능 여부를 확정하는 값이다 — `describeApproveReapprovalDisabledReason`이
  `pending_review` 상태가 아니면 disabled 처리하고, 통과 조건에
  quality/forbidden-pattern guard가 걸려 있어 사람이 실제로 검증한
  뒤에만 넘어간다.
- 같은 raw 값 `"approved"`가 두 필드에서 다른 의미를 가지므로, 기존
  프로젝트 관례(`describeArticleStatus` 선례, Phase UX-03A semantic
  audit)를 그대로 따라 **공용 `describeStatusValue`를 억지로 통일하지
  않고 필드 전용 헬퍼**를 추가했다.

```ts
const REWRITE_SUGGESTION_STATUS_LABELS: Record<RewriteSuggestionStatus, string> = {
  draft: "초안", ready: "검토 준비됨", needs_review: "검토 필요", approved: "선택됨",
  rejected: "반려됨", applied: "적용됨", blocked: "진행 불가", failed: "실패",
};
export function describeRewriteSuggestionStatus(status: RewriteSuggestionStatus): string {
  return REWRITE_SUGGESTION_STATUS_LABELS[status] ?? status;
}
```

`suggestionStatus === "approved"`는 이제 "선택됨"으로 표시되어, ③의
"최종 승인"과 혼동되지 않는다. 페이지 상단 안내 배너도 새 흐름 이름으로
다시 썼다: "개선안 선택 → 개선안 적용(재작성 버전 생성) → 원본과 비교 →
재검토 요청 → 최종 승인 → 재내보내기 준비."

## 7. social-posts workspace primary action 조사 결과

`app/social-posts/[id]/page.tsx` 상단 "지금 상태 요약" 카드는
`lib/social/social-post-auto-review.ts`의
`getSocialPostWorkspacePrimaryAction(qualityStatus, approvalStatus,
review)`로 계산한 `{kind, label}`을 쓴다. 이 helper는 `NextActionPanel`이
쓰는 공통 `NextActionViewModel`과는 별도의, UX-03B1에서 통합하지 못한
4번째 next-action helper였다.

**조사 결과**: 이 helper는 실제로는 "지금 무엇을 해야 하는지" 자체를
새로 계산하는 business logic이 아니라, **이미 페이지 안에 존재하는
실행 지점 중 어디로 이동해야 하는지를 요약해서 알려주는 navigation
전용 helper**로 판정했다.

- `kind === "run_review"`일 때만 실제로 폼을 직접 제출한다 — 이 폼이
  호출하는 `runSocialPostQualityGateAction`은 `AutoReviewSummaryCard`
  footer의 "자동 재검토 실행" 버튼과 **같은 action**이다(중복
  action이지만 사용자가 스크롤하지 않고 바로 실행할 수 있는 단축
  실행일 뿐, 별도 판단 로직을 갖고 있지 않다).
- `kind === "view_body"`/`"edit"`는 단순히 edit/preview 탭으로 이동하는
  링크다.
- `kind === "approve"`(아직 미승인)와 `kind === "publish_prep"`(이미
  승인됨)는 **둘 다 예외 없이 같은 앵커(`#final-approval-panel`)로만
  이동**한다 — 즉 이 카드는 "승인할지 말지"를 스스로 판단하지 않고,
  실제 승인 가능 여부 판단(`getApprovalGateStatus`가 계산하는
  `gate.canApprove`)과 실제 승인 버튼(`approveSocialPostAction` 폼)이
  있는 위치로 안내만 한다.

즉 (A) navigation 전용 케이스에 해당한다. 다만 조사 중 실제 문제를
하나 확인했다: 이 helper의 버튼이 기존에는 `bg-zinc-900`(강조/primary
스타일)로 렌더링되어 있어서, 페이지 하단 최종 승인 패널의 진짜 primary
버튼(`approveSocialPostAction` 폼, 역시 `bg-zinc-900`)과 **시각적으로
두 개의 primary action처럼 보였다** — 금지된 "페이지 상단 [승인] /
페이지 하단 [게시 준비], 둘 다 primary처럼 표시" 패턴에 해당한다.

**해결**: helper 자체(`getSocialPostWorkspacePrimaryAction`)와 호출부의
business logic은 전혀 바꾸지 않았다 — 삭제하지도, `NextActionViewModel`
어댑터로 강제 통합하지도 않았다(억지로 통합하면 "navigation 전용
helper"와 "실행 전용 helper"라는 서로 다른 성격을 하나의 타입으로
욱여넣게 되어 오히려 더 혼란스럽다). 대신 상단 카드의 버튼 3종
(run_review 폼/view_body·edit 링크/approve·publish_prep 앵커) 스타일을
전부 secondary(테두리, `border border-zinc-300 bg-zinc-50`)로 낮추고,
dt 라벨을 "다음 작업"에서 **"빠른 이동"**으로 바꿔 이 영역이
"navigation 단축 경로"라는 것을 명확히 했다. 이제 페이지 전체에서
강조(primary, `bg-zinc-900`) 스타일 버튼은 최종 승인 패널의
`approveSocialPostAction` 폼 하나뿐이다.

## 8. 남은 High 문제

- 우선순위 2 route(`/articles/[id]`, `/dashboard/blog`, `/dashboard`,
  `/dashboard/social-performance`, `/trends`, `/themes/[themeId]`)에는
  아직 `NextActionPanel`/`WorkflowStatusCard`/`AutoReviewSummaryCard`/
  `HumanReviewPanel`을 적용하지 않았다.
- `PlatformBadge` 계열 미통합(`/trends`, `/themes/[themeId]`).
- `app/articles/[id]/rewrite/page.tsx`의 카드 단위 세부 UX(다른
  governance 원칙 — Level 정보 분리, primary action 1개 제한 등 —
  적용 여부)는 이번 Phase에서 용어 정리만 다뤘고, 전체 재검토는
  하지 않았다.

## 9. UX-03C 대상

1. `NextActionPanel`/`WorkflowStatusCard`를 우선순위 2 route에 적용
   검토(`/dashboard`는 이미 좋은 패턴이므로 "더 단순해지는 영역에만"
   신중히 적용)
2. `AutoReviewSummaryCard`/`HumanReviewPanel`을 나머지 카드로 확대
3. status label helper 적용 범위를 `/trends`, `/themes/[themeId]`까지
   확대
4. `PlatformBadge` 계열 공통 컴포넌트 통합
5. `/articles/[id]/rewrite` 카드 단위 세부 UX 재검토

---

## 10. 수정한 파일 목록

**신규**:
- `lib/social/thread-item-formatter.ts`, `.test.ts`
- `components/social/inline-post-body-editor.tsx`, `.test.tsx`(UX-03A에서 설계만 됐던 파일을 이번 Phase에서 실제 구현)
- `docs/ux/ux-03b2-interaction-consistency.md`(이 문서)

**수정**:
- `lib/social/social-post-inline-edit-service.ts`, `.test.ts` — `continueAfterSave` 추출, `saveSocialPostThreadAndProcess` 신설
- `app/articles/[id]/actions.ts` — `saveSocialPostThreadInlineEditAction` 신설
- `components/social/social-post-body-panel.tsx`, `.test.tsx` — thread 모드 분기 추가
- `app/articles/[id]/social/page.tsx`, `.test.ts` — X 카드에 thread 모드 적용
- `lib/social/rewrite-version-user-facing-status.ts`, `.test.ts` — 라벨 재정리, `describeRewriteSuggestionStatus` 신설
- `app/articles/[id]/rewrite/page.tsx`, `.test.ts` — 새 라벨 적용, 안내 배너 재작성
- `app/social-posts/[id]/page.tsx`, `.test.ts` — 상단 요약 카드 버튼을 secondary 스타일로, dt 라벨을 "빠른 이동"으로 변경
- `docs/ux/full-ux-audit.md`, `docs/ux/ux-refactor-roadmap.md`, `docs/ui-ux-governance-rules.md`(업데이트)

## 11. 테스트 추가/수정 내역

- `lib/social/thread-item-formatter.test.ts`: 4개(정렬/빈 값 제거/구분자)
- `components/social/inline-post-body-editor.test.tsx`: 13개(단일 모드 5개 유지 + thread 모드 5개 신규 + 기타)
- `lib/social/social-post-inline-edit-service.test.ts`: 20개(기존 13개 + `saveSocialPostThreadAndProcess` 7개 신규)
- `components/social/social-post-body-panel.test.tsx`: 20개(기존 16개 + thread 모드 4개 신규)
- `app/articles/[id]/social/page.test.ts`: 46개(기존 42개 + X 카드 wiring 4개 신규)
- `lib/social/rewrite-version-user-facing-status.test.ts`: 16개(기존 14개 라벨 갱신 3개 포함 + `describeRewriteSuggestionStatus` 2개 신규)
- `app/articles/[id]/rewrite/page.test.ts`: 28개(기존 21개 라벨 갱신 2개 포함 + 새 용어 검증 7개 신규)
- `app/social-posts/[id]/page.test.ts`: 55개(기존 51개 + workspace primary action navigation 검증 4개 신규)

## 12. lint 결과

`npm run lint` — 오류 없음(출력 없음).

## 13. test 결과

전체 스위트: **264 files / 3443 tests passed**, 실패 없음.

## 14. build 결과

`npm run build` 성공(`next build`, Turbopack, TypeScript 통과, 19개
route 모두 정상 생성).

## 15. 회귀 점검

다음 기존 기능을 코드 리뷰 + 테스트로 재확인했다(모두 이상 없음):
WordPress Draft 생성/업데이트, social 글 생성, 자동 검토(quality
gate), 자동 수정(auto-fix), 승인(approve), 본문 복사(copy), Job
Progress, `WorkflowStatusCard`/`NextActionPanel`/`HumanReviewPanel`/
`AutoReviewSummaryCard`(UX-03A/B1에서 만든 공통 컴포넌트), public
publish 안전장치(여전히 명시적 사람 클릭 필요, 이번 Phase에서 어떤
자동 게시 로직도 추가하지 않음).

---

**UX-03B2에서는 동일 기능의 동작과 사용자 용어를 통일했으며, 남은
화면 확대 적용과 PlatformBadge 통합은 UX-03C로 남겼습니다.**
