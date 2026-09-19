# 전체 UX 감사 보고서 (Phase UX-01)

- 작성일: 2026-09-18
- 범위: 코드 조사 전용. 이 문서 작성 과정에서 코드/컴포넌트/DB/설정은 변경하지 않았다.
- 조사 방법: route 전수 조사, 글 카드 유형 전수 조사, 기술 정보 노출 grep 조사, 사용자 여정/자동화 가능성 조사(4개 병렬 조사 결과 종합)

> **업데이트 (2026-09-19, Phase UX-06)**: UX-02~05B의 모든 변경을
> 실제 사용자 여정(WordPress/Naver Cafe/X thread/Multi-platform/
> Rewrite/Dashboard/Trends) 기준으로 자동 검증했다. 핵심 Journey
> blocker 0건, dead-end 0건, raw 기술 정보 노출 0건, primary action
> 충돌 0건을 확인했고 **UX-07 진입 기준을 충족**했다. 자세한 내용은
> [`docs/ux/ux-06-user-journey-validation.md`](./ux-06-user-journey-validation.md),
> [`docs/ux/ux-06-journey-matrix.md`](./ux-06-journey-matrix.md) 참고.

> **업데이트 (2026-09-19, Phase UX-07, 프로젝트 종료)**: 남은 부분
> 해결 High(H5/H6)를 정리하고 Medium/Low를 재분류했다. Critical
> open 0, High open 0, Journey blocker 0, dead-end 0, 위험한
> publish/approval 오해 0 — **UX 개선 프로젝트 완료 조건을
> 충족했다.** 자세한 내용은
> [`docs/ux/ux-final-report.md`](./ux-final-report.md) 참고.

---

## 1. Executive Summary

이 프로젝트는 "테마 선택 → 자료 수집 → 글 만들기 → 최종 확인 → 게시"라는 목표 흐름에 비해 내부적으로 매우 정교한 파이프라인(계약 검사, AI 평가, 자동 검토/자동 수정, SEO plugin 연동, WordPress 미디어 업로드 등)을 이미 갖추고 있다. 그리고 최근 커밋 이력(`Phase 3~4` 계열)을 보면 **일부 화면은 이미 이번 감사가 요구하는 방향으로 상당히 리팩터링되어 있다** — `/dashboard`, `/articles/[id]/blog`, `/articles/[id]/social`, `/social-posts/[id]`가 대표적이다. 이 화면들은:
- primary action을 1개로 계산하는 로직(`getSocialPostCardActionState`, `getWordPressPublishPrepState`, `getPostApprovalNextActions`)을 이미 갖추고 있고,
- raw 상태값을 `&lt;details&gt;` 뒤로 접는 패턴("상세 상태 보기", "raw 탭" 등)을 이미 도입했으며,
- 자동 검토 → 안전한 자동 수정 → 재검토 파이프라인(`post-auto-fix-service.ts`)도 이미 존재한다.

반대로 **`app/articles/[id]/page.tsx`(원본 article 페이지)는 이 프로젝트에서 가장 심각한 UX 부채가 몰려 있는 단일 파일**이다. env 변수 이름(`WORDPRESS_BASE_URL`, `SEO_PLUGIN_PROVIDER` 등)이 8곳 이상 raw로 렌더링되고, "테스트"라는 단어를 쓰면서 실제로는 공개 게시가 실행되는 버튼이 존재하며, "WordPress 게시 준비"라는 동일한 이름의 섹션이 페이지 안에 두 번 나온다. 이 페이지는 코드 주석상 "메인 경로가 아닌 보조 경로"로 명시되어 있어, 다음 Phase에서는 **개선보다 "일반 사용자 동선에서 완전히 숨기거나 별도 관리자 라우트로 격리"하는 편이 더 근본적인 해법**일 수 있다.

전체적으로 이 프로젝트의 UX 문제는 "기능이 없어서"가 아니라 **"이미 존재하는 좋은 패턴(details 접힘, 라벨 변환 헬퍼, next-action 계산 로직)이 일부 화면에만 적용되고 나머지 화면에는 적용되지 않아 일관성이 깨진 것"**이 핵심 원인이다. 따라서 UX-02 이후 작업은 새 컴포넌트를 발명하기보다 **이미 검증된 패턴을 전 화면에 일관 적용**하는 방향이 효율적이다.

---

## 2. 조사 범위 요약

- route(page.tsx) 17개 전수 조사
- 글 카드 유형 10개 조사 (WordPress 블로그, 네이버 블로그, 네이버 카페, X, Threads, Instagram, 언론기사/해설기사/칼럼(공용 구조), 기사 목록 카드, dashboard 생성 글 카드; rewrite 카드는 시간 제약으로 다음 Phase 확인 필요 — 아래 "조사 공백" 참조)
- 기술 정보 노출 grep 조사 30여 건
- 사용자 여정 5개, 자동화 가능성 항목 10개

