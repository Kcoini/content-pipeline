# Phase 4-15: SNS/커뮤니티 글 카드 안 inline 수정·저장 후 검토/승인·본문 복사

## 문제

Phase 4-14가 목록 카드에서 본문을 전체로 보여주고 승인/export까지
가능하게 했지만, "본문 수정"은 여전히 `/social-posts/[id]` 상세
페이지로 이동해야 했다. 수정 후 다시 목록으로 돌아와 검토/승인해야
해서 클릭 수가 많았고, 본문을 바로 복사할 방법도 없었다.

## 해결

### 1) 카드 안 inline editor (`SocialPostBodyPanel`)

`components/social/social-post-body-panel.tsx`(신규, `"use client"`)가
게시용 본문 표시(읽기 모드)와 textarea 편집(편집 모드)을 하나의
컴포넌트로 관리한다 — 페이지 이동 없이 `useState`로만 모드를 바꾼다.

- 읽기 모드: "게시용 본문" 라벨 + `CopyPostBodyButton` + 기존
  `ExpandableText`(Phase 4-14, 그대로 재사용) + (지원 플랫폼이면)
  "본문 수정" 버튼.
- 편집 모드: 현재 본문 전체를 담은 `<textarea>`(`white-space:
  pre-wrap`으로 줄바꿈 유지) + [저장 후 승인]/[저장 후 자동
  검토]/[저장만 하기]/[취소] 4개 버튼.
- 저장 버튼 3개는 **하나의 `<form>`을 공유**하고, `name="saveMode"`
  값만 다르게 제출한다(HTML 표준 동작 — 클릭된 버튼의 name/value만
  FormData에 포함된다) — 별도의 클라이언트 상태나 분기 로직 없이
  서버 action이 `formData.get("saveMode")`로 어떤 버튼이 눌렸는지
  안다.

### 2) 저장 대상 필드 결정 (`getSocialPostEditableField`)

`lib/social/social-post-inline-edit-service.ts`(신규)의
`getSocialPostEditableField(platform)`이 `PLATFORM_WRITING_CONFIGS`
(하드코딩된 platform 이름 목록이 아니라, `getSocialPostDisplayBody`와
동일한 기준)를 보고 저장 대상 필드를 고른다:

- `supportsThreads`가 true인 platform(x) → `null`(지원 안 함) — x는
  `threadItems` 배열 기반 콘텐츠라 단일 textarea로 안전하게 수정할
  수 없다. 이 플랫폼은 `SocialPostBodyPanel`이 "본문 수정" 버튼을
  아예 보여주지 않고(카드의 secondary action 목록에는 기존처럼
  상세 페이지로 가는 "본문 수정" 링크가 남는다), 상세 페이지의
  전용 thread 편집기를 계속 사용해야 한다.
- 그 외 `supportsBody`가 true(naver_cafe/naver_blog/wordpress_blog/
  threads/news_article/opinion_column) → `"postBody"`.
- `supportsCaption`만 true(instagram) → `"caption"`.

네이버 카페는 항상 `postBody`로 저장되므로, caption만 수정되어
본문이 비어 보이는 문제가 재발하지 않는다.

### 3) 저장 → 자동 검토 → 승인 순서 보장 (`saveSocialPostBodyAndProcess`)

같은 파일의 `saveSocialPostBodyAndProcess(socialPostId, body,
saveMode, approvedBy)`가 새 저장/승인 로직을 만들지 않고 이미 있는
서비스를 순서대로 호출한다:

1. `editSocialPostContent()`(기존, 변경 없음) — 저장. 이 함수가
   호출하는 `saveSocialPostRevision()`은 이미 저장 시 `quality_status`
   를 `not_checked`로, `approval_status`를 `not_requested`로
   초기화하고 있었다(Phase 3-4/3-26에서 확립된 동작) — 이번에 새로
   만들지 않았다.
2. `saveMode === "save_only"`면 여기서 끝난다.
3. 그 외에는 `runSocialPostQualityGateAndSave()`(기존)로 자동
   검토를 실행한다.
4. `saveMode === "save_review_and_approve"`이고 검토가 진행됐으면
   `approveSocialPost()`(기존)를 호출한다 — **이 함수가 승인 가능
   여부를 다시 직접 판단하지 않는다**. `approveSocialPost()` 자신의
   `checkApprovable()` 게이트(quality_status가 not_checked/blocked/
   failed면 차단, checklist에 blocked/fail 항목이 있으면 차단)를
   그대로 신뢰한다 — 승인 가능 조건을 두 곳에서 다르게 판단하는
   위험을 피하기 위해서다.

빈 본문은 `editSocialPostContent()`를 호출하기 전에 차단한다.
`saveMode`가 무엇이든 승인은 검토를 거친 뒤에만 시도된다 — "저장
후 바로 승인"은 만들지 않았다.

### 4) 게시용 본문 복사 (`CopyPostBodyButton`)

