# UI 정보 3계층 분류 (Phase UX-01)

- 작성일: 2026-09-18
- 이 문서는 조사 전용이며 코드 변경은 없다.

---

## 분류 기준

**Level 1 — 일반 사용자 기본 표시**
현재 상태, 본문, 확인 필요 사항, 다음 작업, 진행 상태. 사용자가 페이지를 열자마자 봐야 하는 정보.

**Level 2 — 필요할 때 확인**
자동 검토 상세, SEO, 대표 이미지, 출처, 게시 상태, 성과. 기본 화면에는 없지만 한 번의 클릭(펼치기/탭 전환)으로 접근 가능해야 하는 정보.

**Level 3 — 관리자/개발자 전용**
raw status, ID, API 상태, 로그, provider, endpoint, JSON, DB field, payload, env 변수명. 일반 사용자에게는 원칙적으로 보이지 않아야 하는 정보.

---

## Level 1 항목 (현재 잘 지켜지는 화면 기준 예시)

- `/dashboard`의 "현재 상태 / 다음 작업" 카드 (`workflowState` 계산, primary action 1개)
- `SocialPostBodyPanel`의 본문 표시/복사/수정 버튼
- `getUserFacingStatus(post)`로 변환된 상태 문구 (`social/page.tsx:388`)
- `social-posts/[id]` 상세의 "게시용 미리보기" 탭

## Level 2 항목 (현재 잘 지켜지는 화면 기준 예시)

- `social/page.tsx:536` "상세 상태 보기 / 보조 작업 (관리자용, 기본 접힘)" — `&lt;details&gt;`로 격리
- `social-posts/[id]/page.tsx:837` 내부 상태(quality_status 등) — `&lt;details&gt;`로 격리
- `social-posts/[id]/page.tsx`의 "raw" 탭 (명시적으로 3단계 탭 구조로 분리)
- `blog/page.tsx:1205` "고급 옵션 / 단계별 상태 자세히 보기"
- `blog/page.tsx:184-205` 프로세스 로그의 "상세 JSON 보기" 접힘

## Level 3 항목이 잘못 노출되고 있는 위치 (Level 1 화면에 그대로 등장)

| 파일:라인 | 노출된 Level 3 정보 | 현재 상태 |
|---|---|---|
| `app/articles/[id]/page.tsx:1009-1015` | SEO plugin `provider` select | 접힘 안에 있으나 하위 섹션이 펼쳐진 채 나열됨 — 사실상 L1 노출 |
| `app/articles/[id]/page.tsx:1516` | `WORDPRESS_MEDIA_UPLOAD_ENABLED` env var 이름 | 접힘 내부지만 하위 미접힘 |
| `app/articles/[id]/page.tsx:1676` | `process.env.WORDPRESS_BASE_URL` 값 직접 렌더링 | 동일 |
| `app/articles/[id]/page.tsx:1711` | `WORDPRESS_PUBLISH_ENABLED` env var 이름 | 동일 |
| `app/articles/[id]/page.tsx:2098-2106,2198` | `SEO_PLUGIN_PROVIDER`, `SEO_PLUGIN_WRITE_ENABLED`, `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED` | 동일 |
| `app/articles/[id]/blog/page.tsx:997` | `quality_status` 필드명이 안내 문구에 그대로 삽입 | **완전 미접힘, L1 노출** |
| `app/articles/[id]/blog/page.tsx:389,1186` | `article.status` raw enum | **완전 미접힘, L1 노출** |
| `components/wordpress/wordpress-publishing-panel.tsx:118-225` | `qualityStatus`/`approvalStatus`/WordPress Post ID/Media ID/SEO 필드명 | **완전 미접힘, L1 노출** (WordPress 블로그 카드 안에 상시 표시) |
| `app/themes/[themeId]/page.tsx:172-176` | `ARTICLE_SEARCH_ENABLED` env var 이름 | **완전 미접힘, L1 노출** |
| `app/dashboard/blog/page.tsx:122-155`, `app/dashboard/rewrite/page.tsx:110-143` | 필터 드롭다운의 raw enum 옵션 텍스트 | **완전 미접힘, L1 노출** (다만 필터라는 맥락상 상대적으로 영향은 적음) |
| `components/platform-api/api-readiness-badge.tsx:11-13` | "Dry-run 준비됨" 등 라벨 자체에 기술 용어 포함 | 배지 형태로 L1 노출 |
| `components/social-ab-tests/ab-test-card.tsx:78-90` | `"ready로 변경"` 버튼 라벨 | L1 노출 |
| `app/articles/[id]/page.tsx:2629` | `public_publish_approval_status` raw 값 | L1 노출 |
| `app/articles/page.tsx:12-16` | `"초안 (draft)"`처럼 한국어 라벨 뒤 raw enum 병기 | 부분 노출 (라벨은 있으나 원문도 함께) |
| `components/social-performance-dashboard/dashboard-filter-controls.tsx:4-5`, `charts/low-performance-chart.tsx:14` | `PERFORMANCE_STATUSES`, `"not_measured"` 라벨 | L1 노출 |

## 숨겨야 할 항목 목록 (다음 Phase 우선순위용)

1. 모든 env 변수 이름 (`WORDPRESS_*`, `SEO_PLUGIN_*`, `ARTICLE_SEARCH_ENABLED`) — 사용자 화면에는 "연결됨/연결 안 됨" 같은 상태 문구로만 표시
2. `quality_status`, `approval_status`, `publish_guard`, `platform_publish_dry_run_status` 등 DB 필드명 원문 — 항상 라벨 헬퍼를 거쳐야 함
3. WordPress Post ID, Media ID, Media URL — Level 2(고급 정보)로 이동
4. SEO plugin `provider`/`endpoint`/`payload` 관련 텍스트 — Level 2~3
5. `dry-run`, `handoff`, `payload`, `eventName` 등 영어 기술 용어 — 한국어 사용자 문구로 교체하거나 Level 3로 이동
6. raw enum이 그대로 쓰이는 필터 옵션 라벨(`not_checked`, `ready` 등) — status label helper로 전면 교체
7. "고급 기능" 하위의 미접힘 서브섹션들 — 개별 `&lt;details&gt;`로 재구성하거나 공통 `AdvancedDetails` 컴포넌트로 통합

## 관찰: Level 분리가 이미 잘 된 참고 사례

- `app/social-posts/[id]/page.tsx` — `tab=preview|edit|raw` 3단 구조로 Level 1/2/3을 명시적으로 코드 레벨에서 분리. 주석에 "DB 컬럼명과 raw id 문자열을 그대로 노출하지 않는다"는 원칙이 이미 명문화되어 있음
- `app/articles/[id]/social/page.tsx:536` — "관리자용, 기본 접힘"이라는 명시적 문구와 함께 raw 값을 격리
- `app/dashboard/page.tsx` — `sectionExpansion`, `currentStepArea`로 "현재 단계만 펼치고 나머지는 접힘" 패턴을 이미 구현

이 3개 화면의 패턴을 다음 Phase에서 나머지 화면(특히 `/articles/[id]`, `/articles/[id]/blog`, `/dashboard/blog`, `/dashboard/rewrite`)에 일관 적용하는 것이 가장 효율적인 개선 경로다.