### 조사 공백 (다음 Phase에서 보완 필요)
- `app/articles/[id]/rewrite/page.tsx`의 카드 단위 세부 조사는 이번 Phase에서 완료하지 못함 (route 레벨 조사만 수행)
- `app/dashboard/rewrite/page.tsx`, `app/dashboard/social-performance/page.tsx`, `app/trends/page.tsx` 일부는 부분 확인에 그침
- `getApprovalGateStatus`(승인 게이트 비활성 사유 표시 로직)가 모든 케이스에서 `reason`을 채우는지는 코드 미확인 — Critical/High 후보로 다음 Phase에서 우선 확인

---

## 3. Critical 문제

> **업데이트 (2026-09-18, Phase UX-02A)**: C1/C2/C5/C7은
> `app/articles/[id]/page.tsx`에 한해 해결되었다. 자세한 변경 내용은
> [`docs/ux/ux-02a-critical-safety-cleanup.md`](./ux-02a-critical-safety-cleanup.md)
> 참고.
>
> **업데이트 (2026-09-18, Phase UX-02B)**: C3/C4/C6도 해결되었다
> (`app/articles/[id]/blog/page.tsx`, `components/wordpress/wordpress-publishing-panel.tsx`).
> 자세한 변경 내용은
> [`docs/ux/ux-02b-wordpress-blog-cleanup.md`](./ux-02b-wordpress-blog-cleanup.md)
> 참고. `/dashboard/blog`, `/dashboard/rewrite`의 필터 라벨은 실사 결과
> 이미 `describeStatusField`/`describeStatusValue`로 번역되어 있음을
> 확인했다(추가 조치 불필요 — Section L/M 항목의 문서 기준 원자료가
> 최신 코드 상태를 반영하지 못했던 것으로 판단).

| # | 위치 | 문제 | 근거 | 상태 |
|---|---|---|---|---|
| C1 | `app/articles/[id]/page.tsx:2601-2702` | "테스트 실행"이라는 문구를 쓰면서 실제로는 WordPress **실제 공개 게시**가 실행되는 버튼이 존재. 사용자가 "테스트니까 괜찮겠지"라고 판단해 실수로 공개 게시할 위험 | `"WordPress 공개 게시 테스트 실행 (실제 공개 게시)"` 버튼 텍스트 자체가 모순적 | ✅ 해결 (UX-02A) — 라벨을 "WordPress 실제 공개 게시 실행"으로 변경하고 별도 관리자 전용 접힘으로 격리 |
| C2 | `app/articles/[id]/page.tsx` 다수 위치 | env 변수 이름이 최소 8곳 raw로 화면에 렌더링됨 (`WORDPRESS_BASE_URL`, `WORDPRESS_MEDIA_UPLOAD_ENABLED`, `WORDPRESS_PUBLISH_ENABLED`, `SEO_PLUGIN_PROVIDER`, `SEO_PLUGIN_WRITE_ENABLED`, `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED`) | L1009-1015, L1516, L1676, L1711, L2098-2106, L2198 | ⚠️ 확인 완료 — 실사 결과 전부 이미 중첩 `<details>`(상세 보기) 안에 있었음(추가 이동 불필요). provider select만 새로 접힘 처리(C7 참고) |
| C3 | `app/articles/[id]/blog/page.tsx:997` | 버튼 비활성 사유 문구에 `quality_status=ready` 같은 raw DB 필드명이 그대로 문장에 섞여 노출 | `"먼저 품질검사를 통과해야 합니다(quality_status=ready 필요)."` | ✅ 해결 (UX-02B) — raw 필드명 제거, "내부 상태값 보기" 접힘 안 dt/dd도 describeStatusField/describeStatusValue로 번역 |
| C4 | `components/wordpress/wordpress-publishing-panel.tsx:118-225` | WordPress 게시 준비 패널이 `&lt;details&gt;`로 접히지 않고 기본 노출 상태로, `qualityStatus`/`approvalStatus` raw enum, WordPress Post ID, WordPress Media ID, Media URL, SEO 필드명(영문)을 10개 이상 dt/dd로 나열 | wordpress-publishing-panel.tsx:120-226; 호출부 blog/page.tsx:1135-1200 | ✅ 해결 (UX-02B) — 기본 화면은 5줄 요약(품질검사/승인/Draft/SEO/대표 이미지, 모두 describeStatusValue로 번역)만 표시, ID/URL/raw guard/timestamp는 "상세 상태 보기" 접힘으로 이동. 동일 컴포넌트를 쓰는 `/articles/[id]`도 함께 영향 받아 검증됨 |
| C5 | `app/articles/[id]/page.tsx` | "WordPress 게시 준비"라는 **동일한 이름의 섹션이 페이지 안에 두 번** 존재(자동 실행 섹션과 요약 카드 섹션) — 사용자가 어느 쪽을 눌러야 하는지 혼동 | L796-856 vs L1285-1348 | ✅ 해결 (UX-02A) — 자동 실행 섹션 제목을 "WordPress 게시 준비 자동 실행"으로 구분(완전 통합은 UX-03에서 재검토) |
| C6 | `app/articles/[id]/blog/page.tsx:389, 1186` | `article status: {article.status}` 형태로 raw enum(draft/reviewed)이 번역 없이 그대로 노출. 같은 프로젝트의 `/articles/[id]/social`은 `describeStatusValue()`로 이미 번역하고 있어 **동일 데이터의 화면 간 표현 불일치**이자 raw enum 노출 | blog/page.tsx:389,1186 vs social/page.tsx:155 | ✅ 해결 (UX-02B) — 신규 `describeArticleStatus()`(article.status 전용, "reviewed"→"승인됨" 고정)로 번역. 승인 안내 문구의 raw 병기도 제거 |
| C7 | `app/articles/[id]/page.tsx:1009-1020` | SEO plugin provider 선택(`yoast`/`rank_math`/`aioseo`)이 접힘 없이 메인 화면에 select로 노출 | L1002-1020 | ✅ 해결 (UX-02A) — 현재 provider를 친화적 텍스트로 먼저 보여주고, select는 "SEO plugin 직접 선택 (고급)" 접힘 안으로 이동 |

