# UX 리팩터 로드맵 (Phase UX-01 산출물 — 계획만, 코드 변경 없음)

- 작성일: 2026-09-18
- 본 문서는 `full-ux-audit.md`, `user-journey-audit.md`, `ui-information-levels.md`의 발견 사항을 바탕으로 이후 Phase의 작업 범위를 계획한다.
- 이 문서 자체는 계획서이며, 이번 Phase에서 실제 코드 변경은 수행하지 않았다.

---

## UX-02: Critical 수정

> **진행 상태 (2026-09-18)**: `app/articles/[id]/page.tsx` 범위는
> **UX-02A로 완료**됨. 나머지(`app/articles/[id]/blog/page.tsx`,
> `components/wordpress/wordpress-publishing-panel.tsx`)는 **UX-02B로
> 분리**해 아직 진행 전이다. 아래는 원래 계획이며, 완료 내역은
> [`docs/ux/ux-02a-critical-safety-cleanup.md`](./ux-02a-critical-safety-cleanup.md) 참고.

### UX-02A (완료): app/articles/[id]/page.tsx 안전 문제 + 기술정보 노출

- "테스트 실행 (실제 공개 게시)" 버튼 라벨에서 "테스트"를 제거하고
  ("WordPress 실제 공개 게시 실행"), 별도 "⚠ 관리자 전용" 접힘으로
  한 번 더 격리했다. 실행 조건(guard)과 확인 모달은 그대로 유지.
- env 변수 노출 지점(`WORDPRESS_BASE_URL` 등)을 실사했고, 전부 이미
  중첩 `<details>` 안에 있어 추가 이동이 필요 없었다.
- SEO plugin provider select를 "SEO plugin 직접 선택 (고급)" 접힘
  안으로 옮기고, 기본 화면에는 현재 provider 이름만 보여준다.
- 중복된 "WordPress 게시 준비" 섹션의 이름 충돌을 해소했다(자동 실행
  섹션을 "WordPress 게시 준비 자동 실행"으로 개명). 완전한 통합은
  UX-03에서 다시 검토.
- 위험도는 낮았다: 버튼 라벨/접힘 위치/dt 라벨만 바꿨고 서버 액션,
  guard, DB 스키마는 전혀 건드리지 않았다. 전체 테스트(3316개)/lint/
  build 모두 통과.

### UX-02B (완료, 2026-09-18): 나머지 Critical 잔여 항목

> 완료 내역은 [`docs/ux/ux-02b-wordpress-blog-cleanup.md`](./ux-02b-wordpress-blog-cleanup.md) 참고.

**목적**: UX-02A가 다루지 않은 나머지 안전/기술정보 문제를 정리한다.

**대상 페이지**: `app/articles/[id]/blog/page.tsx`, `components/wordpress/wordpress-publishing-panel.tsx`

**실제 변경 범위**:
- `quality_status=ready` 같은 raw 필드명이 섞인 안내 문구를 자연어로 교체 (C3), "내부 상태값 보기" 접힘 안 dt/dd도 `describeStatusField`/`describeStatusValue`로 번역
- `article.status` raw enum 노출 지점(`blog/page.tsx:389,1186,1727`)에 신규 `describeArticleStatus()` 적용 (C6) — 기존 프로젝트 컨벤션("reviewed"=article 레벨에서는 "승인됨")과 충돌하지 않도록 공용 `describeStatusValue`와 분리한 전용 헬퍼로 추가
- `WordPressPublishingPanel`의 기본 화면을 5줄 요약(raw enum은 `describeStatusValue`로 번역)으로 압축하고, ID/URL/raw guard/timestamp는 "상세 상태 보기" 접힘으로 이동 (C4) — `app/articles/[id]/page.tsx`(article target)와 `app/articles/[id]/blog/page.tsx`(wordpress_blog target) 양쪽 모두 영향, 두 화면 테스트 전부 통과 확인
- 패널 자체 제목이 wordpress_blog 카드의 children(자체 "WordPress 게시 준비" 다음 작업 카드)과 중복되는 문제도 함께 정리(`isPrimaryWorkflow`일 때 "게시 상태 요약"으로 제목 구분)
- `/dashboard/blog`, `/dashboard/rewrite` 필터는 실사 결과 이미 `describeStatusField`/`describeStatusValue`를 쓰고 있어 추가 조치 없음(UX-01 감사 원자료가 최신 코드를 반영하지 못했던 것으로 확인)

