// Phase 4-17: Job Progress System — raw job_type/status 값을 사용자
// 친화적인 한국어 문구로 바꾸는 순수 함수/상수 모음. 새 status enum이나
// DB 컬럼을 추가하지 않는다. 알 수 없는 값이 들어와도 예외를 던지지
// 않고 원본 값을 그대로 반환한다(화면이 깨지는 것보다 낫다).

import type { JobRunStepStatus, JobStatus } from "./job-progress-types";

/** job_type → 화면에 보여줄 작업명. */
export const JOB_TYPE_LABELS: Record<string, string> = {
  trend_collection: "트렌드 수집",
  related_url_collection: "관련 URL 수집",
  master_manuscript_generation: "마스터 원고 생성",
  wordpress_blog_generation: "WordPress 블로그 글 생성",
  social_post_generation: "SNS/커뮤니티 글 생성",
  quality_review: "자동 검토",
  wordpress_auto_prep: "WordPress 게시 준비",
  seo_write: "SEO 정보 반영",
  featured_image_upload: "대표 이미지 업로드",
  export_preparation: "복사/export 준비",
};

/** job_type 라벨을 반환한다. 알 수 없는 값이면 원본을 그대로 반환한다. */
export function getJobTypeLabel(jobType: string): string {
  return JOB_TYPE_LABELS[jobType] ?? jobType;
}

/** status → 화면에 보여줄 상태 문구. */
const JOB_STATUS_LABELS: Record<JobRunStepStatus, string> = {
  not_started: "시작 전",
  queued: "대기 중",
  running: "진행 중",
  waiting_user: "확인 필요",
  retrying: "재시도 중",
  partial_success: "일부 완료",
  completed: "완료",
  failed: "실패",
  blocked: "진행 불가",
  cancelled: "취소됨",
  stalled: "멈춤 가능성 있음",
  skipped: "건너뜀",
};

/** status 라벨을 반환한다. 알 수 없는 값이면 원본을 그대로 반환한다. */
export function getJobStatusLabel(status: string): string {
  return JOB_STATUS_LABELS[status as JobRunStepStatus] ?? status;
}

/** JobStatusBadge 등에서 색상을 고를 때 쓰는 분류(tone). */
export type JobStatusTone = "neutral" | "progress" | "success" | "warning" | "danger";

const JOB_STATUS_TONES: Record<JobRunStepStatus, JobStatusTone> = {
  not_started: "neutral",
  queued: "neutral",
  running: "progress",
  retrying: "progress",
  waiting_user: "warning",
  partial_success: "warning",
  stalled: "warning",
  completed: "success",
  failed: "danger",
  blocked: "danger",
  cancelled: "neutral",
  skipped: "neutral",
};

/** status에 대응하는 tone을 반환한다. 알 수 없는 값이면 "neutral"을 반환한다. */
export function getJobStatusTone(status: string): JobStatusTone {
  return JOB_STATUS_TONES[status as JobRunStepStatus] ?? "neutral";
}

/**
 * job_run이 실패/차단됐을 때 보여줄 원인 카테고리 라벨. error_category는
 * 자유 문자열이라 이 표에 없는 값도 올 수 있다(그 경우 원본을 그대로
 * 보여준다) — 새 카테고리를 추가할 때 여기 라벨만 채워 넣으면 된다.
 */
const ERROR_CATEGORY_LABELS: Record<string, string> = {
  network_error: "네트워크/연결 오류 가능성",
  wordpress_connection_error: "WordPress 연결 오류 가능성",
  missing_source_data: "필요한 데이터가 부족합니다",
  ai_response_invalid: "AI 응답 구조에 문제가 발생했습니다",
  validation_failed: "입력 값 검증에 실패했습니다",
  unknown: "알 수 없는 오류가 발생했습니다",
};

/** error_category 라벨을 반환한다. 알 수 없는 값이면 원본을 그대로 반환한다. */
export function getJobErrorCategoryLabel(category: string | null | undefined): string {
  if (!category) return ERROR_CATEGORY_LABELS.unknown;
  return ERROR_CATEGORY_LABELS[category] ?? category;
}

/** JobStatus 기준으로 polling을 계속해야 하는지 판단한다(터미널 상태 여부). */
export function isTerminalJobStatus(status: JobStatus): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "blocked" ||
    status === "partial_success" ||
    status === "cancelled" ||
    status === "waiting_user"
  );
}
