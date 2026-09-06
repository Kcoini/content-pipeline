# Phase 1-22: 상단 내비게이션 단순화

## 문제

`/dashboard` 헤더에 버튼 8개(자동 테마 찾기 / 기사 목록 보기 / Social
Performance Dashboard / Content Dashboard / Blog Dashboard / Rewrite
Dashboard / Platform API Readiness / Automation Safety)가 한 줄에
나열되어 있었다 — 핵심 작업 버튼과 운영/대시보드 버튼이 같은 레벨로
보였고, 영문/한국어가 섞여 있었으며, "Automation Safety"처럼 위험/운영
성격의 버튼이 항상 강한 빨간색으로 노출돼 시선을 빼앗았다.

## 조치

`components/navigation/dashboard-top-nav.tsx`(신규, client component)를
만들고 `/dashboard` 헤더에서 기존 버튼 나열을 이 컴포넌트 하나로
대체했다.

### 항상 노출되는 버튼 (2~3개)
- **자동 테마 찾기**(`/trends`)
- **기사 목록**(`/articles`) — 모바일(`sm` 미만)에서는 숨기고 메뉴 안으로
  옮긴다.
- **대시보드 ▾**(모바일에서는 **메뉴 ▾**) — 드롭다운 트리거.

### 드롭다운 메뉴 구성 (`DASHBOARD_MENU_GROUPS`)
역할별로 나눈다:
- **콘텐츠 관리**: 콘텐츠 현황(`/dashboard/content`), 블로그
  현황(`/dashboard/blog`), 리라이트 관리(`/dashboard/rewrite`)
- **성과 분석**: 소셜 성과(`/dashboard/social-performance`)
- **운영 설정**: API 연동 준비(`/dashboard/platform-api`), 자동화
  안전(`/dashboard/automation-safety`)

### 버튼명 한국어 통일
| 이전(영문) | 이후(한국어) |
|---|---|
| Social Performance Dashboard | 소셜 성과 |
| Content Dashboard | 콘텐츠 현황 |
| Blog Dashboard | 블로그 현황 |
| Rewrite Dashboard | 리라이트 관리 |
| Platform API Readiness | API 연동 준비 |
| Automation Safety | 자동화 안전 |
| 기사 목록 보기 | 기사 목록 |

### 위험/운영 메뉴 분리
"자동화 안전"은 더 이상 상단에 상시 노출되는 빨간 버튼이 아니다 —
"운영 설정" 그룹 안에서만 `text-red-700`(옅은 강조, 배경색 없음)로
구분한다.

### active 상태
`DashboardTopNav`는 `active: DashboardTopNavActive` prop을 받아
현재 페이지에 해당하는 링크/메뉴 항목에 `aria-current="page"` +
`bg-zinc-100 font-semibold`(메뉴 항목) 또는 진한 배경(primary
버튼/트리거)을 적용한다. **현재는 `/dashboard` 페이지에서만 이
컴포넌트를 사용하며 `active={null}`을 넘긴다** — 다른 대시보드
하위 페이지(콘텐츠/블로그/리라이트/성과/API/자동화 안전)는 각자
기존의 개별 헤더/보조 nav를 그대로 유지하고 있어(이번 작업 범위 밖),
그 페이지들에서 `active`가 실제로 트렌드/기사/콘텐츠 등으로 설정되는
경우는 아직 없다. 향후 그 페이지들도 이 컴포넌트로 통일하면 active
상태가 전체 화면에서 일관되게 동작한다.

### 접근성 / 키보드
- 트리거 버튼에 `aria-haspopup="menu"`, `aria-expanded`,
  `aria-controls` 적용.
- 메뉴 항목에 `role="menu"`/`role="menuitem"`.
- `Escape` 키 또는 메뉴 바깥 클릭으로 닫힌다(순수 `useEffect` +
  `document` 이벤트 리스너, 새 UI 라이브러리 없음).
- 페이지 이동(pathname 변경) 시 메뉴가 자동으로 닫힌다.

## 지키지 않은 것 / 변경하지 않은 것

- 라우팅 대상은 전혀 바뀌지 않았다 — 버튼 위치만 옮겼다.
- 기존 페이지는 하나도 삭제하지 않았다.
- DB schema 변경 없음.

## 테스트

- `components/navigation/dashboard-top-nav.test.ts`: 메뉴 구성(모든
  기존 라우트 포함), 한국어 라벨, 역할별 그룹, 자동화 안전의
  danger 표시, 접근성 속성(aria-haspopup/expanded/controls),
  Escape/바깥 클릭 처리, active 강조 스타일, 새 UI 라이브러리 미사용
  검사.
- `app/dashboard/page.test.ts`: 헤더가 `DashboardTopNav`로 대체됐는지,
  예전 영문 버튼명이 페이지에 직접 나열되지 않는지, 라우팅 유지 여부.

`npm run lint`, `npx vitest run`(전체), `npx tsc --noEmit -p .`(baseline
37 유지), `npm run build` 모두 통과 확인.
