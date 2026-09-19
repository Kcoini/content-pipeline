# UX-04B: Multi-Platform Review Workspace

- 작성일: 2026-09-18
- 범위: 하나의 article에서 여러 플랫폼 글이 생성됐을 때, 사용자가 카드를
  하나씩 열어 확인해야 하는 부담을 줄인다. UX-04A에서 설계만 해 둔
  `MultiPlatformReviewSummary`를 실제로 구현하고, `app/articles/[id]/social/page.tsx`를
  "여러 플랫폼 글 검토 workspace"의 중심으로 만들었다. 안전한 일괄
  승인 구조도 함께 도입했다. `docs/ux/full-ux-audit.md`,
  `docs/ux/user-journey-audit.md`, `docs/ux/ux-refactor-roadmap.md`,
  `docs/ux/ux-04a-human-review-simplification.md`,
  `docs/ui-ux-governance-rules.md`를 먼저 읽고 작업했다.
- 이번 Phase에서 하지 않은 것: 자동 외부 게시, bulk public publish,
  DB validation 우회, approval guard 우회, review algorithm 재작성,
  새 AI 모델, 새 platform 추가, WordPress public publish 변경, 전체
  dashboard redesign.

---

## 1. MultiPlatformReviewSummary 구현 방식

`lib/ui/multi-platform-review-summary.ts`에 `summarizeMultiPlatformReview(posts)`를 구현했다. 새 review 판단 로직을 만들지 않는다 — UX-04A의 `summarizeUserFacingReview()`가 post 1개에 대해 이미 계산한 `UserFacingReviewSummary`(state: checking/ready/needs_confirmation/blocked/failed)를 여러 post에 반복 적용해서 모을 뿐이다.

```ts
export interface MultiPlatformReviewSummary {
  total: number;
  checking: number; ready: number; needsConfirmation: number; blocked: number; failed: number;
  approved: number; // approvalStatus==="approved" — review state와 별도 축
  readyPostIds: string[]; needsConfirmationPostIds: string[]; blockedPostIds: string[];
  failedPostIds: string[]; checkingPostIds: string[]; approvedPostIds: string[];
  bulkApprovalEligiblePostIds: string[]; // state==="ready" && approvalStatus!=="approved"
}
```

"검토 완료"(review state)와 "승인 완료"(approval_status)는 서로 다른 축이므로 절대 합치지 않는다 — `approved` post도 review state 축에서는 여전히 `ready`로 집계될 수 있다(두 축이 독립적).

같은 파일에 `getMultiPlatformReviewSortKey(post): number`도 함께 구현했다 — blocked=0, needs_confirmation=1, failed=2, checking=3, ready=4, 이미 approved인 post는 review state와 무관하게 항상 5(가장 낮은 우선순위)를 반환한다.

## 2. summary UI 구조

`components/review/multi-platform-review-summary-card.tsx`(`MultiPlatformReviewSummaryCard`)는 순수 표시 컴포넌트다 — 집계 로직 없이 `MultiPlatformReviewSummary`만 받아 렌더링한다.

```
플랫폼별 글 검토
전체 6개
게시 전 해결 필요 1개   (blocked > 0일 때만)
확인 필요 1개           (needsConfirmation > 0일 때만)
자동 검토 실패 0개      (failed > 0일 때만, 생략됨)
자동 검토 중 0개        (checking > 0일 때만, 생략됨)
확인할 사항 없음 4개     (ready > 0일 때만)
승인 완료 0개           (approved > 0일 때만, 생략됨)
```

0개인 카테고리는 아예 렌더링하지 않아 카드가 불필요하게 길어지지 않는다. raw state 이름(`ready`/`needs_confirmation`/`blocked`/`approval_status` 등)은 어디에도 노출하지 않는다.

## 3. 문제 우선 정렬 방식

`app/articles/[id]/social/page.tsx`에서 현재 page에 보이는 `posts`를 `getMultiPlatformReviewSortKey`로 정렬한 뒤 렌더링한다(`sortedPosts`). 정렬은 **현재 page 안에서만** 적용한다 — `lib/social/article-social-page-service.ts`의 페이지네이션 자체(어느 글이 몇 page에 속하는지)는 바꾸지 않았다. 대부분의 article은 post 수가 한 page 안에 다 들어오므로 실질적으로는 이미 "문제 있는 글이 먼저 보인다"는 목표를 달성하지만, post 수가 매우 많아 여러 page로 나뉘는 극단적인 경우 문제 있는 글이 2page에 있을 수 있다는 한계는 남는다(전역 정렬은 pagination 서비스 자체를 건드려야 해서 이번 Phase 범위를 넘는다고 판단해 보류).