**위험도**: 낮음으로 실현됨 — `WordPressPublishingPanel`은 두 화면에서 쓰이므로
양쪽 모두 정적 소스 검사 테스트를 갱신/추가해 회귀를 방지했다. 전체
테스트(3329개)/lint/build 모두 통과.

**의존성**: UX-02A 완료 후 진행(충족됨)

---

## UX-03: 공통 컴포넌트 통합

> **진행 상태 (2026-09-18)**: **UX-03A, UX-03B1, UX-03B2, UX-03C 완료 —
> UX-03 전체 완료**. UX-03A에서 공통 기반 컴포넌트(AdvancedDetails/
> AutoReviewSummaryCard/InlinePostBodyEditor/HumanReviewPanel) 신설과
> semantic audit을 마쳤고, UX-03B1에서 NextActionPanel/WorkflowStatusCard를
> 실제 구현해 우선순위 1 화면 3곳(blog/social 카드, social-posts 상세)에
> 적용했다. UX-03B2에서는 X 카드 인라인 thread 편집, rewrite 페이지
> "승인" 용어 3종 정리, social-posts 상단 요약 카드의 중복 primary
> action 판단 정리를 마쳤다. UX-03C에서 PlatformBadge 공통화, 우선순위
> 2 화면(`/articles/[id]`, `/dashboard/*`, `/trends`, `/themes/[themeId]`)
> 재확인/적용, `/articles/[id]/rewrite` 카드 단위 전수 감사를 완료했다.
> 완료 내역은
> [`docs/ux/ux-03a-common-ux-foundation.md`](./ux-03a-common-ux-foundation.md),
> [`docs/ux/ux-03b1-workflow-next-action.md`](./ux-03b1-workflow-next-action.md),
> [`docs/ux/ux-03b2-interaction-consistency.md`](./ux-03b2-interaction-consistency.md),
> [`docs/ux/ux-03c-route-adoption-platform-labels.md`](./ux-03c-route-adoption-platform-labels.md) 참고.

### UX-03A (완료): 공통 UX 기반 구축 + semantic audit

**목적**: 중복 구현된 UI 로직 중 안전하게 뽑아낼 수 있는 것부터 공통
컴포넌트로 만들고, 상태 라벨(특히 `article.status`의 `reviewed`)의
의미가 실제로 일관된지 검증한다.

**실제 변경 범위**:
- `AdvancedDetails` 공통 컴포넌트 신설, 기존 4곳의 개별 `<details>` 구현 교체(`WordPressPublishingPanel`, `blog/page.tsx` 2곳, `social/page.tsx` 1곳) — 그 과정에서 `blog/page.tsx`에 남아있던 raw enum 노출(quality/approval 등 영문 필드명 + 원문 status) 1건을 추가로 발견해 함께 수정
- `AutoReviewSummaryCard` 추출 — `social/page.tsx`와 `social-posts/[id]/page.tsx`의 중복 인라인 블록 통합(issue별 액션 링크/자동 수정 배너 등 페이지별 차이는 slot prop으로 보존)
- `InlinePostBodyEditor` 추출 — `SocialPostBodyPanel` 내부 편집 UI를 공통 컴포넌트로 분리(Server Action form 계약 유지, 렌더링 결과 100% 동일). `/social-posts/[id]` "수정하기" 탭(다중 필드 편집기, 다른 action)은 범위 밖으로 확인
- `HumanReviewPanel` 신설 및 `social-posts/[id]` 최종 승인 패널에 적용(auto_fixable 제외, user_confirmation_required + blocking만 표시)
- semantic audit: `article.status="reviewed"` → "승인됨" 매핑이 `lib/harness/approval-gate.ts`/`approveArticle`/`docs/phase-2-23-...` 문서와 일치함을 코드 근거로 검증(수정 불필요 결론)
- `NextActionPanel`/`WorkflowStatusCard`는 기존 helper 3개(`getWordPressPublishPrepState`/`getSocialPostCardActionState`/`getPostApprovalNextActions`)와 `dashboard-workflow-presentation.ts`의 반환 shape을 비교해 공통 `NextActionViewModel`/`WorkflowStatusViewModel` 타입을 문서로 제안(코드에 추가하지 않음)
- X inline edit 제약(`getSocialPostEditableField`가 X에 null 반환하는 이유)과 rewrite 승인 용어 3종의 실제 state 의미를 조사·문서화(문구/구현 변경은 하지 않음)

