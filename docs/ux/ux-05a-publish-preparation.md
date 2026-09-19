# UX-05A: Unified Post-Approval Publishing Preparation

- 작성일: 2026-09-18
- 범위: "승인 완료 이후 사용자가 무엇을 해야 하는지"를 플랫폼
  capability 기준으로 하나의 공통 UX로 정리했다. 새 publish engine을
  만들지 않고, 이미 존재하는 `getWordPressPublishPrepState`/
  `getPostApprovalNextActions`를 어댑터로 감싼다. `getApprovalGateStatus`
  전수 감사와 x/threads/instagram의 markdown/HTML 잔여물 탐지 gap도
  이번 Phase에서 함께 처리했다. `docs/ux/full-ux-audit.md`,
  `docs/ux/user-journey-audit.md`, `docs/ux/ux-refactor-roadmap.md`,
  `docs/ux/ux-04a-human-review-simplification.md`,
  `docs/ux/ux-04b-multi-platform-review.md`, `docs/ui-ux-governance-rules.md`를
  먼저 읽고 작업했다.
- 이번 Phase에서 하지 않은 것: 자동 public publish, bulk external
  publish, 기존 approval/publish guard 우회, 실제 direct-publish
  capability 신규 구현, 새 route 신설. 실제 게시 실행 UX(성공/부분
  실패/재시도 처리)는 **UX-05B로 분리**했다.

---

## 1. 현재 플랫폼별 실제 게시 capability 조사 결과

코드 조사 결과 **2026-09-18 기준, 어떤 플랫폼에도 실제 "즉시 API
게시"가 구현되어 있지 않다.** `lib/social/platform-api-readiness-checker.ts`는
`PLATFORM_API_PUBLISHING_ENABLED`가 true여도 readiness status가
`"dry_run_ready"` 또는 `"ready_for_future_test"`까지만 도달한다 —
실제 발행 호출 코드 자체가 없다. `lib/social/post-approval-next-actions.ts`도
이미 이 사실을 알고 "게시하기"라는 라벨을 어디서도 반환하지 않는다
(주석에 명시).

실제 구현된 게시 방식은 3가지뿐이다:

| capability | 플랫폼 | 실제로 하는 일 |
|---|---|---|
| `draft` | wordpress_blog | WordPress REST API로 실제 Draft 생성/업데이트(실제 구현됨, 공개 게시는 아님) |
| `manual` | naver_blog, news_article, opinion_column | 본문 복사 + 수동 export 준비 |
| `copy` | naver_cafe, x, threads, instagram | 본문 복사(+ API 연동이 설정되어 있으면 "게시 준비 상태 확인" 보조 링크) |

`lib/ui/publish-preparation-view-model.ts`의 `getPublishCapability(platform)`가
이 표를 코드로 고정한다 — "direct_publish"는 타입에 아예 포함하지
않았다(나중에 실제로 구현되면 그때 추가한다).

## 2. PublishPreparationViewModel 구현 방식

```ts
export type PublishPreparationState = "not_approved" | "needs_attention" | "needs_setup" | "ready" | "in_progress" | "completed" | "failed";

export interface PublishPreparationViewModel {
  platform: SocialPlatform;
  state: PublishPreparationState;
  title: string; message?: string;
  completedItems?: string[]; remainingItems?: string[];
  primaryAction?: { type: string; label: string; href?: string; disabled?: boolean; disabledReason?: string };
  secondaryActions?: Array<{ type: string; label: string; href?: string }>;
}
```

새 business logic을 만들지 않는다 — 두 어댑터가 각각 기존 함수를
감싼다:

- `fromWordPressPublishPrepStateToPublishPreparation(prep, publishStatus)` — `getWordPressPublishPrepState()`(UX-03B1에서 이미 WordPress 카드에 적용된 함수)의 `primaryAction.actionType`을 state로 매핑한다: `generate_post`/`run_quality_gate`/`review_quality_issues`/`request_approval`/`approve` → `not_approved`(승인 이전 단계는 세부 사유와 무관하게 "게시 준비" 관점에서는 아직 승인 전으로 묶는다 — 더 세밀한 구분은 기존 WordPress `WorkflowStatusCard`가 이미 담당), `set_featured_image`/`waive_featured_image`/`prepare_checklist`/`reflect_seo` → `needs_attention`, `create_draft`/`update_draft`/`view_draft` → `ready`.
- `fromPostApprovalNextActionsToPublishPreparation(platform, result, publishStatus, manualPostStatus?)` — `getPostApprovalNextActions()`(UX-03B1에서 승인 완료 이후 다음 작업 계산에 이미 쓰이던 함수)를 감싼다. `check_wordpress_publish_readiness`만 `needs_attention`, 나머지(`copy_body`/`view_detail`/`create_wordpress_draft`/`prepare_manual_export`/`check_api_readiness`)는 전부 `ready`(실제로 지금 클릭 가능한 action이기 때문).
- `notApprovedPublishPreparation(platform)` — 아직 승인되지 않은 post용 공통 헬퍼.

두 어댑터 모두 시작 시 `publishStatus`/`manualPostStatus`를 먼저 확인해 `"published"`/`"posted"`면 `completed`로, `"failed"`면 `failed`로 강제 override한다(어떤 단계에 있든 실제 게시 결과가 최우선).

## 3. PublishPreparationSummaryCard 구조

UX-04B의 `MultiPlatformReviewSummaryCard`와 완전히 같은 패턴이다 —
`lib/ui/multi-platform-publish-preparation-summary.ts`의
`summarizeMultiPlatformPublishPreparation()`이 여러 post의
`PublishPreparationViewModel.state`를 세기만 하고(새 판단 로직 없음),
`components/publish/publish-preparation-summary-card.tsx`가 그 결과를
"전체 N개 / 처리 실패 N개(있을 때만) / 확인 필요 N개 / 게시 설정
필요 N개 / 승인 필요 N개 / 게시 준비 완료 N개 / 처리 중 N개 / 완료
N개"로 렌더링한다. 0개 카테고리는 생략한다.

## 4. PlatformPublishPreparationCard 구조

`components/publish/platform-publish-preparation-card.tsx` — 플랫폼
하나의 상태를 compact하게 보여준다(`platformLabel` + `title` +
`message` + `primaryAction`). 실제 버튼/폼은 페이지마다 라우팅이
다르므로 `renderAction` 콜백으로 호출 측이 구성한다(`AutoReviewSummaryCard`의
`renderIssueActions`, `NextActionPanel`의 `renderAction`과 같은 기존
패턴). `disabled`+`disabledReason`이 있으면 항상 보이는 텍스트로
이유를 표시한다(hover title에만 의존하지 않음 — 프로젝트 전역 규칙).

## 5. WordPress 승인→Draft 흐름

조사 결과 **새 컴포넌트를 추가하지 않았다.** `app/articles/[id]/blog/page.tsx`의
wordpress_blog 카드는 이미 UX-03B1에서 `getWordPressPublishPrepState`
→ `fromWordPressPublishPrepState`/`fromWordPressPublishPrepStateToWorkflowStatus`
→ `WorkflowStatusCard`/`NextActionPanel`로 이 Phase가 요구하는 흐름을
정확히 구현하고 있었다:

- 승인 전 → "승인 필요"
- 승인 완료 + Draft 없음 → "WordPress Draft 만들기"
- Draft 있음 + 대표 이미지/체크리스트/SEO 미해결 → 해당 문제 해결 action
- 모두 해결 + Draft 있음 → "WordPress Draft 보기"
- public publish는 기본 primary action으로 전혀 등장하지 않음(UX-02A에서 이미 관리자 전용 접힘으로 격리됨)