## 4. High 문제

> **업데이트 (2026-09-18, Phase UX-03B1)**: H10은 해결되었다. 자세한
> 내용은 [`docs/ux/ux-03b1-workflow-next-action.md`](./ux-03b1-workflow-next-action.md) 참고.
>
> **업데이트 (2026-09-18, Phase UX-03B2)**: H8/H9는 해결되었다. 자세한
> 내용은 [`docs/ux/ux-03b2-interaction-consistency.md`](./ux-03b2-interaction-consistency.md) 참고.

| # | 위치 | 문제 | 상태 |
|---|---|---|---|
| H1 | `app/themes/[themeId]/page.tsx:172-176` | Mock 모드 배너에 `ARTICLE_SEARCH_ENABLED=false` env 변수명이 그대로 노출 | ✅ 해결 (UX-03C) — "테스트 데이터 모드"로 문구 교체, env 변수명 제거. `app/trends/page.tsx`의 동일 패턴("Mock 모드"/"Real API 모드")도 함께 한국어로 교체 |
| H2 | `components/platform-api/api-readiness-badge.tsx:11-13`, `api-readiness-summary.tsx:26,46` | "Dry-run 준비됨", "dry-run only" 등 기술 용어가 라벨 자체에 그대로 포함 | ✅ 해결 (UX-04B) — `dry_run_ready`→"연결 확인 가능", `ready_for_future_test`→"실제 게시 기능 준비 중"으로 교체. `api-readiness-summary.tsx`의 "dry-run 가능"/"feature flag"/"blockers"/"warnings", `api-dry-run-payload-preview.tsx`의 "API Dry-run Payload"/영문 필드명도 함께 한국어로 정리 |
| H3 | `components/social-ab-tests/ab-test-card.tsx:78-90` | `"ready로 변경"` 버튼처럼 raw enum이 버튼 라벨에 그대로 사용됨 | ✅ 해결 (UX-04B) — "테스트 준비 완료로 표시"/"테스트 시작"으로 교체, testStatus 배지도 raw enum 대신 `TEST_STATUS_LABELS`로 번역 |
| H4 | `app/dashboard/blog/page.tsx:122-155`, `app/dashboard/rewrite/page.tsx:110-143` | 필터 드롭다운 옵션 텍스트가 `not_checked/ready/needs_revision/blocked/failed` 등 raw enum 그대로 | ✅ 해결 확인 (UX-02B에서 이미 해결, UX-03C에서 재검증) — 두 페이지 모두 `describeStatusField`/`describeStatusValue`를 거치며 `<option value="raw">{describeStatusValue(raw)}</option>` 패턴으로 value(제출값)와 표시 텍스트가 분리되어 있음을 코드로 재확인 |
| H5 | `app/articles/[id]/page.tsx` (WordPress 전송 섹션 전체) | "고급 기능" details 안에는 있으나, 하위 섹션들이 다시 개별 접힘 없이 펼쳐진 상태로 나열되어 펼치는 순간 기술 정보가 대량 쏟아짐 | ✅ 해결 (UX-07) — 관리자 접힘 내부를 SEO 연동/대표 이미지/WordPress 연결·반영 실행/게시 안전 설정 4개 카테고리 accordion으로 그룹핑(기본 닫힘). 개별 섹션 내용/기존 leaf accordion은 그대로 유지, 카테고리 accordion 1단만 추가(accordion 과다 중첩 방지). `lib/ui/ux-07-polish.test.ts`로 회귀 고정 |
| H6 | `SocialPostBodyPanel` 편집 UI vs `app/social-posts/[id]/page.tsx` "수정하기" 탭 | 동일한 "본문 inline 수정" 기능이 서로 다른 필드 구성/버튼 배치로 **중복 구현**됨 (InlinePostBodyEditor 후보) | ✅ 해결 (UX-07) — 조사 결과 두 UI는 실제로 중복이 아니라(카드의 inline editor=본문만, 상세 페이지 탭=제목/본문/캡션/해시태그/스레드까지) **용어 충돌**이 진짜 문제였음을 확인. "수정하기" → "글 정보 편집"으로 라벨 변경해 "본문 수정"(inline)과 명확히 구분, business logic/action은 변경 없음 |
| H7 | `social/page.tsx:353-381` vs `social-posts/[id]/page.tsx:444-538` | "자동 검토 요약"(통과/확인필요/수정필요/차단) 블록이 거의 동일한 JSX로 두 곳에 각각 인라인 구현됨 (AutoReviewSummaryCard 후보) | ✅ 해결 (UX-03A) — `AutoReviewSummaryCard` 공통 컴포넌트로 통합 |
| H8 | `app/articles/[id]/rewrite/page.tsx:223,369,382` | 한 화면에서 "개선 제안 승인" / "재승인 요청" / "재승인 승인하기"라는 세 가지 다른 의미의 "승인" 용어가 공존해 혼동 유발 | ✅ 해결 (UX-03B2) — "개선안 선택"/"재검토 요청"/"최종 승인"으로 라벨 재정리(`describeRewriteSuggestionStatus` 신설). state machine/DB 필드는 변경 없음 |
| H9 | X 플랫폼 카드 (`social/page.tsx`) | 다른 플랫폼은 inline 수정 가능하지만 X만 "본문 수정" 클릭 시 상세 페이지로 이동 (thread 구조 때문) — 플랫폼 간 동일 라벨, 다른 동작 | ✅ 해결 (UX-03B2) — `InlinePostBodyEditor`에 `mode="thread"` 추가, X 카드도 다른 플랫폼과 동일하게 카드 안에서 인라인 편집 |
| H10 | `app/articles/[id]/blog/page.tsx:149-157` | 로그 필터 라벨에 `"Handoff"` 등 영어 용어가 번역 없이 노출 | ✅ 해결 (UX-03B1) — `describeStatusField`의 기존 `handoff_status` 매핑과 통일해 한국어로 교체 |