**위험도**: 낮게 실현됨 — 추출한 컴포넌트는 전부 기존 렌더링 결과를 그대로
재현하도록 slot/props로 설계했고, 정적 소스 검사 + `renderToStaticMarkup`
테스트로 회귀가 없음을 확인했다. 전체 테스트(3364개)/lint/build 통과.

**의존성**: UX-02A/02B 완료 후 진행(충족됨)

### UX-03B1 (완료, 2026-09-18): NextActionViewModel/WorkflowStatusViewModel 실제 구현 + 우선순위 1 적용

> 완료 내역은 [`docs/ux/ux-03b1-workflow-next-action.md`](./ux-03b1-workflow-next-action.md) 참고.

**목적**: UX-03A에서 설계만 제안했던 `NextActionViewModel`/`WorkflowStatusViewModel`을
실제 구현하고, 가장 중요한 화면부터 적용한다.

**실제 변경 범위**:
- `lib/ui/next-action-view-model.ts`/`lib/ui/workflow-status-view-model.ts` 구현 — 기존 helper 3개(`getWordPressPublishPrepState`/`getSocialPostCardActionState`/`getPostApprovalNextActions`)는 그대로 두고 어댑터 함수만 추가
- `components/workflow/next-action-panel.tsx`/`workflow-status-card.tsx` 신설
- 적용: `app/articles/[id]/blog/page.tsx`(wordpress_blog 카드), `app/articles/[id]/social/page.tsx`(목록 카드), `app/social-posts/[id]/page.tsx`(최종 승인 패널)
- "Handoff" 영문 라벨 3곳(로그 필터 옵션/Step 7 제목/안내 문장)을 `lib/social/status-labels.ts`의 기존 `handoff_status: "수동 게시 준비"` 매핑과 통일해 한국어로 교체
- dead-end("다음 작업" 문구만 있고 실제 action 없는 화면) 전수 검색 — 우선순위 1 화면 3곳에서는 발견되지 않음

**위험도**: 낮게 실현됨 — 기존 렌더링 함수(`renderPrepActionButton`/`renderAction`/`renderNextAction`)를 그대로 재사용하고 표현 레이어만 공통 컴포넌트로 옮겼다. 전체 테스트(3407개)/lint/build 통과.

**의존성**: UX-03A 완료(충족됨)

### UX-03B2 (완료, 2026-09-18): 상호작용 일관성 + rewrite 용어 정리

> 완료 내역은 [`docs/ux/ux-03b2-interaction-consistency.md`](./ux-03b2-interaction-consistency.md) 참고.

**목적**: 같은 기능(본문 수정)이 카드/플랫폼마다 다르게 동작하는 문제와,
rewrite 페이지의 "승인" 용어 3종이 서로 다른 의미를 가리키던 문제를
정리한다. 전체 route 확대 적용이나 PlatformBadge 통합은 다루지 않는다.

**실제 변경 범위**:
- `InlinePostBodyEditor`에 `mode="thread"` (discriminated union prop) 추가 — 항목별 `<textarea name="threadItemText">`로 순서 보존, 단일 문자열 계약은 그대로 유지
- `saveSocialPostThreadAndProcess`/`saveSocialPostThreadInlineEditAction` 신설 — 기존 `continueAfterSave` 저장 파이프라인을 공유(저장/검토/승인 로직 중복 없음)
- `SocialPostBodyPanel`에 thread 모드 분기 추가, `app/articles/[id]/social/page.tsx`의 X 카드에 실제 적용 — 이제 다른 플랫폼과 동일하게 카드 안에서 `[본문 수정]`이 열린다
- `formatThreadItemsForCopy` 신설 — thread 복사 시 항목을 순서대로 줄바꿈으로 합쳐 복사(기존 `getSocialPostDisplayBody`의 공백 join은 변경하지 않음)
- `lib/social/rewrite-version-user-facing-status.ts`: "개선 제안 승인"→"개선안 선택", "재승인 요청"→"재검토 요청", "재승인 승인하기"→"최종 승인"으로 라벨 재정리, `describeRewriteSuggestionStatus` 신설(공용 `describeStatusValue`의 "승인 완료"와 분리) — state machine/DB 필드/action 함수명은 변경 없음
- `app/articles/[id]/rewrite/page.tsx`에 새 라벨 적용, 안내 배너를 새 흐름 이름으로 재작성
- `getSocialPostWorkspacePrimaryAction` 조사 결론: 순수 navigation-only helper(어느 섹션으로 이동할지만 알려줌)로 판정 — 삭제/통합 대신 상단 "지금 상태 요약" 카드의 버튼 스타일을 secondary(테두리)로 낮춰 최종 승인 패널의 primary 버튼과 경쟁하지 않게 정리