## 4. 문제 없는 카드 compact 처리

본문 자체는 기존 governance 규칙(1,200자 이하 전체 표시, 초과 시 카드 안 접기/펼치기, `ExpandableText`)을 그대로 유지한다. 카드 전체를 그룹 단위로 접는(예: "확인할 사항 없는 글 N개 보기" 형태의 페이지 레벨 collapse) 인터랙션은 이번 Phase에서 **구현하지 않았다** — 기존 카드 렌더링 로직(플랫폼 배지/본문 패널/자동 검토 카드/승인 패널/관리자 상세/게시 결과 기록 등 400줄 이상)을 안전하게 두 그룹으로 쪼개 별도 `<details>`로 감싸려면 그 큰 렌더링 블록을 별도 함수로 추출해야 하는데, 손으로 수백 줄을 옮기는 것은 실수 위험이 커서 이번 Phase에서는 보류했다. 대신 **정렬(3절)로 이미 문제 있는 카드가 항상 위에 오므로**, 사용자는 스크롤 상단에서 확인할 것을 먼저 보게 된다 — spec 문서에서도 이 collapse는 "허용한다"(필수 아님)로 명시되어 있어 낮은 위험도를 우선했다. 다음 Phase에서 카드 렌더링을 별도 컴포넌트로 추출하면서 함께 구현하는 것을 권장한다(아래 "남은 주요 UX 문제" 참고).

## 5. needsConfirmation 표시 방식

카드별 `AutoReviewSummaryCard`(UX-04A에서 이미 `userFacingSummary`를 전달하도록 되어 있음)가 그대로 담당한다 — 이 Phase에서 새로 바꾸지 않았다. `HumanReviewPanel`은 `/social-posts/[id]` 상세 화면에서 이미 쓰이고 있고, 목록 카드 규모에서는 `AutoReviewSummaryCard`의 필터링된 issue 목록이 같은 역할을 한다(UX-04A doc 6절 참고).

## 6. blocked 표시 방식

정렬(3절)로 blocked 카드가 needsConfirmation보다도 먼저 오도록 우선순위를 부여했다. 카드 자체의 시각적 표시(빨간 톤 `AutoReviewSummaryCard`)는 UX-03A/04A에서 이미 구현되어 있다 — 이번 Phase는 "어디에 나타나는지"(순서)만 바꿨다. 차단 글이 있어도 다른 플랫폼의 정상 글까지 막지 않는다(각 카드/액션은 독립적으로 동작).

## 7. bulk approval 구현 여부

구현했다. `MultiPlatformReviewSummaryCard`의 `renderBulkApprovalAction` 슬롯에 `bulkApproveSocialPostsAction` 폼을 렌더링한다 — `bulkApprovalEligiblePostIds`가 하나도 없으면 이 슬롯 자체가 호출되지 않는다(버튼이 아예 나타나지 않는다).

## 8. bulk approval eligibility 조건

`bulkApprovalEligiblePostIds` = review state가 `"ready"`이고 `approvalStatus !== "approved"`인 post만. needsConfirmation/blocked/checking/failed/이미 approved/본문 없음(본문이 없으면 애초에 `ready` 상태가 될 수 없다 — `summarizeUserFacingReview`가 checklist 기준으로 판단)은 전부 제외된다. 제외된 글이 있으면 버튼 위에 "N개는 확인이 필요해 제외됩니다" 문구로 이유를 안내한다.

## 9. 기존 approval guard 재사용 방식

`lib/social/social-post-approval-service.ts`에 `bulkApproveSocialPosts(socialPostIds, approvedBy, notes?)`를 추가했다. **새 validation을 만들지 않는다** — 대상 post마다 기존 `approveSocialPost()`(단일 승인과 완전히 동일한 `checkApprovable()` guard)를 그대로 호출한다. `UPDATE social_posts SET approval_status='approved' WHERE id IN (...)` 같은 일괄 update는 어디에도 없다.

## 10. partial success 처리

