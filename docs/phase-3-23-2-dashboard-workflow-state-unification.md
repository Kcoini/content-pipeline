# Phase 3-23-2: 대시보드 상태 판단 통합 + 잔여 UI 결함 수정

## 배경

Phase 3-23 작업 직후 대시보드 UI를 엄격하게 재검토한 결과, 다음과 같은
실제 결함이 확인되었다.

1. `nextActionState`(3단계)와 `workflowState`(5단계)가 동시에 존재해 같은
   화면에서 서로 다른 기준의 안내를 낼 수 있었다.
2. 대시보드에서 플랫폼 글 생성을 실행해도 결과 확인은 `/articles/[id]`로
   이동해야 했다.
3. `workflowState`가 `needs_review`/`ready_for_publish_prep`로 진행되어도
   출처 추가/출처 목록/기사 초안 생성 섹션이 계속 크게 펼쳐져 있었다.
4. "관련 기사 URL 수집" CTA가 테마 요약 카드와 상태 카드에 중복 표시됐다.
5. 모바일에서 "왼쪽에서 테마를 먼저 생성하세요" 문구가 실제 레이아웃과
   맞지 않았다(모바일은 `flex-col-reverse`로 왼쪽 사이드바가 화면 맨
   아래로 감).
6. `article!` non-null assertion이 여러 곳에 있어 workflowState 우선순위
   로직이 바뀌면 런타임 크래시 위험이 있었다.
7. 상태별 색상 체계가 카드에 적용되지 않고 대부분 파란색으로 고정됐다.
8. 앵커 이동(`#generate-draft` 등) 시 focus 이동이 없어 접근성이 부족했다.
9. 기사 초안 섹션이 heading 없이 한 줄 텍스트로 축소돼 있었다.
10. `nextActionState`가 죽은 코드에 가까워 유지보수 부담이 있었다.

이 문서는 위 10개 항목을 어떻게 고쳤는지 기록한다.

## 1. 상태 체계를 workflowState 하나로 통합

`lib/dashboard/source-display.ts`의 `resolveNextActionState`/
`NextActionState`를 완전히 제거했다(다른 곳에서 쓰이지 않음을 grep으로
확인). `resolveDashboardWorkflowState`에 `hasTheme` 입력을 추가해 테마가
선택되지 않은 경우까지 포함한 6단계로 확장했다.

```ts
export type DashboardWorkflowState =
  | "needs_theme"
  | "needs_source"
  | "ready_to_generate"
  | "needs_platform_posts"
  | "needs_review"
  | "ready_for_publish_prep";
```

문구/색상/CTA 계산은 새 파일 `lib/dashboard/dashboard-workflow-presentation.ts`
의 순수 함수로 옮겼다 — `page.tsx`에는 상태별 문구를 하드코딩하지 않는다.

- `getDashboardStatusSummary(state, ctx)`: "현재 상태 / 다음 작업" 카드의
  headline/nextAction/primary·secondary action을 계산한다.
- `getWorkflowStateTone(state)`: 카드 색상(테두리/배경/텍스트/배지)을
  계산한다.
- `getDashboardSectionExpansion(state)`: 이전 단계 섹션의 기본 펼침
  여부를 계산한다.

이렇게 하면 상태 판단 기준이 이 세 함수(와 그 입력이 되는
`resolveDashboardWorkflowState`) 하나로 고정되어, 화면 두 곳이 서로 다른
결론을 내는 문제가 구조적으로 발생할 수 없다.

## 2. 완료된 단계 섹션은 접힘 처리

`getDashboardSectionExpansion`이 반환하는 `sourceAddExpanded`/
`sourceListExpanded`/`draftGenerationExpanded`/`platformGenerationExpanded`
를 각 섹션의 `<details open={...}>`에 그대로 연결했다. 폼/목록 자체는
삭제하지 않고 `<details>`로만 감쌌다("기존 기능은 삭제하지 않는다"
원칙). 예:

- `needs_source`: 출처 추가/목록 펼침, 기사 초안·플랫폼 생성 폼은 접힘.
- `ready_to_generate`: 기사 초안 생성 폼만 펼침.
- `needs_platform_posts`: 플랫폼별 글 생성 폼만 펼침.
- `needs_review`/`ready_for_publish_prep`: 위 폼들은 모두 접힘(단, "기사
  초안" 요약 카드와 "생성된 글 N개 · 검토 대기 · 승인 완료" 요약 줄은
  접히지 않고 항상 보인다 — 결과가 있다는 사실과 링크는 이전 단계라도
  필요하기 때문이다).

## 3. 대시보드에서 실행한 플랫폼 글 생성 결과를 대시보드 안에서 확인

`lib/navigation/return-to.ts`의 allowlist에 `/dashboard` 루트를
추가했다(하위 경로는 여전히 금지, query/hash만 허용):

```
/^\/(articles\/[^\/?#]+(\/(blog|social|rewrite|performance|ab-tests))?|dashboard)(\?[^\s]*)?(#[^\s]*)?$/
```

대시보드의 "플랫폼별 글 생성" 폼의 `returnTo`를
`buildArticleOverviewUrl(article.id)`에서
`` `/dashboard?themeId=${themeId}#platform-generation` ``로 바꿨다. 생성
완료 후 `publishMessage` query param을 대시보드가 직접 읽어
`TransientNotice`(토스트)와 "플랫폼별 글 생성" 섹션 안의 상시 노출
결과 박스(초록색, "생성된 글 보기" 링크 포함) 두 곳에 표시한다 —
토스트는 4초 뒤 사라지지만, 섹션 안 박스는 새로고침 전까지 남아 있다.

