# 전체 UX 감사 보고서 (Phase UX-01)

- 작성일: 2026-09-18
- 범위: 코드 조사 전용. 이 문서 작성 과정에서 코드/컴포넌트/DB/설정은 변경하지 않았다.
- 조사 방법: route 전수 조사, 글 카드 유형 전수 조사, 기술 정보 노출 grep 조사, 사용자 여정/자동화 가능성 조사(4개 병렬 조사 결과 종합)

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

| # | 위치 | 문제 | 근거 |
|---|---|---|---|
| C1 | `app/articles/[id]/page.tsx:2601-2702` | "테스트 실행"이라는 문구를 쓰면서 실제로는 WordPress **실제 공개 게시**가 실행되는 버튼이 존재. 사용자가 "테스트니까 괜찮겠지"라고 판단해 실수로 공개 게시할 위험 | `"WordPress 공개 게시 테스트 실행 (실제 공개 게시)"` 버튼 텍스트 자체가 모순적 |
| C2 | `app/articles/[id]/page.tsx` 다수 위치 | env 변수 이름이 최소 8곳 raw로 화면에 렌더링됨 (`WORDPRESS_BASE_URL`, `WORDPRESS_MEDIA_UPLOAD_ENABLED`, `WORDPRESS_PUBLISH_ENABLED`, `SEO_PLUGIN_PROVIDER`, `SEO_PLUGIN_WRITE_ENABLED`, `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED`) | L1009-1015, L1516, L1676, L1711, L2098-2106, L2198 |
| C3 | `app/articles/[id]/blog/page.tsx:997` | 버튼 비활성 사유 문구에 `quality_status=ready` 같은 raw DB 필드명이 그대로 문장에 섞여 노출 | `"먼저 품질검사를 통과해야 합니다(quality_status=ready 필요)."` |
| C4 | `components/wordpress/wordpress-publishing-panel.tsx:118-225` | WordPress 게시 준비 패널이 `&lt;details&gt;`로 접히지 않고 기본 노출 상태로, `qualityStatus`/`approvalStatus` raw enum, WordPress Post ID, WordPress Media ID, Media URL, SEO 필드명(영문)을 10개 이상 dt/dd로 나열 | wordpress-publishing-panel.tsx:120-226; 호출부 blog/page.tsx:1135-1200 |
| C5 | `app/articles/[id]/page.tsx` | "WordPress 게시 준비"라는 **동일한 이름의 섹션이 페이지 안에 두 번** 존재(자동 실행 섹션과 요약 카드 섹션) — 사용자가 어느 쪽을 눌러야 하는지 혼동 | L796-856 vs L1285-1348 |
| C6 | `app/articles/[id]/blog/page.tsx:389, 1186` | `article status: {article.status}` 형태로 raw enum(draft/reviewed)이 번역 없이 그대로 노출. 같은 프로젝트의 `/articles/[id]/social`은 `describeStatusValue()`로 이미 번역하고 있어 **동일 데이터의 화면 간 표현 불일치**이자 raw enum 노출 | blog/page.tsx:389,1186 vs social/page.tsx:155 |
| C7 | `app/articles/[id]/page.tsx:1009-1020` | SEO plugin provider 선택(`yoast`/`rank_math`/`aioseo`)이 접힘 없이 메인 화면에 select로 노출 | L1002-1020 |

## 4. High 문제

| # | 위치 | 문제 |
|---|---|---|
| H1 | `app/themes/[themeId]/page.tsx:172-176` | Mock 모드 배너에 `ARTICLE_SEARCH_ENABLED=false` env 변수명이 그대로 노출 |
| H2 | `components/platform-api/api-readiness-badge.tsx:11-13`, `api-readiness-summary.tsx:26,46` | "Dry-run 준비됨", "dry-run only" 등 기술 용어가 라벨 자체에 그대로 포함 |
| H3 | `components/social-ab-tests/ab-test-card.tsx:78-90` | `"ready로 변경"` 버튼처럼 raw enum이 버튼 라벨에 그대로 사용됨 |
| H4 | `app/dashboard/blog/page.tsx:122-155`, `app/dashboard/rewrite/page.tsx:110-143` | 필터 드롭다운 옵션 텍스트가 `not_checked/ready/needs_revision/blocked/failed` 등 raw enum 그대로 |
| H5 | `app/articles/[id]/page.tsx` (WordPress 전송 섹션 전체) | "고급 기능" details 안에는 있으나, 하위 섹션들이 다시 개별 접힘 없이 펼쳐진 상태로 나열되어 펼치는 순간 기술 정보가 대량 쏟아짐 |
| H6 | `SocialPostBodyPanel` 편집 UI vs `app/social-posts/[id]/page.tsx` "수정하기" 탭 | 동일한 "본문 inline 수정" 기능이 서로 다른 필드 구성/버튼 배치로 **중복 구현**됨 (InlinePostBodyEditor 후보) |
| H7 | `social/page.tsx:353-381` vs `social-posts/[id]/page.tsx:444-538` | "자동 검토 요약"(통과/확인필요/수정필요/차단) 블록이 거의 동일한 JSX로 두 곳에 각각 인라인 구현됨 (AutoReviewSummaryCard 후보) |
| H8 | `app/articles/[id]/rewrite/page.tsx:223,369,382` | 한 화면에서 "개선 제안 승인" / "재승인 요청" / "재승인 승인하기"라는 세 가지 다른 의미의 "승인" 용어가 공존해 혼동 유발 |
| H9 | X 플랫폼 카드 (`social/page.tsx`) | 다른 플랫폼은 inline 수정 가능하지만 X만 "본문 수정" 클릭 시 상세 페이지로 이동 (thread 구조 때문) — 플랫폼 간 동일 라벨, 다른 동작 |
| H10 | `app/articles/[id]/blog/page.tsx:149-157` | 로그 필터 라벨에 `"Handoff"` 등 영어 용어가 번역 없이 노출 |