`BulkApprovalResult = { successCount, failureCount, approvedSocialPosts, failures: Array<{socialPostId, message}> }`. 일부가 승인 조건을 만족하지 못해도(예: 그 사이 다른 요청으로 상태가 바뀐 경우) 나머지는 계속 진행한다. `bulkApproveSocialPostsAction`은 이 결과로 "N개 승인 완료" / "N개 승인 완료 · M개는 상태가 변경되어 승인하지 못했습니다" / "승인에 실패했습니다" 세 가지 메시지를 만들어 redirect query로 전달한다(기존 message-on-redirect 메커니즘 재사용 — 새 toast 시스템을 만들지 않았다).

## 11. bulk approval 후 외부 publish가 실행되지 않는 보장

`bulkApproveSocialPosts()`/`bulkApproveSocialPostsAction()` 어디에도 WordPress/플랫폼 API 관련 함수 호출이 없다 — `approveSocialPost()`(단일 승인과 동일)만 호출하고, 이 함수는 이미 `approval_status`만 바꾸는 것으로 범위가 고정되어 있다(파일 상단 주석에 명시). 정적 소스 검사 테스트로 `bulkApproveSocialPostsAction(`가 프로그래밍적으로 호출되는 지점이 없음(항상 `<form action={bulkApproveSocialPostsAction}>` 형태의 사용자 제출)을 확인했다.

## 12. WordPress/social_posts 데이터 모델 관계

**DB 레벨 분리는 없다.** `wordpress_blog`도 다른 플랫폼과 완전히 동일한 `social_posts` 테이블의 한 row다(`SocialPlatform` 유니온의 값 중 하나일 뿐). 페이지 레벨에서만 `getPlatformGroup(platform)`(`lib/social/content-type-classifier.ts`) 기준으로 나뉜다:

- `"blog"` 그룹(wordpress_blog/naver_blog/news_article/opinion_column) → `app/articles/[id]/blog/page.tsx`
- `"community"`/`"social"` 그룹(naver_cafe/x/threads/instagram) → `app/articles/[id]/social/page.tsx`(이번 Phase의 workspace 적용 대상)

이 Phase는 spec의 명시적 허용("첫 구현은 social/platform posts 중심이어도 된다")에 따라 `app/articles/[id]/social/page.tsx`가 이미 가져오는 posts(`article-social-page-service.ts`가 필터링한 community/social 그룹)만을 범위로 구현했다 — wordpress_blog 등 blog 그룹 post를 억지로 같은 요약에 합치지 않았다. blog 그룹까지 하나의 workspace로 합치려면 두 페이지의 데이터 조회를 통합하거나 요약을 두 번(각 페이지에) 만들어야 하는데, 이는 이번 Phase 범위를 넘는다고 판단했다.

## 13. markdown/HTML cleanup 조사 결과

- `lib/social/naver-cafe-plain-text-sanitizer.ts`: HTML entity 디코딩, escape된 markdown 문자 정리, markdown 링크/표 평탄화, heading/bold 마커 제거까지 이미 폭넓게 구현되어 있다 — naver_cafe는 충분히 커버됨.
- `lib/social/internal-section-heading-sanitizer.ts`: 내부 작성 구조명(리드문/본문/배경 설명 등) 소제목 정리 — 플랫폼 공통.
- **실제 gap**: x/threads/instagram(plain-text SNS 플랫폼)에는 markdown/HTML 잔여물을 **탐지하는 quality-gate 검사 자체가 없다**(`social-quality-gate.ts`에 naver_cafe 전용 검사만 존재). 즉 정리 서비스가 없는 게 아니라, 애초에 "문제가 있는지 감지"하는 단계부터 빠져 있다. 이 gap을 메우려면 새 quality-gate 검사 항목을 추가해야 하는데, 이는 "review algorithm 재작성"에 해당해 이번 Phase의 명시적 금지사항이다 — 구현하지 않고 문서화만 한다.

## 14. automation-safety 버튼 정리 결과

`app/dashboard/automation-safety/page.tsx`를 최신 코드로 재확인한 결과, 4개 버튼("Safety Review 실행"/"최근 로그 보안 점검"/"게시 workflow 점검"/"feature flag 점검")이 **모두 동일한 `rerunAutomationSafetyReview` action을 인자 없이 호출**하고 있었다(구분되는 파라미터 없음) — 원래 UX-01 감사 결과가 최신 코드에서도 그대로 유효했다. 4개 버튼을 "안전 점검 다시 실행" 1개로 통합했다. 카테고리별(로그 보안/게시 workflow/feature flag) 점검 결과는 삭제하지 않고 아래 "카테고리별 상태" 섹션에서 읽기 전용으로 계속 확인할 수 있다.

