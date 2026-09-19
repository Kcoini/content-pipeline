# UX-03A: Common UX Foundation

- 작성일: 2026-09-18
- 범위: 공통 UX 기반 컴포넌트 구축(AdvancedDetails/AutoReviewSummaryCard/
  InlinePostBodyEditor/HumanReviewPanel)과 중복 구현 정리, 상태 의미
  semantic audit. `docs/ux/full-ux-audit.md`, `docs/ux/user-journey-audit.md`,
  `docs/ux/ui-information-levels.md`, `docs/ux/ux-refactor-roadmap.md`,
  `docs/ux/ux-02a-critical-safety-cleanup.md`,
  `docs/ux/ux-02b-wordpress-blog-cleanup.md`, `docs/ui-ux-governance-rules.md`를
  먼저 읽고 작업했다.
- 이번 Phase에서 하지 않은 것: NextActionPanel/WorkflowStatusCard의 전면
  적용(조사와 공통 契約 제안만 함), PlatformBadge 통합, X inline edit
  실제 구현, rewrite 승인 용어 문구 변경, DB schema/migration/API/승인
  로직/public publish 로직 변경, 전체 route 재작성 — 전부 UX-03B/UX-05
  이후로 남긴다.

---

## 1. 상태 의미 semantic audit 결과

### article.status = "reviewed"의 실제 의미

**결론: "승인됨"이 맞다.** 근거:

1. `lib/types/domain.ts:117`: `ArticleStatus = "draft" | "reviewed" | "published"` — `"approved"`라는 별도 값 자체가 존재하지 않는다.
2. `app/articles/[id]/actions.ts:1724-1729`의 `approveArticleAction` 독스트링: `"draft 상태 기사를 사용자 승인을 거쳐 reviewed로 전환한다 (FR-9)"`. 이 action의 버튼 라벨은 "승인하기"다.
3. `lib/repositories/article-repository.ts:457-513`의 `approveArticle` 함수 독스트링: `"사용자의 명시적 승인을 받아 기사를 status='reviewed'로 전환한다"`. `assertApproved({ toStatus: "reviewed", approved: true, ... })`를 호출하고, 로그에 `action: "approve_article", status: "approved"`를 남긴다.
4. `db/schema.sql:26-31`: `-- article 상태: draft -> reviewed -> published`. 여기도 `approved`라는 별도 enum 값은 없다.
5. **가장 결정적인 근거**: `docs/phase-2-23-wordpress-draft-approval-status-clarity.md`(이미 존재하는 프로젝트 문서)가 이 질문에 정확히 답한 바 있다 — *"이 프로젝트에는 `approval_status`라는 별도의 필드가 없다"*, *"`reviewed` = 사람이 '승인하기'를 눌러 승인 완료(검토+승인이 한 단계)"*. 즉 이 모델에서는 "검토"와 "승인"이 별개 단계가 아니라 **하나의 게이트**다.
6. 기존 `STATUS_LABEL` 상수(`app/articles/page.tsx:12-14`, `app/articles/[id]/page.tsx:99-101`)가 이미 Phase 2-23 때부터 `reviewed: "승인됨 (reviewed)"`로 번역해 왔다 — UX-02B의 `describeArticleStatus`는 새 규칙을 만든 게 아니라 **기존 프로젝트 컨벤션을 그대로 재확인**한 것이다.

**결론: UX-02B에서 추가한 `describeArticleStatus`의 `reviewed → "승인됨"` 매핑은 정확하며 수정할 필요가 없다.**

### approval_status의 reviewed/approved와의 차이

`approval_status`(social_posts 테이블, 값: `not_requested`/`pending_review`/`approved`/`rejected`/`revoked`)는 `article.status`(articles 테이블, 값: `draft`/`reviewed`/`published`)와 **완전히 다른 도메인 객체**다. 두 필드 사이에 이름 충돌은 없다 — `approval_status`에는 애초에 `"reviewed"`라는 값 자체가 없다.

진짜 충돌 지점은 **raw 문자열 `"reviewed"`가 두 가지 다른 필드에서 재사용되는 것**이다:
- `article.status`(마스터 승인 게이트, `lib/harness/approval-gate.ts`가 강제) → "승인됨"
- `wpMetadataStatus`/`seoPluginMetadataStatus`/`featuredImageStatus`/`WordPressFinalDraftReviewStatus`(선택적 하위 항목이 "누군가 한 번 봤다"는 의미의 비강제 플래그) → "검토 완료"