**위험도**: 낮게 실현됨 — 기존 helper/action 함수는 재사용하고 라벨/스타일/표현 레이어만 바꿨다. 전체 테스트(3443개)/lint/build 통과.

**의존성**: UX-03B1 완료(충족됨)

### UX-03C (완료, 2026-09-18): 우선순위 2 화면 확대 적용 + PlatformBadge 통합

> 완료 내역은 [`docs/ux/ux-03c-route-adoption-platform-labels.md`](./ux-03c-route-adoption-platform-labels.md) 참고.

**목적**: UX-03B1/B2에서 검증된 공통 패턴(AdvancedDetails/status label
helper 등)을 나머지 화면으로 확대하고, PlatformBadge 계열을 공통
컴포넌트로 통합하며, `/articles/[id]/rewrite` 카드 단위 UX를
전수 감사한다.

**실제 변경 범위**:
- `components/common/platform-badge.tsx` + `lib/ui/platform-badge.ts` 신설 — SocialPlatform(기존 `PLATFORM_LABELS`)과 trend 검색 출처(naver/daum/mock, 기존 raw 노출) 둘 다 하나의 helper로 라벨/색상 계산. `app/trends/page.tsx`, `app/themes/[themeId]/page.tsx`의 개별 `PlatformBadge` 구현 제거, `components/social-performance-dashboard/charts/platform-performance-chart.tsx`의 별도 영문 라벨 매핑 제거
- `app/themes/[themeId]/page.tsx`, `app/trends/page.tsx`의 "Mock 모드" 영문 배지 + env 변수명(`ARTICLE_SEARCH_ENABLED=false`) 노출을 "테스트 데이터 모드" 한국어 문구로 교체(H1 해결)
- `app/articles/[id]/page.tsx` 기본 화면을 "현재 상태 / 다음 작업(WordPress 블로그 글 관리) / 보조(SNS 글 관리)"로 재구성 — 보조 route 성격을 유지하며 이해 가능한 요약만 남기고, 대형 관리자 전용 접힘은 그대로 유지(세부 재구조화는 보류)
- `app/articles/[id]/rewrite/page.tsx` 카드 단위 전수 감사 — "개선안 선택" 버튼에 disabled 로직이 없어 완료 후에도 반복 노출되던 버그 발견/수정, 대상 원본 글 select의 raw platform key 노출 수정, 페이지 로컬 `<details>`를 `AdvancedDetails`로 교체. 감사 과정에서 rewrite 서비스 레이어(`rewrite-suggestion-review-service.ts`/`rewrite-application-service.ts`/`rewrite-reapproval-service.ts`/`rewrite-reexport-service.ts`) 오류 메시지의 raw 필드명 노출도 함께 발견해 수정
- `app/dashboard/rewrite/page.tsx` 용어를 UX-03B2 rewrite 라벨과 통일(`describeStatusField`의 `rewrite_reapproval_status` 라벨을 중앙에서 수정해 두 페이지 모두 자동 반영)
- `app/dashboard/page.tsx`, `app/dashboard/blog/page.tsx` 재확인 — 이미 단일 판단 로직/라벨 변환이 적용되어 있음을 코드로 재확인, 추가 변경 불필요로 결론(과도한 변경 금지 원칙 준수)
- `app/dashboard/social-performance/page.tsx` 재확인 — 페이지 자체는 문제 없었으나 이 페이지가 쓰는 `dashboard-filter-controls.tsx`/`low-performance-chart.tsx`/`tone-performance-chart.tsx`에서 raw status/raw enum 노출 다수 발견해 기존 헬퍼로 수정

**위험도**: 낮게 실현됨 — 3개 fork로 파일 범위를 명확히 분리해 병렬 작업, 각 fork가 기존 helper/컴포넌트만 재사용(새 business logic 없음). 전체 테스트(3470개)/lint/build 통과.

**의존성**: UX-03B2 완료(충족됨)

---

## UX-04: 자동 검토·자동 수정 UX

> **진행 상태 (2026-09-18)**: **UX-04A, UX-04B 완료 — UX-04 전체 완료**.
> 완료 내역은
> [`docs/ux/ux-04a-human-review-simplification.md`](./ux-04a-human-review-simplification.md),
> [`docs/ux/ux-04b-multi-platform-review.md`](./ux-04b-multi-platform-review.md) 참고.

