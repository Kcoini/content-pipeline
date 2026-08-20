# Phase 3 Route Map

Phase 3에서 추가/확장된 라우트를 정리한다. Phase 1~2의 `/`,
`/themes/[themeId]`, `/trends`, `/articles` 목록 라우트는 이 문서
범위에 포함하지 않는다(변경 없음).

## `/articles/[id]`

- **목적**: **원본 article 관리.** 기사 하나의 개요와 하위 워크플로우
  진입점. article은 WordPress 블로그형 글이 아니다 — WordPress
  게시의 기본 대상은 `/articles/[id]/blog`의 `wordpress_blog` 글이다.
- **표시 데이터**: 기사 본문, 상태, 관련 social post 개수 요약.
- **주요 버튼**: blog/social/rewrite/performance/ab-tests 하위
  페이지로 이동하는 링크. "고급 기능: 원본 article WordPress 전송"
  (접이식) — Phase 2의 WordPress Metadata/SEO Plugin/Featured
  Image/Connection Test/WordPress Draft/Public Publish가 여기 모여
  있으며, article 본문을 그대로 WordPress로 보내는 **보조 기능**이다.
  섹션 맨 위에는 `/articles/[id]/blog`와 같은 공통 컴포넌트
  (`components/wordpress/wordpress-publishing-panel.tsx`,
  `targetType="article"`, `isPrimaryWorkflow={false}` → "대상: 원본
  article" + "보조 기능"/"고급 기능" 배지)로 요약을 보여준다.
  이 섹션 안에 **"대표 이미지 없이 진행"**(article 원본 전송 전용
  waive) 버튼이 있다 — 사유 선택 필수, 확인 문구 표시 후에만
  제출되며, Publish Quality Gate의 featured image 항목을 hard
  fail이 아니라 warning으로 바꾼다. `/articles/[id]/blog`의
  wordpress_blog 카드에 있는 같은 이름의 기능과는 저장 위치/상태가
  완전히 독립적이다(자세한 내용은 아래 및
  [`article-blog-wordpress-workflow.md`](./article-blog-wordpress-workflow.md) 참고).
- **연결 workflow**: 모든 Phase 3 워크플로우의 시작점.
- **주의사항**: 기사 상태(`draft/reviewed/published`) 전환은 이
  페이지가 아니라 Phase 1~2의 승인 흐름을 그대로 따른다. "고급
  기능" 섹션은 기존 Phase 2 동작을 그대로 유지한다(이름/배치만
  변경) — 유일한 예외는 "대표 이미지 없이 진행" waive가 Publish
  Quality Gate의 featured image 판정에 영향을 준다는 점이다.

## `/articles/[id]/blog`

- **목적**: **플랫폼별 블로그 게시용 글 관리.** 블로그형 플랫폼
  (wordpress_blog, naver_blog) social post 관리. **WordPress 게시의
  기본(메인) 대상은 이 페이지의 wordpress_blog 글이다.**