## 15. H2 dry-run 처리 결과

`components/platform-api/api-readiness-badge.tsx`: `dry_run_ready` → "연결 확인 가능", `ready_for_future_test` → "실제 게시 기능 준비 중"(각각 실제 의미 — 설정은 됐지만 실제 게시 호출 없이 연결만 확인되는 상태 / 설정은 충족됐지만 API 호출 코드 자체가 아직 구현되지 않은 상태 — 를 코드 기준으로 확인한 뒤 그에 맞는 문구로 교체).

`components/platform-api/api-readiness-summary.tsx`: "dry-run 가능" → "연결 확인 가능"(배지와 용어 통일), "feature flag" → "게시 기능 활성화 여부", "blockers" → "차단 사유", "warnings" → "확인 필요 사항".

`components/platform-api/api-dry-run-payload-preview.tsx`: "API Dry-run Payload" → "API 게시 전 미리보기", "title"/"hashtags"/"text preview"/"caption preview"/"validation errors" 같은 영문 필드명을 각각 "제목"/"해시태그"/"본문 미리보기"/"캡션 미리보기"/"확인 필요 사항"으로 교체.

## 16. H3 raw enum action 처리 결과

`components/social-ab-tests/ab-test-card.tsx`: "ready로 변경" → "테스트 준비 완료로 표시"(`markAbTestReadyAction`이 실제로 하는 일 — draft를 ready로 바꿔 다음 단계로 넘길 준비를 마쳤다는 뜻), "running 시작" → "테스트 시작"(`startAbTestAction`이 실제로 A/B 테스트 실행을 시작하는 것). 추가로 발견: testStatus 배지가 `{abTest.testStatus}` raw enum을 그대로 렌더링하고 있어, `TEST_STATUS_LABELS` 맵을 새로 만들어 함께 교체했다(disabled 조건 등 로직은 전혀 바꾸지 않음 — 라벨만 교체).

## 17. 적용 route

`app/articles/[id]/social/page.tsx`(workspace 중심 적용), `app/dashboard/automation-safety/page.tsx`(버튼 통합), `components/platform-api/*.tsx`(H2), `components/social-ab-tests/ab-test-card.tsx`(H3).

---

## 18. 수정한 파일 목록

**신규**:
- `lib/ui/multi-platform-review-summary.ts`, `.test.ts`
- `components/review/multi-platform-review-summary-card.tsx`, `.test.tsx`
- `components/social-ab-tests/ab-test-card.test.tsx`
- `components/platform-api/api-dry-run-payload-preview.test.tsx`
- `docs/ux/ux-04b-multi-platform-review.md`(이 문서)

**수정**:
- `lib/social/social-post-approval-service.ts`, `.test.ts` — `bulkApproveSocialPosts` 신설
- `app/articles/[id]/actions.ts` — `bulkApproveSocialPostsAction` 신설
- `lib/social/article-social-page-service.ts`, `.test.ts` — `allPosts` 필드 추가(페이지네이션 전 전체 목록)
- `app/articles/[id]/social/page.tsx`, `.test.ts` — workspace 요약 카드, 문제 우선 정렬, 일괄 승인 UI 적용
- `app/dashboard/automation-safety/page.tsx`, `.test.ts` — 버튼 4개 → 1개 통합
- `components/platform-api/api-readiness-badge.tsx`, `.test.tsx` — H2 라벨 교체
- `components/platform-api/api-readiness-summary.tsx`, `.test.tsx` — H2 라벨 교체
- `components/platform-api/api-dry-run-payload-preview.tsx` — H2 라벨 교체
- `components/social-ab-tests/ab-test-card.tsx` — H3 라벨 교체
- `docs/ux/full-ux-audit.md`, `docs/ux/user-journey-audit.md`, `docs/ux/ux-refactor-roadmap.md`, `docs/ux/ux-04a-human-review-simplification.md`, `docs/ui-ux-governance-rules.md`(업데이트)

## 19. 테스트 추가/수정 내역