### UX-04A (완료, 2026-09-18): AI가 처리 가능한 검토·수정은 기본 화면에서 숨기고, 사람 판단 항목만 남긴다

> 완료 내역은 [`docs/ux/ux-04a-human-review-simplification.md`](./ux-04a-human-review-simplification.md) 참고.

**목적**: 이미 존재하는 자동 검토/자동 수정 파이프라인(`post-auto-fix-service.ts`,
`review-issue-fixability.ts`, `HumanReviewPanel`, `AutoReviewSummaryCard`)의
사용자 노출 방식을 "AI가 처리할 수 있는 문제는 자동 처리, 사람 판단이
필요한 것만 표시" 원칙에 맞게 다시 정리한다. 새 검사 엔진/새 AI 모델은
추가하지 않는다.

**실제 변경 범위**:
- `summarizeUserFacingReview()`(`lib/social/social-post-auto-review.ts`) 신설 — 기존 축 기반 리포트(`summarizeAutoReview`)와 fixability 기반 분류(`classifyReviewIssues`)를 교차 참조해 auto_fixable 문제를 필터링하고, "checking/ready/needs_confirmation/blocked/failed" 5단계 사용자 상태를 계산
- `AutoReviewSummaryCard`에 선택적 `userFacingSummary` prop 추가 — 전달하면 기본 화면이 "헤드라인 + 확인할 사항 N건"으로 단순화되고, 기존 4개 카운트 줄 + 전체 issue 목록(auto_fixable 포함)은 내부 `AdvancedDetails`("자동 검토 상세")로 자동 이동. 전달하지 않으면 기존 동작 100% 유지(하위 호환)
- `fromUserFacingReviewToWorkflowStatus`/`fromUserFacingReviewToNextAction`(`lib/ui/*.ts`) 신설 — UX-03B1 어댑터 패턴을 그대로 따름
- 적용: `app/articles/[id]/social/page.tsx`(목록 카드), `app/social-posts/[id]/page.tsx`(상세 화면 — `humanReviewItems` 계산의 중복 필터링도 함께 제거), `app/articles/[id]/blog/page.tsx`(wordpress_blog 카드에 이전까지 없었던 issue 가시성을 추가 + "자동 수정 후 재검토" 버튼을 wordpress_blog에도 확장)
- `app/articles/[id]/rewrite/page.tsx` 조사 결과: 이 원칙이 적용되지 않음(rewrite는 quality-gate/auto-fix 시스템을 전혀 쓰지 않는 별개의 제안/재승인 상태 머신) — 변경 없음
- 생성 직후 자동 수정→자동 재검토 자동 실행은 이미 Phase 4-28에서 구현되어 있었음을 재확인(모든 플랫폼 공용 `generateSocialDraft`가 호출) — 새로 구현하지 않음
- `[자동 검토 실행]`/`[자동 수정 후 재검토]` 버튼이 기본 성공 흐름에서 경쟁하는 primary로 보이지 않는지 3개 route 모두 검증(이미 대부분 올바르게 구현되어 있었음을 확인)

**위험도**: 낮게 실현됨 — 새 prop은 opt-in(전달 안 하면 기존 동작 유지), 3개 route는 독립적으로 병렬 작업. 전체 테스트(3505개)/lint/build 통과.

**의존성**: UX-03 완료(충족됨)

### UX-04B (완료, 2026-09-18): 다중 플랫폼 일괄 확인 UX

> 완료 내역은 [`docs/ux/ux-04b-multi-platform-review.md`](./ux-04b-multi-platform-review.md) 참고.

**목적**: 기사 하나에서 여러 플랫폼 글이 생성됐을 때, 사용자가 각 카드를 개별적으로 검토·확인·승인해야 하는 반복 부담을 줄인다.

