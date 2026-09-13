// Phase 4-17: Job Progress System — job_runs / job_run_steps 테이블 데이터
// 접근 및 row ↔ 도메인 타입 매핑. 서비스 레벨 로직(진행률 계산, heartbeat,
// stalled 판정 등)은 job-progress-service.ts가 담당한다.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database, JobRunRow, JobRunStepRow } from "@/lib/supabase/database.types";

type JobRunUpdate = Database["public"]["Tables"]["job_runs"]["Update"];
type JobRunStepUpdate = Database["public"]["Tables"]["job_run_steps"]["Update"];
import type { JobRun, JobRunStep, JobRunStepStatus, JobStatus } from "./job-progress-types";

export function mapJobRunRow(row: JobRunRow): JobRun {
  return {
    id: row.id,
    jobType: row.job_type,
    targetType: row.target_type,
    targetId: row.target_id,
    articleId: row.article_id,
    socialPostId: row.social_post_id,
    themeId: row.theme_id,
    status: row.status as JobStatus,
    currentStepKey: row.current_step_key,
    currentStepLabel: row.current_step_label,
    totalSteps: row.total_steps,
    completedSteps: row.completed_steps,
    progressPercent: row.progress_percent,
    userMessage: row.user_message,
    errorMessage: row.error_message,
    errorCategory: row.error_category,
    retryable: row.retryable,
    nextActionLabel: row.next_action_label,
    nextActionHref: row.next_action_href,
    startedAt: row.started_at,
    lastHeartbeatAt: row.last_heartbeat_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapJobRunStepRow(row: JobRunStepRow): JobRunStep {
  return {
    id: row.id,
    jobRunId: row.job_run_id,
    stepOrder: row.step_order,
    stepKey: row.step_key,
    stepLabel: row.step_label,
    status: row.status as JobRunStepStatus,
    message: row.message,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface InsertJobRunInput {
  jobType: string;
  targetType: string | null;
  targetId: string | null;
  articleId: string | null;
  socialPostId: string | null;
  themeId: string | null;
  status: JobStatus;
  totalSteps: number;
  userMessage: string | null;
}

/** job_runs row 하나를 새로 만든다. */
export async function insertJobRun(input: InsertJobRunInput): Promise<JobRun> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("job_runs")
    .insert({
      job_type: input.jobType,
      target_type: input.targetType,
      target_id: input.targetId,
      article_id: input.articleId,
      social_post_id: input.socialPostId,
      theme_id: input.themeId,
      status: input.status,
      total_steps: input.totalSteps,
      user_message: input.userMessage,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`작업 실행 기록 생성에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapJobRunRow(data);
}

/** job_runs row 하나를 patch로 갱신한다. */
export async function updateJobRunRow(jobRunId: string, patch: JobRunUpdate): Promise<JobRun> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.from("job_runs").update(patch).eq("id", jobRunId).select().single();

  if (error || !data) {
    throw new Error(`작업 실행 기록 갱신에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapJobRunRow(data);
}

/** job_run_id 하나를 조회한다. 없으면 null을 반환한다. */
export async function getJobRunById(jobRunId: string): Promise<JobRun | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.from("job_runs").select().eq("id", jobRunId).maybeSingle();

  if (error) {
    throw new Error(`작업 실행 기록 조회에 실패했습니다: ${error.message}`);
  }

  return data ? mapJobRunRow(data) : null;
}

/** target_type/target_id 기준으로 가장 최근 job_run 1건을 조회한다. */
export async function getLatestJobRunByTarget(targetType: string, targetId: string): Promise<JobRun | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("job_runs")
    .select()
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`작업 실행 기록 조회에 실패했습니다: ${error.message}`);
  }

  return data ? mapJobRunRow(data) : null;
}

export interface InsertJobRunStepInput {
  jobRunId: string;
  stepOrder: number;
  stepKey: string;
  stepLabel: string;
}

/** job_run_steps row 여러 개를 한 번에 만든다(순서는 배열 순서를 따른다). */
export async function insertJobRunSteps(inputs: InsertJobRunStepInput[]): Promise<JobRunStep[]> {
  if (inputs.length === 0) return [];
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("job_run_steps")
    .insert(
      inputs.map((input) => ({
        job_run_id: input.jobRunId,
        step_order: input.stepOrder,
        step_key: input.stepKey,
        step_label: input.stepLabel,
      }))
    )
    .select();

  if (error || !data) {
    throw new Error(`작업 단계 기록 생성에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return data.map(mapJobRunStepRow);
}

/** job_run_id 기준 step_order 오름차순으로 전체 단계를 조회한다. */
export async function getJobRunSteps(jobRunId: string): Promise<JobRunStep[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("job_run_steps")
    .select()
    .eq("job_run_id", jobRunId)
    .order("step_order", { ascending: true });

  if (error) {
    throw new Error(`작업 단계 기록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapJobRunStepRow);
}

/** job_run_id + step_key로 특정 단계 하나를 patch로 갱신한다. */
export async function updateJobRunStepRow(
  jobRunId: string,
  stepKey: string,
  patch: JobRunStepUpdate
): Promise<JobRunStep> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("job_run_steps")
    .update(patch)
    .eq("job_run_id", jobRunId)
    .eq("step_key", stepKey)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`작업 단계 기록 갱신에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapJobRunStepRow(data);
}