`components/social/copy-post-body-button.tsx`(신규, `"use client"`)가
`navigator.clipboard.writeText()`를 우선 사용하고, 사용할 수
없거나 실패하면 임시 `<textarea>` + `document.execCommand("copy")`
fallback으로 복사한다. 복사 대상은 항상 `getSocialPostDisplayBody(post)`
결과 전체다 — `ExpandableText`가 접힌 상태여도 표시 중인 축약문이
아니라 전달받은 원본 `text` 전체를 복사한다. 성공/실패 메시지를
버튼 아래에 3초간 보여준다.

### 5) 로그 기록 (redirect 없는 client-event action)

`app/articles/[id]/actions.ts`에 `saveSocialPostInlineEditAction`
(저장/검토/승인 — `redirectToSafeTarget`로 같은 페이지에 메시지와
함께 되돌아간다)과 `logSocialPostInlineEditClientEventAction`(신규,
**redirect하지 않는** 순수 로그 전용 action)을 추가했다. 후자는
`<form>` 제출이 아니라 클라이언트 컴포넌트에서 `await
logSocialPostInlineEditClientEventAction(...)`처럼 일반 함수로
호출한다 — 편집창 열기/취소, 복사 성공/실패처럼 페이지 이동이 없어야
하는 순수 상호작용을 기록하기 위해서다. 로깅 실패는 항상 삼켜서
(`catch {}`) 사용자 흐름을 막지 않는다.

`lib/repositories/log-repository.ts`의 `LogEventType`에 다음 13개를
추가했다: `social_post_inline_edit_opened`/`_cancelled`,
`social_post_body_save_started`/`_completed`/`_failed`,
`social_post_save_review_started`/`_completed`/`_failed`,
`social_post_save_approve_started`/`_completed`/`_blocked`,
`social_post_body_copied`, `social_post_body_copy_failed`. full
post body/caption은 어떤 로그에도 남기지 않는다 — 길이(`bodyLength`)
등 메타데이터만 기록한다.

## 상태별 버튼 (기존 Phase 4-14 `getSocialPostCardActionState` 재사용)

`edit_body` secondary action은 그대로 두되(다른 화면/플랫폼 재사용
대비), 카드 렌더링 단계에서 `getSocialPostEditableField(post.platform)
!== null`이면 그 secondary action을 목록에서 걸러낸다 — 이제
`SocialPostBodyPanel` 자신이 "본문 수정" 버튼을 보여주므로 중복
표시를 피한다. x처럼 inline 편집이 안 되는 플랫폼은 기존대로 상세
페이지로 가는 "본문 수정" 링크가 secondary에 남는다.

## 안전 원칙

- 자동 public publish는 추가하지 않았다.
- 승인 전 export를 막는 기존 guard(`checkApprovable`,
  `runPlatformPublishingGuard`)는 변경하지 않았다.
- raw 런타임 에러는 `describeUnexpectedError()`로 감싼다(Phase 4-9
  원칙 재사용).
- 민감정보(Application Password 등)는 이번에도 노출하지 않는다.
- full post body/캡션/프롬프트는 로그에 남기지 않는다.

## 테스트

- `lib/social/social-post-inline-edit-service.test.ts`(신규, 16개):
  `getSocialPostEditableField` 플랫폼별 분기, 빈 본문 차단, x 플랫폼
  차단, postBody/caption 저장 대상 분기, 3가지 saveMode 동작, 검토
  실패 시 승인 미호출, 호출 순서(저장→검토→승인) 검증.
- `components/social/copy-post-body-button.test.tsx`(신규, 7개):
  라벨 렌더링, clipboard/fallback/메시지 문구/로그 호출을 소스에서
  확인.
- `components/social/social-post-body-panel.test.tsx`(신규, 9개):
  읽기/편집 모드 렌더링, 버튼 구성, saveMode name 공유, textarea
  초기값, 열기/취소 로그 호출.
- `app/articles/[id]/social/page.tsx` 테스트: `SocialPostBodyPanel`
  사용, secondary 목록에서 edit_body 중복 제거 로직을 검사하는
  테스트 추가/갱신.
- `app/articles/[id]/actions.test.ts`: 새 action 2개(저장/로그) 정적
  검사 추가.
- 전체 `npx vitest run`: 237 files / 3038 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류. `npm run build`: 성공(클라이언트 컴포넌트가
  `"use server"` 파일의 함수를 직접 import해 호출하는 패턴 포함해
  정상 빌드됨을 확인).

## 관련 문서

- [`phase-4-14-social-post-list-inline-body.md`](./phase-4-14-social-post-list-inline-body.md) — 본문 표시/ExpandableText/getSocialPostCardActionState의 선행 작업
- [`phase-3-26-social-post-review-workspace.md`](./phase-3-26-social-post-review-workspace.md) — editSocialPostContent가 이미 quality/approval을 초기화하는 동작의 출처
- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)
