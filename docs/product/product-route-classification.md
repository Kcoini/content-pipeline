# Product Route Classification (PRODUCT-01A, PRODUCT-01B 갱신)

- 작성일: 2026-09-23(PRODUCT-01A) / 2026-09-24(PRODUCT-01B)
- 조사 대상: `find app -name "page.tsx"` 결과 18개 route 전수.
- 분류 기준(섹션 3): KEEP / SIMPLIFY / ADMIN_ONLY / MIXED(한 화면
  안에 여러 성격이 섞여 있음).
- **PRODUCT-01B 갱신**: `/dashboard/platform-api`, `/dashboard/automation-safety`
  는 route/코드를 삭제하거나 이동하지 않고, `components/navigation/dashboard-top-nav.tsx`
  의 드롭다운 메뉴 안에서 "관리자 / 고급" 그룹으로 시각적으로
  분리했다(구분선 + 안내 문구 + 옅은 글자색). 두 route 모두 여전히
  URL로 직접 접근 가능하다(auth/RBAC 없음, 이번 Phase 범위 밖).

| Route | 현재 목적 | 주 사용자 | 분류 | 노출된 기술 용어(발견) | Primary action | 향후 처리 제안 | 구현 위험도 |
|---|---|---|---|---|---|---|---|
| `/` | `/dashboard`로 redirect | - | - | 없음 | - | 그대로 유지 | 낮음 |
| `/dashboard` | 테마 생성→출처→마스터 원고→플랫폼 글 생성 전체 진입점 | INTERNAL_USER | MIXED | 없음(자체는 잘 정리됨), 단 하위 메뉴로 ADMIN_ONLY 라우트 다수 연결 | "테마 생성"/"마스터 원고 만들기"/"글 생성하기"(단계별로 바뀜, `workflowState` 기반) | Home + Create Content 진입점으로 유지, 단 상단 드롭다운에서 admin 성격 메뉴(운영 설정 그룹) 분리 | 낮음(이미 단계별 primary action 구조 있음) |
| `/dashboard/content` | 전체 기사/플랫폼 글 진행 현황 KPI 테이블 | INTERNAL_USER(참고용) | KEEP(용어는 이미 한국어) | 없음 | 없음(읽기 전용) | "내 콘텐츠" 후보 화면으로 재활용 가능 | 낮음 |
| `/dashboard/blog` | 블로그 글 성과/필터 대시보드 | INTERNAL_USER | KEEP(PRODUCT-01B 재확인: 필터 옵션은 이미 `describeStatusValue()`로 한국어 라벨 렌더링, `value` 속성만 raw — 정상) | 없음(재확인 완료) | 없음(필터+목록) | "내 콘텐츠"/성과 하위로 편입 | 낮음 |
| `/dashboard/rewrite` | 리라이트(재작성) 후보/성과 대시보드 | INTERNAL_USER(고급) | KEEP(PRODUCT-01B 재확인: 위와 동일, 이미 정상) | 없음(재확인 완료) | 없음(필터+목록) | 고급 기능으로 유지 | 낮음 |
| `/dashboard/social-performance` | 소셜 성과 종합 대시보드 | INTERNAL_USER(참고용) | KEEP(1차 확인 기준, 세부는 재조사 필요) | 미확인(이번 Phase에서 라인 단위 미검토) | 없음 | "내 콘텐츠 > 성과" 하위로 편입 | 낮음 |
| `/dashboard/platform-api` | 플랫폼별 API 게시 준비 상태(feature flag/env 설정 누락 등) | **ADMIN 전용이어야 함** | ADMIN_ONLY | `capability.publishEnabledFlagName`(env flag 이름 그대로, monospace 노출), `currentMode` raw enum, "설정 누락" env var 개수(그대로 유지 — 이 페이지는 원래 Admin 진단용이라 raw 값 자체는 문제 아님) | 없음(읽기 전용) | **PRODUCT-01B 완료**: nav 드롭다운에서 "관리자 / 고급" 그룹으로 분리(route 자체는 유지) | 낮음(현재도 읽기 전용, 위험한 액션 없음) |
| `/dashboard/automation-safety` | 자동화 안전 점검(승인 게이트/게시 가드/로깅 보안 등 카테고리별 점검) | **ADMIN 전용이어야 함** | ADMIN_ONLY | `finding.severity` raw 값, "샘플 id" 노출(그대로 유지 — Admin 진단용) | "안전 점검 다시 실행" | **PRODUCT-01B 완료**: nav 드롭다운에서 "관리자 / 고급" 그룹으로 분리 | 낮음(읽기 전용 + 재계산 버튼뿐) |
| `/articles` | 기사(원고) 목록 | INTERNAL_USER | KEEP(초기 확인 필요, 라벨 뒤 raw enum 병기 가능성 — UX-01 지적, 재검증 필요) | `article.status` raw enum 병기 가능성(`"초안 (draft)"` 패턴, UX-01 문서 지적) | 기사 선택/승인 진입 | "내 콘텐츠" 목록 화면으로 그대로 사용 가능, enum 병기만 제거 | 낮음 |
| `/articles/[id]` | 기사 상세: 본문/승인/WordPress 초안(보조)/SEO metadata/featured image 등 | INTERNAL_USER + **다수 ADMIN_ONLY 섹션 혼재** | MIXED | ~~`WORDPRESS_BASE_URL`/`WORDPRESS_PUBLISH_ENABLED`/`SEO_PLUGIN_PROVIDER` env명~~ **PRODUCT-01B에서 6곳 라벨 수정 완료**(env 읽기 코드는 유지). `public_publish_approval_status` raw 값(UX-01 지적, 이번 Phase 미검증) | "승인하기" | 본문/승인만 기본 노출, 나머지 WordPress 보조 기능·SEO 상세는 이미 `<details>` 안(구조는 양호) — 추가 재배치는 PRODUCT-01C 이후 | 중간(3,061줄) |
| `/articles/[id]/blog` | wordpress_blog 카드: 글 생성→품질→승인→대표이미지→체크리스트→Draft | INTERNAL_USER | MIXED | ~~"SEO Plugin update status" 영문 라벨~~ **PRODUCT-01B에서 수정 완료**("SEO 반영 처리 결과"로 교체). guardScore/qualityScore(JSON 상세 안, 기본 닫힘, 양호) | 상태별로 동적(예: "게시 체크리스트 만들기"→"WordPress Draft 보기") | PRODUCT-01B 이전에 이미 실제 버그(체크리스트 export 전제조건)를 고친 화면 — 상태 기계 로직은 계속 건드리지 않는다 | 중간(2,809줄) |
| `/articles/[id]/social` | naver_cafe/x/threads/instagram 등 SNS 글 검토·승인·수동 게시 준비 | INTERNAL_USER | MIXED | "관리자용, 기본 접힘" 영역 이미 존재(양호), raw JSON(상세 보기, 기본 닫힘) | "승인" / bulk 승인 | 기본 흐름은 KEEP 수준, 보조 영역(품질검사 다시 실행/승인 요청 등 6개 버튼) primary와 시각적으로 더 분리 권장 | 낮음(구조는 이미 양호, primary action 재배치만) |
| `/articles/[id]/rewrite` | 원본 대비 재작성 버전 관리 | INTERNAL_USER(고급) | SIMPLIFY(미확인, 재조사 필요) | 미확인 | 미확인 | 고급 기능으로 유지 | 낮음 |
| `/articles/[id]/performance` | 게시 후 성과(views/likes 등) 수동 입력·조회 | INTERNAL_USER | KEEP(추정, 재검증 필요) | 미확인 | Metrics 입력 | "게시 준비 완료 콘텐츠"의 후속 화면으로 편입 | 낮음 |
| `/articles/[id]/ab-tests` | 글 반응 비교(A/B 테스트) 실험 관리 | INTERNAL_USER(고급) | KEEP(이미 한국어화 완료 확인) | 없음(전수 확인 완료 — 94줄 전체 검토) | "비교 실험 만들기" | 고급 기능으로 유지, 1차 IA에서는 숨김 우선순위 낮음 | 낮음 |
| `/social-posts/[id]` | social post 상세: 본문/게시 상태/관리자용 요약(내보내기 자료 개수 등) | INTERNAL_USER + **명시적 "관리자용" 섹션 포함** | MIXED(이미 자체적으로 tab=preview/edit/raw로 3단 분리 — 참고 사례) | "내보내기 자료 항목 수" 등 관리자용 요약(이미 "관리자용"이라 라벨링됨, 다만 실제 권한 분리는 없음) | 상태별 동적(승인/게시결과 기록 등) | 기존 tab 구조를 INTERNAL_USER 기본 tab / raw tab=Admin 경계로 그대로 승격 가능 — 재구현 최소 | 낮음(이미 구조가 있음) |
| `/themes/[themeId]` | 테마의 URL 후보 수집/가져오기(대시보드의 보조 흐름) | INTERNAL_USER | SIMPLIFY(미확인) | `ARTICLE_SEARCH_ENABLED` env var 참조 확인(값 노출 여부는 라인 단위 미검증) | "가져오기" 계열 | Create Content 마법사의 "Step 2 참고자료"로 흡수 검토 | 낮음~중간(대시보드와 기능 중복 가능성, 통합 여부 판단 필요) |
| `/trends` | 자동 테마 후보 탐색/분류(existing_theme_update/needs_review/duplicate_theme) | INTERNAL_USER(고급) | SIMPLIFY | `classification` raw 값이 필터 value로 쓰임(`page.tsx:678,909`, 라벨은 한국어 병기됨 — "확인 필요 (N)") | 테마 선택/가져오기 | Create Content 진입점 중 하나("주제 자동 추천")로 편입 검토, 995줄로 가장 복잡한 화면 중 하나 — 별도 재조사 필요 | 중간 |

## 요약

- **ADMIN_ONLY로 명확히 분리해야 할 route 2개**: `/dashboard/platform-api`,
  `/dashboard/automation-safety` — 둘 다 이미 읽기 전용(위험한 액션 없음)이라
  이동 자체의 구현 위험은 낮다.
- **MIXED(같은 화면 안에서 재구성 필요) route 5개**: `/articles/[id]`,
  `/articles/[id]/blog`, `/articles/[id]/social`, `/social-posts/[id]`,
  `/dashboard`(하위 메뉴 성격 혼재).
- **이번 Phase에서 라인 단위로 미확인한 route**: `/dashboard/social-performance`,
  `/articles/[id]/rewrite`, `/articles/[id]/performance`,
  `/themes/[themeId]` 일부 — PRODUCT-01B 착수 전 추가 조사 권장(단,
  MIXED/ADMIN_ONLY 판정에 영향을 줄 만큼 심각한 항목은 없을 것으로
  추정된다 — 이미 프로젝트 전반에 라벨 헬퍼가 적용되어 있는 추세이기
  때문).
