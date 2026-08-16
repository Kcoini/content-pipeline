# Phase 3 Database Migrations

Phase 3(3-1~3-22)에서 추가된 migration만 정리한다. Phase 3-22는
"가능하면 migration 없이 진행"하기로 결정해 별도 migration 파일이
없다. 파일명은 실제 `db/migrations/` 디렉터리와 일치한다.

## 028_phase-3-1-multi-platform-writing-foundation.sql

- **추가 테이블**: `social_posts`, `social_post_quality_runs`,
  `social_post_approvals`
- **목적**: 플랫폼별/문체별 social post 저장 구조의 기초.
- **관련 Phase**: 3-1

## 029_phase-3-4-social-post-review-editing-workflow.sql

- **추가 컬럼(social_posts)**: `edited_at`, `edited_by`,
  `review_notes`, `revision_count`, `last_quality_checked_at`,
  `approval_requested_at`, `rejection_reason`, `revoked_at`,
  `revoked_reason`
- **목적**: 검수/수정/승인 요청·거절·철회 이력 저장.
- **관련 Phase**: 3-4

## 030_phase-3-5-manual-export-copy-workflow.sql

- **추가 컬럼(social_posts)**: `export_status`, `exported_at`,
  `exported_by`, `export_error`, `export_copy_count`,
  `last_copied_at`, `export_notes`
- **목적**: 수동 export(복사) 진행 상태 추적.
- **관련 Phase**: 3-5

## 031_phase-3-6-platform-publishing-guard.sql

- **추가 컬럼(social_posts)**: `platform_publish_guard_status`,
  `platform_publish_guard_score`, `platform_publish_guard_summary`,
  `platform_publish_guard_error`, `platform_publish_guard_checked_at`,
  `platform_publish_ready`, `platform_publish_blocked_reason`
- **목적**: 게시 전 규칙 기반 가드 결과 저장.
- **관련 Phase**: 3-6

## 032_phase-3-7-platform-publish-dry-run-export-handoff.sql

- **추가 컬럼(social_posts)**: `platform_publish_dry_run_status`,
  `platform_publish_dry_run_payload`, `platform_publish_dry_run_error`,
  `platform_publish_dry_run_created_at`,
  `platform_publish_dry_run_created_by`, `handoff_status`,
  `handoff_payload`, `handoff_notes`, `handoff_completed_at`,
  `handoff_completed_by`, `handoff_error`
- **목적**: dry-run payload 생성 및 수동 게시 인계(handoff) 상태.
- **관련 Phase**: 3-7

## 033_phase-3-8-platform-manual-posting-result-recording.sql

- **추가 컬럼(social_posts)**: `manual_post_status`,
  `manual_post_url`, `manual_posted_at`, `manual_posted_by`,
  `manual_post_result_notes`, `manual_post_error`,
  `manual_post_recorded_at`, `manual_post_recorded_by`,
  `manual_post_checklist`
- **목적**: 사람이 실제 플랫폼에 게시한 결과를 기록.
- **관련 Phase**: 3-8

## 034_phase-3-9-social-metrics-manual-input-performance-tracking.sql

- **추가 테이블**: `social_post_metrics`
- **추가 컬럼(social_posts)**: `latest_metrics_id`,
  `latest_metrics_recorded_at`, `latest_views`,
  `latest_impressions`, `latest_likes`, `latest_comments`,
  `latest_shares`, `latest_saves`, `latest_clicks`,
  `latest_engagement_rate`, `latest_click_through_rate`,
  `latest_performance_score`, `performance_status`
- **목적**: 수동 입력 metrics 저장 및 최신 요약 캐시.
- **관련 Phase**: 3-9

## 035_phase-3-10-performance-based-rewrite-suggestion.sql

- **추가 테이블**: `social_post_rewrite_suggestions`
- **추가 컬럼(social_posts)**: `latest_rewrite_suggestion_id`,
  `rewrite_suggestion_status`, `rewrite_suggestion_count`,
  `latest_rewrite_suggested_at`
- **목적**: 성과 기반 rewrite 제안 저장.
- **관련 Phase**: 3-10

## 036_phase-3-11-rewrite-application-versioning-workflow.sql