이 두 개념은 실제로 다르다(하나는 아무것도 막지 않는 참고용 플래그, 다른 하나는 `approval-gate.ts`가 실제로 강제하는 게이트) — 그래서 **다른 한국어 라벨을 쓰는 것이 의도된 정확한 동작**이지, 버그가 아니다. `docs/phase-2-23-wordpress-draft-approval-status-clarity.md`가 이미 이 구분을 명문화했다.

**추가로 필요한 조치는 없다** — 이 semantic audit은 "혹시 UX-02B가 잘못된 매핑을 만들었는지" 검증하는 것이 목적이었고, 검증 결과 문제가 없었다.

---

## 2. AdvancedDetails 구현 및 적용 위치

**구현**: `components/common/advanced-details.tsx` — `title`(기본값 "상세 상태 보기"), `defaultOpen`(기본 false), `testId`, `className`, `children`을 받는 얇은 `<details>` 래퍼. API key/token/raw body/prompt 원문은 이 컴포넌트 계약에 포함하지 않는다(호출 측이 넣지 않도록 코드 주석으로 원칙을 명시).

**적용 위치** (기존 개별 `<details>` 구현 4곳을 치환):
1. `components/wordpress/wordpress-publishing-panel.tsx` — "상세 상태 보기" (UX-02B에서 만든 접힘)
2. `app/articles/[id]/blog/page.tsx` — "내부 상태값 보기" (WordPress 반영 탭)
3. `app/articles/[id]/blog/page.tsx` — "상세 상태 보기 (관리자용, 기본 접힘)" (카드 상단 요약). **이 자리에서 raw enum 노출 하나를 추가로 발견해 함께 고쳤다**: `quality: {post.qualityStatus} · approval: {post.approvalStatus} · ...` 형태로 영문 필드명 + raw enum이 그대로 노출되고 있었다 — `describeStatusField`/`describeStatusValue`로 번역했다(UX-02B가 놓친 부분, 이번에 발견).
4. `app/articles/[id]/social/page.tsx` — "상세 상태 보기 / 보조 작업 (관리자용, 기본 접힘)"

route 레이아웃이나 데이터 흐름은 바꾸지 않았다 — 각 자리의 `title` 문구와 내부 콘텐츠는 그대로 유지했다.

---

## 3. AutoReviewSummaryCard 구현 및 제거한 중복 JSX 위치

**구현**: `components/review/auto-review-summary-card.tsx` — `summarizeAutoReview()`(기존 순수 함수, 변경 없음)가 반환하는 `AutoReviewSummary`를 받아 톤 색상 박스, 통과/확인 필요/수정 필요/차단 카운트, 승인 가능 안내, issue 목록을 렌더링한다. 두 페이지의 문구 차이(글 유형/검토 기준 안내, issue별 액션 링크, 자동 수정 배너)는 손실 없이 유지하기 위해 `contextNote`/`renderIssueActions`/`extraBanner`/`footer`/`labelPrefix`/`maxIssues`/`compact` slot으로 열어 두었다 — 고정 레이아웃으로 강제하지 않았다.

**제거한 중복 JSX**:
- `app/articles/[id]/social/page.tsx:353-381`(목록 카드 안, compact 버전) — 톤 클래스 계산/카운트 줄/issue 목록 로직 전체를 컴포넌트로 이동. 기존 시각적 출력은 동일하다(`compact`, `labelPrefix="자동 검토 결과: "`, `maxIssues={5}`로 원래 동작 재현).
- `app/social-posts/[id]/page.tsx`(상세 화면, 전체 리포트 버전, 옛 라인 기준 약 444-552) — 동일하게 컴포넌트로 이동, issue별 [수정하기]/[본문 위치 보기] 링크와 자동 수정 배너는 `renderIssueActions`/`extraBanner`로 그대로 유지, 하단 "자동 수정 후 재검토"/"자동 재검토 실행" 버튼은 `footer`로 유지.

세 번째 위치(`app/social-posts/[id]/page.tsx:273-276`의 dt/dd 압축 한 줄 요약, `:1150-1157`의 최종 승인 패널 dt/dd 카운트)는 이번 Phase에서 건드리지 않았다 — 이미 충분히 압축된 한 줄/두 줄 요약이라 공통 컴포넌트로 바꿔도 코드량이 줄지 않고, 오히려 range 조정 리스크만 커진다고 판단했다.

---

## 4. InlinePostBodyEditor 구현 및 적용 위치

