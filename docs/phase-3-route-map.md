# Phase 3 Route Map

Phase 3에서 추가/확장된 라우트를 정리한다. Phase 1~2의 `/`,
`/themes/[themeId]`, `/trends`, `/articles` 목록 라우트는 이 문서
범위에 포함하지 않는다(변경 없음).

## `/articles/[id]`

- **목적**: 기사 하나의 개요와 하위 워크플로우 진입점.
- **표시 데이터**: 기사 본문, 상태, 관련 social post 개수 요약.
- **주요 버튼**: blog/social/rewrite/performance/ab-tests 하위
  페이지로 이동하는 링크.
- **연결 workflow**: 모든 Phase 3 워크플로우의 시작점.
- **주의사항**: 기사 상태(`draft/reviewed/published`) 전환은 이
  페이지가 아니라 Phase 1~2의 승인 흐름을 그대로 따른다.

## `/articles/[id]/blog`

- **목적**: 블로그형 플랫폼(wordpress_blog, naver_blog) social post
  관리.
- **표시 데이터**: 플랫폼별 초안, quality/approval/export/guard/
  dry-run/handoff/manual post/metrics 상태.
- **주요 버튼**: 초안 생성, 품질검사, 승인 요청, Manual Export,
  Publishing Guard 실행, Dry-run 생성, Handoff 완료, 게시 결과
  기록, Metrics 입력.
- **연결 workflow**: 운영 매뉴얼 5~13단계.
- **주의사항**: 실제 게시 버튼 없음 — 모두 준비/기록 단계.

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