## 5. Medium 문제

> **업데이트 (2026-09-18, Phase UX-03C)**: PlatformBadge 중복 구현, 성과
> 대시보드 필터/차트 raw status 노출 2건이 해결되었다. 자세한 내용은
> [`docs/ux/ux-03c-route-adoption-platform-labels.md`](./ux-03c-route-adoption-platform-labels.md)
> 참고.

- ✅ 해결 (UX-03C) — ~~`components/social-performance-dashboard/dashboard-filter-controls.tsx:4-5`, `charts/low-performance-chart.tsx:14` — 필터/범례에 raw status 노출~~. `dashboard-filter-controls.tsx`의 필드 라벨/platform·toneStyle select 옵션/`performance_status`·`manual_post_status` 옵션/정렬 라벨을 기존 헬퍼(`PLATFORM_LABELS`/`TONE_STYLE_CONFIGS`/`describeStatusField`/`describeStatusValue`)로 교체, `low-performance-chart.tsx` 범례와 `tone-performance-chart.tsx` 막대 라벨도 동일하게 교체
- ✅ 해결 (UX-03C) — ~~`app/trends/page.tsx`, `app/themes/[themeId]/page.tsx`의 `PlatformBadge`류 컴포넌트가 각 페이지에 개별 구현되어 있고, 하나는 색상만 매핑, 하나는 한국어 변환이 없어 동일 데이터의 표현 불일치~~. `components/common/platform-badge.tsx` + `lib/ui/platform-badge.ts`로 통합(SocialPlatform과 trend 검색 출처 naver/daum/mock을 하나의 helper가 함께 라벨링). `components/social-performance-dashboard/charts/platform-performance-chart.tsx`의 별도 영문 라벨 매핑(`"Naver Blog"` 등)도 같은 helper로 교체
- ✅ 해결 (UX-07) — ~~`app/articles/page.tsx:12-16` — 상태 라벨이 `"초안 (draft)"`처럼 한국어 라벨 뒤에 raw enum을 괄호로 병기~~. `초안`/`승인됨`/`게시됨`으로 raw enum 제거
- `article.status`/`post.status` raw ↔ 라벨 변환 여부가 페이지마다 4가지로 다름 — **의도적 유지(Accepted)**: 각 페이지 성격이 달라(목록/워크플로/관리자 필터/탭 분리 상세) 강제 통일 시 얻는 이득보다 리팩터 위험이 크다고 판단, UX-08+ 기능 개발 시 해당 페이지를 만질 때 함께 정리
- Level 3 접힘 영역의 이름이 페이지마다 제각각(`/articles/[id]`="관리자 기능", `/articles/[id]/blog`="상세 상태 보기", `/social-posts/[id]`="내부 원문 보기", `/dashboard`="상세 관리") — **의도적 유지(Accepted)**: 재확인 결과 4곳이 담는 내용의 성격이 서로 다르다(관리자 전용 기능 실행 / 실행 이력 로그 / 원문 그대로 보기 / 대시보드 하위 관리 화면 묶음) — 이름이 달라도 각 맥락에서는 오해 소지가 적어 강제 통일은 보류
- `app/social-posts/[id]/page.tsx` — `tab=raw` 파라미터로 개발자용 화면에 URL 직접 접근 가능 — **향후 기능 개선(Deferred)**: route 자체를 분리해야 하는 구조 변경이라 UX-07 범위(polish) 밖, UX-08+ 후보로 유지
- ✅ 해결 (UX-04B) — ~~`app/dashboard/automation-safety/page.tsx:101-119` — 버튼 4개가 모두 동일한 액션(`rerunAutomationSafetyReview`)을 호출~~. 최신 코드로 재확인한 결과 실제로 4개 버튼이 완전히 동일한 action(구분 파라미터 없음)이었음을 확인, 1개 버튼("안전 점검 다시 실행")으로 통합. 카테고리별 결과는 읽기 전용으로 계속 확인 가능
- `app/articles/[id]/performance/page.tsx:104-111` — 화면 상단이 차트보다 먼저 3단락짜리 disclaimer 텍스트로 채워짐 — 미해결(UX-03C에서 `/dashboard/social-performance`를 확인했으나 동일 문제는 없었음 — disclaimer가 4줄 이내로 이미 양호)
- ✅ 해결 확인 (UX-07 재조사) — ~~`app/articles/[id]/social/page.tsx:735,769` — "내부 원문(raw)" 섹션과 "콘텐츠 미리보기(기존 필드)" 섹션이 기본 화면에 함께 존재~~. 최신 코드에는 해당 중복 섹션이 존재하지 않음(이전 Phase에서 이미 정리됨, 감사 문서가 stale했음)
- ✅ 해결 확인 (UX-07 재조사) — ~~`app/dashboard/platform-api/page.tsx`, `/dashboard/automation-safety/page.tsx` 일반 네비게이션 노출 여부~~. `components/navigation/dashboard-top-nav.tsx` 확인 결과 두 메뉴 모두 드롭다운 안에만 있고 `automation-safety`는 `danger` 플래그로 옅게 구분됨(섹션 10 규칙 준수)
- ✅ 해결 확인 (UX-07 재조사) — ~~언론기사(`news_article`)의 "수동 export 준비" 버튼 라벨 불명확~~. 현재 코드에서 해당 라벨 자체가 존재하지 않음(governance 섹션 2 표의 변환이 이미 적용되어 "수동 게시 준비 자료"류 표현만 남아 있음, 감사 문서가 stale했음)

