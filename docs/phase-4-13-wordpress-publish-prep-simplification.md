# Phase 4-13: WordPress 게시 준비 화면 단순화

## 문제

wordpress_blog 카드 기본 화면에 버튼이 너무 많이 동시에 노출되어
"지금 뭘 눌러야 하는지"가 불명확했다:

- 상단: 품질검사 / 승인 요청 / 승인 / 수동 게시용 Draft 내보내기 /
  게시 체크리스트 준비 — 5개 버튼이 항상 나열됨.
- 중간: "WordPress에 반영하기"(primary)와 "승인하고 WordPress Draft
  만들기"(조건부 primary)가 의미가 겹치는 채로 둘 다 있었음.
- approval_status가 이미 `approved`인데도 "승인" 버튼이 계속
  보였다.
- `publish_guard_status`가 `blocked`인데도 "WordPress에 반영하기"
  버튼이 활성화된 채로 크게 보였다 — 눌러도 되는지 헷갈렸다.
- 실제 차단 이유(대표 이미지 없음/체크리스트 미준비)가 화면 어디에도
  먼저 보이지 않았다.

## 해결: "현재 상태 + 완료된 작업 + 남은 작업 + 다음 버튼 1개"

### 1) 새 상태 계산 helper

`lib/social/wordpress-blog-publish-prep-state.ts`(신규)의
`getWordPressPublishPrepState(input)`이 순수 함수로 다음을 계산한다:

```ts
{
  statusLabel: "대표 이미지와 체크리스트 확인 필요",
  canReflectToWordPress: false,
  completedItems: ["품질검사 완료", "승인 완료", "WordPress Draft 생성됨", "SEO 정보 준비됨"],
  remainingItems: ["대표 이미지 없음", "게시 체크리스트 미준비"],
  blockingReasons: ["대표 이미지가 없습니다.", "게시 체크리스트가 아직 준비되지 않았습니다."],
  primaryAction: { label: "대표 이미지 설정하기", actionType: "set_featured_image" },
  secondaryActions: [
    { label: "이미지 없이 진행", actionType: "waive_featured_image" },
    { label: "게시 체크리스트 만들기", actionType: "prepare_checklist" },
    { label: "WordPress Draft 보기", actionType: "view_draft", href: "..." },
  ],
}
```

우선순위(먼저 만족하지 못한 조건 하나만 primary로 선택한다):
본문 없음 → 품질검사 필요 → 품질 문제 확인 → 승인 필요 → 대표 이미지
필요 → 체크리스트 필요 → Draft 생성 필요 → SEO 반영 필요 → (모두
충족) Draft 최종 반영/보기.

`canReflectToWordPress`는 `quality_status===ready &&
approval_status===approved && publish_guard_status`가 `blocked`/
`failed`가 아닐 때만 `true`다. 대표 이미지/체크리스트는 이 필드에
직접 관여하지 않는다 — 실제 Draft 반영(`prepareWordPressBlogPostForPublishingAction`,
Phase 4-10)은 그 항목들이 없어도 부분 성공으로 계속 진행하기
때문이다. 대신 `remainingItems`/`blockingReasons`로 사용자에게
먼저 보여주고, 화면에서는 원본 article 승인 여부
(`isArticleApprovedForWordPress = article.status === "reviewed"`)까지
추가로 확인한 `canReflectNow`로 실제 버튼을 활성화/비활성화한다.

기존 `lib/social/wordpress-blog-workflow-steps.ts`
(`getWordPressBlogNextRecommendedAction`)는 삭제하지 않았다 — 이
페이지의 "단계별 상태 자세히 보기" 접힘 영역에 참고용으로 계속
쓰인다.

### 2) 상단 버튼 정리

`app/articles/[id]/blog/page.tsx`에서 품질검사/승인 요청/승인/수동
내보내기/체크리스트 준비 5개 버튼을 `post.platform !== "wordpress_blog"`
조건으로 감쌌다 — wordpress_blog에서는 기본 화면에 나열하지 않고,
아래 "WordPress 게시 준비" 카드의 "고급 작업 보기" 접힘 영역
안으로 그대로(기능 삭제 없이) 옮겼다. naver_blog 등 다른 플랫폼은
대응하는 요약 카드가 없으므로 기존 그대로 노출한다.

### 3) 통합 "WordPress 게시 준비" 카드

