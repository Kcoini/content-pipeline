// pipeline_logs / contract_runs 테이블 데이터 접근.
// lib/harness/logger.ts가 이 모듈을 통해 파이프라인 이벤트와 계약 검사 결과를 영속화한다.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ContractRunRow, ContractTargetType, PipelineLogRow } from "@/lib/supabase/database.types";
import type { ContractViolation } from "@/lib/harness/types";

export type LogEventType =
  | "theme_created"
  | "source_added"
  | "contract_checked"
  | "article_draft_created"
  // Phase 1-4: AI 기사 생성 파이프라인 이벤트
  | "ai_mode_selected"
  | "source_summary_started"
  | "source_summary_completed"
  | "article_generation_started"
  | "article_generation_completed"
  | "article_eval_started"
  | "article_eval_completed"
  | "ai_generation_failed"
  // Phase 1-5: 기사 검토/수정/승인 이벤트
  | "article_updated"
  | "article_approved"
  // Phase 1-8: 기사 품질 경고
  | "article_quality_warning"
  // Phase 1-10: 출처별 자동 요약 이벤트
  | "source_summary_failed"
  | "source_summary_skipped"
  | "source_summary_mocked"
  // Phase 1-12: 트렌드 수집 및 테마 추출 이벤트
  | "trend_collection_started"
  | "trend_collection_completed"
  | "trend_collection_failed"
  | "theme_clustering_started"
  | "theme_clustering_completed"
  | "theme_selected"
  | "theme_created_from_cluster"
  // Phase 1-13: 플랫폼별 트렌드 수집 이벤트
  | "naver_trend_collection_started"
  | "naver_trend_collection_completed"
  | "naver_trend_collection_failed"
  | "daum_trend_collection_started"
  | "daum_trend_collection_completed"
  | "daum_trend_collection_failed"
  // Phase 1-13: 기사 URL 후보 수집 이벤트
  | "article_url_collection_started"
  | "article_url_collection_completed"
  | "article_url_collection_failed"
  | "article_url_candidate_selected"
  | "article_url_candidate_imported"
  | "article_url_candidate_dismissed"
  | "source_created_from_candidate"
  // Phase 2-2: WordPress draft publish 이벤트
  | "wordpress_publish_started"
  | "wordpress_publish_completed"
  | "wordpress_publish_failed"
  | "wordpress_publish_dry_run"
  | "wordpress_publish_skipped_not_reviewed"
  | "wordpress_publish_skipped_duplicate"
  // Phase 2-3: WordPress category/tag/SEO metadata 이벤트
  | "wordpress_metadata_generation_started"
  | "wordpress_metadata_generation_completed"
  | "wordpress_metadata_generation_failed"
  | "wordpress_metadata_reviewed"
  | "wordpress_metadata_target_keyword_fallback_used"
  | "wordpress_metadata_target_keyword_missing"
  | "wordpress_category_tag_sync_skipped_dry_run"
  | "wordpress_category_tag_sync_started"
  | "wordpress_category_tag_sync_completed"
  | "wordpress_category_tag_sync_failed"
  // Phase 2-4: SEO plugin metadata mapping 이벤트
  | "seo_plugin_metadata_generation_started"
  | "seo_plugin_metadata_generation_completed"
  | "seo_plugin_metadata_generation_failed"
  | "seo_plugin_metadata_reviewed"
  | "seo_plugin_write_skipped_provider_none"
  | "seo_plugin_write_skipped_dry_run"
  | "seo_plugin_write_started"
  | "seo_plugin_write_completed"
  | "seo_plugin_write_failed"
  // Phase 2-5: Featured Image Preparation 이벤트
  | "featured_image_preparation_started"
  | "featured_image_preparation_completed"
  | "featured_image_preparation_failed"
  | "featured_image_reviewed"
  | "featured_image_upload_skipped_not_implemented"
  | "wordpress_featured_image_skipped_no_media"
  // Phase 2-6: WordPress Media Upload Preparation 이벤트
  | "wordpress_media_upload_preparation_started"
  | "wordpress_media_upload_preparation_completed"
  | "wordpress_media_upload_preparation_failed"
  | "wordpress_media_upload_dry_run"
  | "wordpress_media_upload_skipped_disabled"
  | "wordpress_featured_media_prepared"
  | "wordpress_featured_media_skipped_no_media_id"
  // Phase 2-7: Image Generation Integration 이벤트
  | "image_generation_started"
  | "image_generation_completed"
  | "image_generation_failed"
  | "image_generation_skipped_disabled"
  | "generated_image_reviewed"
  | "wordpress_media_source_updated_from_generated_image"
  // Phase 2-8: Actual WordPress Connection Test 이벤트
  | "wordpress_connection_test_started"
  | "wordpress_connection_test_completed"
  | "wordpress_connection_test_failed"
  | "wordpress_actual_publish_started"
  | "wordpress_actual_publish_completed"
  | "wordpress_actual_publish_failed"
  | "wordpress_category_sync_started"
  | "wordpress_category_sync_completed"
  | "wordpress_category_sync_failed"
  | "wordpress_tag_sync_started"
  | "wordpress_tag_sync_completed"
  | "wordpress_tag_sync_failed"
  | "wordpress_media_upload_started"
  | "wordpress_media_upload_completed"
  | "wordpress_media_upload_failed"
  // Phase 2-9: WordPress Draft Publish Stabilization 이벤트
  | "wordpress_actual_publish_skipped_duplicate"
  | "wordpress_actual_publish_skipped_not_reviewed"
  | "wordpress_actual_publish_dry_run"
  | "wordpress_media_upload_skipped_deferred"
  | "seo_plugin_write_skipped_deferred"
  // Phase 2-10: WordPress Media Upload Actual Test 이벤트
  | "wordpress_media_upload_skipped_no_source"
  | "wordpress_media_source_invalid"
  | "wordpress_media_metadata_update_completed"
  | "wordpress_media_metadata_update_failed"
  // Phase 2-19: 기존 WordPress media를 직접 지정한 경우 업로드 건너뜀
  | "wordpress_media_upload_skipped_existing_media"
  // Phase 2-11: WordPress Featured Media Draft Publish Test 이벤트
  | "wordpress_featured_media_attach_started"
  | "wordpress_featured_media_attach_completed"
  | "wordpress_featured_media_attach_failed"
  | "wordpress_featured_media_attach_skipped_no_media_id"
  | "wordpress_featured_media_existing_draft_found"
  | "wordpress_featured_media_existing_draft_not_found"
  | "wordpress_media_item_validation_completed"
  | "wordpress_media_item_validation_failed"
  // Phase 2-12: SEO Plugin Actual Metadata Test 이벤트
  | "seo_plugin_actual_write_started"
  | "seo_plugin_actual_write_completed"
  | "seo_plugin_actual_write_failed"
  | "seo_plugin_actual_write_skipped_disabled"
  | "seo_plugin_actual_write_skipped_provider_none"
  | "seo_plugin_actual_write_skipped_no_wordpress_post"
  | "seo_plugin_actual_write_skipped_missing_target_keyword"
  | "seo_plugin_actual_write_needs_custom_endpoint"
  | "seo_plugin_actual_write_verification_completed"
  | "seo_plugin_actual_write_verification_warning"
  // Phase 2-13: Custom WordPress SEO Metadata Endpoint(Rank Math 전용) 이벤트
  | "seo_plugin_custom_endpoint_write_started"
  | "seo_plugin_custom_endpoint_write_completed"
  | "seo_plugin_custom_endpoint_write_failed"
  | "seo_plugin_custom_endpoint_skipped_disabled"
  | "seo_plugin_custom_endpoint_skipped_provider_not_supported"
  | "seo_plugin_custom_endpoint_skipped_no_wordpress_post"
  | "seo_plugin_custom_endpoint_skipped_missing_target_keyword"
  | "seo_plugin_custom_endpoint_verification_completed"
  | "seo_plugin_custom_endpoint_verification_failed"
  // Phase 2-14: WordPress Final Draft Payload Review 이벤트
  | "wordpress_final_draft_review_started"
  | "wordpress_final_draft_review_completed"
  | "wordpress_final_draft_review_failed"
  | "wordpress_final_draft_review_skipped_missing_draft"
  // Phase 2-15: Publish Quality Gate 이벤트
  | "publish_quality_gate_started"
  | "publish_quality_gate_completed"
  | "publish_quality_gate_needs_revision"
  | "publish_quality_gate_blocked"
  | "publish_quality_gate_failed"
  // Phase 2-16: Human Approval Before Public Publish 이벤트
  | "public_publish_approval_started"
  | "public_publish_approval_completed"
  | "public_publish_approval_blocked"
  | "public_publish_approval_failed"
  | "public_publish_approval_duplicate"
  | "public_publish_approval_revoked"
  | "public_publish_approval_revoke_failed"
  // Phase 2-17: WordPress Public Publish Test 이벤트
  | "wordpress_public_publish_started"
  | "wordpress_public_publish_completed"
  | "wordpress_public_publish_failed"
  | "wordpress_public_publish_blocked"
  | "wordpress_public_publish_skipped_already_published"
  | "wordpress_public_publish_guard_passed"
  | "wordpress_public_publish_guard_failed"
  // Phase 2-19: Manual Featured Image Source Setup 이벤트
  | "featured_image_manual_source_saved"
  | "featured_image_external_url_saved"
  | "featured_image_local_upload_saved"
  | "featured_image_existing_wordpress_media_saved"
  | "featured_image_manual_source_failed"
  // Featured Image Workflow: Source Setup (3단계 워크플로우 정리)
  | "featured_image_source_saved"
  | "featured_image_source_failed"
  // Phase 3-1: Multi-platform Writing Schema & Foundation 이벤트
  | "social_post_created"
  | "social_post_generation_started"
  | "social_post_generation_completed"
  | "social_post_generation_failed"
  | "social_post_placeholder_generation_started"
  | "social_post_placeholder_generation_completed"
  | "social_post_placeholder_generation_failed"
  | "social_quality_gate_started"
  | "social_quality_gate_completed"
  | "social_quality_gate_blocked"
  | "social_quality_gate_failed"
  | "social_approval_started"
  | "social_approval_completed"
  | "social_approval_rejected"
  | "social_export_completed"
  // Phase 3-2: Prompt / Context / Contract Structure 이벤트
  | "social_prompt_assembly_started"
  | "social_prompt_assembly_completed"
  | "social_contract_validation_started"
  | "social_contract_validation_completed"
  | "social_draft_generation_started"
  | "social_draft_generation_completed"
  | "social_draft_generation_failed"
  // Phase 3-3: Platform Writing Templates & Real Draft Generation 이벤트
  | "social_context_build_started"
  | "social_context_build_completed"
  | "social_ai_generation_started"
  | "social_ai_generation_completed"
  | "social_ai_generation_skipped_mock_mode"
  // Phase 3-4: Social Post Review & Editing Workflow 이벤트
  | "social_post_edit_started"
  | "social_post_edit_completed"
  | "social_post_edit_failed"
  | "social_approval_requested"
  | "social_approval_revoked"
  | "social_approval_failed"
  // Phase 3-5: Manual Export & Copy Workflow 이벤트
  | "social_manual_export_started"
  | "social_manual_export_completed"
  | "social_manual_export_blocked"
  | "social_manual_export_failed"
  | "social_manual_export_copied"
  // Phase 3-6: Platform-specific Approval & Publishing Guard 이벤트
  | "social_platform_publish_guard_started"
  | "social_platform_publish_guard_completed"
  | "social_platform_publish_guard_needs_revision"
  | "social_platform_publish_guard_blocked"
  | "social_platform_publish_guard_failed"
  // Phase 3-7: Platform Publish Dry-run & Export Handoff 이벤트
  | "social_platform_publish_dry_run_started"
  | "social_platform_publish_dry_run_completed"
  | "social_platform_publish_dry_run_blocked"
  | "social_platform_publish_dry_run_failed"
  | "social_platform_handoff_started"
  | "social_platform_handoff_completed"
  | "social_platform_handoff_blocked"
  | "social_platform_handoff_failed"
  // Phase 3-8: Platform Manual Posting Checklist & Result Recording 이벤트
  | "social_manual_posting_prepare_started"
  | "social_manual_posting_prepare_completed"
  | "social_manual_posting_prepare_blocked"
  | "social_manual_posting_prepare_failed"
  | "social_manual_posting_record_started"
  | "social_manual_posting_record_completed"
  | "social_manual_posting_record_blocked"
  | "social_manual_posting_record_failed"
  | "social_manual_posting_skipped"
  | "social_manual_posting_failed_recorded"
  // Phase 3-9: Social Metrics Manual Input & Performance Tracking 이벤트
  | "social_metrics_record_started"
  | "social_metrics_record_completed"
  | "social_metrics_record_failed"
  | "social_metrics_record_warning"
  // Phase 3-10: Performance-based Rewrite Suggestion 이벤트
  | "social_rewrite_suggestion_started"
  | "social_rewrite_diagnosis_completed"
  | "social_rewrite_suggestion_completed"
  | "social_rewrite_suggestion_blocked"
  | "social_rewrite_suggestion_failed"
  | "social_rewrite_suggestion_approved"
  | "social_rewrite_suggestion_rejected"
  // Phase 3-11: Rewrite Application & Versioning Workflow 이벤트
  | "social_rewrite_application_preview_started"
  | "social_rewrite_application_preview_completed"
  | "social_rewrite_application_started"
  | "social_rewrite_application_completed"
  | "social_rewrite_application_blocked"
  | "social_rewrite_application_failed"
  | "social_rewrite_version_created"
  // Phase 3-12: Rewrite Version Quality Recheck & Comparison 이벤트
  | "social_rewrite_version_quality_recheck_started"
  | "social_rewrite_version_quality_recheck_completed"
  | "social_rewrite_version_quality_recheck_blocked"
  | "social_rewrite_version_quality_recheck_failed"
  | "social_rewrite_version_comparison_started"
  | "social_rewrite_version_comparison_completed"
  | "social_rewrite_version_comparison_blocked"
  | "social_rewrite_version_comparison_failed"
  // Phase 3-13: Rewrite Re-approval & Re-export Workflow 이벤트
  | "social_rewrite_reapproval_requested"
  | "social_rewrite_reapproval_approved"
  | "social_rewrite_reapproval_rejected"
  | "social_rewrite_reapproval_revoked"
  | "social_rewrite_reapproval_blocked"
  | "social_rewrite_reapproval_failed"
  | "social_rewrite_reexport_prepare_started"
  | "social_rewrite_reexport_prepare_completed"
  | "social_rewrite_reexport_started"
  | "social_rewrite_reexport_completed"
  | "social_rewrite_reexport_blocked"
  | "social_rewrite_reexport_failed"
  | "social_rewrite_republish_workflow_refreshed"
  | "social_rewrite_republish_workflow_failed"
  // Phase 3-14: Rewrite Performance Tracking & Original-vs-Rewrite Result Comparison 이벤트
  | "social_rewrite_performance_comparison_preview_started"
  | "social_rewrite_performance_comparison_preview_completed"
  | "social_rewrite_performance_comparison_started"
  | "social_rewrite_performance_comparison_completed"
  | "social_rewrite_performance_comparison_needs_more_data"
  | "social_rewrite_performance_comparison_blocked"
  | "social_rewrite_performance_comparison_failed"
  // Phase 3-15: Social Performance Dashboard 이벤트
  | "social_performance_dashboard_build_started"
  | "social_performance_dashboard_build_completed"
  | "social_performance_dashboard_build_failed"
  // Phase 3-16: Content Type Separation & Dashboard Information Architecture 이벤트
  | "content_grouping_started"
  | "content_grouping_completed"
  | "content_grouping_failed"
  | "dashboard_information_architecture_loaded"
  // Phase 3-18: Social Post Detail Route & Pagination 이벤트
  | "social_post_detail_view_loaded"
  | "article_page_pagination_applied"
  // Phase 3-19: Dashboard Charts & Trend Visualization 이벤트
  | "social_performance_charts_build_started"
  | "social_performance_charts_build_completed"
  | "social_performance_charts_build_failed"
  // Phase 3-20: A/B Testing Draft Structure 이벤트
  | "social_ab_test_draft_created"
  | "social_ab_test_variant_added"
  | "social_ab_test_ready"
  | "social_ab_test_started"
  | "social_ab_test_paused"
  | "social_ab_test_completed"
  | "social_ab_test_cancelled"
  | "social_ab_test_metrics_refreshed"
  | "social_ab_test_comparison_completed"
  | "social_ab_test_comparison_inconclusive"
  | "social_ab_test_failed"
  // Phase 3-21: Platform API Publishing Preparation 이벤트
  | "social_platform_api_publish_prepare_started"
  | "social_platform_api_publish_prepare_completed"
  | "social_platform_api_publish_prepare_blocked"
  | "social_platform_api_publish_prepare_failed"
  | "social_platform_api_readiness_checked"
  | "social_platform_api_dry_run_payload_built";