## 6. Low 문제

- ✅ 해결 (UX-03C) — ~~`app/trends/page.tsx`의 `PlatformBadge`가 `naver`/`daum`/`mock` raw 문자열을 배지 텍스트로 사용~~. 공통 `PlatformBadge`가 "네이버"/"다음"/"테스트 데이터"로 번역
- `RelatedPostLinks`의 "→" 화살표 라벨이 여전히 작업 순서처럼 보일 여지 — **의도적 유지(Accepted, UX-07 재확인)**: 컴포넌트가 이미 분리되어 있고 실제 오해 사례가 보고된 적 없어 낮은 우선순위 유지
- `app/dashboard/automation-safety/page.tsx:28` — `publish_guards: "게시 가드"` 매핑은 되어 있으나 페이지 성격상 낮은 우선순위 — **의도적 유지(Accepted)**
- `/dashboard`의 "상세 관리" 접힘 안 pipeline log type이 영문 그대로 — **의도적 유지(Accepted)**: 접힘 상태라 기본 노출 없음, 관리자/디버깅 목적 로그라 영향 적음
- 표현/문구 다듬기 다수 — UX-07에서 `/articles` 상태 라벨 raw enum 제거 1건을 일괄 처리, 나머지는 개별 이슈로 보고된 것이 없어 추가 항목화하지 않음

