// Phase 3-22: 내부 상태값(quality_status/approval_status/export_status 등)을
// 사용자 친화적 문구로 변환하고, 지금 눌러야 할 "다음 작업" 버튼 하나를
// 결정하는 순수 함수 모음. DB 값이나 SocialPost 타입 자체는 바꾸지 않는다
// — "상세 상태 보기" 접힘 영역에서는 원문 상태값을 그대로 보여줄 수
// 있으므로, 이 파일은 표시 방식만 다룬다.

import type {
  SocialPost,
  SocialPostQualityStatus,
  SocialPostApprovalStatus,
  SocialPostExportStatus,
} from "./social-platform-types";

export type NextActionKind =
  | "generate"
  | "quality_check"
  | "review"
  | "approve"
  | "export"
  | "view_existing"
  | "retry";

export interface NextRecommendedAction {
  kind: NextActionKind;
  label: string;
}

const QUALITY_STATUS_LABELS: Record<SocialPostQualityStatus, string> = {
  not_checked: "품질검사 전",
  ready: "품질검사 통과",
  needs_revision: "수정이 필요합니다",
  blocked: "품질검사에서 차단됨",
  failed: "품질검사 실패",
};

const APPROVAL_STATUS_LABELS: Record<SocialPostApprovalStatus, string> = {
  not_requested: "승인 요청 전",
  pending_review: "검토 대기 중",
  approved: "승인 완료",
  rejected: "반려됨",
  revoked: "승인 취소됨",
};

const EXPORT_STATUS_LABELS: Record<SocialPostExportStatus, string> = {
  not_exported: "아직 내보내지 않음",
  ready: "내보낼 준비 완료",
  exported: "내보내기 완료",
  blocked: "승인 전이라 내보낼 수 없음",
  failed: "내보내기 실패",
};

/**
 * 카드 상단에 보여줄 한 줄 상태 요약("네이버 카페 글이 생성되었습니다.
 * 현재 검토가 필요합니다." 같은 문구가 아니라, 그 문구를 구성하는 핵심
 * 상태 라벨 하나). 우선순위: 실패/차단 > 승인 대기/검토 필요 > 승인 완료
 * > 품질검사 전.
 */
export function getUserFacingStatus(
  post: Pick<SocialPost, "qualityStatus" | "approvalStatus" | "exportStatus">
): string {
  if (post.qualityStatus === "failed") return "생성에 실패했습니다";
  if (post.qualityStatus === "blocked") return "품질검사에서 차단되었습니다";
  if (post.approvalStatus === "rejected") return "반려되었습니다 — 다시 검토가 필요합니다";
  if (post.approvalStatus === "revoked") return "승인이 취소되었습니다";
  if (post.exportStatus === "exported") return "내보내기(export)까지 완료되었습니다";
  if (post.approvalStatus === "approved") return "승인 완료 — 복사/export할 수 있습니다";
  if (post.approvalStatus === "pending_review") return "현재 검토가 필요합니다";
  if (post.qualityStatus === "needs_revision") return "검토 결과 수정이 필요합니다";
  if (post.qualityStatus === "ready") return "생성이 완료되었습니다 — 검토가 필요합니다";
  return "품질검사 전입니다";
}

/**
 * 지금 눌러야 할 버튼 하나를 결정한다(카드당 주요 버튼은 하나만
 * 강조한다는 원칙 — Phase 3-22). post가 없으면(아직 생성 전) "글
 * 생성하기"를 반환한다.
 */
export function getNextRecommendedAction(
  post: Pick<SocialPost, "qualityStatus" | "approvalStatus" | "exportStatus"> | null
): NextRecommendedAction {
  if (!post) return { kind: "generate", label: "글 생성하기" };

  if (post.qualityStatus === "failed") return { kind: "retry", label: "다시 생성하기" };
  if (post.qualityStatus === "blocked") return { kind: "retry", label: "다시 생성하기" };
  if (post.approvalStatus === "rejected" || post.approvalStatus === "revoked") {
    return { kind: "review", label: "다시 검토 요청하기" };
  }
  if (post.exportStatus === "exported") return { kind: "view_existing", label: "기존 글 보기" };
  if (post.approvalStatus === "approved") return { kind: "export", label: "복사/export 준비하기" };
  if (post.approvalStatus === "pending_review") return { kind: "approve", label: "승인하기" };
  if (post.qualityStatus === "needs_revision") return { kind: "review", label: "글 검토하기" };
  if (post.qualityStatus === "ready") return { kind: "review", label: "글 검토하기" };
  return { kind: "quality_check", label: "품질검사 실행하기" };
}

/** "상세 상태 보기" 접힘 영역에서 쓸, 원문 상태값 → 한국어 라벨 매핑. 개발자용 원문 값도 함께 보여준다. */
export function describeSocialPostStatusFields(
  post: Pick<SocialPost, "qualityStatus" | "approvalStatus" | "exportStatus">
): { key: string; label: string; rawValue: string }[] {
  return [
    { key: "qualityStatus", label: QUALITY_STATUS_LABELS[post.qualityStatus], rawValue: post.qualityStatus },
    { key: "approvalStatus", label: APPROVAL_STATUS_LABELS[post.approvalStatus], rawValue: post.approvalStatus },
    { key: "exportStatus", label: EXPORT_STATUS_LABELS[post.exportStatus], rawValue: post.exportStatus },
  ];
}