## 4. 중복 CTA 제거

"관련 기사 URL 수집" 링크를 테마 요약 카드 헤더에서 제거했다. 이제 이
링크는 `needs_source` 상태일 때 `getDashboardStatusSummary`가 반환하는
`secondaryActionHref`를 통해 "현재 상태 / 다음 작업" 카드에서만
렌더링된다 — 화면에 같은 의미의 버튼이 두 번 나타나지 않는다.

## 5. 모바일 문구 수정

"왼쪽에서 테마를 먼저 생성하세요"를 방향에 의존하지 않는 문구로
바꿨다: "아직 선택된 테마가 없습니다. 테마 목록에서 기존 테마를
선택하거나 새 테마를 추가하세요." + `#theme-list`로 스크롤하는 "테마
생성/선택하기" 버튼.

## 6. article! non-null assertion 제거

문구/href 계산을 `getDashboardStatusSummary`로 옮기면서
`articleId?: string`를 받아 `article ? .. : undefined` 형태로 안전하게
계산하도록 했다. `page.tsx`에는 더 이상 `article!`이 없다(테스트로
`/article!\./`, `/article!\[/` 패턴 부재를 검증). `article`이 필요한
JSX 블록은 모두 `{article && (...)}` 조건부 렌더링이다.

## 7. 상태별 색상 체계 적용

`getWorkflowStateTone`이 5색 체계(회색=시작 전, 파랑=진행중/다음 작업,
노랑=확인 필요, 초록=완료/가능, 빨강=차단/오류 — 이번에는 오류 상태가
없어 빨강 미사용)를 `DashboardWorkflowState` 각 값에 매핑한다.
`needs_source`/`needs_review`는 노랑, `ready_to_generate`/
`needs_platform_posts`는 파랑, `ready_for_publish_prep`는 초록,
`needs_theme`는 회색 — 이제 카드 색상이 상태에 따라 실제로 바뀐다(예전
처럼 파란색 고정이 아니다).

## 8. 앵커 이동 접근성 개선

`#generate-draft`, `#platform-generation`, `#theme-list` 대상
section에 `tabIndex={-1}`과 focus 시 outline을 보이는 Tailwind
클래스(`focus:outline focus:outline-2 focus:outline-offset-2
focus:outline-indigo-500`)를 추가했다. HTML 표준상 fragment
navigation은 target이 focusable하면(tabindex 보유) 브라우저가 자동으로
focus를 옮기므로, 별도의 client-side JS 없이 네이티브 `<a href="#...">`
만으로 키보드/스크린리더 사용자에게 이동이 인지된다. `#source-url-input`
은 원래 `<input>`이라 이미 focusable했다.

## 9. 기사 초안 섹션 heading 복구

"기사 초안" 섹션을 `<h2>` heading을 가진 독립 섹션으로 복구했다 —
제목/status 한 줄 + "원고 보기"/"재생성" 버튼. `article`이 있을 때만
렌더링되고, 다른 단계가 현재 단계여도 이 요약 카드 자체는 항상 보인다
(접히지 않는다 — 결과물이 있다는 사실과 이동 링크는 이전 단계라도
필요하기 때문). 본문 전체 미리보기는 여전히 "상세 관리"에 있다.

## 10. 관리 정보는 계속 "상세 관리" 접힘 영역에

Phase 3-23에서 이미 만든 "상세 관리"(계약 검사 결과 · 기사 본문
미리보기 · 파이프라인 로그) 구조는 그대로 유지했다.

## 영향받지 않는 것

- naver_cafe/naver_blog/wordpress_blog/x/threads/instagram의 생성·검토·
  승인·export 로직은 전혀 건드리지 않았다 — 대시보드는 여전히 기존
  action(`generateSelectedPlatformPostsAction` 등)을 재사용만 한다.
- WordPress는 이번에도 Draft 생성/업데이트까지만 다룬다. 자동 public
  publish 경로는 추가하지 않았다.
- "조용히 덮어쓰지 않는다" 원칙: 재생성 확인 배너(`showRegenerateConfirm`)
  로직은 그대로 유지했고, `<details>`로 감싸더라도 배너가 뜬 상태면
  강제로 펼쳐진다(`open={sectionExpansion.draftGenerationExpanded ||
  showRegenerateConfirm}`).

## 테스트

- `lib/dashboard/source-display.test.ts`: `resolveDashboardWorkflowState`에
  `hasTheme`/`needs_theme` 케이스 추가, `resolveNextActionState` 테스트
  제거(함수 자체가 삭제됨).
- `lib/dashboard/dashboard-workflow-presentation.test.ts`(신규): 톤 색상이
  상태별로 다른지, 문구/버튼이 정확한지, needs_review에 "기사 작성
  가능" 같은 이전 단계 문구가 섞이지 않는지, articleId 없이도 안전한
  fallback href를 주는지 검증.
- `lib/navigation/return-to.test.ts`: `/dashboard`(+query/hash) 허용,
  `/dashboard/xxx` 하위 경로 차단 케이스 추가.
- `app/dashboard/page.test.ts`: 상태 통합(하드코딩 문구 없음, helper
  사용 확인), 섹션 접힘, CTA 중복 제거, 모바일 문구, `article!` 부재,
  기사 초안 heading, 앵커 tabIndex, 대시보드 자기 자신으로의 returnTo,
  결과 메시지 표시 — 총 47개 테스트로 확장.
- 전체 `npx vitest run`: 208 files / 2582 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류.
- `npm run build`: 성공.

## 관련 문서

- [`phase-3-23-dashboard-workflow-ui.md`](./phase-3-23-dashboard-workflow-ui.md)
