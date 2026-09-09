// Phase 3-24: 페이지별로 편차가 컸던 "raw 상태값/DB 필드명 노출" 문제를
// 한 곳에서 고치기 위한 공통 변환 유틸. lib/social 여러 곳에 흩어진
// 상태 enum(quality_status/approval_status/export_status/handoff_status/
// manual_post_status/performance_status/rewrite 관련 상태 등)에 공통으로
// 등장하는 raw 문자열 값과, "내부 상태값 보기" 접힘 영역에서 쓰는 필드
// 라벨을 여기서 한 번에 관리한다.
//
// 새 enum이나 새 DB 컬럼을 추가하지 않는다 — 이미 존재하는 문자열 값을
// 화면에 어떻게 "번역"해서 보여줄지만 담당하는 순수 함수/상수 모음이다.
// 알 수 없는 값이 들어와도 절대 예외를 던지지 않고 원본 값을 그대로
// 반환한다(화면이 깨지는 것보다 낫다 — 다만 알려진 값은 최대한 이 표에
// 채워 넣는다).
//
// 플랫폼 라벨(PLATFORM_LABELS)과 문체 라벨(TONE_STYLE_CONFIGS)은 이미
// lib/social/platform-generation-recommendations.ts와
// lib/social/tone-style-config.ts에 있으므로 여기서 다시 만들지 않는다
// — 이 파일은 "상태값"과 "DB 필드명"만 다룬다.

/**
 * 여러 상태 enum(quality_status/approval_status/export_status/
 * handoff_status/manual_post_status/performance_status/
 * rewrite_reapproval_status/rewrite_reexport_status/
 * rewrite_republish_workflow_status/version_comparison_status 등)에
 * 공통으로 등장하는 raw 값 → 한국어 라벨.
 */
const STATUS_VALUE_LABELS: Record<string, string> = {
  // "아직 ~ 전" 계열 (enum마다 이름은 다르지만 의미는 같다)
  not_checked: "아직 확인 전",
  not_requested: "요청 전",
  not_created: "아직 생성 전",
  not_started: "아직 시작 전",
  not_recorded: "아직 기록 없음",
  not_exported: "아직 내보내지 않음",
  not_published: "아직 게시되지 않음",
  not_measured: "아직 측정 전",
  not_compared: "아직 비교 전",
  not_ready: "아직 준비 안 됨",

  // 공통 결과 계열
  ready: "준비 완료",
  ready_to_record: "기록 대기",
  dry_run: "게시 전 미리보기 완료",
  scheduled: "예약됨",
  published: "게시됨",
  pending_review: "검토 대기",
  approved: "승인 완료",
  rejected: "반려",
  revoked: "승인 취소됨",
  blocked: "차단됨",
  failed: "실패",
  completed: "완료",
  exported: "내보내기 완료",
  posted: "게시 기록됨",
  skipped: "건너뜀",
  needs_revision: "수정 필요",
  needs_review: "검토 필요",
  draft: "초안",
  suggested: "제안됨",
  applied: "적용됨",
  current: "현재 버전",
  archived: "보관됨",
  superseded: "대체됨",

  // 성과 측정/비교 계열
  low: "낮음",
  average: "보통",
  good: "좋음",
  excellent: "매우 좋음",
  original_better: "원본이 더 좋음",
  rewrite_better: "재작성 글이 더 좋음",
  similar: "비슷함",

  // rewrite 재게시 워크플로 세부 단계(rewrite_republish_workflow_status)
  ready_for_reapproval: "재승인 요청 가능",
  reapproval_pending: "재승인 검토 중",
  reapproved: "재승인 완료",
  reexport_ready: "재내보내기 준비 완료",
  reexported: "재내보내기 완료",
  guard_ready: "게시 조건 확인 완료",
  dry_run_ready: "게시 전 미리보기 준비 완료",
  handoff_ready: "수동 게시 준비 완료",
  handoff_completed: "수동 게시 준비 확인 완료",
  manual_post_recorded: "수동 게시 기록 완료",
};

/** raw 상태값 하나를 한국어 라벨로 바꾼다. 알 수 없는 값이면 원본을 그대로 반환한다(예외를 던지지 않는다). */
export function describeStatusValue(value: string | null | undefined): string {
  if (value == null || value.length === 0) return "알 수 없음";
  return STATUS_VALUE_LABELS[value] ?? value;
}

/**
 * "내부 상태값 보기" 접힘 영역에서 쓰는 필드 라벨(DB 컬럼명/camelCase
 * 필드명 → 한국어). raw 필드명을 화면에 그대로 쓰지 않기 위함이다.
 */
export const STATUS_FIELD_LABELS: Record<string, string> = {
  quality_status: "품질검사",
  qualityStatus: "품질검사",
  approval_status: "검토/승인",
  approvalStatus: "검토/승인",
  export_status: "내보내기 상태",
  exportStatus: "내보내기 상태",
  publish_status: "게시 상태",
  publishStatus: "게시 상태",
  handoff_status: "수동 게시 준비",
  handoffStatus: "수동 게시 준비",
  manual_post_status: "수동 게시 기록",
  manualPostStatus: "수동 게시 기록",
  performance_status: "성과 측정 상태",
  performanceStatus: "성과 측정 상태",
  platform_publish_guard_status: "게시 준비 확인",
  platformPublishGuardStatus: "게시 준비 확인",
  platform_publish_dry_run_status: "게시 전 미리보기",
  platformPublishDryRunStatus: "게시 전 미리보기",
  suggestion_status: "재작성 제안 상태",
  suggestionStatus: "재작성 제안 상태",
  application_status: "적용 상태",
  applicationStatus: "적용 상태",
  version_comparison_status: "버전 비교 상태",
  versionComparisonStatus: "버전 비교 상태",
  rewrite_reapproval_status: "재승인 상태",
  rewriteReapprovalStatus: "재승인 상태",
  rewrite_reexport_status: "재내보내기 상태",
  rewriteReexportStatus: "재내보내기 상태",
  rewrite_republish_workflow_status: "게시 준비 흐름",
  rewriteRepublishWorkflowStatus: "게시 준비 흐름",
  is_rewrite_version: "재작성 버전 여부",
  isRewriteVersion: "재작성 버전 여부",
  version_number: "버전 번호",
  versionNumber: "버전 번호",
  parent_social_post_id: "이전 버전 글",
  parentSocialPostId: "이전 버전 글",
  root_social_post_id: "원본 글",
  rootSocialPostId: "원본 글",

  // Phase 3-24: /social-posts/[id] 상세 페이지의 raw DB 필드명도 같은
  // 표에서 관리한다(콘텐츠 필드 + 그 외 상태 필드).
  post_title: "제목",
  excerpt: "요약",
  hashtags: "해시태그",
  post_url: "게시된 URL",
  quality_score: "품질 점수",
  latest_performance_score: "최근 성과 점수",
  latest_metrics_recorded_at: "최근 성과 측정일",
  rewrite_suggestion_status: "재작성 제안 상태",
  recommended_for_repost: "재게시 추천 여부",
  rewrite_performance_comparison_status: "재작성 성과 비교 상태",
  content_group: "콘텐츠 분류",
  content_type: "콘텐츠 유형",
  created_at: "생성일",
  updated_at: "수정일",
};

/** field 라벨을 반환한다. 알 수 없는 필드면 원본 필드명을 그대로 반환한다. */
export function describeStatusField(field: string): string {
  return STATUS_FIELD_LABELS[field] ?? field;
}
