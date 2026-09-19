# UX-04A: AI Handles Routine Fixes, Humans See Only Real Decisions

- 작성일: 2026-09-18
- 범위: 이미 존재하는 자동 검토(quality gate)/자동 수정(post-auto-fix-service)/
  재검토 파이프라인을 새로 만들지 않고, "AI가 안전하게 처리할 수 있는
  문제는 자동 처리 → 사람에게 보이지 않음 / 사람 판단이 필요한 문제만
  표시 / 최종 승인은 항상 사람"이라는 원칙에 맞게 사용자 화면을 다시
  정리했다. `docs/ux/full-ux-audit.md`, `docs/ux/user-journey-audit.md`,
  `docs/ux/ui-information-levels.md`, `docs/ux/ux-refactor-roadmap.md`,
  `docs/ux/ux-03a-common-ux-foundation.md`,
  `docs/ux/ux-03b1-workflow-next-action.md`,
  `docs/ux/ux-03b2-interaction-consistency.md`,
  `docs/ux/ux-03c-route-adoption-platform-labels.md`,
  `docs/ui-ux-governance-rules.md`를 먼저 읽고 작업했다.
- 작업 방식: 코디네이터가 공유 기반(계산 로직 + 공통 컴포넌트 확장)을
  먼저 만들고, 우선순위 1~3 route를 파일 범위가 겹치지 않는 3개 fork로
  병렬 적용했다.
- 이번 Phase에서 하지 않은 것: review algorithm 전면 재작성, 새로운
  AI 모델 도입, DB migration, approval state machine 변경, publish
  logic 변경, public publish 변경, 새 플랫폼 추가, 전체 dashboard
  redesign, 전체 CSS rewrite, 다건 일괄 승인 구현(UX-04B로 분리).

---

## 1. 자동처리 vs 사람확인 원칙

기존에 이미 구현되어 있던 3단계 분류(`lib/social/review-issue-fixability.ts`)를
그대로 재사용했다 — 새 분류 체계를 만들지 않는다.

| fixability | 의미 | 사용자에게 보여줄 것 |
|---|---|---|
| `auto_fixable` | AI/시스템이 사람에게 묻지 않고 안전하게 고칠 수 있는 문제(구현된 sanitizer가 있으면 `canAutoFix=true`로 자동 처리, 없으면 아직 사람이 "본문 수정"으로 직접 고쳐야 하지만 여전히 "사실 판단이 필요한 문제"는 아님) | 기본 화면에서 숨김. "자동 검토 상세"에서만 확인 가능 |
| `user_confirmation_required` | 사실/출처/수치/기관명 등 AI가 임의로 단정할 수 없는 문제 | `HumanReviewPanel`에 표시 |
| `blocking` | 개인정보/허위/위험 표현 등 승인을 막아야 하는 문제 | `HumanReviewPanel`에 표시(승인 불가 배지) |

## 2. 기본 검토 UI — 5단계 사용자 상태 모델

`lib/social/social-post-auto-review.ts`에 `summarizeUserFacingReview(qualityStatus, review, checklist)`를 신설했다. 기존 축 기반 리포트(`summarizeAutoReview`, structure/source/platform_fit/tone/safety 축)와 fixability 기반 분류(`classifyReviewIssues`)를 **같은 checklist에 대해 각각 계산한 뒤 key로 교차 참조**한다 — 두 분류 로직을 합치거나 새로 만들지 않았다.

```ts
export type UserFacingReviewState = "checking" | "ready" | "needs_confirmation" | "blocked" | "failed";

export interface UserFacingReviewSummary {
  state: UserFacingReviewState;
  stateLabel: string;   // "자동 검토 중" / "승인 가능" / "확인 필요" / "문제 해결 필요" / "자동 검토 실패"
  stateMessage: string; // 한 문장 설명
  headline: string;     // 기존 review.overallLabel 재사용("자동 검토 완료" 등)
  confirmationCount: number;      // auto_fixable을 제외한, 사람이 봐야 하는 issue 개수
  hiddenAutoFixableCount: number; // 기본 화면에서 숨긴 auto_fixable issue 개수
  visibleIssues: AutoReviewIssue[]; // auto_fixable 제외 issue 목록
}
```