**구현**: `components/social/inline-post-body-editor.tsx` — `SocialPostBodyPanel`의 편집 모드 UI(textarea + 저장 후 승인/저장 후 자동 검토/저장만 하기/취소)만 그대로 추출했다. **Server Action form 기반 저장 방식을 그대로 유지**했다 — client-side `value`/`onChange` 콜백으로 강제 통합하지 않았다(중복 UI 조사 fork가 확인한 제약: `SocialPostBodyPanel`은 `<form action={saveAction}>`을 쓰고, 저장 방식(저장만/저장+검토/저장+승인) 구분도 버튼의 `name="saveMode"` value로 하지 콜백 3개로 하지 않는다 — 이 계약을 그대로 보존해야 기존 호출부(`saveSocialPostInlineEditAction`)를 바꾸지 않고 재사용할 수 있다).

**적용 위치**: `components/social/social-post-body-panel.tsx`가 이 컴포넌트를 내부에서 사용하도록 리팩터링했다 — `SocialPostBodyPanel`은 이미 `app/articles/[id]/blog/page.tsx`에서 2곳 재사용되고 있었으므로, 이번 추출로 실질적인 재사용 범위가 넓어졌다(향후 새 카드가 "본문 하나만 inline 편집"이 필요하면 `SocialPostBodyPanel` 전체가 아니라 `InlinePostBodyEditor`만 가져다 쓸 수 있다). 렌더링 결과는 리팩터링 전후 **100% 동일**하다(정적 소스 검사 + `renderToStaticMarkup` 테스트로 확인).

**`/social-posts/[id]`의 "수정하기" 탭에는 적용하지 않았다** — 중복 UI 조사에서 확인된 대로, 그 탭은 단일 본문 편집기가 아니라 제목/본문 또는 threadItems(JSON)/caption/hashtags/cardItems(JSON)까지 다루는 **다중 필드 메타데이터 편집기**이고 별도 action(`editSocialPostAction`)을 쓴다 — `InlinePostBodyEditor`(본문 전용) 계약으로 대체하면 기능이 유실된다. 이 탭의 통합 여부는 UX-03B에서 별도로 검토해야 한다.

---

## 5. HumanReviewPanel 구현 및 적용 위치

**구현**: `components/review/human-review-panel.tsx` — 지시된 `HumanReviewItem` 인터페이스(`id`/`label`/`description?`/`severity?`/`actionLabel?`/`actionHref?`) 그대로 구현했다. `items.length === 0`이면 "확인할 사항 없음"만 compact하게 보여주고, `severity`는 항상 한국어 배지("참고"/"확인 필요"/"승인 불가")로 표시한다 — raw fixability enum(`auto_fixable`/`user_confirmation_required`/`blocking`)은 절대 그대로 노출하지 않는다.

**데이터 소스**: 이 컴포넌트 자신은 분류하지 않는다 — 호출 측이 이미 존재하는 `lib/social/review-issue-fixability.ts`의 `summarizeReviewIssues()`(변경 없음)로 checklist를 분류한 뒤, `userConfirmationRequired` + `blocking` 항목만 `HumanReviewItem[]`으로 변환해 넘긴다. `autoFixable` 항목은 이 패널에 넣지 않는다 — 이미 별도의 "자동으로 정리할 수 있는 항목 N개" 안내가 그 항목들을 다룬다.

**적용 위치**: `app/social-posts/[id]/page.tsx`의 "최종 승인" 패널(`#final-approval-panel`) — 기존 dt/dd 카운트 요약("확인 필요 / 수정 필요 / 차단: N개 / N개 / N개") 아래, **승인 전에만** 실제 항목 목록을 보여준다(승인 완료 후에는 숨긴다 — 더 이상 확인할 필요가 없으므로). 기존 카운트 dt/dd는 그대로 유지했고(삭제 없음), 이 패널은 그 아래 추가로 붙은 것이라 기존 기능을 대체하지 않는 **순수 추가**다.

**적용하지 않은 위치**: `app/articles/[id]/social/page.tsx`의 목록 카드 자동 검토 요약에는 적용하지 않았다 — 카드가 이미 조밀한 목록 뷰이고, 승인 전 최종 확인 지점(`social-posts/[id]`)에서 한 번 더 명확하게 보여주는 것이 더 가치 있다고 판단했다. 전면 적용은 UX-03B에서 검토한다.

---

## 6. NextAction 공통 ViewModel 조사 결과

기존 helper 3개의 반환 shape을 비교했다(fork 조사 결과):

