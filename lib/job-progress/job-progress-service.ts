// Phase 4-17: Job Progress System — 여러 단계로 이루어진 내부 작업(job_run)의
// 생성/진행/완료/실패를 관리하는 공용 helper. 개별 작업(WordPress 게시
// 준비, 마스터 원고 생성, SNS 글 생성, 트렌드 수집 등)은 이 helper를
// 순서대로 호출하기만 하면 되고, job_runs/job_run_steps 테이블 구조를
// 직접 다루지 않는다.
//
// 저장 금지: API key/auth token/Authorization header/Application
// Password/full article body/full social post body/full prompt/full AI
// response/image binary/raw full external API response. errorMessage는
// 항상 짧고 안전한 요약 문자열만 넘긴다.
//
// pipeline_logs 연동: 각 생명주기 전환마다 logEvent()를 호출해
// job_run_created/job_run_started/job_step_started/job_step_completed/
// job_step_failed/job_run_completed/job_run_partial_success/job_run_failed/
// job_run_blocked/job_run_stalled_detected 이벤트를 남긴다(event_name
// 컬럼만 사용 — event 컬럼은 쓰지 않는다). 로그 실패가 작업 자체를
//막지 않도록 항상 실패를 삼킨다.

import {
  getJobRunById,
  getJobRunSteps,
  getLatestJobRunByTarget,
  insertJobRun,
  insertJobRunSteps,
  updateJobRunRow,
  updateJobRunStepRow,
} from "./job-progress-repository";
import { logEvent } from "@/lib/repositories/log-repository";
import type { CreateJobRunInput, JobRunStepStatus, JobRunWithSteps, JobStatus, JobStepDefinition } from "./job-progress-types";
import { detectStalledJobRun } from "./job-progress-types";

// detectStalledJobRun은 supabase 등 서버 전용 의존성이 없는 순수 함수라
// job-progress-types.ts에 정의돼 있다(client component에서 직접 import할
// 수 있도록). 기존 호출부 호환을 위해 이 서비스 모듈에서도 재수출한다.
export { detectStalledJobRun };

/** logEvent 실패가 작업 진행 자체를 막지 않도록 감싼다. */
async function safeLogEvent(...args: Parameters<typeof logEvent>): Promise<void> {
  try {
    await logEvent(...args);
  } catch {
    // pipeline_logs 기록 실패는 무시한다 — job_run 자체의 상태는 이미 저장됐다.
  }
}

function computeProgressPercent(totalSteps: number, completedSteps: number): number {
  if (totalSteps <= 0) return 0;
  return Math.round((completedSteps / totalSteps) * 100);
}

/** 새 job_run을 만든다(status=queued). 단계는 별도로 createJobSteps로 등록한다. */
export async function createJobRun(input: CreateJobRunInput) {
  const jobRun = await insertJobRun({
    jobType: input.jobType,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    articleId: input.articleId ?? null,
    socialPostId: input.socialPostId ?? null,
    themeId: input.themeId ?? null,
    status: "queued",
    totalSteps: 0,
    userMessage: input.userMessage ?? null,
  });

  await safeLogEvent({
    type: "job_run_created",
    status: "info",
    message: `작업이 등록되었습니다: ${input.jobType}`,
    articleId: input.articleId,
    details: { jobRunId: jobRun.id, jobType: input.jobType, targetType: input.targetType, targetId: input.targetId },
  });

  return jobRun;
}

/** job_run에 속한 단계 목록을 등록한다(순서는 배열 순서). total_steps도 함께 갱신한다. */
export async function createJobSteps(jobRunId: string, steps: JobStepDefinition[]) {
  const created = await insertJobRunSteps(
    steps.map((step, index) => ({
      jobRunId,
      stepOrder: index + 1,
      stepKey: step.stepKey,
      stepLabel: step.stepLabel,
    }))
  );

  await updateJobRunRow(jobRunId, { total_steps: steps.length, progress_percent: 0 });

  return created;
}

/** job_run을 running으로 전환하고 started_at/last_heartbeat_at을 지금 시각으로 채운다. */
export async function startJobRun(jobRunId: string) {
  const now = new Date().toISOString();
  const jobRun = await updateJobRunRow(jobRunId, {
    status: "running",
    started_at: now,
    last_heartbeat_at: now,
  });

  await safeLogEvent({
    type: "job_run_started",
    status: "info",
    message: `작업을 시작했습니다: ${jobRun.jobType}`,
    articleId: jobRun.articleId ?? undefined,
    details: { jobRunId, jobType: jobRun.jobType },
  });

  return jobRun;
}