state 판단: `qualityStatus === "failed"` → failed / `"not_checked"` → checking /
`review.overallStatus === "blocked"` → blocked / `confirmationCount > 0` →
needs_confirmation / 그 외 → ready. blocked 항목은 `classifyReviewIssue`에서
언제나 `fixability: "blocking"`으로 고정되어 auto_fixable 필터에 걸러지지
않으므로, blocked 판정이 놓치는 경우는 없다.

## 3. HumanReviewPanel 역할

UX-03A에서 신설된 `HumanReviewPanel`은 조사 결과 **이미 원칙대로
구현되어 있었다** — `items.length === 0`이면 "확인할 사항 없음"만
compact하게 보여주고, raw fixability enum을 노출하지 않으며, severity를
"참고"/"확인 필요"/"승인 불가" 한국어 배지로 표시한다. 이번 Phase에서
컴포넌트 자체는 수정하지 않았다. 대신 각 호출부(`app/social-posts/[id]/page.tsx`)에서
`humanReviewItems`를 만들던 수동 필터(`humanReviewKeys` Set 계산)가
`summarizeUserFacingReview()` 내부와 동일한 `classifyReviewIssues()` 호출을
**중복** 수행하고 있던 것을 확인해, `userFacingReview.visibleIssues`를
직접 재사용하도록 정리했다(출력은 100% 동일, 중복 계산만 제거).

## 4. AutoReviewSummaryCard 역할 변경

`components/review/auto-review-summary-card.tsx`에 선택적 `userFacingSummary?: UserFacingReviewSummary` prop을 추가했다.

- **전달하지 않으면** 기존 동작 100% 그대로(통과/확인 필요/수정 필요/차단 4개 카운트 + 전체 issue 목록을 항상 보여줌) — 하위 호환.
- **전달하면** 기본 화면이 다음처럼 단순화된다:
  - 카운트 줄 → `확인할 사항 N건` 또는 `확인할 사항 없음`
  - issue 목록 → `userFacingSummary.visibleIssues`(auto_fixable 제외)만
  - 원래의 4개 카운트 줄 + 전체 issue 목록(auto_fixable 포함) + "auto_fixable N건은 사람이 직접 확인할 필요가 없다"는 안내는 컴포넌트가 자동으로 `AdvancedDetails title="자동 검토 상세"` 안에 넣어서 보여준다(삭제하지 않음 — 필요하면 여전히 확인 가능).

새 prop을 opt-in으로 설계한 이유: 이 컴포넌트는 3개 route에서 공유되는데, 각 route를 서로 다른 fork가 병렬로 작업했다 — 기존 호출부를 건드리지 않고 각 fork가 독립적으로 새 prop을 붙이는 방식이 회귀 위험을 최소화했다.

## 5. 자동 수정/재검토 흐름

조사 결과, **글 생성 직후 자동 수정 → 자동 재검토는 이미 Phase 4-28에서 구현되어 있었다** — 이번 Phase에서 새로 만들지 않았다.

`lib/social/social-draft-generation-service.ts`의 `generateSocialDraft()`(모든 플랫폼이 공유하는 단일 생성 함수)가 quality gate 실행 후, `qualityResult.status === "needs_revision"`이고 남은 문제가 전부 `auto_fixable && canAutoFix`(`hasOnlyImplementedAutoFixableIssues()`)이면 `runAutoFixAndRecheck()`(`lib/social/post-auto-fix-service.ts`)를 자동 호출한다. `approval_status`는 이 경로에서도 절대 바꾸지 않는다. 이 자동 실행은 생성 직후 1회만 실행되며(무한 반복 방지), 실패해도 생성 자체는 성공으로 처리해 사용자가 수동 재시도(`[자동 수정 후 재검토]`)로 이어갈 수 있다.