| 필드 | `getWordPressPublishPrepState` | `getSocialPostCardActionState` | `getPostApprovalNextActions` |
|---|---|---|---|
| 상태 한 줄 요약 | `statusLabel` | `statusBadge` | `message` |
| primary action | `primaryAction: {label, actionType, href?}` | `primaryAction: {label, actionType}` | `primaryAction: {label, actionType}` |
| secondary actions | `secondaryActions[]` | `secondaryActions[]` | `secondaryActions[]`(항상 최소 1개, 빈 배열 없음) |
| 완료/미완료 목록 | `completedItems[]`, `remainingItems[]` | 없음 | 없음 |
| 차단 사유 | `blockingReasons[]` | 없음(개별 `describeXxxDisabledReason` 함수가 담당) | 없음 |
| 실행 가능 플래그 | `canReflectToWordPress` | 없음(primaryAction 존재 여부로 암묵 판단) | 없음 |

공통점: 셋 다 `{label, actionType}` 형태의 action 객체 + primary 1개·secondary N개 구조를 쓴다. 차이는 "현재 상태 한 줄" 필드명(`statusLabel`/`statusBadge`/`message`)과 `completedItems`/`remainingItems`/`blockingReasons`(prep-state에만 있음)다. `rewrite-version-user-facing-status.ts`류 함수는 이 패턴을 아예 따르지 않고 `{kind, label}` 단일 액션만 반환한다 — 공통 통합 시 이 gap을 메워야 한다.

**제안하는 공통 契約(UX-03B에서 실제 통합 시 시작점)**:

```ts
export interface NextActionViewModel {
  statusMessage: string; // statusLabel/statusBadge/message를 여기로 통일
  primaryAction: { label: string; actionType: string; href?: string; disabled?: boolean; disabledReason?: string };
  secondaryActions: Array<{ label: string; actionType: string; href?: string }>;
  completedItems?: string[]; // optional — prep-state류만 채움
  remainingItems?: string[];
  blockingReasons?: string[];
}
```

이번 Phase에서는 이 타입을 코드에 추가하지 않았다(문서 제안 수준) — 실제 통합은 기존 3개 helper의 반환값을 이 shape으로 매핑하는 어댑터 함수부터 시작하는 것을 권장한다(각 helper 자체를 다시 쓰지 않는다).

---

## 7. WorkflowStatus 공통 ViewModel 조사 결과

`/dashboard`의 `lib/dashboard/dashboard-workflow-presentation.ts`를 조사했다:

- `DashboardWorkflowState`(`lib/dashboard/source-display.ts`) 실제 값 6개: `needs_theme | needs_source | ready_to_generate | needs_platform_posts | needs_review | ready_for_publish_prep`
- `getWorkflowStateTone(state)` → `{containerClassName, headingClassName, bodyClassName, badgeLabel, badgeClassName}`(5색 배지 체계: 회색=시작 전 / 파랑=진행중·다음 작업 / 노랑=확인 필요 / 초록=완료·가능 / 빨강=미사용)
- `getDashboardStatusSummary(state, ctx)` → `{headline, nextAction, primaryActionLabel, primaryActionHref, secondaryActionLabel?, secondaryActionHref?}`
- `getDashboardSectionExpansion(state)` → `{sourceAddExpanded, draftGenerationExpanded, platformGenerationExpanded}`(다른 helper엔 대응 개념이 없는, 대시보드 전용 섹션 접힘 제어)
- `getDashboardCurrentStepArea(state)` → `"source" | "draft" | "platform" | null`(지금 강조할 영역)

**제안하는 공통 契約**:

```ts
export interface WorkflowStatusViewModel {
  state: "idle" | "in_progress" | "needs_attention" | "ready" | "completed" | "blocked";
  title: string;
  message?: string;
  tone: { containerClassName: string; badgeLabel: string; badgeClassName: string };
}
```

`getDashboardSectionExpansion`/`getDashboardCurrentStepArea`는 대시보드 특유의 "여러 섹션 중 하나만 펼침" 구조를 위한 것이라 이 공통 契約에는 포함하지 않았다 — 대시보드 전용 확장으로 남겨야 한다. 이번 Phase에서는 새 `WorkflowStatusCard`를 만들지 않았다(지시사항: "무리해서 모든 페이지에 적용하지 않는다").

---

## 8. X inline edit를 UX-03B에서 적용하기 위해 필요한 차이

