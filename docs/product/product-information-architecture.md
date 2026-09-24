# Product Information Architecture Proposal (PRODUCT-01A/B/C/D/E 갱신)

- 작성일: 2026-09-23(PRODUCT-01A) / 2026-09-24(PRODUCT-01B/C/D/E)
- PRODUCT-01E: `/dashboard`의 "Content Creation Wizard" 필요 여부를
  재검토했고, 기존 Dashboard(workflowState 기반 guided step section)로
  충분하다고 결론지었다 — 별도 `/dashboard/create` route는 만들지
  않았다. 상세는 `docs/product/product-01e-content-creation-experience.md`
  참고.
- PRODUCT-01A는 조사/제안만 했다. **PRODUCT-01B에서 navigation 분리를
  실제로 구현했다** — route는 여전히 이동/rename하지 않았고(URL 그대로
  유지), `components/navigation/dashboard-top-nav.tsx`의 드롭다운
  안에서만 "관리자 / 고급" 그룹을 시각적으로 분리했다(구분선 + 안내
  문구 + 옅은 글자색). 상세는 `docs/product/product-01b-user-shell.md`
  참고.
- 근거: `docs/product/product-route-classification.md`(route 전수 조사).

## 현재 Navigation 구조(PRODUCT-01D 이후)

```
상단 고정: [자동 테마 찾기] [기사 목록] [메뉴 ▾]

메뉴 ▾ 드롭다운:
  콘텐츠 관리: 콘텐츠 현황 / 블로그 현황 / 리라이트 관리        ← audience: user
  성과 분석:   소셜 성과                                       ← audience: user
  설정:        설정(/dashboard/settings)                       ← audience: user
  ────────────────────────────────────────────────
  (안내: "아래는 콘텐츠 작업에는 필요 없는 운영자/관리자 전용 화면입니다")
  관리자 / 고급: API 연동 준비 상태 / 자동화 안전 점검(danger)  ← audience: admin
```

**PRODUCT-01A에서 지적했던 문제와 처리 상태**:
1. ~~"운영 설정" 그룹이 콘텐츠 관리 그룹과 같은 무게로 섞여 있다~~ →
   **해결(PRODUCT-01B)**: `DASHBOARD_MENU_GROUPS`에
   `audience: "user" | "admin"`을 추가하고, admin 그룹 앞에만 구분선 +
   안내 문구를 렌더링한다(정적 소스 검사 + Playwright로 회귀 방지).
2. ~~"대시보드"라는 트리거 라벨이 여전히 "콘텐츠 관리+성과+관리자"를
   모두 가리킨다~~ → **해결(PRODUCT-01C)**: 트리거 라벨을 모바일에서
   이미 쓰던 "메뉴"로 desktop도 통일했다 — "대시보드로 이동하는
   버튼"으로 오해할 여지를 없앴다. route는 전혀 바꾸지 않았다.
3. `/dashboard` 자체가 "홈"이자 "콘텐츠 만들기"이자 "진행 상황
   확인"을 동시에 수행 — **부분 해결(PRODUCT-01D)**: 테마가 하나도
   없는 첫 사용 상태에서는 환영 문구 + 5단계 안내 + 단일 CTA로
   "홈"을 대신하도록 했다(기존 `!selectedTheme` 빈 상태 분기를 그대로
   재사용, 새 라우트/마법사는 만들지 않음). 테마가 있는 기존 사용자
   경로는 전혀 바꾸지 않았다 — "콘텐츠 만들기"와 "진행 상황 확인"이
   한 페이지에 공존하는 구조 자체는 여전히 유지된다(섹션 15/19
   "Content Creation Wizard 만들지 않는다" 원칙).
4. "Settings 화면 부재" — **해결(PRODUCT-01D)**: `/dashboard/settings`
   신설. 실제로 저장 가능한 항목이 없어(Category C) 편집 가능한
   설정은 없고, 현재 서비스 준비 상태(`ContentServiceReadiness`)와
   게시 방식(Draft 전용) 확인만 제공한다. 상세는
   `docs/product/product-01d-first-use-settings.md` 참고.
5. Admin 성격 화면(`platform-api`, `automation-safety`)이 시스템
   상태/preflight/토큰 사용량 같은 **진짜 운영 지표는 아직 하나도
   포함하지 않는다** — 현재 `npm run ops:preflight`/
   `ops:report-usage`는 CLI 전용이라 Admin IA를 만들어도 채울 화면이
   부분적으로 비어 있다(신규 개발 필요, 이번 Phase 범위 아님).

## 제안 Navigation(목표 구조)

```
Internal User
├── 홈                    (신규 개념 — 현재 없음)
├── 콘텐츠 만들기          → /dashboard (테마→출처→원고→플랫폼 글 생성 유지)
│                           (미래: Step 마법사로 재구성, 섹션 7 참고)
├── 내 콘텐츠              → /articles (목록) + /dashboard/content (현황)
│                           + /dashboard/blog, /dashboard/social-performance(성과 하위 탭)
├── 게시 준비              → /articles/[id]/blog, /articles/[id]/social
│                           (article별로 흩어진 현재 구조를 "게시 준비 대기 목록"
│                            형태로 한 곳에 모으는 신규 요약 화면 필요 — 미구현)
└── 설정                  → /dashboard/settings(구현 완료, PRODUCT-01D — 섹션 10 참고)

Admin
├── 시스템 상태            → /dashboard/platform-api(이동) + preflight 신규 웹 UI
├── 작업 로그              → 신규(pipeline_logs 조회 웹 UI 없음, CLI만 존재)
├── AI 사용량              → 신규(ops:report-usage 웹 UI 없음, CLI만 존재)
├── 실패 작업              → job_run stalled 조회(부분적으로 job-progress 컴포넌트 존재,
│                            전용 목록 화면은 없음)
└── 고급 정보              → /dashboard/automation-safety(이동)
```