---

## 7. 페이지별 문제 요약

| Route | 핵심 문제 | Severity |
|---|---|---|
| `/` | 없음 (즉시 redirect) | - |
| `/dashboard` | 이미 모범 사례. UX-03C에서 재확인(현재 상태/다음 작업/진행 중/완료 판단 로직 단일, raw 노출 없음) — 변경 불필요로 결론 | Low |
| `/themes/[themeId]` | ✅ env var 노출/PlatformBadge 중복 구현 해결 (UX-03C) | 해결됨 |
| `/articles` | 상태 라벨에 raw enum 병기 | Medium |
| `/articles/[id]` | ✅ Critical 항목 해결(UX-02A). UX-03C에서 기본 화면을 현재 상태/다음 작업(WordPress 블로그 글 관리)/보조(SNS 글 관리)로 재구성, 관리자 기능은 `AdvancedDetails` 성격의 접힘으로 유지(내부 세부 재구조화는 보류, H5 참고) | 부분 해결 |
| `/articles/[id]/blog` | ✅ 해결 (UX-02B) | 해결됨 |
| `/articles/[id]/social` | 대체로 양호(governance rule 반영됨), 레거시 필드 중복 표시 | Medium |
| `/articles/[id]/rewrite` | ✅ "승인" 용어 3종 혼동 해결(UX-03B2) + 카드 단위 전수 감사 완료(UX-03C — primary action 반복 표시 버그 발견/수정, raw platform 노출 수정, 내부 상태값 접힘을 `AdvancedDetails`로 통일) | 해결됨 |
| `/articles/[id]/performance` | 상단 disclaimer 과다 | Low |
| `/social-posts/[id]` | 탭 구조로 Level 분리 모범 사례, raw 탭 URL 직접 접근 가능, disabled 사유 미표시 가능성 | Medium |
| `/dashboard/platform-api`, `/dashboard/automation-safety` | ✅ 버튼 4개→기능 1개 중복 해결 (UX-04B). 관리자 화면 성격 명확하나 일반 동선 노출 여부 확인은 미해결 | 부분 해결 |
| `/dashboard/blog` | ✅ UX-03C에서 재확인 — 필터/테이블 모두 이미 라벨 변환됨, primary action 중복 없음(추가 조치 불필요로 결론) | 해결 확인 |
| `/dashboard/content` | 문제 없음 | Low |
| `/dashboard/rewrite` | ✅ 해결 (UX-03C) — 테이블 헤더/필터가 새 rewrite 용어와 일치하도록 정리, `rewrite_reapproval_status` 필드 라벨을 공용 helper에서 직접 수정 | 해결됨 |
| `/dashboard/social-performance` | ✅ 해결 (UX-03C) — 페이지 자체는 문제 없었으나, 렌더링에 쓰는 `dashboard-filter-controls`/`low-performance-chart`/`tone-performance-chart`에서 raw status/enum 노출 다수 발견해 수정 | 해결됨 |
| `/trends` | ✅ PlatformBadge 중복 구현/Mock 모드 영문 배지 해결 (UX-03C) | 해결됨 |

## 8. 카드별 문제 요약

| 카드 유형 | 핵심 문제 | Severity |
|---|---|---|
| WordPress 블로그 | ✅ 해결 (UX-02B) | 해결됨 |
| 네이버 블로그 | WordPress 패널 없어 상대적으로 양호, "다음 작업"이 export로만 제한적 | Medium |
| 네이버 카페/Threads/Instagram | Level 분리 양호(governance rule 반영), 버튼 개수는 많으나 위계 명확 | Low~Medium |
| X | ✅ 해결 (UX-03B2) — 본문 수정이 이제 다른 플랫폼과 동일하게 카드 안에서 열림 | 해결됨 |
| 언론기사/해설기사/칼럼 | naver_blog와 동일 구조 공유, export 버튼 동작 불명확 | Medium |
| 기사 목록 카드(`/articles`) | 상태 라벨에 raw enum 병기 | Medium |
| rewrite 카드(개선 제안/재작성 버전) | ✅ 해결 (UX-03C) — 카드별 전수 감사 완료: primary action 1개 확인, "개선안 선택" 버튼에 disabled 로직이 아예 없던 버그(반복 표시 위험) 발견/수정, 대상 원본 글 select의 raw platform key 노출 수정, dead-end 없음 확인, 내부 상태값 접힘을 `AdvancedDetails`로 통일 | 해결됨 |

