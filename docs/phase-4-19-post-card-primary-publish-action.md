# Phase 4-19: 모든 글 카드에 상태 기반 "다음 작업" 버튼 정리 (1차)

## 문제

`/articles/[id]/blog`의 naver_blog/news_article/opinion_column 카드는
품질검사·승인 요청·승인·수동 export 만들기·게시 체크리스트 준비 5개
버튼을 같은 줄에 나란히 나열하고 있었다(wordpress_blog 카드만 Phase
4-13에서 "현재 상태 + 남은 작업 + 다음 버튼 1개" 요약 카드로 이미
정리돼 있었다). 사용자는 지금 무엇을 눌러야 하는지 버튼 목록에서
직접 판단해야 했다.

## 조사 결과 — 새로 만들 것이 거의 없었다

이번 스펙(모든 글 카드에 상태 기반 "다음 작업" 1개 버튼, WordPress는
Draft 생성/업데이트, 그 외 플랫폼은 승인 후 본문 복사/export 준비로
안내)이 요구하는 것은 이미 대부분 구현되어 있었다:

- **WordPress 블로그**: `getWordPressPublishPrepState()`
  (`lib/social/wordpress-blog-publish-prep-state.ts`, Phase 4-13)가
  이미 "WordPress Draft 만들기"/"WordPress Draft 최종 반영"(업데이트)/
  "WordPress Draft 보기" 라벨의 단일 primary action을 계산하고
  있었다 — 새로 만들 필요가 없었다.
- **SNS/커뮤니티 글**(`/articles/[id]/social`): `getSocialPostCardActionState()`
  (`lib/social/social-post-card-action-state.ts`, Phase 4-14)가 이미
  품질검사 → 문제 확인 → 승인 → 복사/export 준비 → 복사하기 순서의
  단일 primary action을 계산하고 있었다.
- **네이버 카페 실제 자동 업로드**: 이 프로젝트에는 네이버 로그인/
  OAuth/access token/clubid/menuid를 저장하는 어떤 구조도 없다
  (`checkPlatformApiReadiness()`가 모든 SNS 플랫폼을 `requiresOAuth`로
  분류하고 "OAuth flow/token storage가 아직 구현되지 않았다"고 명시).
  즉 네이버 카페/네이버 블로그/X/Threads/Instagram은 애초에
  "실제 업로드"가 아니라 항상 "승인 후 본문 복사 → 수동 게시" 흐름
  하나뿐이다 — 이 프로젝트에서 `getSocialPostCardActionState`의
  "복사/export 준비" → "복사하기" 흐름이 곧 스펙이 말하는 "API
  미연결 플랫폼은 본문 복사로 안내"와 동일하다. 가짜 API 연동을
  새로 만들지 않았다.

## 이번에 실제로 한 것

유일하게 정리가 안 되어 있던 부분 — `/articles/[id]/blog`의
naver_blog/news_article/opinion_column 카드 — 에 `getSocialPostCardActionState`
를 재사용했다:

```tsx
{post.platform !== "wordpress_blog" &&
  (() => {
    const cardState = getSocialPostCardActionState(post);
    // primary action 1개 + secondary action들만 렌더링
    // (품질검사/승인/승인요청/수동export를 동시에 나열하지 않는다)
  })()}
```

- `social/page.tsx`(Phase 4-14)와 완전히 같은 `renderAction` switch를
  사용해 표시/동작 방식을 통일했다 — 같은 상태면 어느 페이지에서
  보든 같은 버튼 라벨이 보인다.
- `SocialPostBodyPanel`(Phase 4-18)이 이미 "본문 수정" 버튼을 자체
  제공하므로, secondary 목록에서 중복되는 `edit_body` action은
  제외한다(social/page.tsx와 동일 패턴).
- `getSocialPostCardActionState`의 action 종류에 없는 기존 기능
  "게시 체크리스트 준비"(`prepareManualPostingRecordAction`)는
  삭제하지 않고 보조 작업으로 그대로 남겼다.