새 `PublishPreparationViewModel`을 여기 억지로 덧씌우면 같은 화면에
두 개의 "게시 준비 상태 판단 로직"이 생기는 것이라 판단해 적용하지
않았다(governance: "한 화면에는 primary action 판단 로직이 하나만").

## 6. 다른 플랫폼 승인→게시 준비 흐름

`app/articles/[id]/social/page.tsx`(community/social 그룹: naver_cafe/x/threads/instagram)에
"게시 준비" 섹션을 새로 추가했다 — UX-04B의 검토 workspace 섹션과는
분리된 별도 `<section>`이며, **승인된 post만** 대상으로 한다(미승인
post의 "승인 필요" 상태는 이미 위쪽 검토 섹션에서 보이므로 중복 표시
방지). `app/articles/[id]/blog/page.tsx`의 naver_blog/news_article/
opinion_column 카드는 조사 결과 이미 `getSocialPostCardActionState`가
승인 완료 이후 단일 primary action(`prepare_export`/`copy_or_view_export`)을
정확히 계산하고 있어 새 컴포넌트를 추가하지 않았다.

## 7. bulk approval 이후 next action

UX-04B의 `bulkApproveSocialPostsAction`은 이미 같은 페이지
(`app/articles/[id]/social/page.tsx`)로 redirect한다. 이번 Phase에서
추가한 "게시 준비" 섹션이 `allPosts`(페이지네이션 전 전체 목록)를
매 렌더마다 새로 계산하므로, 일괄 승인 직후 새로고침된 페이지에는
방금 승인된 post들의 실제 다음 action(본문 복사 등)이 곧바로
나타난다 — 별도의 새 플러밍 없이 dead-end가 해소된다. 전용 "게시
준비 보기" 이동 버튼이나 별도 확인 화면은 만들지 않았다(UX-05B 후보로
남김).

## 8. getApprovalGateStatus 전수 감사 결과

`lib/social/social-post-auto-review.ts`의 `getApprovalGateStatus`를
`canApprove: false`를 반환하는 8개 분기 전부 확인했다:

| 조건 | reason |
|---|---|
| 이미 승인됨 | "이미 승인된 글입니다." |
| publishStatus === "blocked" | "게시 상태가 차단되어 있어 승인할 수 없습니다." |
| publishStatus === "published" | "이미 게시된 글은 다시 승인할 수 없습니다." |
| qualityStatus === "not_checked" | "먼저 자동 검토를 실행해야 승인할 수 있습니다." |
| qualityStatus === "failed" | "자동 검토 실행이 실패했습니다. 자동 검토를 다시 실행하세요." |
| qualityStatus === "blocked" | "차단 항목이 있어 승인할 수 없습니다." |
| !hasContent | "본문이 없어 승인할 수 없습니다." |
| hasBlockingIssues | "차단되었거나 수정이 필요한 항목이 있어 승인할 수 없습니다." |