## 5. Medium 문제

- `app/articles/page.tsx:12-16` — 상태 라벨이 `"초안 (draft)"`처럼 한국어 라벨 뒤에 raw enum을 괄호로 병기 (완전한 Level 3 은닉 원칙과 부분 충돌)
- `components/social-performance-dashboard/dashboard-filter-controls.tsx:4-5`, `charts/low-performance-chart.tsx:14` — 필터/범례에 raw status 노출
- `app/trends/page.tsx`, `app/themes/[themeId]/page.tsx`의 `PlatformBadge`류 컴포넌트가 각 페이지에 개별 구현되어 있고, 하나는 색상만 매핑, 하나는 한국어 변환이 없어 **동일 데이터의 표현 불일치**
- `article.status`/`post.status` raw ↔ 라벨 변환 여부가 페이지마다 4가지로 다름 (`/articles`=라벨+원문 병기, `/articles/[id]/blog`=원문만, `/dashboard/blog`=라벨만, `/social-posts/[id]`=라벨 우선+raw는 별도 탭)
- Level 3 접힘 영역의 이름이 페이지마다 제각각: "고급 기능"(`/articles/[id]`), "상세 상태 보기"(`/articles/[id]/blog`), "raw 탭"(`/social-posts/[id]`), "상세 관리"(`/dashboard`) — 동일 개념, 4개의 다른 UI 패턴
- `app/social-posts/[id]/page.tsx` — `tab=raw` 파라미터로 개발자용 화면에 URL 직접 접근 가능 (공유 링크 오발송 위험)
- `app/dashboard/automation-safety/page.tsx:101-119` — 버튼 4개가 모두 동일한 액션(`rerunAutomationSafetyReview`)을 호출 — 실질 기능은 1개인데 버튼이 4개로 분산
- `app/articles/[id]/performance/page.tsx:104-111` — 화면 상단이 차트보다 먼저 3단락짜리 disclaimer 텍스트로 채워짐
- `app/articles/[id]/social/page.tsx:735,769` — "내부 원문(raw)" 섹션과 "콘텐츠 미리보기(기존 필드)" 섹션이 기본 화면에 함께 존재, 레거시 필드로 추정되는 중복 표시
- `app/dashboard/platform-api/page.tsx`, `/dashboard/automation-safety/page.tsx` — 관리자용 화면임을 명시하고 있으나, 일반 사용자 네비게이션(`DashboardTopNav`)에 노출되는지 별도 확인 필요
- 언론기사(`news_article`)의 "수동 export 준비" 버튼이 실제로 무엇을 하는지(다운로드/화면 이동 등) 라벨만으로 불명확

## 6. Low 문제

- `app/trends/page.tsx`의 `PlatformBadge`가 `naver`/`daum`/`mock` raw 문자열을 배지 텍스트로 사용 (관용적 배지라 심각도는 낮음)
- `RelatedPostLinks`의 "→" 화살표 라벨이 여전히 작업 순서처럼 보일 여지 (컴포넌트 자체는 이미 분리되어 낮은 우선순위)
- `app/dashboard/automation-safety/page.tsx:28` — `publish_guards: "게시 가드"` 매핑은 되어 있으나 페이지 성격상 낮은 우선순위
- `/dashboard`의 "상세 관리" 접힘 안 pipeline log type이 영문 그대로 (접힘 상태라 영향 적음)
- 표현/문구 다듬기 다수 (별도 목록화하지 않음, UX-07 polish 단계에서 일괄 처리 권장)

---

## 7. 페이지별 문제 요약

