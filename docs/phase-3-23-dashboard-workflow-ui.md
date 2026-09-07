# Phase 3-23: 대시보드를 "작업 흐름 중심 화면"으로 재구성

## 배경

Phase 3-21/3-22에서 `/articles/[id]` 계열 페이지는 "테마 → 출처 →
플랫폼별 글 생성 → 검토 → 승인" 흐름과 행동 중심 UI(진행 단계 표시,
현재 상태/다음 작업 카드, 관리 정보 접힘)를 갖췄다. 그런데 `/dashboard`는
여전히 "출처 → 기사 초안"까지만 다루고, 그 이후(플랫폼별 글 생성/검토/
승인)는 전부 `/articles/[id]`로 링크만 걸려 있었다 — 대시보드를 열어도
"지금 눌러야 할 다음 버튼"이 기사 초안 생성 이후로는 보이지 않았다.

이 단계는 그 간극을 메운다: 대시보드 자체에 플랫폼별 글 생성 상태를
반영하고, "현재 상태/다음 작업" 카드를 기사 초안 이후 단계까지 확장하며,
플랫폼별 글 생성 섹션을 대시보드의 핵심 영역으로 새로 추가한다.

## 변경 요약

### 1. `resolveDashboardWorkflowState()` 추가 (`lib/dashboard/source-display.ts`)

기존 `resolveNextActionState()`(출처→기사초안까지 3단계:
`needs_source`/`ready_to_generate`/`article_exists`)는 그대로 두고,
나란히 5단계짜리 `DashboardWorkflowState`를 추가했다.

```
needs_source           출처 부족
ready_to_generate       출처 충분, 기사초안 미생성
needs_platform_posts   기사초안 있음, 플랫폼별 글 없음
needs_review           플랫폼별 글 있음, 승인된 것 없음
ready_for_publish_prep 승인된 플랫폼별 글 있음
```

기사초안 이후 상태를 판단하기 위해 대시보드는 선택된 테마의 article이
있으면 `listSocialPostsByArticle(article.id)`를 조회해 전체 개수와
`approvalStatus === "approved"` 개수를 계산한다.

### 2. "현재 상태 / 다음 작업" 카드 확장 (`app/dashboard/page.tsx`)

카드 제목을 "다음 작업" → "현재 상태 / 다음 작업"으로 바꾸고, 위 5개
상태 각각에 대해 "현재 상태: …" / "다음 작업: …" 두 줄 + 버튼 1개(주요)
+ 필요 시 보조 링크 1개를 표시한다. 문구는 명시적으로 요청받은 예시를
그대로 사용했다(예: "현재 상태: 아직 출처가 없습니다." / "다음 작업:
기사 작성에 사용할 출처를 추가하세요." / [출처 추가하기]).

### 3. "플랫폼별 글 생성" 섹션을 대시보드에 신규 추가

`#platform-generation` 섹션을 대시보드 우측 작업 영역에 새로 추가했다.
article이 없으면 안내 문구만 보여주고, article이 있으면
`app/articles/[id]/page.tsx`의 동일 섹션과 **같은 컴포넌트/서버
액션**(`PlatformSelectionCheckboxes`, `generateSelectedPlatformPostsAction`,
`generateAllPlatformPostsAction`, `ConfirmSubmitButton`)을 그대로
재사용한다 — 로직을 복제하지 않았다. 폼은 `returnTo`를
`buildArticleOverviewUrl(article.id)`로 넘기므로, 생성 후에는 결과를
바로 확인할 수 있는 기사 개요 페이지로 이동한다(대시보드 자체로
돌아오는 `returnTo`는 `lib/navigation/return-to.ts`의 허용 패턴이
`/articles/[id]*`로 제한돼 있어 지원하지 않는다 — 이 검증기를
넓히는 것은 이번 작업 범위 밖이라 손대지 않았다).

개별/선택/전체 생성 구분은 Phase 3-21과 동일하다: 체크박스로 선택한
플랫폼만 생성하는 게 기본 버튼이고, 전체 생성은 `<details>`로 접어둔
고급 옵션 + 비용 경고 확인 모달(`ConfirmSubmitButton`)을 거친다.
기본 추천 플랫폼(WordPress 블로그/네이버 블로그/네이버 카페)과 기본
제외(X/Threads/Instagram)도 동일하다.

문체는 이번에도 대시보드 기본 화면에서는 "추천 문체 자동 적용"
고정값만 쓰고, 플랫폼별/전체 수동 선택 UI는 노출하지 않는다(과도한
노출 방지 원칙) — 세밀한 문체 조정이 필요하면 기사 상세 페이지의
동일 섹션(고급 옵션)을 이용하도록 안내 문구를 추가했다.

### 4. 정보 우선순위 재배치 (4순위 → "상세 관리" 접힘 영역)

기존에 상시 노출되던 계약 검사 결과(source/article contract) 전체와
기사 본문 미리보기, 파이프라인 로그를 화면 하단의 `<details>` "상세
관리" 영역 하나로 모았다. 기사 초안 섹션에는 제목/status/링크 한 줄만
남기고, 계약 검사 결과 카드는 삭제하지 않고 그대로 상세 관리 안으로
옮겼다(값/로직 변경 없음).

플랫폼별 글 생성 섹션에는 "생성된 글 N개 · 검토 대기 N개 · 승인 완료
N개" 요약 한 줄만 1차 정보로 남기고, 개별 글의 상세 상태(quality_status,
export_status 등)는 여전히 `/articles/[id]/social`, `/social-posts/[id]`
쪽 화면(Phase 3-19~3-22에서 이미 정리됨)에서 확인한다 — 대시보드에
중복 구현하지 않았다.