**실제 변경 범위**:
- `summarizeMultiPlatformReview()`(`lib/ui/multi-platform-review-summary.ts`) 구현 — UX-04A의 `summarizeUserFacingReview()`를 post마다 반복 적용해 `{total, checking, ready, needsConfirmation, blocked, failed, approved, bulkApprovalEligiblePostIds, ...}` 집계, `getMultiPlatformReviewSortKey()`로 "문제 있는 글 우선" 정렬 키 제공
- `MultiPlatformReviewSummaryCard`(`components/review/*.tsx`) 신설 — "전체 N개 / 게시 전 해결 필요 N개 / 확인 필요 N개 / 확인할 사항 없음 N개 / 승인 완료 N개" 요약 + 일괄 승인 슬롯
- `bulkApproveSocialPosts()`(`lib/social/social-post-approval-service.ts`) + `bulkApproveSocialPostsAction`(`app/articles/[id]/actions.ts`) 신설 — 기존 단일 `approveSocialPost()` guard를 대상마다 그대로 호출(새 validation 없음), 부분 실패 지원, 외부 게시 미실행
- 적용: `app/articles/[id]/social/page.tsx` — 상단에 요약 카드 + 일괄 승인(ConfirmSubmitButton으로 명시적 확인), 카드 목록을 문제 우선 순으로 정렬
- automation-safety 4버튼 재확인 결과 실제로 동일 action이었음을 확인 → 1개로 통합
- H2(dry-run 용어)/H3(raw enum 버튼 라벨) 해결 — `ApiReadinessBadge`/`ApiReadinessSummary`/`ApiDryRunPayloadPreview`/`AbTestCard`
- markdown/HTML 잔여물 정리 조사 — naver_cafe는 이미 충분히 커버됨, x/threads/instagram(plain-text SNS)은 검사 자체가 없는 실제 gap을 발견(수정하지 않고 기록만 — 새 quality-gate 검사 추가는 이번 Phase 범위 밖)

**위험도**: 낮게 실현됨 — 일괄 승인은 기존 단일 승인 guard를 루프로 재사용, 새 validation 없음. 전체 테스트(3547개)/lint/build 통과.

**의존성**: UX-04A 완료(충족됨)

---

## UX-05: 게시/승인 흐름 단순화

> **업데이트 (2026-09-18)**: "승인" 용어 혼동(rewrite "개선 제안 승인"/
> "재승인 요청"/"재승인 승인하기")은 UX-03B2에서, WordPress Draft/실제
> 공개 게시 문구·동선 분리는 UX-02A에서 이미 해결되었다. **UX-05A,
> UX-05B 완료 — UX-05 전체 완료**. 완료 내역은
> [`docs/ux/ux-05a-publish-preparation.md`](./ux-05a-publish-preparation.md),
> [`docs/ux/ux-05b-publish-execution-completion.md`](./ux-05b-publish-execution-completion.md) 참고.

### UX-05A (완료, 2026-09-18): 승인 이후 게시 준비 과정 통합

> 완료 내역은 [`docs/ux/ux-05a-publish-preparation.md`](./ux-05a-publish-preparation.md) 참고.

**목적**: "승인 완료 이후 사용자가 무엇을 해야 하는지"를 플랫폼
capability 기준으로 통합한 공통 UX로 정리한다. 새 publish engine은
만들지 않는다.

**실제 변경 범위**:
- `PublishPreparationState`(7단계: not_approved/needs_attention/needs_setup/ready/in_progress/completed/failed) + `PublishPreparationViewModel`(`lib/ui/publish-preparation-view-model.ts`) 신설 — 기존 `getWordPressPublishPrepState`/`getPostApprovalNextActions`를 어댑터로 감싸기만 함(새 판단 로직 없음)
- 조사 결과: **어떤 플랫폼에도 실제 "즉시 API 게시"가 구현되어 있지 않음**을 확인 — `getPublishCapability`는 draft(wordpress_blog)/manual(naver_blog·news_article·opinion_column)/copy(naver_cafe·x·threads·instagram) 3가지만 반환하고, "게시하기"라는 존재하지 않는 버튼은 만들지 않음
- `summarizeMultiPlatformPublishPreparation()`/`PublishPreparationSummaryCard`/`PlatformPublishPreparationCard` 신설(UX-04B와 같은 집계+요약카드+개별카드 패턴)
- 적용: `app/articles/[id]/social/page.tsx`에 "게시 준비" 섹션 추가(검토 workspace와 분리, 승인된 post만 대상). `app/articles/[id]/blog/page.tsx`는 조사 결과 기존 `WorkflowStatusCard`/`NextActionPanel`(wordpress_blog) + `getSocialPostCardActionState`(naver_blog/news_article/opinion_column)가 이미 이 Phase의 목표를 만족해 새 컴포넌트를 추가하지 않음(중복 방지)
- `getApprovalGateStatus` 전수 감사 완료 — 8개 분기 모두 이미 자연어 reason을 갖고 있고 raw 필드명이 없음을 확인(수정 불필요, 회귀 테스트만 추가)
- x/threads/instagram의 markdown/HTML 잔여물 탐지 gap(UX-04B에서 발견) 해결 — `platform_markup_residue` checklist key 신설, `lib/social/plain-text-markup-residue-sanitizer.ts` 구현(naver_cafe 동작은 그대로 유지), auto_fixable+구현됨으로 분류