| Route | 핵심 문제 | Severity |
|---|---|---|
| `/` | 없음 (즉시 redirect) | - |
| `/dashboard` | 이미 모범 사례에 가까움. 상세 관리 안 로그 타입 영문 | Low |
| `/themes/[themeId]` | env var 노출, PlatformBadge 중복 구현 | High |
| `/articles` | 상태 라벨에 raw enum 병기 | Medium |
| `/articles/[id]` | env var 대량 노출, "테스트"인데 실공개게시, 섹션명 중복, provider select 미접힘 | **Critical** |
| `/articles/[id]/blog` | WordPress 패널 raw 상태 대량 노출, article.status 미번역, 필터 영문 용어 | **Critical** |
| `/articles/[id]/social` | 대체로 양호(governance rule 반영됨), 레거시 필드 중복 표시 | Medium |
| `/articles/[id]/rewrite` | "승인" 용어 3종 혼동, 카드 단위 조사 공백 | High |
| `/articles/[id]/performance` | 상단 disclaimer 과다 | Low |
| `/social-posts/[id]` | 탭 구조로 Level 분리 모범 사례, raw 탭 URL 직접 접근 가능, disabled 사유 미표시 가능성 | Medium |
| `/dashboard/platform-api`, `/dashboard/automation-safety` | 관리자 화면 성격 명확하나 일반 동선 노출 여부 확인 필요, 버튼 4개→기능 1개 중복 | Medium |
| `/dashboard/blog` | 필터 옵션 raw enum, 나머지는 라벨 변환 양호 | High(필터만) |
| `/dashboard/content` | 문제 없음 | Low |
| `/dashboard/rewrite`, `/dashboard/social-performance` | 유사 패턴 추정, 다음 Phase 재확인 | 추정 Medium |
| `/trends` | PlatformBadge 중복 구현 | Medium |

## 8. 카드별 문제 요약

| 카드 유형 | 핵심 문제 | Severity |
|---|---|---|
| WordPress 블로그 | `WordPressPublishingPanel` raw 상태/ID 대량 상시노출, article.status 미번역, 액션 소스 3곳 이상 | **Critical** |
| 네이버 블로그 | WordPress 패널 없어 상대적으로 양호, "다음 작업"이 export로만 제한적 | Medium |
| 네이버 카페/Threads/Instagram | Level 분리 양호(governance rule 반영), 버튼 개수는 많으나 위계 명확 | Low~Medium |
| X | 본문 수정 시 상세 페이지 이동 필요 (다른 플랫폼과 불일치) | High |
| 언론기사/해설기사/칼럼 | naver_blog와 동일 구조 공유, export 버튼 동작 불명확 | Medium |
| 기사 목록 카드(`/articles`) | 상태 라벨에 raw enum 병기 | Medium |
| rewrite 카드 | 조사 공백 — 다음 Phase 확인 필요 | 미정 |

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
- 자동화 가능하나 미구현: status 한국어 변환의 전면 적용(헬퍼는 있으나 일부 화면 미적용), markdown/HTML 잔여물 정리 서비스, PlatformBadge 라벨 통합
- 사용자 판단 필요(자동화 부적절): SEO provider 선택, WordPress Draft 생성 실행, 실제 공개 게시

## 12. 공통 컴포넌트 후보 (요약)

| 후보 | 분류 |
|---|---|
| JobProgressCard | 그대로 재사용 가능 (이미 모범 구현) |
| CopyPostBodyButton | 그대로 재사용 가능 |
| RelatedLinks (`RelatedPostLinks`) | 그대로 재사용 가능 |
| tone label helper | 그대로 재사용 가능 |
| status label helper | 그대로 재사용 가능하나 적용 범위 확대 필요 |
| UnifiedPostBodyViewer | 약간 수정하면 공통화 가능 (`SocialPostBodyPanel` 기반 확장) |
| NextActionPanel | 약간 수정하면 공통화 가능 (3개 유사 로직 인터페이스 통일) |
| FinalApprovalPanel | 약간 수정하면 공통화 가능 |
| PlatformPublishPreview | 약간 수정하면 공통화 가능 |
| InlinePostBodyEditor | 중복 구현되어 있음 |
| WordPressPublishPrepCard | 중복 구현되어 있음 (패널 안에 또 패널) |
| AutoReviewSummaryCard | 중복 구현되어 있음 |
| AdvancedDetails | 새 공통 컴포넌트 필요 |
| HumanReviewPanel | 새 공통 컴포넌트 필요 |
| WorkflowStatusCard | 새 공통 컴포넌트 필요 (부분적으로 `/dashboard`에 유사 구현 있음, 추출 필요) |

## 13. 우선순위 개선안 (요약, 상세는 roadmap 문서)

1. **(Critical, 최우선)** `app/articles/[id]/page.tsx`의 env var/raw 필드 노출 제거 및 "테스트"라는 라벨로 실제 공개 게시가 실행되는 버튼 문구·플로우 수정
2. **(Critical)** `WordPressPublishingPanel`을 기본 접힘(`AdvancedDetails`)으로 전환하고 raw 필드를 라벨 헬퍼로 변환
3. **(High)** status label helper를 `/dashboard/blog`, `/dashboard/rewrite`, `/articles/[id]`, `/articles/[id]/blog`에 전면 적용
4. **(High)** `AdvancedDetails` 공통 컴포넌트 신설 후 4개 페이지의 개별 구현 통합
5. **(Medium)** `AutoReviewSummaryCard`, `InlinePostBodyEditor` 중복 제거 및 공통화

세부 로드맵은 `docs/ux/ux-refactor-roadmap.md` 참고.