- **추가 테이블**: `social_post_versions`
- **추가 컬럼(social_posts)**: `parent_social_post_id`,
  `root_social_post_id`, `version_number`, `version_label`,
  `version_status`, `rewrite_source_suggestion_id`,
  `rewrite_applied_from_social_post_id`, `rewrite_applied_at`,
  `rewrite_applied_by`, `rewrite_application_notes`,
  `is_rewrite_version`
- **추가 컬럼(social_post_rewrite_suggestions)**:
  `applied_social_post_id`, `application_status`,
  `application_error`, `application_notes`
- **목적**: rewrite 적용 시 새 버전 row 생성(원본 비파괴).
- **관련 Phase**: 3-11

## 037_phase-3-12-rewrite-version-quality-recheck-comparison.sql

- **추가 테이블**: `social_post_version_comparisons`
- **추가 컬럼(social_posts)**: `latest_version_comparison_id`,
  `version_comparison_status`, `version_comparison_score`,
  `recommended_for_repost`, `version_comparison_checked_at`
- **목적**: 버전 간 품질 재검사 및 비교 결과 저장.
- **관련 Phase**: 3-12

## 038_phase-3-13-rewrite-reapproval-reexport-workflow.sql

- **추가 컬럼(social_posts)**: `rewrite_reapproval_status`,
  `rewrite_reapproval_requested_at`,
  `rewrite_reapproval_requested_by`, `rewrite_reapproved_at`,
  `rewrite_reapproved_by`, `rewrite_reapproval_notes`,
  `rewrite_reapproval_error`, `rewrite_reexport_status`,
  `rewrite_reexported_at`, `rewrite_reexported_by`,
  `rewrite_reexport_error`, `rewrite_republish_workflow_status`,
  `rewrite_republish_workflow_summary`
- **목적**: rewrite version 재승인 없이는 재export할 수 없도록
  별도 승인 트랙 추가.
- **관련 Phase**: 3-13

## 039_phase-3-14-rewrite-performance-tracking-original-vs-rewrite-comparison.sql

- **추가 테이블**: `social_rewrite_performance_comparisons`
- **추가 컬럼(social_posts)**:
  `latest_rewrite_performance_comparison_id`,
  `rewrite_performance_comparison_status`,
  `rewrite_performance_winner`, `rewrite_performance_score_delta`,
  `rewrite_performance_improvement_rate`,
  `rewrite_performance_checked_at`, `rewrite_performance_summary`
- **목적**: 원본 vs rewrite 실제 성과(수동 입력 metrics 기준) 비교.
- **관련 Phase**: 3-14

## 040_phase-3-20-ab-testing-draft-structure.sql

- **추가 테이블**: `social_ab_tests`, `social_ab_test_variants`
- **추가 컬럼(social_posts)**: `ab_test_status`, `latest_ab_test_id`,
  `ab_test_variant_role`, `ab_test_variant_label`
- **목적**: A/B 테스트 draft 구조(자동 실행 아님).
- **관련 Phase**: 3-20

## 041_phase-3-21-platform-api-publishing-preparation.sql

- **추가 컬럼(social_posts)**: `api_publish_preparation_status`,
  `api_publish_readiness_status`, `api_publish_eligible_for_dry_run`,
  `api_publish_eligible_for_actual_publish`,
  `api_publish_preparation_summary`, `api_publish_prepared_at`,
  `api_publish_prepared_by`, `api_publish_blocked_reason`
- **목적**: 플랫폼 API 게시 준비 상태 요약 저장(실제 게시 아님).
- **관련 Phase**: 3-21

## Phase 3-22: migration 없음

Automation Safety Review(Phase 3-22)는 결과를 DB에 저장하지 않기로
결정해 별도 migration을 추가하지 않았다. `runAutomationSafetyReview()`는
매 호출마다 최신 상태를 계산해 반환하는 순수 조회 함수다. 필요해지면
`automation_safety_review_runs` 테이블을 추가해 이력을 저장할 수
있다(자세한 내용은
[`phase-3-22-automation-safety-review.md`](./phase-3-22-automation-safety-review.md) 참고).

## 관련 문서

- 아키텍처: [`phase-3-architecture.md`](./phase-3-architecture.md)
- 안전 체크리스트: [`phase-3-safety-checklist.md`](./phase-3-safety-checklist.md)