---

## 9. 반복되는 공통 문제 (Top 10)

1. raw status/enum이 페이지마다 번역 여부가 다름 (4가지 방식 혼재)
2. env 변수 이름이 사용자 화면에 그대로 노출 (특히 `/articles/[id]`)
3. "고급 정보/상세 상태/raw" 접힘 영역의 이름과 구현 방식이 페이지마다 제각각
4. 동일한 이름의 섹션(WordPress 게시 준비)이 한 페이지에 중복
5. status label helper(`describeStatusField`/`describeStatusValue`)가 존재하는데도 일부 화면(`/dashboard/blog`, `/dashboard/rewrite`, `/articles/[id]`, `/articles/[id]/blog`)에는 미적용
6. 플랫폼 배지(`PlatformBadge`류)가 여러 페이지에 개별 구현되어 표현이 다름
7. "자동 검토 요약" 블록이 여러 화면에 인라인으로 중복 구현
8. 본문 inline 수정 UI가 화면마다 다르게 구현(InlinePostBodyEditor 후보)
9. "테스트"라는 단어를 쓰면서 실제로 위험한 동작(공개 게시)이 실행되는 버튼
10. 같은 개념에 다른 용어 사용 (승인/재승인/승인요청, 수정하기/본문 수정/rewrite)

## 10. 기술 정보 노출 목록 (요약)

세부 표는 조사 원자료 기준. 대표 항목:
- `WORDPRESS_BASE_URL`, `WORDPRESS_MEDIA_UPLOAD_ENABLED`, `WORDPRESS_PUBLISH_ENABLED`, `SEO_PLUGIN_PROVIDER`, `SEO_PLUGIN_WRITE_ENABLED`, `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED`, `ARTICLE_SEARCH_ENABLED` — env 변수명 원문
- `quality_status`, `approval_status`, `publish_guard`, `platform_publish_dry_run_status` — DB 필드명 원문
- `not_checked/ready/needs_revision/blocked/failed`, `not_attached/skipped_dry_run/not_reviewed`, `wordpress_blog/source_based_explainer/monetized_blog/story/curiosity/explanatory` — raw enum 값
- `provider`, `endpoint`, `payload`, `Post ID`, `Media ID`, `dry-run`, `handoff` — 기술 용어
- 전체 목록과 Level 분류는 `docs/ux/ui-information-levels.md` 참고

## 11. 자동화 가능 작업 (요약)

전체 분류표는 `docs/ux/user-journey-audit.md` 참고. 핵심 요약:
- 이미 자동화됨(참고용): 안전한 리뷰 이슈 자동 수정, 자동 수정 후 재검토, fixability 판정 (`lib/social/post-auto-fix-service.ts`, `review-issue-fixability.ts`)
- 자동화 가능하나 미구현: status 한국어 변환의 전면 적용(헬퍼는 있으나 일부 화면 미적용)
- ✅ 해결 (UX-05A) — ~~markdown/HTML 잔여물 정리 서비스~~. x/threads/instagram에 `platform_markup_residue` 검사 + 자동 정리기 신설(`lib/social/plain-text-markup-residue-sanitizer.ts`)
- ✅ 해결 (UX-03C) — ~~PlatformBadge 라벨 통합~~
- 사용자 판단 필요(자동화 부적절): SEO provider 선택, WordPress Draft 생성 실행, 실제 공개 게시

> **업데이트 (2026-09-18, Phase UX-04A)**: "AI가 자동 처리할 수 있는
> 문제(auto_fixable)는 사용자 화면에서 숨기고, 사람 판단이 필요한
> 것만 보여준다"는 원칙을 3개 핵심 route(`/articles/[id]/social`,
> `/social-posts/[id]`, `/articles/[id]/blog`)에 실제로 적용했다.
> 자세한 내용은 [`docs/ux/ux-04a-human-review-simplification.md`](./ux-04a-human-review-simplification.md) 참고.

## 12. 공통 컴포넌트 후보 (요약)

