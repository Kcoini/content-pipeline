# Phase 4-14: SNS/커뮤니티 글 목록 카드 본문 인라인 표시 + 버튼 정리

## 문제

`app/articles/[id]/social/page.tsx`(SNS/커뮤니티 글 목록)에서:

- 게시용 본문이 140자로 잘려 보였다(`getSocialPostDisplayBody(post).slice(0, 140)`).
- 전체 본문을 보려면 `/social-posts/[id]` 상세 페이지로 이동해야 했다.
- 자동 검토가 이미 통과했는데도 품질검사/승인 요청/승인/복사·export
  준비 4개 버튼이 항상 같은 수준으로 나열되어 있었다(`nextAction.kind`로
  강조 스타일만 바뀌고, 버튼 자체는 사라지지 않았다).
- 본문보다 자동 검토 결과 카드가 먼저 보였다.

## 해결

### 1) 카드 안에서 본문 전체 표시 (`ExpandableText`)

`components/social/expandable-text.tsx`(신규, `"use client"`)가
`text`/`collapsedLimit`(기본 1,200자)/`previewLength`(기본
700자)/`expandLabel`/`collapseLabel`/`defaultExpanded` props를 받아:

- 1,200자 이하면 버튼 없이 전체를 그대로 보여준다.
- 1,200자를 초과하면 700자만 보여주고 "전체 보기" 버튼을 표시한다.
- 클릭하면 `useState`로 같은 컴포넌트 안에서 펼침/접힘만 바꾼다 —
  페이지 이동도, 서버 action 호출도 없다.

목록 카드는 `getSocialPostDisplayBody(post)`(Phase 3-19, 변경 없음 —
naver_cafe는 여전히 `sanitizeNaverCafePlainText(postBody)`를 우선
사용해 caption만 보이는 문제가 재발하지 않는다)의 결과를 이
컴포넌트에 그대로 넘긴다. 본문이 비어 있으면 `"(본문 없음)"` 한
마디만 보여주지 않고, `describeAutoReviewNotRunYet()`으로 다음
작업까지 함께 안내한다.

### 2) 본문을 자동 검토 결과보다 먼저 표시

기존에는 (1) 본문 140자 미리보기 → (2) 사용자 친화 상태 요약 →
(3) 자동 검토 리포트(통과/확인필요/수정필요/차단 상세) 순서였다.
이제는 (1) 게시용 본문(전체/펼치기) → (2) 자동 검토 리포트 → (3)
사용자 친화 상태 요약 → (4) primary/secondary 버튼 순서다 — 사용자가
글을 먼저 읽고 판단할 수 있게 한다.

### 3) 상태별 primary action 1개 (`getSocialPostCardActionState`)

`lib/social/social-post-card-action-state.ts`(신규)의
`getSocialPostCardActionState(post)`가 지금 상태에 맞는
`statusBadge` + `primaryAction`(1개) + `secondaryActions`(0~2개)를
계산한다. 우선순위: 품질검사 미실행 → 품질 문제(수정필요/차단/실패) →
export 준비/완료 → 승인 완료(export 준비 전) → 자동 검토 통과(승인
필요).

핵심 변경: `approveSocialPost()`(`lib/social/social-post-approval-service.ts`)는
`approval_status`가 `pending_review`일 것을 요구하지 않는다 — quality
gate만 통과하면 바로 승인할 수 있다. 따라서 자동 검토 통과 직후의
기본 흐름은 "승인 요청"을 건너뛰고 곧바로 **[승인]**을 primary로
보여준다. "승인 요청"은 필수 단계가 아니므로 "상세 상태 보기 / 보조
작업" 접힘 안으로만 이동했다(기능은 삭제하지 않음).

`approval_status === "approved"`가 되면 [승인] 버튼 자체가 더 이상
계산되지 않고(다음 우선순위로 넘어간다) [복사/export 준비]가
primary가 된다 — "승인 완료" 배지만 남고 승인 버튼은 사라진다.