`lib/social/social-post-inline-edit-service.ts:42-46`의 `getSocialPostEditableField`: `PLATFORM_WRITING_CONFIGS[platform].supportsThreads`가 true(X)면 무조건 `null`을 반환한다(주석: "x는 threadItems 배열 기반 콘텐츠라 단일 textarea로 안전하게 수정할 수 없다"). `getSocialPostEditableField(post.platform) !== null`이 여러 화면(`social/page.tsx` 등)에서 inline 편집 가능 여부 게이트로 쓰인다.

**공통 `InlinePostBodyEditor`가 X를 지원하려면**: 현재 계약(`value: string` 단일 문자열)을 그대로 확장할 수 없다 — `value: string | ThreadItem[]`(또는 `mode: "body" | "threads"` discriminated prop)을 받고, threads 모드에서는 스레드 항목별 여러 textarea + 항목 추가/삭제 UI가 필요하다. 이번 Phase에서 만든 `InlinePostBodyEditor`는 "본문 하나(단일 문자열)"만 다루는 계약이므로, X 지원은 이 컴포넌트에 새 모드를 추가하는 형태(하위 호환 유지, 기존 `value: string` 사용처는 그대로 두고 옵션으로 배열 모드 추가)가 될 것이다 — UX-03B에서 실제 구현 필요.

---

## 9. rewrite 승인 용어의 실제 state 의미 조사 결과

`app/articles/[id]/rewrite/page.tsx`의 세 버튼은 실제로 **완전히 다른 3개 state machine**을 다룬다(혼동 문제는 실재한다):

| 버튼 | action | 바꾸는 상태 | 실제 의미 |
|---|---|---|---|
| 개선 제안 승인 | `approveRewriteSuggestionAction` → `approveRewriteSuggestion` | `social_post_rewrite_suggestions.suggestion_status`만 | AI가 제안한 재작성 아이디어 자체를 채택할지 — 아직 아무 글도 만들어지지 않은 단계 |
| 재승인 요청 | `requestRewriteReapprovalAction` → `requestRewriteReapproval` | `rewrite_reapproval_status`/`approval_status`(둘 다 "pending_review")/`rewrite_republish_workflow_status`("reapproval_pending") | 이미 생성된 rewrite version 글(적용된 개선안으로 실제 만들어진 새 글)을 재게시용으로 재검토 요청 |
| 재승인 승인하기 | `approveRewriteReapprovalAction` → `approveRewriteReapproval` | `rewrite_reapproval_status`/`approval_status`(둘 다 "approved")/`rewrite_republish_workflow_status`("reapproved") | 위 재검토 요청을 최종 승인 — quality_status가 "ready"여야 하고 forbidden pattern guard도 통과해야 함(실질적 최종 게이트) |

세 버튼은 실제로는 순차 단계(제안 승인 → 개선안 적용으로 새 글 생성 → 재승인 요청 → 재승인 승인)를 나타내지만, "승인"이라는 단어가 세 곳에 다른 의미로 쓰여 사용자가 혼동하기 쉽다는 UX-01 감사의 지적은 근거가 확인됐다. 이번 Phase에서는 문구를 바꾸지 않았다(지시사항: UX-03B/UX-05에서 처리) — 실제 문구 변경 시에는 세 번째("재승인 승인하기")가 유일한 실질적 최종 게이트라는 점을 명확히 드러내는 방향을 권장한다.

---

## 10. 수정한 파일 목록

**신규 컴포넌트/테스트**:
- `components/common/advanced-details.tsx`, `.test.tsx`
- `components/review/auto-review-summary-card.tsx`, `.test.tsx`
- `components/review/human-review-panel.tsx`, `.test.tsx`
- `components/social/inline-post-body-editor.tsx`, `.test.tsx`

**기존 컴포넌트 리팩터링**:
- `components/social/social-post-body-panel.tsx`, `.test.tsx` — InlinePostBodyEditor 재사용
- `components/wordpress/wordpress-publishing-panel.tsx`, `.test.ts` — AdvancedDetails 재사용

**페이지 수정**:
- `app/articles/[id]/blog/page.tsx`, `.test.ts` — AdvancedDetails 2곳 적용 + raw enum 노출 1건 추가 수정
- `app/articles/[id]/social/page.tsx`, `.test.ts` — AdvancedDetails 1곳 + AutoReviewSummaryCard 적용
- `app/social-posts/[id]/page.tsx`, `.test.ts` — AutoReviewSummaryCard + HumanReviewPanel 적용