/** job_run 필드를 자유롭게 patch한다(사용자 메시지/다음 작업 버튼 등). */
export async function updateJobRun(
  jobRunId: string,
  patch: Partial<{
    status: JobStatus;
    currentStepKey: string | null;
    currentStepLabel: string | null;
    userMessage: string | null;
    nextActionLabel: string | null;
    nextActionHref: string | null;
  }>
) {
  return updateJobRunRow(jobRunId, {
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.currentStepKey !== undefined ? { current_step_key: patch.currentStepKey } : {}),
    ...(patch.currentStepLabel !== undefined ? { current_step_label: patch.currentStepLabel } : {}),
    ...(patch.userMessage !== undefined ? { user_message: patch.userMessage } : {}),
    ...(patch.nextActionLabel !== undefined ? { next_action_label: patch.nextActionLabel } : {}),
    ...(patch.nextActionHref !== undefined ? { next_action_href: patch.nextActionHref } : {}),
  });
}

/** last_heartbeat_at을 지금 시각으로 갱신한다(멈춤 여부 판정 기준). */
export async function heartbeatJobRun(jobRunId: string) {
  return updateJobRunRow(jobRunId, { last_heartbeat_at: new Date().toISOString() });
}

/** step 하나를 running으로 전환하고, job_run의 current_step도 함께 갱신한다. */
export async function startJobStep(jobRunId: string, stepKey: string, stepLabel: string) {
  const now = new Date().toISOString();
  const step = await updateJobRunStepRow(jobRunId, stepKey, { status: "running", started_at: now });
  await updateJobRunRow(jobRunId, {
    current_step_key: stepKey,
    current_step_label: stepLabel,
    last_heartbeat_at: now,
  });

  await safeLogEvent({
    type: "job_step_started",
    status: "info",
    message: `단계를 시작했습니다: ${stepLabel}`,
    details: { jobRunId, stepKey, status: "running" },
  });

  return step;
}

/**
 * step 하나를 완료 처리하고, job_run의 completed_steps/progress_percent도
 * 함께 갱신한다. message는 짧고 안전한 요약만 전달한다(full body 금지).
 */
export async function completeJobStep(jobRunId: string, stepKey: string, message?: string) {
  const now = new Date().toISOString();
  const step = await updateJobRunStepRow(jobRunId, stepKey, {
    status: "completed",
    finished_at: now,
    message: message ?? null,
  });

  const steps = await getJobRunSteps(jobRunId);
  const completedSteps = steps.filter((s) => s.status === "completed" || s.status === "skipped").length;
  const jobRun = await getJobRunById(jobRunId);
  const totalSteps = jobRun?.totalSteps ?? steps.length;

  await updateJobRunRow(jobRunId, {
    completed_steps: completedSteps,
    progress_percent: computeProgressPercent(totalSteps, completedSteps),
    last_heartbeat_at: now,
  });

  await safeLogEvent({
    type: "job_step_completed",
    status: "success",
    message: `단계가 완료되었습니다: ${step.stepLabel}`,
    details: { jobRunId, stepKey, status: "completed", progressPercent: computeProgressPercent(totalSteps, completedSteps) },
  });

  return step;
}

/**
 * step 하나를 건너뛴 것으로 표시한다(예: 조건상 필요 없는 단계).
 * completed_steps 집계에는 포함시킨다.
 */
export async function skipJobStep(jobRunId: string, stepKey: string, message?: string) {
  const now = new Date().toISOString();
  const step = await updateJobRunStepRow(jobRunId, stepKey, {
    status: "skipped",
    finished_at: now,
    message: message ?? null,
  });

  const steps = await getJobRunSteps(jobRunId);
  const completedSteps = steps.filter((s) => s.status === "completed" || s.status === "skipped").length;
  const jobRun = await getJobRunById(jobRunId);
  const totalSteps = jobRun?.totalSteps ?? steps.length;

  await updateJobRunRow(jobRunId, {
    completed_steps: completedSteps,
    progress_percent: computeProgressPercent(totalSteps, completedSteps),
    last_heartbeat_at: now,
  });

  return step;
}

/** step 하나를 실패 처리한다. errorMessage는 짧고 안전한 요약만 전달한다. */
export async function failJobStep(jobRunId: string, stepKey: string, errorMessage: string) {
  const step = await updateJobRunStepRow(jobRunId, stepKey, {
    status: "failed",
    finished_at: new Date().toISOString(),
    error_message: errorMessage,
  });

  await safeLogEvent({
    type: "job_step_failed",
    status: "failed",
    message: `단계가 실패했습니다: ${step.stepLabel}`,
    details: { jobRunId, stepKey, status: "failed" },
  });

  return step;
}

