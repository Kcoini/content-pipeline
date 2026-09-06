# Phase 1-23: 대시보드를 "선택한 테마 중심 작업형 대시보드"로 개편

## 문제

`/dashboard`에서:
- 왼쪽 "새 테마 입력" 폼이 항상 펼쳐져 있어 사이드바가 복잡했다.
- 테마 목록에 검색이 없어 테마가 많아지면 원하는 항목을 찾기 어려웠다.
- 오른쪽에 선택된 테마 정보/출처 등록 폼/출처 목록이 한꺼번에 노출되어
  정보 밀도가 높았다.
- 출처 등록 폼이 항상 크게 펼쳐져 있어 출처 목록/다음 작업이 아래로
  밀렸다.
- 출처 카드에 긴 URL 전체가 그대로 노출됐다.
- 사용자가 다음에 뭘 해야 하는지 알려주는 화면 요소가 없었다.

## 조치 (`app/dashboard/page.tsx` 중심, UI만 변경 — 데이터 구조/DB
schema/테마 생성·출처 추가·기사 생성 action은 전혀 바꾸지 않았다)

### 1) 오른쪽 메인 영역 순서 재정렬

1. 선택된 테마 요약 카드
2. 다음 작업 카드(신규)
3. 출처 상태 요약(신규)
4. 출처 추가(compact, 기본 접힘)
5. 출처 목록(compact 카드)
6. (기존 그대로) 계약 검사 & 기사 초안 생성 → 기사 초안 → 파이프라인 로그

### 2) 왼쪽 사이드바

- **새 테마 입력**은 `<details>`(네이티브 HTML, JS 불필요)로 감싸 기본
  접힘 상태로 바꿨다. 트리거는 "+ 새 테마"(닫힘) ↔ "새 테마 입력
  접기"(열림) — Tailwind의 `group-open:` variant로 텍스트만 전환한다.
- **테마 검색**: `components/dashboard/theme-search-list.tsx`(신규
  client component)를 추가해 제목 기준 실시간 필터링을 제공한다(순수
  함수 `lib/dashboard/theme-search.ts`의 `filterThemesByQuery()`를
  재사용, 서버 왕복 없음).
- **선택된 테마 강조**: 선택된 항목에 `border-l-4 border-zinc-900` +
  진한 배경 + `aria-current="page"`를 적용해 명확히 표시한다.
- **삭제 버튼**은 계속 작고 옅은 색(`text-[10px] text-zinc-400`)으로
  우측 보조 영역에 둔다(기존과 동일, 강하게 보이지 않게).
- **보관/삭제된 테마 제외, 중복 테마 미표시**: `getThemes()`가 기본으로
  `archived_at is null`만 조회하므로 이미 만족한다. `themes` 테이블
  자체는 사용자가 최종 확정해 저장한 개별 테마라 "병합된 테마" 개념이
  없다(병합/중복 제거는 그 이전 단계인 `/trends`의 공통 테마 후보
  — `theme_clusters` — 에서 이미 처리된다, `docs/phase-1-16-theme-candidate-deduplication.md`
  참고) — 그래서 이 화면에서 추가로 할 일이 없었다.

### 3) 선택된 테마 요약 카드

테마명/설명/키워드 badge/언어 badge는 그대로 두고, 아래에 한 줄 요약을
추가했다: `출처 {n}개 등록됨 · 조건 충족|출처 부족 · 기사 작성
가능|불가`. 버튼은 "관련 기사 URL 수집"(secondary)만 남겼다 — "테마
수정"은 추가하지 않았다(이 코드베이스에 테마 수정 action/페이지 자체가
존재하지 않아, 없는 기능을 가리키는 버튼을 만들지 않았다).

### 4) 다음 작업 카드 (신규)

`lib/dashboard/source-display.ts`의 `resolveNextActionState()`가 세
상태 중 하나를 반환한다:

| 상태 | 문구 | 버튼 |
|---|---|---|
| `needs_source` | "기사 작성을 위해 출처가 N개 더 필요합니다." | 출처 추가, 관련 기사 URL 수집 |
| `ready_to_generate` | "출처 조건이 충족되어 기사 초안을 생성할 수 있습니다." | 기사 초안 생성 |
| `article_exists` | "이 테마로 생성된 기사가 있습니다." | 기사 보기, 새 기사 생성 |

**이 화면의 유일한 primary button(진한 배경)은 이 카드 안에 있다** —
"선택된 테마 요약 카드"와 "계약 검사 & 기사 초안 생성" 섹션의 버튼은
모두 secondary(테두리만 있는) 스타일로 낮췄다(primary는 화면당 1개).

"출처 추가" 버튼은 `href="#source-url-input"`으로, 출처 등록
`<details>` **안**에 있는 URL 입력 필드의 id를 직접 가리킨다 — 최신
브라우저는 닫힌 `<details>` 안에 있는 요소로 앵커 이동하면 그
`<details>`를 자동으로 펼친다(JS 없이 "이동 + 자동으로 폼 열기"가
된다). "기사 초안 생성"/"새 기사 생성" 버튼은 `href="#generate-draft"`로
기존 모드 선택 폼(collapsed 되어 있지 않음)까지 스크롤한다.

