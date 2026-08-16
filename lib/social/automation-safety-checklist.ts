// Phase 3-22: Automation Safety Review — 정적 체크리스트 정의.
// 이 파일은 DB나 환경변수를 조회하지 않는다. 순수 상수 데이터이며,
// automation-safety-review-service가 각 항목을 실제 auditor 결과와
// 매칭해 상태를 채운다.

import type { AutomationSafetyReviewChecklistItem } from "./automation-safety-review-types";

export const AUTOMATION_SAFETY_CHECKLIST: AutomationSafetyReviewChecklistItem[] = [
  // feature_flags
  {
    id: "feature_flags.platform_api_publishing_enabled_default_false",
    category: "feature_flags",
    label: "PLATFORM_API_PUBLISHING_ENABLED 기본값 false",
    description: "PLATFORM_API_PUBLISHING_ENABLED가 설정되지 않았거나 명시적으로 false여야 한다.",
  },
  {
    id: "feature_flags.platform_api_dry_run_only_default_true",
    category: "feature_flags",
    label: "PLATFORM_API_DRY_RUN_ONLY 기본값 true",
    description: "PLATFORM_API_DRY_RUN_ONLY는 dry-run만 허용하도록 기본 true여야 한다.",
  },
  {
    id: "feature_flags.per_platform_publish_flags_default_false",
    category: "feature_flags",
    label: "플랫폼별 API 게시 flag 기본값 false",
    description:
      "X_API_PUBLISH_ENABLED, THREADS_API_PUBLISH_ENABLED, INSTAGRAM_API_PUBLISH_ENABLED, NAVER_BLOG_API_PUBLISH_ENABLED, NAVER_CAFE_API_PUBLISH_ENABLED, WORDPRESS_API_PUBLISH_ENABLED가 모두 false여야 한다.",
  },
  {
    id: "feature_flags.social_publish_enabled_default_false",
    category: "feature_flags",
    label: "SOCIAL_PUBLISH_ENABLED 기본값 false",
    description: "SOCIAL_PUBLISH_ENABLED가 설정되지 않았거나 명시적으로 false여야 한다.",
  },
  // approval_gates
  {
    id: "approval_gates.quality_ready_required",
    category: "approval_gates",
    label: "quality_status='ready' 필요",
    description: "게시 준비 항목은 quality_status가 ready여야 한다.",
  },
  {
    id: "approval_gates.approval_approved_required",
    category: "approval_gates",
    label: "approval_status='approved' 필요",
    description: "게시 준비 항목은 approval_status가 approved여야 한다.",
  },
  {
    id: "approval_gates.rejected_revoked_blocks_publish",
    category: "approval_gates",
    label: "rejected/revoked 상태는 게시를 차단",
    description: "approval_status 또는 rewrite_reapproval_status가 rejected/revoked면 게시가 차단되어야 한다.",
  },
  {
    id: "approval_gates.rewrite_version_needs_reapproval",
    category: "approval_gates",
    label: "rewrite version 재승인 필요",
    description: "rewrite version은 재export 전에 재승인(rewrite_reapproval_status=approved)이 필요하다.",
  },
  {
    id: "approval_gates.ab_test_variant_needs_existing_workflow",
    category: "approval_gates",
    label: "A/B 테스트 variant도 기존 승인 workflow를 따름",
    description: "A/B 테스트 variant 게시도 기존 approval workflow를 우회하지 않아야 한다.",
  },
  // publish_guards
  {
    id: "publish_guards.platform_publish_guard_ready",
    category: "publish_guards",
    label: "platform_publish_guard_status='ready'",
    description: "게시 가드 상태가 ready여야 실제 게시 후보가 될 수 있다.",
  },
  {
    id: "publish_guards.platform_publish_ready_flag",
    category: "publish_guards",
    label: "platform_publish_ready=true 정합성",
    description: "platform_publish_ready가 true이면 가드 상태도 ready여야 한다.",
  },
  {
    id: "publish_guards.dry_run_status_ready",
    category: "publish_guards",
    label: "platform_publish_dry_run_status='ready'",
    description: "dry-run 상태가 ready여야 handoff가 완료될 수 있다.",
  },
  {
    id: "publish_guards.handoff_status_check",
    category: "publish_guards",
    label: "handoff_status 점검",
    description: "handoff가 dry-run 준비 없이 완료 상태가 되지 않아야 한다.",
  },
  {
    id: "publish_guards.publish_status_duplicate_block",
    category: "publish_guards",
    label: "publish_status='published' 중복 게시 차단",
    description: "이미 published인 항목은 중복 게시되지 않아야 한다.",
  },
  {
    id: "publish_guards.manual_post_status_duplicate_block",
    category: "publish_guards",
    label: "manual_post_status='posted' 중복 게시 차단",
    description: "이미 posted인 항목은 중복 게시되지 않아야 한다.",
  },
  // api_publish
  {
    id: "api_publish.actual_publish_disabled",
    category: "api_publish",
    label: "실제 게시 비활성화",
    description: "어떤 platform adapter도 실제 외부 API 게시를 실행하지 않아야 한다.",
  },
  {
    id: "api_publish.dry_run_only",
    category: "api_publish",
    label: "dry-run만 허용",
    description: "API 게시 준비 단계는 dry-run payload 생성까지만 허용된다.",
  },
  {
    id: "api_publish.adapter_returns_disabled",
    category: "api_publish",
    label: "adapter publish는 disabled/not implemented 반환",
    description: "platform-publish-adapter의 publish 함수는 항상 disabled 또는 not implemented 결과를 반환해야 한다.",
  },
  {
    id: "api_publish.no_external_fetch",
    category: "api_publish",
    label: "외부 fetch 호출 없음",
    description: "adapter 코드가 실제 외부 API로 fetch를 호출하지 않아야 한다.",
  },
  {
    id: "api_publish.readiness_check_no_token_exposure",
    category: "api_publish",
    label: "readiness check가 토큰 값을 노출하지 않음",
    description: "readiness checker 결과는 환경변수 이름/설정 여부만 담고 실제 값을 담지 않아야 한다.",
  },
  // logging_security
  {
    id: "logging_security.no_secret_values",
    category: "logging_security",
    label: "API key/토큰/Authorization header 미저장",
    description: "pipeline_logs에 API key, access token, refresh token, Authorization header, Application Password가 저장되지 않아야 한다.",
  },
  {
    id: "logging_security.no_full_payload",
    category: "logging_security",
    label: "전체 payload 미저장",
    description: "full post_body, full caption, full export_payload, full dry-run payload, full API payload가 저장되지 않아야 한다.",
  },
  // content_safety
  {
    id: "content_safety.no_threat_or_fear",
    category: "content_safety",
    label: "위협/공포 조장 표현 없음",
    description: "생성된 콘텐츠에 위협, 공포 조장 표현이 없어야 한다.",
  },
  {
    id: "content_safety.no_false_or_exaggerated_claims",
    category: "content_safety",
    label: "허위/과장 표현 없음",
    description: "허위 사실, 과장된 수익 주장, 클릭 유도 문구가 없어야 한다.",
  },
  {
    id: "content_safety.no_personal_info_or_defamation",
    category: "content_safety",
    label: "개인정보 노출/명예훼손 없음",
    description: "개인정보 노출, 명예훼손성 표현이 없어야 한다.",
  },
  {
    id: "content_safety.forbidden_pattern_checker_exists",
    category: "content_safety",
    label: "금지 표현 검사기 존재",
    description: "금지 표현을 검사하는 검사기가 코드베이스에 존재해야 한다.",
  },
  // data_integrity
  {
    id: "data_integrity.no_original_article_deletion",
    category: "data_integrity",
    label: "원본 article 삭제 없음",
    description: "안전 점검 및 관련 workflow는 원본 article을 삭제하지 않는다.",
  },
  {
    id: "data_integrity.no_original_social_post_overwrite",
    category: "data_integrity",
    label: "원본 social_post 덮어쓰기 없음",
    description: "rewrite version은 새 row로 저장되고 원본을 덮어쓰지 않는다.",
  },
  {
    id: "data_integrity.metrics_marked_manual",
    category: "data_integrity",
    label: "metrics는 수동 입력으로 표시",
    description: "metrics는 자동 수집이 아닌 수동 입력으로 표시되어야 한다.",
  },
  {
    id: "data_integrity.ab_test_separated_from_auto_publish",
    category: "data_integrity",
    label: "A/B 테스트는 자동 게시와 분리",
    description: "A/B 테스트 workflow는 자동 게시 기능과 분리되어야 한다.",
  },
  // rollback
  {
    id: "rollback.pre_actual_publish_criteria_documented",
    category: "rollback",
    label: "실제 게시 이전 단계 rollback 기준 문서화",
    description: "실제 API 게시 이전 단계에 대한 rollback 기준이 문서화되어야 한다.",
  },
  {
    id: "rollback.published_status_change_needs_manual_confirmation",
    category: "rollback",
    label: "published 상태 변경은 수동 확인 필요",
    description: "published 상태 변경은 외부 플랫폼 실제 상태를 수동으로 확인한 후 이뤄져야 한다.",
  },
  {
    id: "rollback.failed_blocked_recovery_criteria_documented",
    category: "rollback",
    label: "failed/blocked 복구 기준 문서화",
    description: "failed/blocked 상태의 복구 기준이 문서화되어야 한다.",
  },
  {
    id: "rollback.accidental_publish_prevention_documented",
    category: "rollback",
    label: "실수 게시 방지 기준 문서화",
    description: "실수로 실제 게시가 활성화된 경우의 대응 기준이 문서화되어야 한다.",
  },
  // manual_workflow
  {
    id: "manual_workflow.manual_export_handoff_maintained",
    category: "manual_workflow",
    label: "수동 export/handoff workflow 유지",
    description: "기존 수동 export/handoff workflow가 계속 유지되어야 한다.",
  },
  {
    id: "manual_workflow.manual_posting_result_maintained",
    category: "manual_workflow",
    label: "수동 게시 결과 입력 workflow 유지",
    description: "수동 게시 결과(manual_post_status) 입력 workflow가 유지되어야 한다.",
  },
  {
    id: "manual_workflow.metrics_manual_input_maintained",
    category: "manual_workflow",
    label: "metrics 수동 입력 workflow 유지",
    description: "metrics 수동 입력 workflow가 유지되어야 한다.",
  },
  // environment
  {
    id: "environment.env_example_has_no_real_secrets",
    category: "environment",
    label: ".env.example에 실제 비밀값 없음",
    description: ".env.example에는 실제 API key/토큰 값이 아닌 placeholder만 있어야 한다.",
  },
];
