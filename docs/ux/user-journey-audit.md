# 사용자 여정 감사 보고서 (Phase UX-01)

- 작성일: 2026-09-18
- 조사 방법: 코드 구조(route 이동, API 호출, 파이프라인 서비스) 기준 5개 대표 여정 추적. 클릭 수는 코드 기준 예상치.
- 이 문서는 조사 전용이며 코드 변경은 없다.

---

## Journey 1: 테마 선택 → 자료 수집 → 마스터 원고 → WordPress 블로그 → 자동 검토 → 수정 → 승인 → WordPress Draft

**현재 흐름 (route 이동 순서)**
`/dashboard`(테마 선택) → `/themes/[themeId]`(자료 수집) → `/dashboard?themeId=`(마스터 원고 생성) → `/dashboard`(플랫폼별 글 생성) → `/articles/[id]/blog`(자동 검토 확인 → 수정 → 승인 → WordPress Draft 생성)

| 항목 | 값 |
|---|---|
| 주요 클릭 수(추정) | 약 9~10회 (테마 선택 1, URL 수집 1, 후보 선택+등록 1, 마스터 원고 생성 1, 블로그 글 생성 1, 품질검사 확인 1, 필요시 수정 1, 승인 1, WordPress Draft 생성 1) |
| 필수 페이지 이동 | 최소 3회 왕복 (`/dashboard` → `/themes/[id]` → `/dashboard` → `/articles/[id]/blog`) |
| 사용자 판단 단계 | 3곳 (후보 URL 선택, 수정 필요 여부 확인, 최종 승인) |
| 자동화 가능 단계 | 품질검사 자동 재실행(이미 `runAutoFixAndRecheck`로 구현됨); 후보 URL 자동 import는 미구현(수동 체크 필요) |
| next action 불명확 위치 | `app/articles/[id]/page.tsx:1279-1344` — 원본 article 페이지와 `blog/page.tsx`에 유사한 WordPress 게시 준비 패널이 각각 존재해 어느 화면에서 작업해야 하는지 혼동 |
| 기술 정보 노출 위치 | `app/articles/[id]/page.tsx:2629`(`public_publish_approval_status` raw), `:2221`(`SEO_PLUGIN_PROVIDER` env명), `:1009`(provider select) |
| 중복 확인 단계 | article 승인 상태 경고문이 `blog/page.tsx:1186`과 `:1727` 두 곳에서 거의 동일하게 반복 (raw enum 포함) |
| 길을 잃을 가능성 | `/dashboard`와 `/articles/[id]`가 유사한 마스터원고/게시 정보를 중복 표시 |
| 추천 단순화 흐름 | 테마→자료수집→원고→플랫폼글 4단계를 하나의 단계형 workflow 화면으로 묶고, `/articles/[id]`의 raw enum·provider 노출을 접힘 영역으로 이동. "WordPress 게시 준비"는 `blog/page.tsx` 단일 진입점으로 통합하고 `/articles/[id]`의 중복 섹션은 제거 또는 관리자 전용으로 격리 |

---

## Journey 2: 테마 선택 → 자료 수집 → 마스터 원고 → 네이버 카페 → 자동 검토 → 수정 → 승인 → 복사/게시 준비

**현재 흐름**
Journey 1과 동일한 초반 경로 + `/articles/[id]/social`(social/page.tsx)로 분기. `naver_cafe`는 `post-approval-next-actions.ts:95-110`에서 API 미설정 시 `copy_body`가 primary, 설정 시 `check_api_readiness`가 secondary로 이미 자동 계산됨.

