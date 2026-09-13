// Phase 4-17: Job Progress System 공통 타입.
//
// 트렌드 수집/마스터 원고 생성/블로그·SNS 글 생성/WordPress 게시 준비 등
// 여러 단계로 이루어진 내부 작업 하나(run)와, 그 안의 단계(step)를
// 표현한다. DB row(JobRunRow/JobRunStepRow, lib/supabase/database.types.ts)
// ↔ 이 도메인 타입 매핑은 job-progress-repository.ts가 담당한다.

/**
 * 모든 job_run/job_run_step이 공유하는 상태 값. 화면 표시용 한국어 라벨은
 * job-progress-labels.ts의 getJobStatusLabel()이 담당한다 — 기본 UI에는
 * 이 raw 값을 그대로 노출하지 않는다("상세 상태 보기" 접힘 영역에서만 사용).
 */
export type JobStatus =
  | "not_started"
  | "queued"
  | "running"
  | "waiting_user"
  | "retrying"
  | "partial_success"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled"
  | "stalled";

/** job_run_steps 전용으로 추가되는 상태(전체 run에는 쓰지 않는다). */
export type JobRunStepStatus = JobStatus | "skipped";

/**
 * 지금까지 적용 대상인 job_type 값. 화면 라벨은
 * job-progress-labels.ts의 JOB_TYPE_LABELS가 담당한다. 새 작업 종류를
 * 추가할 때는 여기와 JOB_TYPE_LABELS를 함께 늘린다.
 */
export type JobType =
  | "trend_collection"
  | "related_url_collection"
  | "master_manuscript_generation"
  | "wordpress_blog_generation"
  | "social_post_generation"
  | "quality_review"
  | "wordpress_auto_prep"
  | "seo_write"
  | "featured_image_upload"
  | "export_preparation";

export interface JobRun {
  id: string;
  jobType: string;
  targetType: string | null;
  targetId: string | null;
  articleId: string | null;
  socialPostId: string | null;
  themeId: string | null;
  status: JobStatus;
  currentStepKey: string | null;
  currentStepLabel: string | null;
  totalSteps: number;
  completedSteps: number;
  progressPercent: number;
  userMessage: string | null;
  errorMessage: string | null;
  errorCategory: string | null;
  retryable: boolean;
  nextActionLabel: string | null;
  nextActionHref: string | null;
  startedAt: string | null;
  lastHeartbeatAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobRunStep {
  id: string;
  jobRunId: string;
  stepOrder: number;
  stepKey: string;
  stepLabel: string;
  status: JobRunStepStatus;
  message: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobRunWithSteps extends JobRun {
  steps: JobRunStep[];
}

/** createJobRun에 전달하는 입력. job_type 외에는 대상 종류에 맞는 값만 채우면 된다. */
export interface CreateJobRunInput {
  jobType: string;
  targetType?: string;
  targetId?: string;
  articleId?: string;
  socialPostId?: string;
  themeId?: string;
  userMessage?: string;
}

/** createJobSteps에 전달하는 단계 정의(순서는 배열 순서를 따른다). */
export interface JobStepDefinition {
  stepKey: string;
  stepLabel: string;
}

/**
 * running/retrying 상태인데 last_heartbeat_at이 이 시간(ms) 이상
 * 지나면 UI에서 "멈춤 가능성 있음"으로 표시한다. DB status를 바로
 * stalled로 바꾸지는 않는다 — detectStalledJobRun()은 표시 여부만
 * 판정하는 순수 함수다.
 */
export const STALLED_THRESHOLD_MS = 2 * 60 * 1000;

/**
 * status가 running/retrying인데 last_heartbeat_at이 STALLED_THRESHOLD_MS
 * 이상 지났으면 true를 반환한다(순수 함수 — DB status를 바꾸지 않는다).
 * supabase 클라이언트 등 서버 전용 의존성이 전혀 없어, 이 파일과 함께
 * client component(JobProgressPolling)에서 직접 import해도 안전하다.
 */
export function detectStalledJobRun(jobRun: { status: JobStatus; lastHeartbeatAt: string | null }, now: Date = new Date()): boolean {
  if (jobRun.status !== "running" && jobRun.status !== "retrying") return false;
  if (!jobRun.lastHeartbeatAt) return false;
  const lastHeartbeat = new Date(jobRun.lastHeartbeatAt).getTime();
  if (Number.isNaN(lastHeartbeat)) return false;
  return now.getTime() - lastHeartbeat >= STALLED_THRESHOLD_MS;
}