이번 Phase에서는 이 사실을 **재확인**하고, 3개 route 모두에서 `[자동 검토 실행]`/`[자동 수정 후 재검토]` 버튼이 기본 성공 흐름에서 경쟁하는 primary로 남아있지 않은지 검증했다 — 결과: 모두 이미 올바르게 구현되어 있었다(`qualityStatus`/checklist를 매 렌더마다 다시 계산하는 기존 로직이 이미 이 원칙을 만족).

## 6. 적용 route

| Route | 적용 내용 |
|---|---|
| `app/articles/[id]/social/page.tsx` (우선순위 1) | 카드별 `AutoReviewSummaryCard`에 `userFacingSummary` 전달 — auto_fixable 숨김. 기존 카드 primary-action 시스템(`getSocialPostCardActionState` + `WorkflowStatusCard`/`NextActionPanel`)은 그대로 두고, review-state 어댑터(`fromUserFacingReviewToWorkflowStatus`/`fromUserFacingReviewToNextAction`)는 **의도적으로 쓰지 않았다** — 카드당 primary action 판단 로직은 하나만 있어야 한다는 원칙(UX-03B1/B2) 때문 |
| `app/social-posts/[id]/page.tsx` (우선순위 2) | `AutoReviewSummaryCard`에 `userFacingSummary` 전달, `humanReviewItems` 계산의 중복 필터링 제거, "지금 상태 요약" 카드의 "자동 검토 결과" dt/dd와 "최종 승인" 패널의 카운트 줄을 `stateLabel`/`stateMessage`/`confirmationCount` 기반 문장으로 단순화(기존 텍스트 위치만 교체 — 새 `WorkflowStatusCard` 인스턴스를 추가하지 않아 UX-03B2가 이미 정리한 "primary action은 하나"라는 결론을 유지) |
| `app/articles/[id]/blog/page.tsx` (우선순위 3) | wordpress_blog 카드의 "Step 1. 품질검사" 탭에 그동안 없었던 issue 가시성을 추가(score/실행시간만 보이고 실제 문제 목록이 전혀 없었던 gap 발견/수정) — `summarizeAutoReview`+`summarizeUserFacingReview`+`AutoReviewSummaryCard`(compact)로 통일. "자동 수정 후 재검토" 버튼도 wordpress_blog에 확장(그동안 `post.platform !== "wordpress_blog"` 조건으로 wordpress_blog만 이 재시도 경로가 없었다). 기존 WordPress 게시 준비용 `WorkflowStatusCard`/`NextActionPanel`(`getWordPressPublishPrepState` 기반, 완전히 다른 개념 — 게시 준비 상태이지 리뷰 상태가 아님)은 건드리지 않았다 |
| `app/articles/[id]/rewrite/page.tsx` | 조사 결과 **적용 대상 아님** — rewrite는 `summarizeAutoReview`/quality-gate 시스템을 전혀 쓰지 않는 별개의 제안/재승인 상태 머신(`rewrite-version-user-facing-status.ts`)이다. auto_fixable 개념 자체가 존재하지 않는다. 변경 없음 |
| news_article/opinion_column | `app/articles/[id]/social/page.tsx`가 아니라 `app/articles/[id]/blog/page.tsx`에서 naver_blog와 같은 카드 branch로 렌더링됨을 확인 — 이 카드들은 wordpress_blog 이전부터 원래 issue-level 목록을 보여주지 않는 compact 요약(`getUserFacingStatus`/`다음 작업` 한 줄 + 상세 페이지 링크) 구조였고, wordpress_blog와 달리 raw 카운트/전체 issue 목록을 노출한 적이 없어 이번 원칙의 위반 사례가 아니다(단, 향후 인라인 issue 미리보기를 추가하면 좋을 후보로 UX-04B 참고 자료에 남겨둔다) |

## 7. 숨긴 내부 검토 정보

`AutoReviewSummaryCard`의 `userFacingSummary` 모드에서 기본 화면(비-AdvancedDetails 영역)에 더 이상 나타나지 않는 것:

- 통과/확인 필요/수정 필요/차단 raw 카운트 줄
- auto_fixable로 분류된 issue(자동으로 정리됐거나 정리 대상인 문제 — 예: 내부 소제목, naver_cafe markdown escape, WordPress heading 구조 등)