## Route → IA 매핑 표(현재 route는 그대로 유지)

| 제안 IA 위치 | 현재 route | 변경 필요 여부 |
|---|---|---|
| 콘텐츠 만들기 | `/dashboard` | 없음(그대로 사용, 라벨/진입 동선만 정리) |
| 콘텐츠 만들기 보조 | `/themes/[themeId]` | 없음(테마별 URL 수집 보조 화면으로 유지) |
| 내 콘텐츠 | `/articles` | 없음 |
| 내 콘텐츠 – 현황 | `/dashboard/content` | 없음 |
| 내 콘텐츠 – 성과 | `/dashboard/blog`, `/dashboard/social-performance`, `/articles/[id]/performance` | 없음(하위 탭 개념으로만 묶음) |
| 내 콘텐츠 – 고급 | `/dashboard/rewrite`, `/articles/[id]/rewrite`, `/articles/[id]/ab-tests` | 없음(1차 노출 우선순위만 낮춤) |
| 게시 준비 | `/articles/[id]/blog`, `/articles/[id]/social`, `/social-posts/[id]` | 없음(개별 article 진입은 유지, 대신 "게시 준비 대기 N건" 같은 진입 요약이 향후 필요 — 신규 화면, 이번 Phase 범위 아님) |
| 설정 | `/dashboard/settings` | 구현 완료(PRODUCT-01D, 신규 route) — 편집 가능한 설정은 없고 서비스 준비 상태/게시 방식 확인만 제공 |
| Admin – 시스템 상태 | `/dashboard/platform-api` | 메뉴 이동(코드 이동 아님, nav 트리 상의 위치만) |
| Admin – 고급 정보 | `/dashboard/automation-safety` | 메뉴 이동 |
| Admin – 작업 로그 / AI 사용량 / 시스템 점검(preflight) | (없음, CLI 전용) | 신규 개발 필요(PRODUCT-01B 이후 범위) |
| 주제 자동 추천(콘텐츠 만들기 보조 진입점) | `/trends` | 없음(향후 Step 마법사의 "주제 선택" 대안 경로로 매핑 검토) |

## Dashboard Conceptual Proposal(섹션 6)

현재 `/dashboard`는 "테마 목록 + 작업 폼"이 중심이다. 목표 개념(코드
변경 없이 개념만 제시):

```
안녕하세요.

확인할 콘텐츠 2개          ← 현재 workflowState 계산 로직 재사용 가능
  (승인 대기 / 확인 필요 fact-grounding 있는 글)

최근 콘텐츠                ← /dashboard/content의 breakdowns 재사용 가능

게시 준비 완료 콘텐츠       ← WordPress Draft 존재 + 승인 완료 post 필터링(신규 집계 필요)

[새 콘텐츠 만들기]          ← 현재 "테마 생성" 폼과 동일한 목적, 진입 위치만 상단으로
```

기술 KPI(request count, token, preflight 등)는 이 개념에 포함하지
않는다 — Admin IA로 전부 이동.

## Content Creation Entry Point 평가(섹션 7)

현재 진입점은 `/dashboard` 한 곳에 이미 모여 있다(테마 생성 → 출처
등록 → 마스터 원고 → 플랫폼 글 생성이 전부 같은 페이지의 순차 섹션).
**완전히 새로운 통합이 필요하지는 않다** — 다만 현재는 "한 페이지
안에서 스크롤/펼치기로 이동"하는 구조라, 신규 사용자에게는 진행
단계가 명확히 안 보일 수 있다(`ContentProgressSteps` 컴포넌트가 이미
상단에 단계 표시를 제공 중 — 재사용 가능).

**미래 Step 마법사 매핑**(구현 금지, 매핑만):

| Step | 현재 대응 기능 |
|---|---|
| Step 1. 주제 | `createTheme` 폼(`/dashboard`) + `/trends`(자동 추천) |
| Step 2. 참고자료 | `addSource` 폼(`/dashboard`) + `/themes/[themeId]`(URL 후보 일괄 수집) |
| Step 3. 사용할 플랫폼 | 플랫폼 카드 선택(`/dashboard`의 "플랫폼별 글 생성" 섹션) — 현재는 원고 생성 이후 단계지만, 마법사에서는 더 앞으로 당길 수 있는지 검토 필요 |
| Step 4. 콘텐츠 생성 | `generateArticleDraft` + `generateSelectedPlatformPostsAction` |

`ContentProgressSteps`(`components/articles/content-progress-steps.tsx`)를
그대로 마법사 단계 표시에 재사용할 수 있는지가 PRODUCT-01B의 첫
확인 항목이 되어야 한다.

## 보호 원칙 재확인(섹션 17)

이 IA 제안은 어떤 라우트도 삭제하지 않고, 승인/게시 가드의 동작도
바꾸지 않는다 — 단지 **어떤 메뉴 트리에서 어떤 사용자가 먼저
보는가**만 다룬다. "게시 준비" 항목은 WordPress Draft/copy/manual의
차이를 여전히 명시해야 하며(`docs/product/product-language-dictionary.md`
"안전 관련 문구" 절 참고), IA 재구성이 이 차이를 흐리게 만들면 안
된다.