### 5. 진행 단계 표시(`ContentProgressSteps`) 갱신

기존에는 `needs_source`/그 외 2단계만 구분했는데, 이번에 `workflowState`
전체를 반영해 `review`/`publish_ready` 단계까지 표시하도록 넓혔다
(컴포넌트 자체는 Phase 3-22에서 만든 것을 그대로 재사용).

## 반영하지 않은 항목(의도적 범위 제외)

- **내부 상태값→사용자 언어 매핑 테이블**: 요청받은 16행 매핑은 대부분
  이미 존재하는 라벨(`PLATFORM_LABELS`, `getUserFacingStatus`, 기사
  모드 라벨 등)로 충족되고 있어 별도의 새 상수 테이블을 만들지 않았다.
  대시보드/기사 페이지 어디에도 `quality_status`, `approval_status`
  같은 원시 값을 그대로 노출하는 곳이 남아있지 않음을 확인했다(상세
  관리 영역의 `status: {article.status}`만 예외 — article.status는
  draft/reviewed/published 3값뿐이라 원래도 사용자에게 노출 가능한
  수준으로 판단해 유지했다).
- **5색 색상 체계 전면 재도색**: 대시보드에서 사용 중인 Tailwind 색상
  (green/blue/amber/red/zinc)이 이미 요청받은 5색 매핑(초록=완료,
  파랑=진행중/다음 작업, 노랑=확인 필요, 빨강=오류, 회색=시작 전)과
  거의 일치해 전면 재도색은 하지 않았다. 다만 "다음 작업" 카드는 원래
  파란색 하나만 썼는데 이는 매핑과 일치한다(현재 진행/다음 작업 = 파랑).
- 대시보드에서 `returnTo`가 대시보드 자기 자신으로 돌아오도록
  `lib/navigation/return-to.ts`의 허용 패턴을 넓히는 것 — 보안
  관련 allowlist라 이번 UI 작업 범위에서 변경하지 않았다.

## 영향받지 않는 것

- naver_cafe 본문 정리(Phase 3-20), wordpress_blog HTML 변환(Phase
  2-21/2-24) 로직은 전혀 건드리지 않았다 — 대시보드는 이 로직들을
  호출하는 액션을 재사용할 뿐이다.
- 자동 public publish 경로는 이번에도 추가/변경하지 않았다. 대시보드에
  새로 추가한 액션(`generateSelectedPlatformPostsAction`/
  `generateAllPlatformPostsAction`)은 모두 draft 생성용이며 WordPress
  공개 게시나 SNS 실제 게시 API를 호출하지 않는다.

## 테스트

- `lib/dashboard/source-display.test.ts`: `resolveDashboardWorkflowState`
  5개 상태 전이 케이스 추가.
- `app/dashboard/page.test.ts`: 현재 상태/다음 작업 카드의 5개 상태별
  문구·버튼, 플랫폼별 글 생성 섹션 존재, 상세 관리 접힘 영역 위치
  검증 테스트 추가/수정.
- 전체 `npx vitest run`: 207 files / 2562 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재,
  증가 없음.
- `npm run lint`: 0 오류.
- `npm run build`: 성공.

## 관련 문서

- [`phase-3-1-multi-platform-writing-foundation.md`](./phase-3-1-multi-platform-writing-foundation.md)
- [`phase-3-21-platform-generation-flow.md`](./phase-3-21-platform-generation-flow.md)
- [`phase-3-22-user-facing-status-simplification.md`](./phase-3-22-user-facing-status-simplification.md)
- [`phase-3-23-2-dashboard-workflow-state-unification.md`](./phase-3-23-2-dashboard-workflow-state-unification.md)
- [`phase-3-23-4-dashboard-current-step-spotlight.md`](./phase-3-23-4-dashboard-current-step-spotlight.md)
