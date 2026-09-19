# UX-03B1: Unified Workflow Status + Next Action

- 작성일: 2026-09-18
- 범위: UX-03A에서 조사만 해둔 `NextActionViewModel`/`WorkflowStatusViewModel`을
  실제로 구현하고, 우선순위 1 화면(`app/articles/[id]/blog/page.tsx`,
  `app/articles/[id]/social/page.tsx`, `app/social-posts/[id]/page.tsx`)에
  적용했다. `docs/ux/full-ux-audit.md`, `docs/ux/user-journey-audit.md`,
  `docs/ux/ui-information-levels.md`, `docs/ux/ux-refactor-roadmap.md`,
  `docs/ux/ux-03a-common-ux-foundation.md`, `docs/ui-ux-governance-rules.md`를
  먼저 읽고 작업했다.
- 이번 Phase에서 하지 않은 것: X inline editor 구현, rewrite state
  machine/용어 변경, approval/publish logic 변경, DB migration, API
  변경, 자동 게시 추가, 전체 레이아웃 rewrite, AutoReview/HumanReview
  전면 재설계, PlatformBadge 통합. 우선순위 2(`app/articles/[id]/page.tsx`,
  `app/dashboard/blog/page.tsx`, `app/dashboard/page.tsx`)는 이번 Phase
  범위가 이미 충분히 커져 다음 Phase로 남겼다(지시사항 8번 "우선순위
  2가 지나치게 커지면 다음 Phase로 일부 남겨도 된다"에 따름).

---

## 1. NextActionViewModel 구현 방식

`lib/ui/next-action-view-model.ts`에 다음을 구현했다:

```ts
type NextActionState = "none" | "in_progress" | "needs_attention" | "ready" | "completed" | "blocked";
interface NextActionViewModelAction {
  label: string; actionType: string; href?: string; disabled?: boolean; disabledReason?: string;
}
interface NextActionViewModel {
  state: NextActionState; message?: string;
  primaryAction?: NextActionViewModelAction; secondaryActions?: NextActionViewModelAction[];
}
```

그리고 기존 3개 helper 각각에 대한 **어댑터 함수**(business logic 재구현
없음, 결과 shape만 변환)를 추가했다:

- `fromWordPressPublishPrepState(prep)` — `primaryAction.actionType === "view_draft"`면 `completed`, `blockingReasons.length > 0`면 `needs_attention`, 그 외 `ready`.
- `fromSocialPostCardActionState(cardState)` — `statusBadge`(이미 한국어 친화 문구) 값으로 `completed`/`needs_attention`/`ready`를 판단.
- `fromPostApprovalNextActions(result)` — `primaryAction.actionType === "view_wordpress_draft"`면 `completed`, 그 외 `ready`.

세 helper(`getWordPressPublishPrepState`/`getSocialPostCardActionState`/
`getPostApprovalNextActions`)는 **전혀 수정하지 않았다** — 어댑터는 그
결과를 읽기만 한다.

## 2. NextActionPanel 구현 방식

`components/workflow/next-action-panel.tsx` — `NextActionViewModel`을
받아 "다음 작업" 제목 + 상태별 톤 색상 + `message` + primary action
1개 + secondary action 목록을 렌더링한다. 실제 버튼/링크/form은 호출
측이 넘기는 `renderAction(action, kind)` 콜백이 구성한다(페이지마다
server action이 다르므로 라우팅을 컴포넌트가 대신 결정하지 않는다).

추가 규칙:
- `disabled && disabledReason`이면 그 이유를 버튼 아래 항상 보이는
  텍스트로 표시한다(hover title에만 의존하지 않음).
- `state === "in_progress"`이고 `progressContent`가 주어지면 버튼 대신
  그 내용(예: JobProgressCard)을 보여준다.
- primary/secondary가 모두 없으면: `fallbackActions`가 있으면 그것을,
  없으면 "추가로 필요한 작업이 없습니다."를 보여준다 — **dead-end를
  만들지 않는다.**

## 3. WorkflowStatusViewModel 구현 방식

`lib/ui/workflow-status-view-model.ts`:

```ts
type WorkflowState = "idle" | "in_progress" | "needs_attention" | "ready" | "completed" | "blocked";
interface WorkflowStatusViewModel { state: WorkflowState; title: string; message?: string; completedItems?: string[]; remainingItems?: string[]; }
```

어댑터 2개:
- `fromWordPressPublishPrepStateToWorkflowStatus(prep)` — `completedItems.length === 0`면 `idle`, `remainingItems.length > 0`이면 `needs_attention`, 추적 대상(품질검사/승인/대표 이미지/체크리스트/SEO)은 모두 끝났지만 마지막 반영 단계(Draft 생성/게시 확인)가 남았으면 `in_progress`, `primaryAction.actionType === "view_draft"`면 `completed`.
- `fromSocialPostCardActionStateToWorkflowStatus(cardState)` — `statusBadge` 기반으로 `needs_attention`/`completed`/`ready` 판단.

## 4. WorkflowStatusCard 구현 방식

`components/workflow/workflow-status-card.tsx` — `heading`(기본 "현재
상태") + `title` + `message?` + `완료: ...`(있을 때만) + `남은 작업:
...`(있을 때만)만 보여준다. 내부 파이프라인 단계 전체를 나열하지
않는다 — 필요하면 옆의 `AdvancedDetails`가 담당한다.

## 5. 적용한 route 목록

- `app/articles/[id]/blog/page.tsx` — wordpress_blog 카드의 "WordPress
  게시 준비" 섹션
- `app/articles/[id]/social/page.tsx` — 목록 카드(플랫폼별 글 카드)
- `app/social-posts/[id]/page.tsx` — "최종 승인" 패널의 승인 완료 이후
  다음 작업 영역

우선순위 2(`app/articles/[id]/page.tsx`, `app/dashboard/blog/page.tsx`,
`app/dashboard/page.tsx`)는 이번 Phase에서 적용하지 않았다 — `/dashboard`는
지시사항(13번)대로 "이미 좋은 패턴"이라 오히려 공통 컴포넌트 설계의
기준으로만 참고했고, 나머지 둘은 우선순위 1에 시간을 집중하기 위해
다음 Phase로 남겼다.

## 6. WordPress 블로그 next action 변화

기존에 카드 안에서 직접 계산하던 "현재 상태 + 완료됨 + 남은 작업"
문단(`<p>`/`<div>` 수동 조합)과 "primary action 1개 + secondary action
목록" 렌더링을 `WorkflowStatusCard`/`NextActionPanel`로 교체했다.
`getWordPressPublishPrepState`가 계산한 값(`statusLabel`/
`completedItems`/`remainingItems`/`primaryAction`/`secondaryActions`)은
그대로 재사용하고, 실제 버튼(품질검사 실행/승인/체크리스트 준비/Draft
생성·업데이트/SEO 반영)을 만드는 `renderPrepActionButton` 함수도 로직
변경 없이 재사용했다(파라미터 타입만 `WordPressPublishPrepAction` →
`NextActionViewModelAction`으로 넓혔다 — switch 문의 case 비교는 문자열
비교라 동작에 영향 없음).

**결과**: 원본 article 미승인 경고, "WordPress에는 Draft 생성/업데이트
까지만 반영합니다" 안내, "단계별 상태 자세히 보기"/"고급 작업 보기"
접힘은 모두 그대로 유지된다 — 표현 레이어만 공통 컴포넌트로 옮겼다.

## 7. social 카드 next action 변화

`getSocialPostCardActionState`가 계산한 `cardState`를 `fromSocialPostCardActionState`로
변환하되, 이 화면 고유의 두 가지 규칙(cardState가 모르는 것)을 뷰모델
조합 시점에 페이지 코드가 직접 반영했다:
1. **"자동 수정 후 재검토" 버튼**(`postAutoFixAndRecheckAction`)은
   cardState에 없는 이 화면 전용 action이라, `qualityStatus ===
   "needs_revision"`일 때만 뷰모델의 secondaryActions(또는
   `autoFixIsPrimary`면 primaryAction)에 끼워 넣는다.
2. **`autoFixIsPrimary`**(남은 문제가 전부 자동 수정 가능)면 이 action이
   primary로, cardState의 원래 primary는 secondary로 내려간다 — 기존
   동작 그대로.
3. **inline 편집 가능 플랫폼**은 `edit_body` secondary action을
   제외한다(SocialPostBodyPanel이 이미 "본문 수정" 버튼을 자체
   제공하므로 중복 방지) — 기존 `visibleSecondaryActions` 필터링 로직
   그대로 재사용.

`renderAction(action, className)`(기존 함수, action별 실제 form/link를
반환)은 그대로 두고, `renderActionForPanel(action, kind)`이라는 얇은
어댑터로 `kind → className` 변환만 추가했다.

## 8. social-post detail 변화

"최종 승인" 패널의 승인 완료 이후 블록(`p.approvalStatus === "approved"
&& approvalNextActions`)에서, 기존에 수동으로 조합하던 `<div className="mt-3
flex flex-col gap-2 text-xs">`(message + primary + secondary 수동
배치)를 `<NextActionPanel viewModel={fromPostApprovalNextActions(approvalNextActions)}
renderAction={...} />`로 교체했다. `renderNextAction`(actionType별 실제
Link/CopyPostBodyButton을 반환하는 기존 함수)은 로직 변경 없이 재사용
했다.

이미 UX-03A에서 적용된 `HumanReviewPanel`(확인이 필요한 사항)과
`AutoReviewSummaryCard`(자동 검토 결과)는 그대로 유지했다 — 화면 순서는
이제 **현재 상태 요약(상단 카드) → 본문(탭) → AutoReviewSummaryCard/
HumanReviewPanel(자동 검토 섹션) → NextActionPanel(최종 승인) →
AdvancedDetails**로, 지시된 순서(현재 상태 → 본문 → 확인 필요 사항 →
다음 작업 → AdvancedDetails)와 일치한다.

## 9. 제거한 중복 primary action 목록

- `app/articles/[id]/blog/page.tsx`: "현재 상태:" 문단과
  `renderPrepActionButton(prepState.primaryAction, "primary")` 수동
  호출을 WorkflowStatusCard/NextActionPanel로 통합 — 두 컴포넌트가
  같은 `prepState`를 공유하므로 상태 문구와 버튼이 어긋날 위험이
  없어졌다.
- `app/articles/[id]/social/page.tsx`: `renderAction(cardState.primaryAction,
  primaryClass)` / `renderAction(cardState.primaryAction, secondaryClass)`
  두 갈래로 나뉘어 있던 autoFix 우선순위 분기를 하나의 `viewModel`
  조합 로직으로 합쳤다 — primary가 항상 정확히 하나만 렌더링된다(테스트로
  검증).
- `app/social-posts/[id]/page.tsx`: 승인 완료 블록의 수동 primary/secondary
  나열을 NextActionPanel로 교체.

## 10. 발견/해결한 dead-end 목록

우선순위 1 화면 3곳에서 "다음 작업"/"아래에서 진행"/"계속 진행"/"다음
단계" 문구를 전수 검색했다. 실제 액션 없이 문구만 있는 dead-end는
발견되지 않았다(모두 문구 바로 아래/옆에 실제 버튼·링크가 있음을
확인) — `app/social-posts/[id]/page.tsx:300`의 "다음 작업" dt/dd(상단
요약 카드)는 `getSocialPostWorkspacePrimaryAction`이라는 4번째 helper
(이번 Phase에서 다루지 않은, `{kind, label}` 단일 액션 shape)를 쓰며
바로 아래(`:305`)에 실제 폼이 있어 dead-end가 아니다 — 다만 이 helper는
3개 helper와 shape이 달라 NextActionViewModel로 통합되지 않았다(UX-03B2
대상 후보로 기록).

## 11. Handoff 문구 처리

`app/articles/[id]/blog/page.tsx`에서 사용자에게 보이는 라벨 3곳을
한국어로 바꿨다: 로그 필터 옵션(`{ key: "handoff", label: "Handoff" }`
→ `"수동 게시 준비"`), "Step 7. 게시 체크리스트 / Handoff" → "Step 7.
게시 체크리스트 / 수동 게시 준비", 안내 문장의 "handoff를 준비합니다" →
"수동 게시 준비 완료 여부를 표시합니다"로 재작성. `lib/social/status-labels.ts`의
기존 `handoff_status: "수동 게시 준비"` 매핑과 용어를 통일했다.
`completePlatformExportHandoffAction`/`getChecklistHandoffMismatchNotice`
같은 함수명·내부 식별자는 지시대로 바꾸지 않았다.

## 12. AdvancedDetails와의 역할 분리

기본 화면(WorkflowStatusCard/AutoReviewSummaryCard·HumanReviewPanel/
NextActionPanel)에는 Level 1 정보만 남기고, WordPress Post/Draft
ID·raw enum·로그처럼 Level 2/3 정보는 계속 `AdvancedDetails`(UX-03A에서
신설) 접힘 안에만 둔다 — 이번 Phase에서 새로 Level 3 정보를
WorkflowStatusCard/NextActionPanel로 끌어올린 곳은 없다(정적 소스
검사로 확인: 두 컴포넌트 모두 raw enum/ID를 렌더링하지 않는다).

## 13. 수정한 파일 목록

**신규**:
- `lib/ui/next-action-view-model.ts`, `.test.ts`
- `lib/ui/workflow-status-view-model.ts`, `.test.ts`
- `components/workflow/next-action-panel.tsx`, `.test.tsx`
- `components/workflow/workflow-status-card.tsx`, `.test.tsx`
- `docs/ux/ux-03b1-workflow-next-action.md`(이 문서)

**페이지 수정**:
- `app/articles/[id]/blog/page.tsx`, `.test.ts` — WorkflowStatusCard/NextActionPanel 적용, Handoff 라벨 3곳 한국어화
- `app/articles/[id]/social/page.tsx`, `.test.ts` — WorkflowStatusCard/NextActionPanel 적용(autoFix 우선순위 로직 유지)
- `app/social-posts/[id]/page.tsx`, `.test.ts` — 승인 완료 이후 영역에 NextActionPanel 적용

**문서**: `docs/ux/full-ux-audit.md`, `docs/ux/ux-refactor-roadmap.md`, `docs/ui-ux-governance-rules.md`(업데이트)

## 14. 테스트 추가/수정 내역

- `next-action-view-model.test.ts`: 13개(3개 adapter × 상태 매핑/message/raw enum 미노출)
- `workflow-status-view-model.test.ts`: 9개(2개 adapter × idle/in_progress/needs_attention/completed 등)
- `next-action-panel.test.tsx`: 9개(primary 1개 제한/secondary 다수/disabledReason/blocked/completed/fallback/무반응 방지/raw state 미노출/in_progress+progressContent)
- `workflow-status-card.test.tsx`: 10개(6개 state 렌더링/completed·remaining 표시/heading 커스터마이즈/raw state 미노출)
- `app/articles/[id]/blog/page.test.ts`: 기존 3개 테스트 갱신 + Handoff 라벨 검증 2개 신규(211개로 증가)
- `app/articles/[id]/social/page.test.ts`: 기존 6개 테스트 갱신(43개 유지, 내용 갱신)
- `app/social-posts/[id]/page.test.ts`: 기존 1개 테스트 갱신(51개 유지)

## 15. lint 결과

`npm run lint` — 오류 없음(출력 없음).

## 16. test 결과

전체 스위트: **263 files / 3407 tests passed**, 실패 없음.

## 17. build 결과

`npm run build` 성공(`next build`, Turbopack, TypeScript 통과, 19개 route
모두 정상 생성). 타입 통합 과정에서 `WordPressPublishPrepAction`(좁은
문자열 유니온)과 `NextActionViewModelAction`(넓은 `string`) 사이의
함수 매개변수 반공변성(contravariance) 이슈가 있었다 — `renderPrepActionButton`의
매개변수 타입을 `NextActionViewModelAction`으로 통일해 해결했다(switch
문의 케이스 비교는 런타임에 영향 없음, 미사용 `WordPressPublishPrepAction`
타입 import도 함께 정리).

## 18. 현재 남아 있는 High 문제

- X 플랫폼 카드의 inline 수정 불가 — UX-03A에서 조사한 데이터 계약
  차이(threadItems 배열)는 그대로 유효, 실제 구현은 UX-03B2.
- `/articles/[id]/rewrite`의 "승인" 계열 용어 3종 혼용 — 문구/구현
  변경 없음, UX-03B2/UX-05 대상.
- 우선순위 2 route(`/articles/[id]`, `/dashboard/blog`, `/dashboard`)에는
  아직 NextActionPanel/WorkflowStatusCard를 적용하지 않았다.
- `app/social-posts/[id]/page.tsx` 상단 요약 카드의
  `getSocialPostWorkspacePrimaryAction`(4번째 next-action helper, `{kind,
  label}` shape)은 이번 통합 대상에서 제외됐다 — NextActionViewModel과
  shape이 달라 별도 어댑터가 필요하다.
- `PlatformBadge` 계열 미통합(`/trends`, `/themes/[themeId]`).

## 19. UX-03B2에서 처리해야 할 항목

1. X 플랫폼용 `InlinePostBodyEditor` 배열(threads) 모드 추가 + 실제 X 카드 적용
2. `/articles/[id]/rewrite` "승인" 계열 용어 3종 정리
3. 우선순위 2 route(`/articles/[id]`, `/dashboard/blog`, `/dashboard`)에 WorkflowStatusCard/NextActionPanel 적용 검토(`/dashboard`는 기존 패턴이 이미 좋으므로 "더 단순해지는 영역에만" 신중히 적용)
4. `getSocialPostWorkspacePrimaryAction`을 NextActionViewModel과 통합할지, 별도로 유지할지 결정
5. `PlatformBadge` 계열 공통 컴포넌트 통합

---

**UX-03B1에서는 주요 화면의 현재 상태와 다음 작업 표현을 공통화했으며,
X inline edit와 rewrite 용어 정리는 UX-03B2로 남겼습니다.**
