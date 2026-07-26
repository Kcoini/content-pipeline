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
  | "publish_quality_gate_failed";

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