**위험도**: 낮게 실현됨 — 어댑터 패턴 재사용, 3개 독립 fork로 병렬 작업(ViewModel 기반 작업/페이지 wiring/markup residue). 전체 테스트(3617개)/lint/build 통과.

**의존성**: UX-04B 완료(충족됨)

### UX-05B (완료, 2026-09-18): 게시 실행·완료 UX

> 완료 내역은 [`docs/ux/ux-05b-publish-execution-completion.md`](./ux-05b-publish-execution-completion.md) 참고.

**목적**: 실제 존재하는 capability(draft/manual/copy)만 사용해 게시 실행과
완료 UX를 연결한다. 새 외부 publish API는 만들지 않는다.

**실제 변경 범위**:
- `PublishPreparationState`에 `"action_completed"`(시스템 작업은 끝났지만 외부 게시 확인은 아직) 추가 — 현재는 타입/집계/요약카드에만 반영, 실제로 이 state를 만드는 곳은 없음(WordPress Draft 보기/copy는 여전히 "ready"로 유지하기로 결정 — 근거는 완료 문서 참고)
- `checkRecordable()`(`lib/social/platform-manual-posting-result-service.ts`)의 raw DB 필드명 노출(`quality_status가 'ready'가 아니어서(...)` 등) 전부 자연어로 교체 — 판단 조건은 불변
- naver_cafe markdown 검사가 unescaped `**bold**`를 놓치던 비대칭 해소(기존 `MARKUP_RESIDUE_BOLD_PATTERN`/`stripBoldMarkers` 재사용, 새 로직 없음)
- 기존 "게시 결과 기록"(`recordManualPostingResultAction`) 폼을 새로 만들지 않고, `PlatformPublishPreparationCard`의 "게시 완료로 표시" secondaryAction에서 그 폼으로 anchor 이동하도록 연결
- `CopyPostBodyButton`에 복사 성공 후 "게시 완료로 표시" 안내(클라이언트 로컬 상태만 — DB 저장 없음)
- bulk approval 성공 메시지 옆에 `#publish-preparation` anchor로 이동하는 "게시 준비 보기" 링크 추가
- 이미 게시 완료로 표시된 글(`publishStatus === "published"`)은 `[본문 수정]`을 비활성화하고 안내 문구로 대체 — 근거 조사 결과, 편집 시 승인 무효화(`approval_status` 리셋)와 게시 완료 글 수정 차단(`saveSocialPostRevision`이 `publishStatus === "published"`면 저장 자체를 막음)은 **이미 repository 레벨에 완전히 구현되어 있었음**을 확인(코드 변경 없음, 프레젠테이션 갭만 수정)
- WordPress Draft 생성 실패는 기존 `redirectToSafeTarget`(에러 메시지 + `jobRunId`) 메커니즘으로 이미 충분히 재시도 가능함을 확인(코드 변경 없음)

**위험도**: 낮게 실현됨 — 조사 결과 대부분의 안전장치(edit invalidation, published-post edit block, manual completion guard)가 이미 구현되어 있어 실제 코드 변경은 프레젠테이션 계층에 국한됨. 전체 테스트(3632개)/lint/build 통과.

**의존성**: UX-05A 완료(충족됨)

---

## UX-06 (완료, 2026-09-19): 전체 사용자 여정 자동 검증

> 완료 내역은 [`docs/ux/ux-06-user-journey-validation.md`](./ux-06-user-journey-validation.md), [`docs/ux/ux-06-journey-matrix.md`](./ux-06-journey-matrix.md) 참고.

**목적**: UX-02~05B 적용 후 핵심 Journey 5개(+Dashboard/Trends 재확인
2개)를 실제 서비스 함수 체이닝 + 프로젝트 전체 정적 UX invariant
검사로 자동 검증한다.

