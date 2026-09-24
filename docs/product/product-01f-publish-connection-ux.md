# PRODUCT-01F: Publish & Connection UX

- 작성일: 2026-09-24
- 관련 문서: `docs/product/product-01e-content-creation-experience.md`,
  `docs/product/product-01d-first-use-settings.md`,
  `docs/product/product-language-dictionary.md`.

## 1. 현재 publish flow(조사 결과)

Generation → Review → Approval → Publish Preparation → Platform-specific
action → Completion record 흐름은 플랫폼에 따라 두 갈래로 나뉜다.

- **wordpress_blog**: `app/articles/[id]/blog/page.tsx`(2800줄+) 전용
  페이지. `getWordPressPublishPrepState()` → `fromWordPressPublishPrepState()`
  → `NextActionPanel`로 "Draft 만들기/업데이트/보기"를 안내한다. 실제
  Draft 생성은 `lib/publish/publish-service.ts`의
  `publishArticleToWordPressDraft()`가 WordPress REST API를 호출한다
  (draft만 생성, 공개 게시 없음 — 재확인 완료).
- **그 외 7개 플랫폼**(naver_blog/naver_cafe/news_article/
  opinion_column/x/threads/instagram): `app/articles/[id]/social/page.tsx`.
  `getPostApprovalNextActions()` → `fromPostApprovalNextActionsToPublishPreparation()`
  → `PlatformPublishPreparationCard`로 "본문 복사/수동 export 준비/API
  게시 준비 확인"을 안내한다. 실제 외부 게시 API 호출은 **이 프로젝트
  어디에도 구현되어 있지 않다**(`lib/ui/publish-preparation-view-model.ts`
  상단 주석에 이미 명시돼 있었다 — 재확인 완료).
- **Completion record**: `lib/social/platform-manual-posting-result-service.ts`의
  `recordManualPostingResult()`가 사용자가 입력한 URL을 저장하고
  `manual_post_status='posted'`로 기록한다. 이 함수의 반환 메시지는
  이미 "실제 API 게시가 아닌 수동 게시 기록입니다"라고 명시한다(재확인
  완료, 변경 없음).

각 플랫폼의 승인 전/승인 완료/게시 준비 전/게시 준비 완료/외부 게시
전/외부 게시 결과 기록 상태 표시는 아래 4절 표로 정리했다.

## 2. 플랫폼별 현재 capability(변경 없음)

`lib/ui/publish-preparation-view-model.ts`의 `PLATFORM_CAPABILITY`(기존)가
정확히 지시서의 capability 표와 일치한다 — 재확인만 하고 값은
전혀 바꾸지 않았다:

| platform | capability |
|---|---|
| wordpress_blog | draft |
| naver_blog | manual |
| news_article | manual |
| opinion_column | manual |
| naver_cafe | copy |
| x | copy |
| threads | copy |
| instagram | copy |

"direct_publish"(API 즉시 게시)는 어떤 플랫폼에도 구현되어 있지 않으므로
`PublishCapability` 타입에 포함되지 않는다(기존 설계, 변경 없음).

## 3. 사용자-facing publish 개념(4가지, 섹션 2)

기존 `PublishPreparationState`(7개 값: not_approved/needs_attention/
needs_setup/ready/in_progress/completed/failed)가 이미 지시서의 4개
개념을 내부적으로 세분화해 구현하고 있었다:

| 지시서 개념 | 대응하는 기존 state | 비고 |
|---|---|---|
| A. 검토 완료 | (이 view model 밖, `social-post-user-facing-status.ts`가 담당) | Publish Preparation view model은 승인 이후만 다룬다 |
| B. 게시 준비 | `not_approved`/`needs_attention`/`needs_setup`/`ready` | "무엇을 더 해야 게시 준비가 끝나는지" |
| C. 플랫폼별 전달 행동 | `ready`의 primaryAction(Draft 만들기/본문 복사/수동 export) | 플랫폼마다 다른 실제 버튼 |
| D. 외부 게시 완료 기록 | `completed`(publishStatus==="published" 또는 manualPostStatus==="posted") | "사용자가 기록했다"는 뜻, 자동 게시 아님 |

## 4. 신규/reused view model/helper

- **재사용(변경 없음)**: `PublishPreparationViewModel`,
  `fromWordPressPublishPrepStateToPublishPreparation`,
  `fromPostApprovalNextActionsToPublishPreparation`,
  `notApprovedPublishPreparation`, `getPublishCapability`,
  `PlatformPublishPreparationCard`, `PublishPreparationSummaryCard`,
  `getContentServiceReadiness`(PRODUCT-01D). 지시서 4절이 예시로 든
  `PlatformPublishActionViewModel { capability, statusLabel,
  explanation, primaryActionLabel, secondaryActionLabel,
  completionMeaning }`과 거의 동일한 shape가 이미 `PublishPreparationViewModel`
  (`platform`/`state`/`title`/`message`/`primaryAction`/`secondaryActions`)로
  존재했다 — 새로 만들지 않았다.