- "승인 요청"(`requestSocialPostApprovalAction`) 버튼은 이 기본
  흐름에서 빠졌다 — `approveSocialPost()`가 애초에 `pending_review`
  상태를 요구하지 않아 승인 요청 없이 바로 승인할 수 있기
  때문이다(Phase 4-14가 social 카드에 이미 적용한 것과 동일한
  판단). 액션 자체는 삭제하지 않았고, wordpress_blog의 "고급 작업
  보기" 안에는 계속 남아 있다.

## 안전 원칙

- 자동 public publish는 어디에도 추가하지 않았다.
- WordPress는 여전히 Draft 생성/업데이트까지만 자동화한다(변경 없음).
- 승인 전에는 어떤 카드에서도 "복사/export 준비"/"복사하기" 이전
  단계(품질검사/승인)가 먼저 완료되어야 한다 — `getSocialPostCardActionState`
  자신의 우선순위 로직을 그대로 재사용했다(새 승인 우회 로직을
  만들지 않았다).
- 네이버 카페 등 실제 API 업로드는 이번에도 구현하지 않았다 —
  OAuth/토큰 저장 인프라가 없는 상태에서 실제 호출 코드를 만들면
  즉시 실패하거나 잘못된 신뢰를 준다고 판단해, 스펙 6번 문단이
  명시한 대로 "구현되지 않았다면 readiness UI와 수동 복사
  fallback부터"라는 원칙을 그대로 따랐다(이미 있는 fallback을
  재사용).

## 이번 작업에서 하지 않은 것 (범위)

- 네이버 카페 로그인/카페·게시판 선택 readiness UI(스펙 6번)는
  추가하지 않았다 — 저장할 상태(access token/clubid/menuid) 자체가
  스키마에 없어서, 새 UI만 만들면 실제로는 아무 것도 하지 못하는
  버튼이 된다. 이 인프라(OAuth 흐름, 토큰 저장, 카페/게시판 선택
  저장)를 먼저 설계하는 것이 별도 작업으로 필요하다.
- 확인 모달(스펙 5번, "WordPress Draft로 반영합니다" 등)은 추가하지
  않았다 — 기존 WordPress Draft 반영 버튼들은 이미 `disabled` +
  `title` 안내로 실행 전 상태를 알려주고 있고, confirm 모달을 추가로
  넣으려면 기존 폼 제출 방식(서버 action) 대신 클라이언트 확인
  단계를 얹어야 해 범위가 커진다. 다음 반복에서 검토한다.
- Job Progress 연동(스펙 9번)은 WordPress 게시 준비 자동 실행에는
  이미 Phase 4-17에서 연결되어 있다. 이번에 정리한 naver_blog 등의
  개별 action(품질검사/승인/export 준비)에는 아직 연결하지 않았다 —
  각 action 자체가 짧게 끝나는 단일 단계라 여러 단계로 나눌 실익이
  낮다고 판단했다.
- `publish_logs` 스키마 확장(스펙 7번)은 하지 않았다 — 지금 정리한
  범위(naver_blog 등의 카드 버튼 재배치)는 새로운 게시/업로드
  동작을 추가한 것이 아니라 기존 action의 버튼 배치만 바꾼 것이라
  새로 저장할 값이 없다.

## 테스트

- `app/articles/[id]/blog/page.test.ts`: 기존 3개 테스트를 새 구조에
  맞게 갱신(형식이 바뀐 guard 마커, "수동 export 만들기" → 새
  primary/secondary 구조로 라벨 변경 반영), 새 describe 1개(3개
  테스트: `getSocialPostCardActionState` 재사용 여부, edit_body 중복
  제거, 게시 체크리스트 준비 유지) 추가. 187 → 190개 테스트 통과.
- 전체 `npx vitest run`: 244 files / 3129 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류. `npm run build`: 성공.

## 관련 문서

- [`phase-4-13-wordpress-publish-prep-simplification.md`](./phase-4-13-wordpress-publish-prep-simplification.md) — WordPress "다음 작업" 1개 버튼 시스템의 원출처
- [`phase-4-14-social-post-list-inline-body.md`](./phase-4-14-social-post-list-inline-body.md) — `getSocialPostCardActionState`의 원출처
- [`phase-4-18-post-card-body-common-component.md`](./phase-4-18-post-card-body-common-component.md) — `SocialPostBodyPanel`을 blog 카드에 적용한 직전 작업
- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)