/** job_run을 completed로 전환한다. next_action_label/href를 함께 저장할 수 있다. */
export async function completeJobRun(
  jobRunId: string,
  result?: { userMessage?: string; nextActionLabel?: string; nextActionHref?: string }
) {
  const now = new Date().toISOString();
  const jobRun = await updateJobRunRow(jobRunId, {
    status: "completed",
    finished_at: now,
    last_heartbeat_at: now,
    user_message: result?.userMessage ?? null,
    next_action_label: result?.nextActionLabel ?? null,
    next_action_href: result?.nextActionHref ?? null,
  });

  await safeLogEvent({
    type: "job_run_completed",
    status: "success",
    message: `작업이 완료되었습니다: ${jobRun.jobType}`,
    articleId: jobRun.articleId ?? undefined,
    details: { jobRunId, jobType: jobRun.jobType, status: "completed" },
  });

  return jobRun;
}

/** job_run을 partial_success로 전환한다(일부 단계만 완료된 상태). */
export async function partialSuccessJobRun(
  jobRunId: string,
  result: { userMessage: string; nextActionLabel?: string; nextActionHref?: string }
) {
  const now = new Date().toISOString();
  const jobRun = await updateJobRunRow(jobRunId, {
    status: "partial_success",
    finished_at: now,
    last_heartbeat_at: now,
    user_message: result.userMessage,
    next_action_label: result.nextActionLabel ?? null,
    next_action_href: result.nextActionHref ?? null,
  });

  await safeLogEvent({
    type: "job_run_partial_success",
    status: "info",
    message: `작업이 일부만 완료되었습니다: ${jobRun.jobType}`,
    articleId: jobRun.articleId ?? undefined,
    details: { jobRunId, jobType: jobRun.jobType, status: "partial_success" },
  });

  return jobRun;
}

/** job_run을 failed로 전환한다. errorMessage는 짧고 안전한 요약만 전달한다. */
export async function failJobRun(
  jobRunId: string,
  error: { errorMessage: string; errorCategory?: string; retryable?: boolean }
) {
  const now = new Date().toISOString();
  const jobRun = await updateJobRunRow(jobRunId, {
    status: "failed",
    finished_at: now,
    last_heartbeat_at: now,
    error_message: error.errorMessage,
    error_category: error.errorCategory ?? null,
    retryable: error.retryable ?? true,
  });

  await safeLogEvent({
    type: "job_run_failed",
    status: "failed",
    message: `작업이 실패했습니다: ${jobRun.jobType}`,
    articleId: jobRun.articleId ?? undefined,
    details: { jobRunId, jobType: jobRun.jobType, status: "failed", retryable: error.retryable ?? true },
  });

  return jobRun;
}

/** job_run을 blocked로 전환한다(사용자 조치가 필요해 자동 진행이 불가능한 경우). */
export async function blockJobRun(jobRunId: string, reason: string) {
  const now = new Date().toISOString();
  const jobRun = await updateJobRunRow(jobRunId, {
    status: "blocked",
    finished_at: now,
    last_heartbeat_at: now,
    user_message: reason,
  });

  await safeLogEvent({
    type: "job_run_blocked",
    status: "info",
    message: `작업이 진행 불가 상태입니다: ${jobRun.jobType}`,
    articleId: jobRun.articleId ?? undefined,
    details: { jobRunId, jobType: jobRun.jobType, status: "blocked" },
  });

  return jobRun;
}

/** job_run을 waiting_user로 전환한다(사용자 확인/승인 대기). */
export async function markJobRunWaitingUser(jobRunId: string, message: string) {
  return updateJobRunRow(jobRunId, {
    status: "waiting_user",
    user_message: message,
    last_heartbeat_at: new Date().toISOString(),
  });
}

/** job_run 하나와 그 단계 전체를 조회한다. */
export async function getJobRunWithSteps(jobRunId: string): Promise<JobRunWithSteps | null> {
  const jobRun = await getJobRunById(jobRunId);
  if (!jobRun) return null;
  const steps = await getJobRunSteps(jobRunId);
  return { ...jobRun, steps };
}

/** target_type/target_id 기준으로 가장 최근 job_run(+단계)을 조회한다. */
export async function getLatestJobRunForTarget(targetType: string, targetId: string): Promise<JobRunWithSteps | null> {
  const jobRun = await getLatestJobRunByTarget(targetType, targetId);
  if (!jobRun) return null;
  const steps = await getJobRunSteps(jobRun.id);
  return { ...jobRun, steps };
}