품질검사가 fail/blocked/needs_revision이면 [문제 확인하기]가
primary다. 이 버튼은 같은 카드 안에서 이미 보이는 자동 검토 리포트로
스크롤하는 in-page anchor(`#social-post-review-{id}`)다 — 별도
페이지로 이동하지 않는다. secondary로 "본문 수정"(상세 페이지로
이동)을 제공한다. **주의**: "AI로 보완하기"처럼 문제를 자동으로
고쳐 쓰는 기능은 만들지 않았다 — 기존 `generateSocialDraft()`는
같은 platform/tone으로 새 글을 다시 만드는 함수라, 기존 글을 그
자리에서 고치지 않고 중복 글이 생길 위험이 있기 때문이다(WordPress
쪽 Phase 4-10/4-13에서 "본문 자동 보완"을 만들지 않은 것과 같은
이유).

### 4) 재실행용 action은 "상세 상태 보기 / 보조 작업" 접힘으로

기존에 있던 5개 보조 action(게시 준비 확인/게시 전 미리보기
만들기/수동 게시 준비 완료/게시 체크리스트 준비)에 이번에
"품질검사 다시 실행"과 "승인 요청"을 추가로 옮겼다 — 삭제한 기능은
없다.

### 5) "게시 결과 기록"은 anchor로 안내

export 준비 완료/완료 상태의 secondary "게시 결과 기록"은 이미
접혀 있는 "게시 결과 기록 / Metrics 입력" `<details>`로 스크롤하는
in-page anchor다(`#social-post-manual-result-{id}`). 열려면 한 번
더 클릭이 필요하지만, 페이지 이동은 없다.

## 상세 페이지의 역할

`/social-posts/[id]`는 삭제하지 않았고 계속 존재한다. 다만 기본
검토 흐름(본문 읽기 → 승인 → export 준비)에서 **강제 경유지가
아니게** 됐다 — 목록 카드에서 본문을 전체로 읽고, 승인/export
준비까지 끝낼 수 있다. 상세 페이지는 내부 상태 확인, 세부 검토 결과,
게시 결과 기록/Metrics 입력, 원본 article 확인, 로그 확인, 고급
작업(Phase 3-26에서 이미 이 역할로 재정의됨)을 위한 화면으로 남는다.

## 안전 원칙

- 자동 public publish는 추가하지 않았다.
- 승인 전 export가 차단되는 기존 guard(`runPlatformPublishingGuard`,
  `checkApprovable`)는 변경하지 않았다.
- 민감정보는 이번에도 노출하지 않는다.

## 테스트

- `components/social/expandable-text.test.tsx`(신규): 1,200자 이하/
  초과 분기, previewLength 적용, defaultExpanded, label 커스터마이즈,
  `"use client"`/서버 action·페이지 이동 없음을 소스에서 확인. 11개
  테스트 통과.
- `lib/social/social-post-card-action-state.test.ts`(신규): 우선순위
  9개 케이스(품질검사 전/수정 필요/승인 전/승인 후/export 준비/
  export 완료) 검증.
- `app/articles/[id]/social/page.test.ts`: 새 구조(ExpandableText
  사용, 본문이 검토 결과보다 먼저, primary 1개만 강조, 보조 action
  접힘 이동)를 검사하는 새 describe 블록 추가, 기존 2개 테스트를
  새 구조에 맞게 갱신. 33개 테스트 통과.
- 전체 `npx vitest run`: 234 files / 3000 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류. `npm run build`: 성공.

## 관련 문서

- [`phase-3-26-social-post-review-workspace.md`](./phase-3-26-social-post-review-workspace.md) — `/social-posts/[id]`가 이미 갖고 있던 "본문 확인→검토→승인→export" 흐름과 `getSocialPostDisplayBody` 재사용 원칙
- [`phase-3-21-platform-generation-flow.md`](./phase-3-21-platform-generation-flow.md)
- [`phase-4-13-wordpress-publish-prep-simplification.md`](./phase-4-13-wordpress-publish-prep-simplification.md) — 같은 "현재 상태 + 남은 작업 + 다음 버튼 1개" 원칙을 WordPress 화면에 적용한 선행 작업
- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)