- **신규(presentation-only)**: `describePublishCapability()`
  (`lib/ui/publish-preparation-view-model.ts`) — capability(draft/
  manual/copy) 값 자체는 그대로 두고, "게시 방식" 한 줄 라벨만 추가로
  계산한다. DB/publish status를 복제하지 않는다.

## 5. WordPress 준비 UX

기존 `app/articles/[id]/blog/page.tsx`의 "Step 3. WordPress Draft"
섹션은 이미 "공개 게시는 하지 않습니다"를 명시하고 있었다(재확인 완료).
이번 Phase에서 "게시 방식: 항상 초안(Draft)으로 저장 — 공개 게시는
하지 않습니다." 한 줄을 섹션 설명에 추가했다(문구 보강, 판단 로직
없음).

## 6. WordPress Draft 성공 UX

`lib/publish/publish-service.ts`의 성공 메시지("WordPress 초안이
생성되었습니다.", "WordPress 초안 생성 완료: {url}")는 이미 지시서
섹션 5가 요구하는 "초안" 표현을 정확히 쓰고 있었다(재확인 완료, 백엔드
파일이라 수정하지 않음 — 섹션 0/29 금지). "게시 완료"/"자동 게시
완료"/"WordPress에 공개됨" 같은 표현은 어디에도 없음을 정적 테스트로
확인했다.

## 7. WordPress 연결 상태 UX(신규)

`app/articles/[id]/blog/page.tsx`에는 **연결 상태 표시가 전혀 없었다**
(post 하나의 게시 준비 상태 `checkWordPressBlogPublishReadiness`만
있었고, 이는 품질/승인/체크리스트를 보는 완전히 다른 축이다). 이번
Phase에서 PRODUCT-01D의 `getContentServiceReadiness().wordpressAvailable`
(재계산 없이 그대로 재사용)로 "WordPress 연결: 연결됨/확인이
필요합니다/상태를 확인할 수 없습니다"를 Step 3 섹션에 추가했다 —
Settings 화면과 정확히 같은 함수, 같은 문구를 쓰므로 모순이 생기지
않는다(섹션 20).

## 8. WordPress 연결 문제가 있을 때

연결 상태가 `available`이 아니면 `[WordPress 연결하기]` 같은 가짜
버튼을 만들지 않고, "관리자에게 설정 확인을 요청해 주세요." +
"설정에서 상태 확인"(`/dashboard/settings`) 링크만 보여준다(지시서
섹션 7과 동일한 패턴, PRODUCT-01D Settings 화면에서 이미 쓰던 문구를
그대로 재사용).

## 9. Copy 플랫폼 UX(재확인)

`getPostApprovalNextActions()`의 naver_cafe/x/threads/instagram
분기가 이미 "승인 완료. API 연동이 설정되어 있습니다 — 게시 준비
상태를 확인하거나 본문을 복사할 수 있습니다." / "...본문을 복사해
수동으로 게시하세요." 문구를 제공하고 있었다(변경 없음). Copy 성공을
"게시 완료"라고 표시하지 않는다 — `CopyPostBodyButton`은 "본문을
복사했습니다."만 보여준다(9번 항목처럼 재확인, 변경 없음).

## 10. Manual 플랫폼 UX(재확인)

naver_blog/news_article/opinion_column 분기는 이미 Copy 플랫폼과
다른 메시지("본문을 복사해 수동으로 게시하거나, 수동 export를 준비할
수 있습니다.")를 제공한다 — 두 그룹이 이미 서로 다른 안내 문구를
쓰고 있었다(재확인, 변경 없음). 이번 Phase에서는 카드에 "게시 방식:
외부에서 직접 게시"(manual) vs "게시 방식: 본문 복사 후 직접
게시"(copy) 라벨을 추가로 얹어(4/13절) 두 그룹의 차이를 한 번 더
명확히 했다.

## 11. Completion Record UX

- `recordManualPostingResult()`의 성공 메시지는 이미 "실제 API 게시가
  아닌 수동 게시 기록입니다"를 명시한다(변경 없음, backend 파일).
- URL 입력 필드 라벨/버튼을 사용자 언어로 바꿨다: "게시 URL"→"게시한
  주소", "게시 URL 저장"/"게시 결과 기록"→"게시 완료 기록"(지시서
  섹션 11 예시와 동일), placeholder "게시된 URL"→"게시한 주소(URL)".
  `app/articles/[id]/blog/page.tsx`(2곳)와 `app/articles/[id]/social/page.tsx`(1곳)
  모두 반영. 안내 문구 "외부 게시 후 게시물 주소를 입력해 주세요."를
  체크리스트 URL 입력 폼에 추가했다. 가짜 URL 자동 추측/입력 없음
  (재확인, 원래도 없었음).

## 12~13. Publish Preparation 화면 / 플랫폼 카드 UX

새 dashboard를 만들지 않았다 — 기존 `PublishPreparationSummaryCard`
(`app/articles/[id]/social/page.tsx`)를 그대로 재사용한다. 플랫폼
카드(`PlatformPublishPreparationCard`)에 "게시 방식" 필드를 추가해
이제 플랫폼 이름/현재 상태(title)/게시 방식/다음 행동(primaryAction)
4개가 기본으로 보인다(지시서 섹션 13 예시와 동일 구조). 기술
capability 이름(`draft_or_manual_existing` 등, admin 전용
`platform-api-capabilities.ts`)은 노출하지 않는다 — 이 카드는 `draft`/
`manual`/`copy` 3값만 사용한다.

## 14. Publish Preparation status language(재확인)

`STATE_LABELS`(기존, `lib/ui/publish-preparation-view-model.ts`)가
이미 raw state를 노출하지 않고 한국어로 변환한다: `ready`→"게시 준비
완료", `needs_attention`→"확인 필요", `not_approved`→"승인 필요" 등
7개 전부. 변경 없음(정적 테스트로 회귀 방지).

## 15. Approval gate 표현(재확인, guard 변경 없음)

`notApprovedPublishPreparation()`이 이미 "아직 승인되지 않았습니다.
먼저 검토·승인을 완료하세요."를 제공하고, primaryAction 자체가
없어(undefined) 카드에 실행 가능한 버튼이 렌더링되지 않는다 — guard를
프론트 조건으로 대체하지 않았다(서버 액션 쪽 승인 검사도 전혀
건드리지 않음).

## 16. 성공 메시지 차별화(재확인)

WordPress(`"WordPress 초안이 생성되었습니다."`), Copy
(`"본문을 복사했습니다."`), Manual result
(`"수동 게시 결과를 기록했습니다 (실제 API 게시가 아닌 수동 게시
기록입니다)."`) — 이미 셋 다 다른 문구를 쓰고 있었다(재확인, 변경
없음). "게시 완료"로 통일되어 있지 않음을 확인했다.

## 17. Copy interaction 확인(재확인)

`CopyPostBodyButton`이 이미 `navigator.clipboard.writeText()` 성공/
실패를 `try/catch` + fallback(`execCommand`)으로 정확히 구분하고,
"본문을 복사했습니다."/"복사하지 못했습니다. 본문을 직접 선택해 복사해
주세요."를 실제 결과에 맞게 보여준다(지시서 섹션 21 예시와 정확히
일치 — 변경 없음). 무조건 성공 toast 없음.