### 5) 출처 상태 요약 (신규)

출처 등록 영역 위에 `summarizeSourceStatus()`(`lib/dashboard/source-display.ts`)
결과를 요약 문장 + 배지(조건 충족/출처 부족, 본문 수집 완료 N, 요약
완료 N, 실패 N)로 보여준다.

### 6) 출처 등록 폼 compact화

전체 폼을 `<details>`로 감싸 기본 접힘("+ 출처 추가")으로 바꿨다.
URL 입력만 상위에 두고, 제목/출판사/발행일/요약은 중첩된
`<details>`("추가 정보 입력 (선택)") 안에 넣었다 — URL만 입력해도
서버(`addSource` 액션)가 그대로 본문을 수집하고 자동 요약을
생성하는 기존 흐름은 전혀 바뀌지 않았다(compact화는 표시만 바꿨다).
`sourceError`가 있으면 `<details open>`으로 자동 펼쳐 오류를 바로
보여준다.

### 7) 출처 목록 카드 개선

- URL 전체 대신 `extractDomain()`(`lib/dashboard/source-display.ts`)으로
  도메인만 표시한다.
- 요약은 `line-clamp-2`로 제한하고, "요약 전체 보기" `<details>`로
  전체 텍스트를 볼 수 있다.
- 본문(raw content)은 기본 숨김이고 "본문 보기" `<details>`(`<pre>` +
  `max-h-64 overflow-auto`)로 확인한다.
- "원문 열기"는 `target="_blank"` 링크로 대체한다.
- **"삭제" 버튼은 추가하지 않았다.** `sources` 테이블에는
  soft-delete용 `archived_at` 컬럼이 없고, 이번 작업의 원칙("DB
  schema 변경 금지")과 이 프로젝트 전반의 "hard delete 금지, soft
  delete 우선" 원칙이 충돌한다 — 스키마를 바꾸지 않고는 안전하게
  구현할 방법이 없어 의도적으로 보류했다. 출처 삭제가 필요하면 별도
  작업으로 `sources.archived_at` 마이그레이션을 먼저 논의해야 한다.

### 8) 상태 배지 문구

`FetchStatusBadge`/`SummaryStatusBadge`(기존 컴포넌트, 변경 없음)가
이미 raw 상태값을 사용자 친화적 문구로 변환하고 있었다(`pending`→
"수집 대기"/"요약 대기", `success`→"본문 수집 완료"/"요약 완료",
`failed`→"수집 실패"/"요약 실패", `skipped`→"요약 건너뜀") — 그대로
재사용했다.

### 9) 한국어 줄바꿈

테마 제목/설명, 출처 제목에 `break-keep`을 적용했다(Tailwind 4 내장
유틸리티, 이 세션에서 `/trends` 화면에 이미 여러 번 적용한 것과 동일한
패턴).

## 모바일 대응

본문 grid를 `flex flex-col-reverse gap-6 lg:grid lg:grid-cols-[280px_1fr]`로
바꿨다 — `lg` 미만에서는 `flex-col-reverse`가 DOM 순서(사이드바 →
메인)를 시각적으로 뒤집어 **메인(선택된 테마 작업 영역)이 먼저, 테마
목록 사이드바가 마지막**에 오게 한다. `lg` 이상에서는 `grid`로
전환되어 원래 2열 레이아웃(왼쪽 사이드바 280px + 오른쪽 메인)을
유지한다.

## 테스트

- `lib/dashboard/source-display.test.ts`: `extractDomain`,
  `summarizeSourceStatus`, `resolveNextActionState` 단위 테스트.
- `lib/dashboard/theme-search.test.ts`: `filterThemesByQuery` 단위
  테스트(대소문자 무시, 중첩 항목 accessor 재사용 포함).
- `components/dashboard/theme-search-list.test.ts`: 검색 접근성,
  archiveAction 재사용, 삭제 버튼 스타일 정적 검사.
- `app/dashboard/page.test.ts`: 새 테마 입력 폼 기본 접힘, 테마 검색
  분리, 선택된 테마 강조, 선택된 테마 요약 카드 내용, 다음 작업 카드
  상태별 문구/버튼, 출처 상태 요약 위치, 출처 등록 폼 compact
  구조(중첩 접기), 도메인 표시(URL 전체 미노출), line-clamp-2 +
  전체보기/본문보기 분리, 원문 열기 새 탭, 삭제 미구현 사유 문서화,
  기존 서버 액션 유지, 모바일 순서(`flex-col-reverse`), `break-keep`
  적용 여부 검사.

`npm run lint`, `npx vitest run`(전체), `npx tsc --noEmit -p .`(baseline
37 유지), `npm run build` 모두 통과 확인.