예전에 각각 있던 "단계별 상태 요약" 배지 나열, "다음 추천 작업"
박스, "WordPress에 반영하기"/"승인하고 WordPress Draft
만들기" 두 버튼을 하나의 카드로 합쳤다:

- 현재 상태 한 줄 요약
- 완료됨 목록(있을 때만)
- 남은 작업 목록(있을 때만)
- 원본 article 미승인 안내(해당할 때만)
- primary action 버튼 1개
- secondary action 버튼 0~3개
- 짧은 안내 문구("Draft까지만 반영, 공개 게시 안 함")
- "단계별 상태 자세히 보기" 접힘(기존 배지 그리드 + 참고용 다음 추천 작업)
- "고급 작업 보기" 접힘(기존 5개 버튼 + 부분 성공 설명)

primaryAction/secondaryAction의 `actionType`은
`renderPrepActionButton()`(page.tsx 내부 헬퍼)이 실제 UI로 변환한다:
필요한 입력값이 없는 action(대표 이미지 설정/waive, SEO 반영,
품질 이슈 확인, 글 생성)은 해당 정보가 있는 탭으로 이동하는 링크로,
입력값이 필요 없는 action(품질검사 실행/승인/체크리스트 만들기/
Draft 생성·업데이트)은 기존 서버 action을 그대로 재사용하는 실제
form 버튼으로 렌더링한다. 승인 primary action은 Phase 4-10에서
만든 `approveAndPrepareWordPressBlogPostForPublishingAction`(승인+
게시 준비 통합)을 그대로 재사용해, 예전에 별도 버튼이던 "승인하고
WordPress Draft 만들기"와 같은 클릭 한 번으로 승인+반영을 끝낸다.

### 4) 완료된 작업은 버튼이 아니라 배지로

- `approval_status === "approved"`면 승인 primary action 자체가
  나타나지 않는다(다음 우선순위 조건으로 넘어간다) — "승인" 버튼이
  사라지고 completedItems에 "승인 완료"만 남는다.
- 마찬가지로 quality/Draft/SEO/이미지/체크리스트가 이미 완료되어
  있으면 그 항목은 primary 후보에서 제외되고 completedItems 배지로만
  표시된다.
- 재실행이 필요한 경우(품질검사 다시 실행, 승인 요청, SEO 다시 반영
  등)는 "고급 작업 보기" 안에서 계속 제공한다(기능 삭제 없음).

## 안전 원칙

- 자동 public publish는 추가하지 않았다.
- WordPress에는 여전히 Draft 생성/업데이트까지만 반영한다.
- `canReflectNow`(=`canReflectToWordPress && isArticleApprovedForWordPress`)가
  false면 Draft 생성/업데이트 primary 버튼이 비활성화된다.
- 민감정보(Application Password, Authorization header, API key)는
  이번에도 어디에도 노출하지 않는다 — 기존 원칙 그대로.

## 테스트

- `lib/social/wordpress-blog-publish-prep-state.test.ts`(신규): 우선순위
  규칙 11개 케이스, canReflectToWordPress의 guard blocked/failed 처리,
  본문의 "현재 예시 상태"(품질/승인 완료, Draft/SEO 있음, 이미지 없음,
  체크리스트 미준비, guard blocked) 시나리오 전체 검증. 19개 테스트
  통과.
- `app/articles/[id]/blog/page.test.ts`: 새 카드 구조, 상단 버튼
  숨김/고급 영역 재배치, primary/secondary 렌더링, canReflectNow
  disabled 조건, raw status 미노출을 검사하는 새 describe 블록
  추가(7개 신규 테스트), 기존에 사라진 문구/구조를 참조하던 실패
  테스트 7개를 새 구조에 맞게 갱신. 169개 테스트 통과.
- 전체 `npx vitest run`: 232 files / 2972 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류(초기 미사용 변수 경고 1건 수정 완료).
- `npm run build`: 성공.

## 관련 문서

- [`wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md)
- [`phase-4-10-wordpress-auto-publishing-preparation.md`](./phase-4-10-wordpress-auto-publishing-preparation.md) — canReflectToWordPress가 재사용하는 부분 성공/승인 통합 로직의 출처
- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)
- [`phase-3-operation-manual.md`](./phase-3-operation-manual.md)
- [`ui-review-agent-checklist.md`](./ui-review-agent-checklist.md)