## 18. 플랫폼 배지(재확인)

기존 `PlatformBadge`/`ContentGroupBadge`가 아이콘과 텍스트를 함께
표시한다(아이콘 단독 표시 없음, 재확인 변경 없음).

## 19. Connection UX 범위

WordPress OAuth/Application Password 관리 UI/Naver·X·Threads·
Instagram OAuth/credential 저장 DB/Secret 입력 UI — 전혀 만들지
않았다. "연결되어 있는가"/"다음에 무엇을 해야 하는가"만 기존
`getContentServiceReadiness()` 재사용으로 보여준다(7절).

## 20. Settings 연동

`/dashboard/settings`와 `/articles/[id]/blog`가 완전히 같은 함수
(`getContentServiceReadiness().wordpressAvailable`)를 호출하므로
"연결됨"/"확인이 필요합니다"/"상태를 확인할 수 없습니다" 문구가
두 화면에서 항상 일치한다 — 서로 다른 readiness 계산을 만들지
않았다.

## 21. Backend 변경 감사(섹션 29)

`git diff --stat` 기준 이번 Phase에서 수정한 파일은 전부 presentation/
view model/component/test다: `app/articles/[id]/blog/page.tsx`,
`app/articles/[id]/social/page.tsx`(문구만), `components/publish/
platform-publish-preparation-card.tsx`, `lib/ui/publish-preparation-
view-model.ts`(신규 export 1개 추가, 기존 함수 로직 변경 없음) 및
대응 테스트. `lib/publish/publish-service.ts`,
`lib/social/platform-manual-posting-result-service.ts`,
`lib/social/post-approval-next-actions.ts`, repository, server guard는
**전혀 수정하지 않았다** — publish semantics/safety gate 변경 없음.

## 22. 알려진 한계

- `fromWordPressPublishPrepStateToPublishPreparation()`은 여전히
  `app/articles/[id]/blog/page.tsx`에서 직접 쓰이지 않는다(그 페이지는
  `fromWordPressPublishPrepState` + `NextActionPanel`을 직접 쓴다) —
  두 어댑터가 동시에 존재하는 이유는 화면마다 필요한 shape가 달라서다
  (NextActionPanel은 progress/fallback을 다루고, PublishPreparation은
  여러 플랫폼을 한 목록에 압축해서 보여준다). 이번 Phase에서는 이
  구조를 통합하지 않았다 — 통합하려면 WordPress 페이지 전체 리팩터링이
  필요해 범위를 벗어난다.
- PRODUCT-01E의 P2(ContentProgressSteps의 generate 단계가 master+
  platform generation을 묶는 문제)는 이번 Phase의 publish flow
  테스트에서 실제 사용자 혼란 사례가 발견되지 않아 수정하지 않았다
  (지시서 섹션 27에 따라 그대로 유지).