**공유 헬퍼**:
- `lib/social/status-labels.ts` — 변경 없음(UX-02B에서 이미 필요한 항목 추가됨, 이번엔 semantic audit으로 검증만)

**문서**:
- `docs/ux/ux-03a-common-ux-foundation.md`(신규, 이 문서)
- `docs/ux/full-ux-audit.md`, `docs/ux/ux-refactor-roadmap.md`, `docs/ui-ux-governance-rules.md`(업데이트)

## 11. 추가/수정 테스트

- `advanced-details.test.tsx`: 6개(기본 닫힘/title/children 접근성/defaultOpen/testId/개발자 용어 미사용)
- `auto-review-summary-card.test.tsx`: 10개(카운트/labelPrefix/maxIssues/renderIssueActions/extraBanner/footer/hideIssueList/raw enum 미노출/톤 클래스)
- `human-review-panel.test.tsx`: 8개(0개/emptyMessage/1개/여러 개/severity 배지/액션 링크/액션 없음/raw enum 미노출)
- `inline-post-body-editor.test.tsx`: 8개(렌더링/버튼 4종/hidden input/취소/server action 유지/saveMode 3종/textarea/빈 본문 미검증)
- `social-post-body-panel.test.tsx`: 편집 모드 상세 검사를 InlinePostBodyEditor 재사용 확인으로 교체
- `wordpress-publishing-panel.test.ts`: AdvancedDetails 재사용 확인 테스트 추가, 기존 "상세 상태 보기" 관련 테스트 갱신
- `app/articles/[id]/blog/page.test.ts`: 2개 갱신(AdvancedDetails 재사용 확인으로)
- `app/articles/[id]/social/page.test.ts`: 1개 갱신(AutoReviewSummaryCard 재사용 확인으로)
- `app/social-posts/[id]/page.test.ts`: 1개 갱신 + 신규 3개(HumanReviewPanel 적용 확인)

## 12. lint 결과

`npm run lint` — 오류 없음(초기 1개 unused-var 경고 발견 후 수정, 최종 출력 없음).

## 13. test 결과

전체 스위트: **259 files / 3364 tests passed**, 실패 없음.

## 14. build 결과

`npm run build` 성공(`next build`, Turbopack, TypeScript 통과, 19개 route 모두 정상 생성).

## 15. 현재 남아 있는 High 문제

- `app/articles/[id]/blog/page.tsx:149-157` 로그 필터 라벨의 "Handoff" 영문 표기
- X 플랫폼 카드의 inline 수정 불가(상세 페이지 이동 필요) — 필요한 데이터 계약 차이는 8번에 문서화, 실제 구현은 UX-03B
- `/articles/[id]/rewrite`의 "승인" 계열 용어 3종 혼용 — 실제 state 의미는 9번에 문서화, 실제 문구 변경은 UX-03B/UX-05
- `NextActionPanel`/`WorkflowStatusCard`의 전면 적용 미완료(이번 Phase는 조사 + 契約 제안까지만)
- `PlatformBadge`류 컴포넌트가 `/trends`, `/themes/[themeId]`에 개별 구현되어 있음(미통합)

## 16. UX-03B에서 실제 적용할 route 우선순위

1. **`NextActionViewModel` 실제 통합** — `getWordPressPublishPrepState`/`getSocialPostCardActionState`/`getPostApprovalNextActions`를 6번에서 제안한 공통 shape로 매핑하는 어댑터부터 시작. 영향 범위가 가장 넓어 우선순위 1.
2. **`InlinePostBodyEditor`에 threads 모드 추가 + X 카드 적용** — 8번에서 확인한 데이터 계약 확장.
3. **`/articles/[id]/rewrite` 용어 정리** — 9번 조사 결과를 바탕으로 "재승인 승인하기"가 유일한 최종 게이트임을 드러내는 문구로 개편(UX-05와 협의).
4. **`AutoReviewSummaryCard`/`HumanReviewPanel`을 나머지 카드(blog 카드, 목록 카드)에도 확대 적용** — 이번 Phase는 social-posts/[id] 1곳 + social 목록 카드 1곳만 적용.
5. **`PlatformBadge` 통합** — `/trends`, `/themes/[themeId]` 중복 구현 정리.
6. **`WorkflowStatusViewModel` 기반 `WorkflowStatusCard` 신설 및 dashboard 외 화면 적용 검토**.

---

**UX-03A에서는 공통 UX 기반과 중복 구현 정리를 진행했으며, 주요 사용자 화면 전체 적용은 UX-03B로 남겼습니다.**
