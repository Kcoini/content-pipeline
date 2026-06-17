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
  | "article_quality_warning";

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
    type: row.event as LogEventType,
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
      event: input.type,
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