| 항목 | 값 |
|---|---|
| 주요 클릭 수(추정) | 약 8~9회 |
| 필수 페이지 이동 | 3회 왕복 (`/dashboard` → `/themes/[id]` → `/dashboard` → `/articles/[id]/social`) |
| 사용자 판단 단계 | 4곳 (후보 선택, 플랫폼/문체 선택, 수정 필요 판단, 승인) |
| 기술 정보 노출 위치 | `social/page.tsx:735` "내부 원문(raw)" 섹션이 접힘 없이 기본 카드 흐름에 함께 표시 |
| 중복 확인 단계 | `social/page.tsx:769` "콘텐츠 미리보기(기존 필드)"가 상단 게시용 미리보기와 별도로 동시 존재 — 레거시 필드로 추정 |
| 추천 단순화 흐름 | "내부 원문(raw)"과 "콘텐츠 미리보기(기존 필드)"를 고급 정보 영역으로 이동하거나, 실제 미사용 필드라면 다음 Phase에서 제거 검토 |

---

## Journey 3: 마스터 원고 → SNS 플랫폼 선택 → 문체 설정 → 여러 플랫폼 글 생성 → 확인 → 승인 → 게시 준비

**현재 흐름**
`/dashboard`(마스터 원고 생성) → `/dashboard`(플랫폼 다중 선택, `components/articles/platform-selection-checkboxes.tsx`) → `/articles/[id]/social`(플랫폼별 카드 확인/승인)

| 항목 | 값 |
|---|---|
| 주요 클릭 수(추정) | 플랫폼 4개 기준 약 10회 이상 (다중 선택 1, 플랫폼별 문체 설정 N, 생성 1, 플랫폼별 확인/승인 N) |
| 사용자 판단 단계 | 플랫폼 수(N)에 비례 — 플랫폼별 문체 선택 N회 + 카드별 승인 N회로 반복 판단 부담이 큼 |
| 자동화 가능 단계 | 안전한 수정 항목은 `post-auto-fix-service.ts`로 이미 부분 자동화되어 있으나, 카드별 "승인 요청" 버튼은 개별 클릭 필요(`social/page.tsx:578`) — 일괄 승인 UI 없음 |
| next action 불명확 위치 | 여러 플랫폼 카드가 동시 나열되며 처리 순서 안내가 없음 (`social/page.tsx:226`) |
| 추천 단순화 흐름 | 플랫폼별 카드에 "전체 일괄 자동검토/일괄 확인" 옵션 또는 처리 순서(Step) 표시 추가 검토 |

---

## Journey 4: 언론 기사 생성 → 자동 검토 → 자동 수정 → 승인 → export/게시 준비

**현재 흐름**
`news_article`/`opinion_column`은 `social/page.tsx`의 동일 카드 구조를 재사용. 승인 후 primary action은 `copy_body`, secondary는 `prepare_manual_export`(`post-approval-next-actions.ts:86-93`).

| 항목 | 값 |
|---|---|
| 기술 정보 노출 | 다른 플랫폼과 공통 컴포넌트를 재사용하므로 Journey 2와 동일한 이슈(내부 원문 raw 섹션 등)를 공유 |
| 불명확 지점 | "수동 export 준비" 버튼이 실제로 무엇을 하는지(다운로드/화면 이동 등) 코드상 실행 로직 확인 필요 — 라벨만으로는 불명확 |
| 추천 단순화 흐름 | "수동 export 준비" 버튼의 실제 동작을 확인한 뒤, 동작에 맞는 구체적 라벨(예: "텍스트 파일로 저장", "다른 곳에 붙여넣기용 복사")로 교체 검토 |

---

## Journey 5: 기존 글 → rewrite → 검토 → 승인 → 게시 준비

**현재 흐름**
`/articles/[id]/rewrite` — 개선 제안 생성(:148) → 제안 목록에서 승인(:223 "개선 제안 승인") → 재승인 요청(:369) → 재승인 승인하기(:382) → 적용