**결론: 8개 분기 전부 이미 자연어 reason을 갖고 있고, raw DB 필드명/
enum이 전혀 섞여 있지 않다.** 코드 수정은 필요 없었다 — 회귀 방지용
테스트 4개만 추가했다(누락됐던 `publishStatus==="blocked"`/`"published"`/
`qualityStatus==="failed"` 케이스 커버리지 + "모든 실패 케이스에 raw
필드명이 없다"는 것을 한 번에 확인하는 전수 테스트).

## 9. disabled reason 개선 내용

기존 `getApprovalGateStatus`/`getWordPressPublishPrepState`/
`getPostApprovalNextActions`가 이미 자연어 disabled 사유를 제공하고
있어 추가 개선이 필요하지 않았다. `PlatformPublishPreparationCard`는
`disabledReason`이 있으면 항상 보이는 텍스트로 표시하도록 설계해,
앞으로 disabled 게시 준비 action이 추가되더라도 자동으로 이 규칙을
따르게 했다.

## 10. 게시 준비 aggregate 결과

`MultiPlatformPublishPreparationSummary = {total, notApproved,
needsAttention, needsSetup, ready, inProgress, completed, failed,
postIdsByState}`. `getPublishPreparationSortKey`로 문제 우선 정렬
(failed > needs_attention > needs_setup > not_approved > ready >
in_progress > completed) — UX-04B의 `getMultiPlatformReviewSortKey`와
같은 패턴을 그대로 따른다.

## 11. 게시 완료 상태 처리

`publishStatus === "published"` 또는 `manualPostStatus === "posted"`가
실제 완료 신호다 — 새로 추정하지 않고 이미 DB에 저장된 값만 사용한다.
"게시 결과 기록"(기존 `recordManualPostingResultAction` 폼, 이미
`app/articles/[id]/social/page.tsx`에 있음)으로 사용자가 직접 기록한
결과를 그대로 읽는다.

## 12. 실패/재시도 상태 처리

`publishStatus === "failed"` 또는 `manualPostStatus === "failed"`면
`failed` state로 표시한다. 실제 재시도 UI(구체적인 "[다시 시도]"
버튼과 그 대상 action)는 플랫폼별로 어떤 재시도가 안전한지(quality
gate 재실행인지, 게시 결과 재기록인지)에 따라 달라 이번 Phase에서는
state 계산까지만 다루고 실제 재시도 흐름 설계는 UX-05B로 남겼다.

## 13. x/threads/instagram markup residue gap 해결 방식

UX-04B에서 발견한 실제 gap(x/threads/instagram에 markdown/HTML 잔여물
탐지 자체가 없었음)을 해결했다.

- 새 checklist key `platform_markup_residue`를 x/threads/instagram
  공통으로 추가(`lib/social/social-quality-gate.ts`) — severity는
  `fail`(naver_cafe의 동일 성격 검사와 같은 수준, `blocked`가 아님 —
  형식 문제이지 안전 문제가 아니므로).
- 탐지 대상: escaped markdown 문자/HTML entity, `##`/`###` heading,
  `**bold**`, 알려진 HTML 태그(화이트리스트 기반이라 `<3` 같은 오탐
  방지).
- 새 사니타이저 `lib/social/plain-text-markup-residue-sanitizer.ts`
  (naver_cafe 전용 sanitizer는 건드리지 않고 별도 파일로 분리 — 기존
  동작에 회귀 위험을 주지 않기 위해).
- `review-issue-fixability.ts`의 `AUTO_FIXABLE_KEYS`+`IMPLEMENTED_AUTO_FIXERS`
  양쪽에 등록(실제 sanitizer가 있으므로 `canAutoFix: true`로 즉시
  분류 — "구현 없이 auto_fixable로만 표시" 금지 원칙 준수).
- `post-auto-fix-service.ts`의 `applyImplementedAutoFixers()`를 확장해
  `postBody`뿐 아니라 x의 `threadItems`, instagram의 `caption`/`cardItems`도
  정리할 수 있게 반환 shape을 `{edits: Partial<EditSocialPostInput>,
  changesApplied}`로 바꿨다(naver_cafe 분기는 그대로 유지).
- `social-post-auto-review.ts`의 `AXIS_BY_KEY`에 `platform_markup_residue: "platform_fit"` 추가(naver_cafe의 동일 축과 통일).

이미 생성 직후 자동 실행되는 auto-fix 파이프라인(Phase 4-28,
`hasOnlyImplementedAutoFixableIssues` 트리거)이 그대로 이 새 검사도
집어 가므로, 트리거 로직 자체는 전혀 건드리지 않았다.

**남은 작은 비대칭**: naver_cafe의 기존 검사는 escape/heading만
확인하고 bold marker(`**`)는 확인하지 않는다(x/threads/instagram은
이번에 확인하도록 만들었다) — UX-05B 후보로 남긴다.

## 14. 자동 외부 게시 방지 검증

- `PublishPreparationViewModel`/`PublishPreparationSummaryCard`/
  `PlatformPublishPreparationCard` 어디에도 실제 게시 함수를
  프로그래밍적으로 호출하는 코드가 없다(정적 검사로 확인).
- `bulkApproveSocialPostsAction`(UX-04B)은 여전히 `approval_status`만
  바꾸고, 어떤 경우에도 외부 게시를 유발하지 않는다(변경 없음).
- 새 markup residue 자동 수정기는 기존 auto-fix 파이프라인 안에서만
  실행되며(생성 직후 1회 또는 사용자의 수동 재시도), 승인/게시와
  무관하다.
- x/threads/instagram의 primary action은 여전히 "본문 복사"뿐이다 —
  "게시하기"라는 문자열이 두 페이지 어디에도 없음을 정적 검사로
  확인했다.

## 15. 적용 route

`app/articles/[id]/social/page.tsx`(게시 준비 섹션 신설),
`app/articles/[id]/blog/page.tsx`(변경 없음 — 조사 결과 이미 충족),
`lib/social/social-quality-gate.ts`/`review-issue-fixability.ts`/
`social-post-auto-review.ts`/`post-auto-fix-service.ts`(markup residue
gap 해결).

---

## 16. 수정한 파일 목록

**신규**:
- `lib/ui/publish-preparation-view-model.ts`, `.test.ts`
- `lib/ui/multi-platform-publish-preparation-summary.ts`, `.test.ts`
- `components/publish/publish-preparation-summary-card.tsx`, `.test.tsx`
- `components/publish/platform-publish-preparation-card.tsx`, `.test.tsx`
- `lib/social/plain-text-markup-residue-sanitizer.ts`, `.test.ts`
- `docs/ux/ux-05a-publish-preparation.md`(이 문서)

**수정**:
- `app/articles/[id]/social/page.tsx`, `.test.ts` — "게시 준비" 섹션 추가
- `app/articles/[id]/blog/page.test.ts` — 기존 시스템이 이미 충분함을 확인하는 회귀 테스트 2개 추가(소스 변경 없음)
- `lib/social/social-post-auto-review.ts`, `.test.ts` — `platform_markup_residue` axis 매핑 추가, `getApprovalGateStatus` 회귀 테스트 4개 추가
- `lib/social/social-quality-gate.ts`, `.test.ts` — `platform_markup_residue` 검사 추가
- `lib/social/review-issue-fixability.ts`, `.test.ts` — fixability 분류 추가
- `lib/social/post-auto-fix-service.ts`, `.test.ts` — `applyImplementedAutoFixers` 반환 shape 확장
- `docs/ux/full-ux-audit.md`, `docs/ux/user-journey-audit.md`, `docs/ux/ux-refactor-roadmap.md`, `docs/ux/ux-04a-human-review-simplification.md`, `docs/ux/ux-04b-multi-platform-review.md`, `docs/ui-ux-governance-rules.md`(업데이트)

## 17. 테스트 추가/수정 내역

- `lib/ui/publish-preparation-view-model.test.ts`: 14개(7단계 매핑, capability 3종, X는 게시하기가 아니라 본문 복사, completed/failed override)
- `lib/ui/multi-platform-publish-preparation-summary.test.ts`: 10개(집계 7종, 중복 미집계, 정렬 키)
- `components/publish/publish-preparation-summary-card.test.tsx`: 3개
- `components/publish/platform-publish-preparation-card.test.tsx`: 4개
- `app/articles/[id]/social/page.test.ts`: 66개(기존 58개 + 게시 준비 섹션 8개 신규)
- `app/articles/[id]/blog/page.test.ts`: 217개(기존 215개 + 회귀 확인 2개)
- `lib/social/social-post-auto-review.test.ts`: 33개(기존 29개 + getApprovalGateStatus 감사 4개)
- `lib/social/social-quality-gate.test.ts`: 78개(기존 70개 + markup residue 8개)
- `lib/social/review-issue-fixability.test.ts`: 18개(기존 17개 + 1개)
- `lib/social/post-auto-fix-service.test.ts`: 14개(기존 10개 + 4개)
- `lib/social/plain-text-markup-residue-sanitizer.test.ts`: 12개(신규)

## 18. lint 결과

`npm run lint` — 오류 없음(출력 없음).

## 19. test 결과

전체 스위트: **276 files / 3617 tests passed**, 실패 없음.

## 20. build 결과

`npm run build` 성공(`next build`, Turbopack, TypeScript 통과, 19개 route 모두 정상 생성).

## 21. 최신 Critical/High/Medium/Low

| 등급 | 총 항목 | 해결 | 부분 해결 | 미해결 |
|---|---|---|---|---|
| Critical | 7 (C1-C7) | 7 | 0 | 0 |
| High | 10 (H1-H10) | 8 | 2 (H5, H6) | 0 |
| Medium | 11 | 3 | 1 | 7 |
| Low | 5 | 1 | 0 | 4 |

UX-01 원자료의 개별 항목 수는 UX-04B와 동일하다(이번 Phase가 해결한
markdown/HTML 잔여물 gap과 게시 흐름 dead-end는 UX-01 체크리스트에
개별 항목으로 등재되지 않았던, UX-04A/04B 진행 중 새로 발견된
문제였기 때문 — `docs/ux/user-journey-audit.md`의 자동화 분류표와
`ux-04b-multi-platform-review.md` 25절에서 별도로 추적/해결했다).

## 22. 남은 주요 UX 문제

> **업데이트 (2026-09-18, Phase UX-05B)**: bold marker 비대칭, bulk
> approval 후속 이동, 실제 게시 실행 UX가 해결되었다. 자세한 내용은
> [`docs/ux/ux-05b-publish-execution-completion.md`](./ux-05b-publish-execution-completion.md) 참고.

- H5: `/articles/[id]` 관리자 접힘 블록 내부 세부 미분리
- H6: `/social-posts/[id]` "수정하기" 탭과 `InlinePostBodyEditor`의 구조적 중복
- Medium 7건(상태 라벨 4가지 방식 혼재, `tab=raw` URL 직접 접근, 관리자 화면 일반 동선 노출 여부 등)
- ✅ 해결 (UX-05B) — ~~naver_cafe의 markdown 검사가 bold marker를 확인하지 않는 작은 비대칭(13절)~~
- ✅ 해결 (UX-05B) — ~~bulk approval 이후 전용 "게시 준비 보기" 이동 버튼/확인 화면 미구현(7절)~~
- ✅ 해결 (UX-05B) — ~~실제 게시 실행 UX(성공/부분 실패/재시도의 구체적 흐름)~~

## 23. UX-05B에서 실제 게시 실행 UX로 처리한 항목

1. ✅ 해결 — 승인 → 게시 준비 → Draft/copy/manual → 게시 완료로 이어지는 흐름(실제 direct-publish capability가 없어 "실행"은 여전히 Draft 생성/본문 복사/게시 완료 기록까지)
2. ✅ 해결 — bulk approval 이후 "게시 준비 보기" anchor 링크
3. 부분 해결 — WordPress Draft 실패는 기존 에러 메시지 메커니즘으로 이미 재시도 가능함을 확인(추가 구현 없음). copy/manual 플랫폼의 세분화된 재시도 action 설계는 여전히 다음 Phase 후보
4. 부분 해결 — 집계는 "action_completed" state까지 타입 확장했으나 실제로 이 state를 만드는 곳은 아직 없음(설계만, 다음 Phase 후보)
5. ✅ 해결 — naver_cafe의 markdown 검사에 bold marker 확인 추가

---

**UX-05A에서는 승인 이후의 게시 준비 상태와 다음 작업을 플랫폼별
capability에 맞게 통합했으며, 사용자의 명시적 게시 실행과 결과 처리
UX는 UX-05B로 남겼습니다.**