/**
 * detectStalledJobRun이 true를 반환한 job_run을 실제로 DB status=stalled로
 * 갱신한다. cleanup/check용 action에서만 호출한다 — 일반 polling 응답은
 * detectStalledJobRun()으로 표시만 하고 DB는 건드리지 않는다.
 */
export async function markJobRunStalled(jobRunId: string) {
  const jobRun = await updateJobRunRow(jobRunId, { status: "stalled" });

  await safeLogEvent({
    type: "job_run_stalled_detected",
    status: "info",
    message: `작업이 멈춤 가능성이 있어 표시되었습니다: ${jobRun.jobType}`,
    articleId: jobRun.articleId ?? undefined,
    details: { jobRunId, jobType: jobRun.jobType, status: "stalled" },
  });

  return jobRun;
}

export type { JobRunStepStatus };

/**
 * 기존 오케스트레이터(WordPress 게시 준비 자동 실행, 마스터 원고 생성,
 * SNS 글 생성 등)에 최소 침습으로 붙일 수 있는 진행 상황 기록기.
 *
 * job_run 생성/조회/갱신이 어떤 이유로든(마이그레이션 미적용, DB 오류 등)
 * 실패해도 원래 작업 자체는 절대 막지 않는다 — 모든 메서드가 내부에서
 * 예외를 삼키고, jobRunId가 없으면(생성 실패) 이후 호출은 조용히
 * no-op이 된다. 즉 이 tracker를 붙이기 전/후로 오케스트레이터의 반환값
 * (성공/실패 여부, message 등)은 전혀 달라지지 않는다 — jobRunId만 추가로
 * 얻을 수 있을 뿐이다.
 */
export interface JobProgressTracker {
  /** 생성에 성공했으면 job_run id, 실패했으면 null(이후 호출은 모두 no-op). */
  jobRunId: string | null;
  startStep(stepKey: string, stepLabel: string): Promise<void>;
  completeStep(stepKey: string, message?: string): Promise<void>;
  skipStep(stepKey: string, message?: string): Promise<void>;
  failStep(stepKey: string, errorMessage: string): Promise<void>;
  finishCompleted(result?: { userMessage?: string; nextActionLabel?: string; nextActionHref?: string }): Promise<void>;
  finishPartialSuccess(result: { userMessage: string; nextActionLabel?: string; nextActionHref?: string }): Promise<void>;
  finishFailed(error: { errorMessage: string; errorCategory?: string; retryable?: boolean }): Promise<void>;
  finishBlocked(reason: string): Promise<void>;
}

const NOOP_TRACKER: JobProgressTracker = {
  jobRunId: null,
  async startStep() {},
  async completeStep() {},
  async skipStep() {},
  async failStep() {},
  async finishCompleted() {},
  async finishPartialSuccess() {},
  async finishFailed() {},
  async finishBlocked() {},
};

/** job_run을 만들고 단계를 등록한 뒤 running으로 전환한 JobProgressTracker를 반환한다. */
export async function createJobProgressTracker(input: CreateJobRunInput, steps: JobStepDefinition[]): Promise<JobProgressTracker> {
  let jobRunId: string;
  try {
    const jobRun = await createJobRun(input);
    jobRunId = jobRun.id;
    await createJobSteps(jobRunId, steps);
    await startJobRun(jobRunId);
  } catch {
    return NOOP_TRACKER;
  }

  return {
    jobRunId,
    async startStep(stepKey, stepLabel) {
      try {
        await startJobStep(jobRunId, stepKey, stepLabel);
      } catch {
        // job progress 기록 실패는 무시한다 — 실제 작업 진행에는 영향 없다.
      }
    },
    async completeStep(stepKey, message) {
      try {
        await completeJobStep(jobRunId, stepKey, message);
      } catch {
        // 위와 동일.
      }
    },
    async skipStep(stepKey, message) {
      try {
        await skipJobStep(jobRunId, stepKey, message);
      } catch {
        // 위와 동일.
      }
    },
    async failStep(stepKey, errorMessage) {
      try {
        await failJobStep(jobRunId, stepKey, errorMessage);
      } catch {
        // 위와 동일.
      }
    },
    async finishCompleted(result) {
      try {
        await completeJobRun(jobRunId, result);
      } catch {
        // 위와 동일.
      }
    },
    async finishPartialSuccess(result) {
      try {
        await partialSuccessJobRun(jobRunId, result);
      } catch {
        // 위와 동일.
      }
    },
    async finishFailed(error) {
      try {
        await failJobRun(jobRunId, error);
      } catch {
        // 위와 동일.
      }
    },
    async finishBlocked(reason) {
      try {
        await blockJobRun(jobRunId, reason);
      } catch {
        // 위와 동일.
      }
    },
  };
}