| 항목 | 값 |
|---|---|
| 주요 클릭 수(추정) | 약 5회 (제안 생성 1, 제안 승인 1, 적용 1, 재승인 요청 1, 재승인 승인 1) — 그러나 용어 혼동으로 인한 재확인 왕복이 추가로 발생할 가능성 |
| 사용자 판단 단계 | 3곳 (제안 승인, 적용 여부, 재승인) |
| **핵심 문제** | 한 화면에 "개선 제안 승인"(:223) / "재승인 요청"(:369) / "재승인 승인하기"(:382)라는 **세 가지 다른 의미의 "승인" 용어**가 공존해 사용자가 각 버튼이 무엇을 확정하는지 혼동하기 쉬움 |
| 추천 단순화 흐름 | 용어를 목적이 드러나도록 재명명 검토: "개선 제안 승인" → "제안 채택", "재승인 요청" → "변경 재검토 요청", "재승인 승인하기" → "재검토 확정" (실제 문구는 UX-05에서 확정) |

---

## 자동화 가능성 분류표

| 항목 | 현재 구현 위치 | 분류 |
|---|---|---|
| 안전한 리뷰 이슈 자동 수정 | `lib/social/post-auto-fix-service.ts:118` `runAutoFixAndRecheck` | **safe_to_automate (이미 구현됨)** |
| 자동 수정 후 재검토 | `post-auto-fix-service.ts` 내 recheck 로직 | **safe_to_automate (이미 구현됨)** |
| 리뷰 이슈 fixability 판정 | `lib/social/review-issue-fixability.ts:98` `classifyReviewIssue` | **safe_to_automate (이미 구현됨)** |
| status 한국어 변환 | 페이지마다 `STATUS_LABEL` 등을 개별 정의(`themes/[themeId]/page.tsx:29`, `dashboard/automation-safety/page.tsx:8` 등) — 공통 헬퍼(`describeStatusField`/`describeStatusValue`)는 있으나 미통합 | safe_to_automate (헬퍼 존재, 적용 확대 필요) |
| 완료된 작업 버튼 숨김 | `post-approval-next-actions.ts`가 wordpress_blog 계열엔 적용됨, 다른 화면은 부분 적용 | needs_user_confirmation (전면 검토 필요) |
| markdown/HTML 잔여물 정리 | 코드 내 명시적 cleanup 서비스 미발견 | safe_to_automate (신규 자동화 후보) |
| SEO metadata 준비 | `app/articles/[id]/page.tsx:1002` 버튼 존재, provider는 수동 선택(:1009) | needs_user_confirmation (provider 선택은 사용자 판단 필요) |
| WordPress 자동 초안 생성 | `blog/page.tsx:1193` `prepState.primaryAction` | needs_user_confirmation (게시 관련 행위, 의도적 수동 유지가 적절) |
| 자동화 안전 점검 재실행 | `app/dashboard/automation-safety/page.tsx:101-119` 버튼 4개가 모두 동일 액션 호출 | must_remain_manual이나 **UI 중복 정리 필요** (기능 1개에 버튼 4개) |
| 실제 공개 게시(public publish) | `lib/publish/wordpress-public-publish-service.ts`, `articles/[id]/page.tsx:2591` | must_remain_manual (승인 필요 영역, 올바름 — 단 라벨의 "테스트" 표현은 수정 필요, `full-ux-audit.md` C1 참조) |
| 원고 문단 정리/리드문 보강 | 별도 자동화 서비스 미발견 | needs_user_confirmation 또는 safe_to_automate 후보 (신규 기능, 이번 Phase 범위 밖) |

---

## Journey 공통 관찰

- 모든 Journey에서 "테마 선택 → 자료 수집" 구간은 `/dashboard` ↔ `/themes/[themeId]` 간 왕복이 필수이며, 이 왕복이 모든 여정의 공통 병목이다.
- 플랫폼 수가 늘어날수록(Journey 3) 반복 판단 부담이 선형으로 증가하는데, 일괄 처리 UI가 없다.
- "승인"이라는 단어가 프로젝트 전체에서 최소 4가지 다른 맥락(기사 승인, 소셜포스트 승인, rewrite 제안 승인, rewrite 재승인)에 쓰이고 있어 전역적인 용어 정리가 필요하다 (UX-05에서 다룰 것).