export type LogStatus = "success" | "failed" | "info";

export interface PipelineLogEntry {
  id: string;
  type: LogEventType;
  status: LogStatus;
  message: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface LogEventInput {
  type: LogEventType;
  status: LogStatus;
  message: string;
  details?: Record<string, unknown>;
  /** 로그를 특정 테마(주제)와 연결할 때 사용 */
  themeId?: string;
  /** 로그를 특정 기사와 연결할 때 사용 (Phase 1-4 AI 생성 이벤트) */
  articleId?: string;
  /** 로그 대상 종류 (source/article) */
  targetType?: ContractTargetType;
  /** 로그 대상 id (targetType과 함께 사용) */
  targetId?: string;
}

export type ContractCheckTarget = "source" | "article";

export interface ContractCheckRecord {
  themeId: string;
  target: ContractCheckTarget;
  contractName: string;
  passed: boolean;
  violations: ContractViolation[];
  checkedAt: string;
}

export interface RecordContractCheckInput {
  themeId: string;
  target: ContractCheckTarget;
  contractName: string;
  passed: boolean;
  violations: ContractViolation[];
  /** 검사 시점의 출처 개수 (source 계약: 등록된 출처 수, article 계약: 인용된 출처 수) */
  sourceCount?: number;
}

export function mapLogRow(row: PipelineLogRow): PipelineLogEntry {
  return {
    id: row.id,
    type: row.event_name as LogEventType,
    status: row.status as LogStatus,
    message: row.message ?? "",
    details: row.details_json,
    createdAt: row.created_at,
  };
}

export function mapContractRunRow(row: ContractRunRow): ContractCheckRecord {
  return {
    themeId: row.theme_id ?? "",
    target: row.target_type,
    contractName: row.contract_name,
    passed: row.passed,
    violations: row.violations as ContractViolation[],
    checkedAt: row.created_at,
  };
}

/** 파이프라인 이벤트를 pipeline_logs에 기록한다 (FR-10). */
export async function logEvent(input: LogEventInput): Promise<PipelineLogEntry> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("pipeline_logs")
    .insert({
      theme_id: input.themeId ?? null,
      article_id: input.articleId ?? null,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      event_name: input.type,
      status: input.status,
      message: input.message,
      details_json: input.details ?? {},
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`파이프라인 로그 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapLogRow(data);
}

/** 최신 로그가 먼저 오도록 정렬된 로그 목록을 반환한다. */
export async function getLogs(limit = 20): Promise<PipelineLogEntry[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("pipeline_logs")
    .select()
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`파이프라인 로그 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapLogRow);
}

/** 특정 기사와 관련된 로그를 최신순으로 조회한다 (/articles/[id] 상세 페이지). */
export async function getLogsByArticleId(articleId: string, limit = 20): Promise<PipelineLogEntry[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("pipeline_logs")
    .select()
    .eq("article_id", articleId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`파이프라인 로그 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapLogRow);
}

/** 계약 검사 결과를 contract_runs에 기록한다. */
export async function recordContractCheck(
  input: RecordContractCheckInput
): Promise<ContractCheckRecord> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("contract_runs")
    .insert({
      theme_id: input.themeId,
      target_type: input.target,
      contract_name: input.contractName,
      passed: input.passed,
      status: input.passed ? "success" : "failed",
      source_count: input.sourceCount ?? null,
      failed_conditions: input.violations.map((violation) => violation.ruleId),
      violations: input.violations,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`계약 검사 결과 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapContractRunRow(data);
}

/** 특정 테마의 최신 계약 검사 결과를 조회한다. */
export async function getLatestContractCheck(
  themeId: string,
  target: ContractCheckTarget
): Promise<ContractCheckRecord | undefined> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("contract_runs")
    .select()
    .eq("theme_id", themeId)
    .eq("target_type", target)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`계약 검사 이력 조회에 실패했습니다: ${error.message}`);
  }

  return data ? mapContractRunRow(data) : undefined;
}
