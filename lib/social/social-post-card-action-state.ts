// Phase 4-14: SNS/커뮤니티 글 목록 카드(app/articles/[id]/social/page.tsx)에서
// "품질검사/승인 요청/승인/복사·export 준비"를 동시에 같은 수준으로
// 나열하지 않고, 지금 상태에 맞는 primary action 1개 + secondary
// action 몇 개로 정리하기 위한 순수 계산 함수. 어떤 데이터도 바꾸지
// 않고 어떤 action도 호출하지 않는다.
//
// approveSocialPost()(lib/social/social-post-approval-service.ts)는
// approval_status가 pending_review일 것을 요구하지 않는다 — quality
// gate만 통과했으면 바로 승인할 수 있다. 따라서 이 화면의 기본 흐름은
// "승인 요청"을 거치지 않고 곧바로 "승인"으로 간다("승인 요청"은
// 필수가 아니므로 고급/보조 영역으로만 제공한다).

import type { SocialPostApprovalStatus, SocialPostExportStatus, SocialPostQualityStatus } from "./social-platform-types";

export type SocialPostCardActionType =
  | "run_quality_gate"
  | "review_quality_issues"
  | "approve"
  | "prepare_export"
  | "copy_or_view_export"
  | "record_manual_result"
  | "edit_body"
  | "view_detail";

export interface SocialPostCardAction {
  label: string;
  actionType: SocialPostCardActionType;
}

export interface SocialPostCardActionState {
  /** "자동 검토 통과"/"승인 완료"/"export 준비 완료"/"수정 필요"/"품질검사 전" 중 하나. */
  statusBadge: string;
  primaryAction: SocialPostCardAction;
  secondaryActions: SocialPostCardAction[];
}

export interface SocialPostCardActionStateInput {
  qualityStatus: SocialPostQualityStatus;
  approvalStatus: SocialPostApprovalStatus;
  exportStatus: SocialPostExportStatus;
}

const VIEW_DETAIL: SocialPostCardAction = { label: "상세 보기", actionType: "view_detail" };

/**
 * 지금 상태를 기준으로 "상태 배지 + primary action 1개 + secondary
 * action 목록"을 계산한다. 우선순위: 품질검사 미실행 → 품질 문제(수정
 * 필요/차단/실패) → export 준비/완료 → 승인 완료(export 준비 전) →
 * 자동 검토 통과(승인 필요).
 */
export function getSocialPostCardActionState(input: SocialPostCardActionStateInput): SocialPostCardActionState {
  if (input.qualityStatus === "not_checked") {
    return {
      statusBadge: "품질검사 전",
      primaryAction: { label: "품질검사", actionType: "run_quality_gate" },
      secondaryActions: [VIEW_DETAIL],
    };
  }

  if (input.qualityStatus === "needs_revision" || input.qualityStatus === "blocked" || input.qualityStatus === "failed") {
    // 참고: 검토에서 지적된 문제를 자동으로 고쳐 쓰는 기능(예: "AI로
    // 보완하기")은 이번 작업에서 만들지 않았다 — 기존
    // generateSocialDraft()는 같은 platform/tone으로 새 글을 다시
    // 생성하는 함수라 기존 글을 그 자리에서 안전하게 고쳐 쓰지 않고,
    // 중복 글이 생길 위험이 있다. 대신 사람이 직접 본문을 확인하고
    // 고칠 수 있도록 "본문 수정"으로 안내한다.
    return {
      statusBadge: "수정 필요",
      primaryAction: { label: "문제 확인하기", actionType: "review_quality_issues" },
      secondaryActions: [{ label: "본문 수정", actionType: "edit_body" }, VIEW_DETAIL],
    };
  }

  // 여기부터는 qualityStatus === "ready".
  if (input.exportStatus === "exported") {
    return {
      statusBadge: "export 완료",
      primaryAction: { label: "내보내기 보기", actionType: "copy_or_view_export" },
      secondaryActions: [{ label: "게시 결과 기록", actionType: "record_manual_result" }],
    };
  }
  if (input.exportStatus === "ready") {
    return {
      statusBadge: "export 준비 완료",
      primaryAction: { label: "복사하기", actionType: "copy_or_view_export" },
      secondaryActions: [{ label: "게시 결과 기록", actionType: "record_manual_result" }],
    };
  }

  if (input.approvalStatus === "approved") {
    return {
      statusBadge: "승인 완료",
      primaryAction: { label: "복사/export 준비", actionType: "prepare_export" },
      secondaryActions: [VIEW_DETAIL],
    };
  }

  return {
    statusBadge: "자동 검토 통과",
    primaryAction: { label: "승인", actionType: "approve" },
    secondaryActions: [{ label: "본문 수정", actionType: "edit_body" }, VIEW_DETAIL],
  };
}