- `lib/ui/multi-platform-review-summary.test.ts`: 12개(total/checking/ready/needsConfirmation/blocked/failed/approved 계산, 중복 미집계, eligibility, 정렬 키)
- `components/review/multi-platform-review-summary-card.test.tsx`: 7개(카운트 표시, 0개 카테고리 숨김, raw state 미노출, 승인 완료 별도 표시, bulk 슬롯 조건부 호출)
- `lib/social/social-post-approval-service.test.ts`: 25개(기존 20개 + bulk approval 5개 — 전원 승인/guard 재적용/부분 실패/게시 미실행/빈 목록)
- `app/articles/[id]/social/page.test.ts`: 58개(기존 50개 + workspace 8개 신규)
- `app/dashboard/automation-safety/page.test.ts`: 12개
- `components/platform-api/api-readiness-badge.test.tsx`: 2개
- `components/platform-api/api-readiness-summary.test.tsx`: 2개
- `components/platform-api/api-dry-run-payload-preview.test.tsx`: 1개(신규)
- `components/social-ab-tests/ab-test-card.test.tsx`: 3개(신규)
- `lib/social/article-social-page-service.test.ts`: 3개

## 20. lint 결과

`npm run lint` — 오류 없음(출력 없음).

## 21. test 결과

전체 스위트: **271 files / 3547 tests passed**, 실패 없음.

## 22. build 결과

`npm run build` 성공(`next build`, Turbopack, TypeScript 통과, 19개 route 모두 정상 생성).

## 23. 최신 Critical/High/Medium/Low

| 등급 | 총 항목 | 해결 | 부분 해결 | 미해결 |
|---|---|---|---|---|
| Critical | 7 (C1-C7) | 7 | 0 | 0 |
| High | 10 (H1-H10) | 8 | 2 (H5, H6) | 0 |
| Medium | 11 | 3 | 1 (`/dashboard/platform-api`+`/dashboard/automation-safety`, 버튼 중복은 해결했으나 일반 동선 노출 여부는 미확인) | 7 |
| Low | 5 | 1 | 0 | 4 |

**H2/H3 모두 해결되었다** — High 등급의 미해결 항목은 이제 0건이다(H5/H6는 부분 해결로 유지, "완전 해결"이 아니라 위험도 대비 효과가 낮아 의도적으로 보류한 항목).

## 24. 남은 주요 UX 문제

- H5: `/articles/[id]` 관리자 접힘 블록 내부(~1900줄)가 여전히 하나의 큰 접힘
- H6: `/social-posts/[id]` "수정하기" 탭과 `InlinePostBodyEditor`의 구조적 중복
- Medium 7건(상태 라벨 4가지 방식 혼재, `tab=raw` URL 직접 접근, 관리자 화면 일반 동선 노출 여부 등)
- ✅ 해결 (UX-05A) — ~~x/threads/instagram의 markdown/HTML 잔여물 탐지 gap(13절)~~
- "문제 없는 글" 페이지 레벨 compact/collapse 인터랙션 미구현(4절) — 카드 렌더링을 별도 컴포넌트로 추출하는 리팩터링과 함께 진행 권장
- 전역(page 경계를 넘는) 문제-우선 정렬 미구현(3절) — pagination 서비스 자체를 다뤄야 함

## 25. UX-05에서 처리할 게시 흐름 항목

> **업데이트 (2026-09-18, Phase UX-05A)**: 1, 3, 4번이 완료되었다.
> 자세한 내용은 [`docs/ux/ux-05a-publish-preparation.md`](./ux-05a-publish-preparation.md) 참고.

1. ✅ 해결 (UX-05A) — ~~승인 → 게시 준비 → Draft/API/copy → 게시 완료로 이어지는 실제 게시 흐름 설계~~(게시 준비 단계까지 — 실제 게시 실행은 UX-05B)
2. bulk approval 이후 "게시 준비 보기"로 자연스럽게 이어지는 후속 화면 — 부분 해결(같은 페이지에 게시 준비 섹션이 추가되어 dead-end는 해소했지만, 전용 "게시 준비 보기" 이동 버튼/후속 확인 화면은 UX-05B 후보)
3. ✅ 해결 (UX-05A) — ~~`getApprovalGateStatus`의 비활성 사유 커버리지 점검~~
4. ✅ 해결 (UX-05A) — ~~여러 플랫폼에 걸친 일괄 게시 준비 상태 요약~~(`MultiPlatformPublishPreparationSummary`)

---

**UX-04B에서는 여러 플랫폼 글을 하나씩 확인하는 부담을 줄이고, 확인
필요한 글을 우선 표시하며 안전한 일괄 승인 구조를 도입했습니다. 실제
외부 게시 흐름은 UX-05로 남겼습니다.**