- **표시 데이터**: 플랫폼별 초안, quality/approval/export/guard/
  dry-run/handoff/manual post/metrics 상태. `wordpress_blog` 카드는
  추가로 article 페이지와 같은 공통 컴포넌트(`WordPressPublishingPanel`,
  `targetType="wordpress_blog"`, `isPrimaryWorkflow={true}` → "대상:
  wordpress_blog" + "기본 게시 흐름" 배지)로 **"WordPress 게시 준비"
  섹션**(draft 상태/post ID/URL, SEO metadata 상태/seoTitle/
  metaDescription/targetKeyword, featured image 상태/media ID/attach
  status/waived 여부, publish guard 상태, quality/approval 상태)을
  표시한다. `naver_blog` 카드는 콘텐츠 안전 점검(`{#...}` anchor
  아티팩트/가짜 서명)을 표시한다.
- **주요 버튼**: 초안 생성, 품질검사, 승인 요청, Manual Export,
  게시 결과 기록, Metrics 입력(공통). `wordpress_blog`에만: 게시
  가능 상태 확인(예전 WordPress 게시 준비 확인), Publishing Guard
  실행, 게시 전 미리보기 생성(예전 Dry-run 생성), 수동 게시 완료
  표시(예전 Handoff 완료), WordPress Draft 생성/업데이트, SEO
  Metadata 업데이트, SEO Metadata 재생성, **SEO Plugin Metadata
  반영**(Rank Math/Yoast/AIOSEO/Custom Endpoint/사용 안 함 provider
  선택), 대표 이미지 정보 저장/로컬 업로드/**AI 이미지 생성**(prompt
  생성 + 실제 생성)/연결, 대표 이미지 없이 진행(wordpress_blog 게시
  준비 전용 waive — `/articles/[id]`의 article 원본 전송 waive와는
  독립적), **게시 준비 자동 실행**(예전 WordPress 게시 준비 일괄
  실행, 모두 readiness 통과 시에만 활성화). `naver_blog`에는
  WordPress 관련 버튼이 표시되지 않는다.
  이 버튼들은 화면에서 단순 나열되지 않고 "단계별 상태 요약" →
  "다음 추천 작업" → 게시 준비 자동 실행 → Step 1(품질검사)~
  Step 7(체크리스트/Handoff)의 단계형 workflow UI로 구성된다
  (자세한 구성은 `docs/article-blog-wordpress-workflow.md` 참고).
  Step 5(대표 이미지) 안에서 파일 선택/업로드/Media ID 저장/연결/
  이미지 없이 진행까지 카드 이탈 없이 끝낼 수 있다 — 파일 선택 시
  파일명/크기/형식/업로드 가능 여부와 미리보기를
  `components/social/wordpress-featured-image-file-picker.tsx`
  (`"use client"`)가 같은 카드 안에서 보여주고, 업로드 후에도
  `returnTo`(highlight 포함)로 같은 카드 위치로 돌아온다.
  `naver_blog`에는 이 이미지 업로드 UI가 없다.
  Step 7의 체크리스트 항목 status는 저장된 pending을 그대로
  보여주지 않고 `lib/social/manual-posting-checklist-status.ts`가
  지금 social_post 상태 기준으로 완료/확인 필요/대기중/차단됨/
  실패/생략 중 하나로 다시 계산한다 — handoff가 완료됐는데 체크리스트가
  전부 대기중으로 보이는 모순을 없앤다(자세한 상태 기준은
  `docs/article-blog-wordpress-workflow.md` 참고). "확인 필요"
  항목은 오류가 아니라 사람이 직접 확인해야 하는 수동 검토
  단계이며, 각 항목마다 설명/할 일 안내와 함께
  **확인 완료 표시 버튼**(`markManualChecklistItemConfirmedAction`
  → `social_posts.platformMetadata.manualChecklistConfirmations`,
  DB schema 변경 없음)이 있다(시스템 자동 항목은 제외). "게시 후
  URL 기록 필요" 항목은 기존 `recordManualPostingResultAction`을
  재사용한 URL 입력/저장 폼과, URL이 있으면 나타나는
  `components/social/copy-url-button.tsx`(`"use client"`, 서버
  저장 없음) 복사 버튼으로 처리한다.
- **연결 workflow**: 운영 매뉴얼 5~13단계.
- **주의사항**: SEO metadata/featured image/draft 상태는 여전히
  article 단위(DB 스키마 변경 없이 처리하기 위한 절충)에 저장되지만,
  화면 표시와 액션 트리거는 모두 wordpress_blog 카드 안에서
  끝난다 — article 페이지로 이동할 필요가 없다. "WordPress Draft
  업데이트"는 실제 PATCH API가 없어 재생성 방식으로 동작한다.
  자세한 한계는
  [`article-blog-wordpress-workflow.md`](./article-blog-wordpress-workflow.md)
  참고. 그 외에는 실제 공개 게시 버튼 없음 — 모두 준비/기록 단계.

## `/articles/[id]/social`

- **목적**: SNS/커뮤니티형 플랫폼(naver_cafe, x, threads,
  instagram) social post 관리.
- **표시 데이터**: `/blog`와 동일한 구조, 플랫폼만 다름.
- **주요 버튼**: `/blog`와 동일.
- **연결 workflow**: 운영 매뉴얼 5~13단계.
- **주의사항**: `/blog`와 동일.

## `/articles/[id]/rewrite`

- **목적**: 성과 기반 rewrite 제안/적용/비교/재승인/재export.
- **표시 데이터**: rewrite 제안 목록, 버전 이력, 버전 비교 결과,
  재승인/재export 상태, rewrite-vs-원본 성과 비교.
- **주요 버튼**: 제안 생성, 버전 적용, 버전 비교 실행, 재승인
  요청/승인, 재export.
- **연결 workflow**: 운영 매뉴얼 15~19단계.
- **주의사항**: 재승인 없이 재export가 진행되면 안 된다 —
  automation safety review가 이 정합성을 감사한다.

## `/articles/[id]/performance`

- **목적**: article에 속한 social post들의 성과 확인.
- **표시 데이터**: 수동 입력된 metrics, 계산된 성과 점수/상태.
- **주요 버튼**: metrics 입력 페이지로 이동하는 링크.
- **연결 workflow**: 운영 매뉴얼 14단계.
- **주의사항**: 자동 수집된 값이 아니다 — 모두 수동 입력 기반.

## `/articles/[id]/ab-tests`

- **목적**: variant를 묶은 A/B 테스트 draft 관리.
- **표시 데이터**: 테스트 상태, variant 목록, 비교 결과(수동 입력
  metrics 기반).
- **주요 버튼**: draft 생성, variant 추가, 상태 전환(ready/started/
  paused/completed/cancelled), 비교 실행.
- **연결 workflow**: 운영 매뉴얼 20단계.
- **주의사항**: 자동 게시/자동 승자 판정을 실행하지 않는다 — draft
  구조일 뿐이다.

## `/social-posts/[id]`

- **목적**: social post 하나의 상세 화면(딥링크 대상).
- **표시 데이터**: 해당 social post의 전체 상태와 이력.
- **주요 버튼**: 원본 article/관련 워크플로우로 돌아가는 링크.
- **연결 workflow**: 다른 목록/대시보드에서의 딥링크 진입점.
- **주의사항**: 없음.

## `/dashboard/content`

- **목적**: article 단위로 전체 콘텐츠 상태를 모아보는 대시보드.
- **표시 데이터**: article별 social post 상태 요약.
- **주요 버튼**: 각 article/블로그/소셜 페이지로 이동하는 링크.
- **연결 workflow**: 전체 현황 파악용 진입점.
- **주의사항**: 없음.

## `/dashboard/blog`

- **목적**: 블로그형 social post 전체를 모아보는 대시보드.
- **표시 데이터**: 상태별/플랫폼별 집계.
- **주요 버튼**: 각 social post/article로 이동하는 링크.
- **연결 workflow**: `/articles/[id]/blog`의 상위 뷰.
- **주의사항**: 없음.

## `/dashboard/rewrite`

- **목적**: rewrite 워크플로우 상태를 모아보는 대시보드.
- **표시 데이터**: 제안/적용/비교/재승인 상태별 집계.
- **주요 버튼**: 각 article/rewrite 페이지로 이동하는 링크.
- **연결 workflow**: `/articles/[id]/rewrite`의 상위 뷰.
- **주의사항**: 없음.

## `/dashboard/social-performance`

- **목적**: 플랫폼/문체별 성과, 차트, rewrite 비교를 모아보는
  성과 대시보드.
- **표시 데이터**: 성과 점수 분포, 트렌드 차트, 저성과 항목, rewrite
  비교 요약.
- **주요 버튼**: 필터 컨트롤, 각 article/performance 페이지 링크.
- **연결 workflow**: `/articles/[id]/performance`의 상위 뷰.
- **주의사항**: 모두 수동 입력 metrics 기반 계산 결과다.

## `/dashboard/platform-api`

- **목적**: 플랫폼별 API 게시 준비 상태 확인.
- **표시 데이터**: capability matrix, readiness 상태, 설정 누락
  여부, fallback mode.
- **주요 버튼**: 없음(조회 전용).
- **연결 workflow**: Phase 3-21 API publish preparation.
- **주의사항**: 실제 게시 버튼 없음. 토큰/키 값을 표시하지 않는다.

## `/dashboard/automation-safety`

- **목적**: 전체 워크플로우에 대한 자동화 안전 점검.
- **표시 데이터**: 전체 상태, 카테고리별 상태, checklist, findings,
  recommendations.
- **주요 버튼**: "Safety Review 실행", "최근 로그 보안 점검",
  "게시 workflow 점검", "feature flag 점검"(모두 페이지 재검증만
  수행).
- **연결 workflow**: Phase 3-22 automation safety review.
- **주의사항**: 실제 게시 버튼, 자동 수정 버튼 없음. 점검 결과를
  DB에 저장하지 않는다.

## 관련 문서

- 운영 매뉴얼: [`phase-3-operation-manual.md`](./phase-3-operation-manual.md)
- 아키텍처: [`phase-3-architecture.md`](./phase-3-architecture.md)
