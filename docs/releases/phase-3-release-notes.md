# Release Notes: Phase 3 Multi-platform Content Operations Pipeline

## 릴리즈 요약

기사(article) 한 편을 여러 플랫폼(WordPress Blog, Naver Blog,
Naver Cafe, X, Threads, Instagram)에 맞는 글로 다시 쓰고, 사람이
검수·승인한 뒤, 수동으로 안전하게 게시할 수 있도록 지원하는 콘텐츠
운영 파이프라인이다. 성과를 수동으로 입력해 확인하고, 성과 기반
rewrite 제안/버전 관리/비교, A/B 테스트 draft, 플랫폼 API 게시
준비, 자동화 안전 점검까지 Phase 3-1부터 3-22까지 순차적으로
구축했다.

## 주요 기능

- 8종 문체(explanatory/informational/persuasive/warning/
  loss_aversion/curiosity/comparison/story) × 6개 플랫폼 조합의
  social post 초안 생성
- 검수/수정/승인 워크플로우
- 수동 export(복사용 payload), 게시 전 안전 가드, dry-run, handoff
- 수동 게시 결과 기록, 수동 metrics 입력, 성과 점수 계산
- 성과 기반 rewrite 제안 → 버전 적용(원본 비파괴) → 버전 비교 →
  재승인/재export → rewrite-vs-원본 성과 비교
- 콘텐츠/블로그/rewrite/social performance 대시보드와 차트 시각화
- A/B 테스트 draft 구조(자동 실행 없음)
- 플랫폼 API 게시 준비(capability matrix, readiness checker,
  eligibility guard, dry-run payload builder, adapter skeleton —
  실제 게시는 비활성화)
- automation safety review(feature flag, 승인/가드 정합성, 로깅
  보안, 콘텐츠 안전 규칙에 대한 read-only 점검)

## 주요 UI 변경

- `/articles/[id]/blog`, `/articles/[id]/social`,
  `/articles/[id]/rewrite`, `/articles/[id]/performance`,
  `/articles/[id]/ab-tests` 신설
- `/social-posts/[id]` 상세 라우트 및 딥링크 지원
- `/dashboard/content`, `/dashboard/blog`, `/dashboard/rewrite`,
  `/dashboard/social-performance`, `/dashboard/platform-api`,
  `/dashboard/automation-safety` 대시보드 신설
- returnTo 기반 네비게이션 복귀, 페이지네이션, 대시보드 차트 시각화

## 주요 DB 변경

`social_posts`를 중심으로 `social_post_quality_runs`,
`social_post_approvals`, `social_post_metrics`,
`social_post_rewrite_suggestions`, `social_post_versions`,
`social_post_version_comparisons`,
`social_rewrite_performance_comparisons`, `social_ab_tests`,
`social_ab_test_variants` 테이블이 추가됐다. 전체 목록은
[`phase-3-database-migrations.md`](../phase-3-database-migrations.md)
참고. Phase 3-22는 DB 변경이 없다.

## 주요 안전장치

- 모든 실제 API 게시 feature flag는 기본값 false, dry-run-only
  플래그는 기본값 true.
- 어떤 platform adapter도 실제 외부 API를 호출하지 않는다
  (disabled/not implemented만 반환).
- 승인되지 않은 콘텐츠는 export/guard 이후 단계로 진행할 수 없다.
- rewrite는 항상 새 버전 row로 생성되며 원본을 덮어쓰지 않는다.
- API key/토큰/Authorization header/Application Password/전체
  콘텐츠 원문은 로그에 저장하지 않는다.
- automation safety review가 위 항목들을 read-only로 감사하고,
  결과를 `/dashboard/automation-safety`에서 확인할 수 있다.

## 알려진 제한사항

- 실제 platform API publish는 아직 비활성화되어 있다(WordPress
  draft 생성만 예외이며, 이것도 공개 게시가 아니다).
- metrics는 manual input 기반이다(자동 수집 없음).
- A/B test는 draft structure다(자동 트래픽 분배/자동 승자 게시
  없음).
- rewrite comparison은 완전히 동일한 조건에서의 A/B 테스트가
  아니다 — 서로 다른 시점/게시 조건의 수동 입력 metrics를 비교한다.
- Naver Blog/Cafe는 manual export 중심이다.
- X/Threads/Instagram은 preparation only다(OAuth/실제 게시 미구현).

## 다음 Phase 제안

- automation safety review 결과를 DB에 저장해 이력/추세를 확인.
- 플랫폼 하나를 선정해 실제 OAuth 연동과 API 게시를 구현하는 별도
  Phase 진행(Phase 3-22 checklist를 통과 기준으로 사용).
- CI에서 automation safety review를 정기 실행해 critical finding
  발생 시 알림.

## 관련 문서

- 전체 개요: [`../phase-3-final-overview.md`](../phase-3-final-overview.md)
- 릴리즈 체크리스트: [`../phase-3-release-checklist.md`](../phase-3-release-checklist.md)