`AdvancedDetails title="자동 검토 상세"` 안에는 그대로 남아 있다(raw fixability enum/DB 필드명/전체 prompt/API token 등은 원래도 어디에도 노출하지 않는다 — 이 원칙은 이번 Phase에서도 유지).

## 8. 검토와 승인 구분 확인

3개 route 모두에서 `approveSocialPostAction`(또는 동등한 승인 action)이 프로그래밍적으로 자동 호출되는 지점이 없음을 정적 검사로 확인했다 — 항상 `<form action={approveSocialPostAction}>` 형태의 사용자 제출 폼으로만 존재한다. 자동 검토 통과/자동 수정 완료는 여전히 승인을 대체하지 않는다.

## 9. UX-04B용 MultiPlatformReviewSummary 설계

이번 Phase에서 구현하지 않았다(설계만). 하나의 article에 생성된 여러
플랫폼 글(WordPress/네이버 블로그/네이버 카페/X/Threads/Instagram 등)을
한 번에 요약하기 위한 aggregate ViewModel 후보:

```ts
export interface MultiPlatformReviewSummary {
  total: number;             // 이 article에 생성된 social post 수
  checking: number;          // summarizeUserFacingReview(...).state === "checking"
  ready: number;             // state === "ready" (승인 가능, 아직 미승인)
  needsConfirmation: number; // state === "needs_confirmation"
  blocked: number;           // state === "blocked"
  approved: number;          // approvalStatus === "approved" (review state와 별개 축 — 이미 승인 완료된 글)
}
```

**계산 방법(설계)**: article의 social_post 목록을 순회하며 각 post에
대해 이미 존재하는 `summarizeAutoReview(checklist)` +
`summarizeUserFacingReview(qualityStatus, review, checklist)`를 호출해
`state`별로 카운트하고, `approvalStatus === "approved"`인 post 수를
별도로 센다 — **새 계산 로직을 만들지 않고 이번 Phase에서 이미 구현한
`summarizeUserFacingReview`를 post 여러 개에 반복 적용**하기만 하면
된다. DB에 새 컬럼/테이블을 추가할 필요가 없다(항상 현재 checklist로부터
다시 계산하는 순수 함수 원칙을 그대로 따른다).

**예상 UI**: "전체 6개 중 5개 확인사항 없음 · 1개 확인 필요" 같은 한 줄
요약을 `app/articles/[id]/social/page.tsx`/`app/articles/[id]/blog/page.tsx`
상단에 배치하고, 클릭하면 확인이 필요한 post만 필터링해서 보여주는
방식을 고려할 수 있다(구현은 UX-04B에서).

## 10. 남은 문제

> **업데이트 (2026-09-18, Phase UX-04B)**: H2, H3, 다건 일괄 확인 UX,
> automation-safety 버튼 중복이 모두 해결되었다. 자세한 내용은
> [`docs/ux/ux-04b-multi-platform-review.md`](./ux-04b-multi-platform-review.md) 참고.

- ✅ 해결 (UX-04B) — ~~H2(dry-run 용어), H3(raw enum 버튼 라벨)~~
- `app/articles/[id]/blog/page.tsx`의 naver_blog/news_article/opinion_column 카드는 wordpress_blog처럼 issue-level 미리보기를 아직 갖고 있지 않다(원래도 없었고, 이번 Phase가 이를 위반으로 만들지도 않았지만, 추가하면 더 좋을 후보) — 미해결
- ✅ 해결 (UX-04B) — ~~다건 일괄 확인 UX(Journey 3의 반복 판단 부담)~~
- ✅ 해결 (UX-05A) — ~~markdown/HTML 잔여물 정리(x/threads/instagram 검사 gap)~~
- ✅ 해결 (UX-04B) — ~~`/dashboard/automation-safety`의 버튼 4개→기능 1개 중복~~

---

**UX-04A에서는 AI가 처리할 수 있는 검토·수정 작업을 사용자 기본
흐름에서 숨기고, 사람 판단이 필요한 항목만 전면에 남겼습니다. 다중
플랫폼 일괄 확인 UX는 UX-04B로 남겼습니다.**