**실제 변경 범위**:
- 테스트 인프라 조사 결과: Playwright/Cypress/browser E2E 없음 확인 — 새 dependency를 설치하지 않고 기존 Vitest 패턴(정적 소스 검사 + renderToStaticMarkup + repository mock)만으로 journey 검증 구성
- `lib/journeys/*.test.ts` 5개 신설 — WordPress/Naver Cafe(copy)/X thread/Multi-platform/Rewrite journey를 실제 서비스 함수 체이닝으로 검증, 각각 성공 계약(success contract) 명시
- `lib/ui/ux-invariants.test.ts`(26 tests) 신설 — "다음 작업 옆에 실제 action 존재", "승인/완료 action 반복 금지", "본문 수정=inline edit", "public publish 미노출" 등을 11개 핵심 페이지에 걸쳐 영구 회귀 테스트화
- `lib/ui/raw-technical-info.test.ts`(76 tests) 신설 — raw DB 필드명/env 변수명/dry-run/handoff가 사용자 텍스트로 노출되는지 11개 페이지+8개 공유 컴포넌트 스캔, 실제 leak 1건 발견 즉시 수정
- `PublishPreparationState`의 미사용 `"action_completed"` dead state 제거(UX-05B에서 만들었으나 실제 source of truth가 없어 이번 Phase에서 결정 — 옵션 B)
- Dashboard/Trends/Theme(Journey 6-7)와 기존 조사 공백 4개 페이지는 새 코드 없이 기존 검증 재사용 + 위 두 스캐너의 스캔 대상에 포함시켜 영구 커버

**위험도**: 낮게 실현됨 — 검증 중심, 코드 변경은 라벨 1건 + dead state 제거뿐. 전체 테스트(3767개)/lint/build 통과. **UX-07 진입 기준 충족**(Critical 0/Journey blocker 0/dead-end 0/raw info 노출 0/primary action 충돌 0).

**의존성**: UX-02~05B 전체 완료(충족됨)

---

## UX-07 (완료, 2026-09-19): 최종 UX Polish & Consistency Pass

> 완료 내역은 [`docs/ux/ux-final-report.md`](./ux-final-report.md) 참고.

**목적**: 새 기능 없이 남은 High 부분 해결(H5/H6), Medium/Low 항목,
용어 통일, 정보 밀도, UX governance 최종 고정.

**실제 변경 범위**:
- H5: `app/articles/[id]/page.tsx` 관리자 접힘 내부를 4개 카테고리
  accordion(SEO 연동/대표 이미지/WordPress 연결·반영 실행/게시 안전
  설정)으로 그룹핑 — 기존 개별 섹션/accordion/action은 그대로 두고
  카테고리 accordion 1단만 추가(accordion 과다 중첩 방지)
- H6: `/social-posts/[id]`의 다중 필드 편집 탭 라벨을 "수정하기" →
  "글 정보 편집"으로 변경(본문만 고치는 카드의 "본문 수정"과 용어
  충돌 해소) — business logic/action은 변경 없음
- Medium: `/articles` 상태 라벨의 raw enum 병기(`"초안 (draft)"`)
  제거, 나머지 Medium은 코드 재확인 결과 이미 해결되어 있었거나
  (M7/M8/M9) 의도적 유지(M2/M3/M4)로 재분류
- `lib/ui/ux-07-polish.test.ts` 신설 — H5/H6 회귀 방지
- `docs/ux/ux-regression-checklist.md`, `docs/ux/final-user-workflow.md`,
  `docs/ux/ux-final-report.md` 신설, `docs/ui-ux-governance-rules.md`에
  "UX Governance 최종 원칙(16개)" 절 추가, `CLAUDE.md`에 "UX Rules" 절 추가

**위험도**: 낮게 실현됨 — H5는 순수 wrap(내용 이동/변경 없음), H6은
라벨 텍스트만 변경. 전체 테스트/lint/build 통과. **UX 개선 프로젝트
종료 조건 충족**(Critical open 0/High open 0/Journey blocker 0/
dead-end 0/위험한 publish 오해 0).

**의존성**: UX-02~06 완료 후 (기능적 변경이 끝난 뒤 표현/구조 다듬기)

---

## Phase 간 의존성 요약

```
UX-02 (Critical) → UX-05 (게시/승인 흐름, 동일 영역 공유)
UX-02 → UX-03 (공통 컴포넌트, Critical 수정 패턴 반영)
UX-03 → UX-04 (NextActionPanel/HumanReviewPanel 재사용)
UX-02~05 → UX-06 (전체 검증)
UX-02~06 → UX-07 (polish)
```

## 이번 Phase(UX-01)에서 다음 Phase로 넘기는 미해결 조사 항목

- `app/articles/[id]/rewrite/page.tsx`의 카드 단위 세부 조사
- `/dashboard/rewrite`, `/dashboard/social-performance`, `/trends` 일부 화면의 전문 확인
- `getApprovalGateStatus`가 모든 케이스에서 `reason`을 채우는지 여부
- `/dashboard/platform-api`, `/dashboard/automation-safety`가 일반 사용자 네비게이션에 실제로 노출되는지 여부
