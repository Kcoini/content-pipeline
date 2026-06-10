// pipeline_logs / contract_runs 테이블 데이터 접근.
// lib/harness/logger.ts가 이 모듈을 통해 파이프라인 이벤트와 계약 검사 결과를 영속화한다.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ContractRunRow, PipelineLogRow } from "@/lib/supabase/database.types";
import type { ContractViolation } from "@/lib/harness/types";

export type LogEventType =
  | "theme_created"
  | "source_added"
  | "contract_checked"
  | "article_draft_created";

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
}

export function mapLogRow(row: PipelineLogRow): PipelineLogEntry {
  return {
    id: row.id,
    type: row.stage as LogEventType,
    status: row.status as LogStatus,
    message: row.message ?? "",
    details: row.details,
    createdAt: row.created_at,
  };
}

export function mapContractRunRow(row: ContractRunRow): ContractCheckRecord {
  return {
    themeId: row.topic_id ?? "",
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
      topic_id: input.themeId ?? null,
      stage: input.type,
      status: input.status,
      message: input.message,
      details: input.details ?? {},
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

/** 계약 검사 결과를 contract_runs에 기록한다. */
export async function recordContractCheck(
  input: RecordContractCheckInput
): Promise<ContractCheckRecord> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("contract_runs")
    .insert({
      topic_id: input.themeId,
      target_type: input.target,
      contract_name: input.contractName,
      passed: input.passed,
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
    .eq("topic_id", themeId)
    .eq("target_type", target)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`계약 검사 이력 조회에 실패했습니다: ${error.message}`);
  }

  return data ? mapContractRunRow(data) : undefined;
}