> **업데이트 (2026-09-18, Phase UX-03A)**: AdvancedDetails/AutoReviewSummaryCard/
> InlinePostBodyEditor/HumanReviewPanel을 신설·적용했다. 자세한 내용은
> [`docs/ux/ux-03a-common-ux-foundation.md`](./ux-03a-common-ux-foundation.md) 참고.
>
> **업데이트 (2026-09-18, Phase UX-03B1)**: NextActionPanel/WorkflowStatusCard도
> 신설·구현하고 우선순위 1 화면 3곳(blog/social 카드, social-posts 상세)에
> 적용했다. 자세한 내용은
> [`docs/ux/ux-03b1-workflow-next-action.md`](./ux-03b1-workflow-next-action.md) 참고.
> 우선순위 2 화면(`/articles/[id]`, `/dashboard/blog`, `/dashboard`)은 UX-03B2로 남았다.

| 후보 | 분류 | 상태 |
|---|---|---|
| JobProgressCard | 그대로 재사용 가능 (이미 모범 구현) | 변경 없음 |
| CopyPostBodyButton | 그대로 재사용 가능 | 변경 없음 |
| RelatedLinks (`RelatedPostLinks`) | 그대로 재사용 가능 | 변경 없음 |
| tone label helper | 그대로 재사용 가능 | 변경 없음 |
| status label helper | 그대로 재사용 가능하나 적용 범위 확대 필요 | 변경 없음(semantic audit으로 기존 매핑 검증 완료) |
| UnifiedPostBodyViewer | 약간 수정하면 공통화 가능 (`SocialPostBodyPanel` 기반 확장) | 미착수 |
| NextActionPanel | 약간 수정하면 공통화 가능 (3개 유사 로직 인터페이스 통일) | ✅ 구현 완료(`components/workflow/next-action-panel.tsx` + `lib/ui/next-action-view-model.ts`), blog/social 카드·social-posts 상세 적용. `/articles/[id]` 등 우선순위 2는 UX-03B2 |
| FinalApprovalPanel | 약간 수정하면 공통화 가능 | 미착수 |
| PlatformPublishPreview | 약간 수정하면 공통화 가능 | 미착수 |
| InlinePostBodyEditor | 중복 구현되어 있음 | ✅ 구현 완료(`components/social/inline-post-body-editor.tsx`), `SocialPostBodyPanel`이 내부에서 재사용. `/social-posts/[id]` 다중 필드 편집 탭은 범위 밖(다른 성격) |
| WordPressPublishPrepCard | 중복 구현되어 있음 (패널 안에 또 패널) | ✅ 부분 해결(UX-02B에서 패널 자체 단순화, UX-03A에서 헤딩 중복 이미 제거됨 — 구조 완전 통합은 UX-03) |
| AutoReviewSummaryCard | 중복 구현되어 있음 | ✅ 구현 완료(`components/review/auto-review-summary-card.tsx`), `social/page.tsx` + `social-posts/[id]/page.tsx`에 적용 |
| AdvancedDetails | 새 공통 컴포넌트 필요 | ✅ 구현 완료(`components/common/advanced-details.tsx`), 4곳 적용 |
| HumanReviewPanel | 새 공통 컴포넌트 필요 | ✅ 구현 완료(`components/review/human-review-panel.tsx`), `social-posts/[id]` 최종 승인 패널에 적용 |
| WorkflowStatusCard | 새 공통 컴포넌트 필요 (부분적으로 `/dashboard`에 유사 구현 있음, 추출 필요) | ✅ 구현 완료(`components/workflow/workflow-status-card.tsx` + `lib/ui/workflow-status-view-model.ts`), blog/social 카드 적용. `/dashboard`는 기존 패턴이 이미 좋아 UX-03B2에서 신중히 검토 |

## 13. 우선순위 개선안 (요약, 상세는 roadmap 문서)

1. **(Critical, 최우선)** `app/articles/[id]/page.tsx`의 env var/raw 필드 노출 제거 및 "테스트"라는 라벨로 실제 공개 게시가 실행되는 버튼 문구·플로우 수정
2. **(Critical)** `WordPressPublishingPanel`을 기본 접힘(`AdvancedDetails`)으로 전환하고 raw 필드를 라벨 헬퍼로 변환
3. **(High)** status label helper를 `/dashboard/blog`, `/dashboard/rewrite`, `/articles/[id]`, `/articles/[id]/blog`에 전면 적용
4. **(High)** `AdvancedDetails` 공통 컴포넌트 신설 후 4개 페이지의 개별 구현 통합
5. **(Medium)** `AutoReviewSummaryCard`, `InlinePostBodyEditor` 중복 제거 및 공통화

세부 로드맵은 `docs/ux/ux-refactor-roadmap.md` 참고.
