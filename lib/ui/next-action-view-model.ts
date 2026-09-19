// Phase UX-03B1: 여러 화면에 흩어진 "다음 작업 계산" helper
// (getWordPressPublishPrepState/getSocialPostCardActionState/
// getPostApprovalNextActions)의 결과를 하나의 공통 UI 契約으로
// 표현하기 위한 어댑터. 이 파일은 business logic을 다시 만들지
// 않는다 — 기존 helper가 이미 계산한 상태/우선순위 판단을 그대로
// 받아, NextActionPanel이 렌더링할 수 있는 형태로만 모양을 바꾼다.
//
// 기존 helper 3개는 절대 여기서 재구현하지 않는다:
//   - lib/social/wordpress-blog-publish-prep-state.ts (getWordPressPublishPrepState)
//   - lib/social/social-post-card-action-state.ts (getSocialPostCardActionState)
//   - lib/social/post-approval-next-actions.ts (getPostApprovalNextActions)

import type { WordPressPublishPrepState } from "@/lib/social/wordpress-blog-publish-prep-state";
import type { SocialPostCardActionState } from "@/lib/social/social-post-card-action-state";
import type { PostApprovalNextActionsResult } from "@/lib/social/post-approval-next-actions";
import type { UserFacingReviewSummary } from "@/lib/social/social-post-auto-review";

export type NextActionState = "none" | "in_progress" | "needs_attention" | "ready" | "completed" | "blocked";

export interface NextActionViewModelAction {
  label: string;
  actionType: string;
  href?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export interface NextActionViewModel {
  state: NextActionState;
  message?: string;
  primaryAction?: NextActionViewModelAction;
  secondaryActions?: NextActionViewModelAction[];
}

/**
 * getWordPressPublishPrepState 결과를 NextActionViewModel로 바꾼다.
 * primaryAction.actionType === "view_draft"면(더 할 일이 없고 확인만
 * 남음) "completed"로, blockingReasons가 있으면 "needs_attention"으로,
 * 그 외엔 "ready"로 매핑한다.
 */
export function fromWordPressPublishPrepState(prep: WordPressPublishPrepState): NextActionViewModel {
  const state: NextActionState =
    prep.primaryAction.actionType === "view_draft"
      ? "completed"
      : prep.blockingReasons.length > 0
        ? "needs_attention"
        : "ready";

  return {
    state,
    message: prep.statusLabel,
    primaryAction: {
      label: prep.primaryAction.label,
      actionType: prep.primaryAction.actionType,
      href: prep.primaryAction.href,
    },
    secondaryActions: prep.secondaryActions.map((action) => ({
      label: action.label,
      actionType: action.actionType,
      href: action.href,
    })),
  };
}

const NEEDS_ATTENTION_BADGES = new Set(["수정 필요"]);
const COMPLETED_BADGES = new Set(["export 완료"]);

/**
 * getSocialPostCardActionState 결과를 NextActionViewModel로 바꾼다.
 * statusBadge는 이미 사용자 친화적 한국어 문구이므로(raw enum 아님)
 * 이 문자열 자체를 message로도, state 판단 근거로도 그대로 쓴다.
 */
export function fromSocialPostCardActionState(cardState: SocialPostCardActionState): NextActionViewModel {
  const state: NextActionState = NEEDS_ATTENTION_BADGES.has(cardState.statusBadge)
    ? "needs_attention"
    : COMPLETED_BADGES.has(cardState.statusBadge)
      ? "completed"
      : "ready";

  return {
    state,
    message: cardState.statusBadge,
    primaryAction: { label: cardState.primaryAction.label, actionType: cardState.primaryAction.actionType },
    secondaryActions: cardState.secondaryActions.map((action) => ({ label: action.label, actionType: action.actionType })),
  };
}

/**
 * getPostApprovalNextActions 결과를 NextActionViewModel로 바꾼다.
 * (이 helper는 항상 "승인 완료" 이후 상태만 다루므로 state는 보통
 * "ready" 또는 — WordPress Draft를 이미 확인만 하면 되는 경우 —
 * "completed"다.)
 */
export function fromPostApprovalNextActions(result: PostApprovalNextActionsResult): NextActionViewModel {
  const state: NextActionState = result.primaryAction.actionType === "view_wordpress_draft" ? "completed" : "ready";

  return {
    state,
    message: result.message,
    primaryAction: { label: result.primaryAction.label, actionType: result.primaryAction.actionType },
    secondaryActions: result.secondaryActions.map((action) => ({ label: action.label, actionType: action.actionType })),
  };
}

const REVIEW_STATE_TO_NEXT_ACTION_STATE: Record<UserFacingReviewSummary["state"], NextActionState> = {
  checking: "in_progress",
  ready: "ready",
  needs_confirmation: "needs_attention",
  blocked: "blocked",
  failed: "needs_attention",
};

/**
 * Phase UX-04A: summarizeUserFacingReview(social-post-auto-review.ts)
 * 결과를 NextActionPanel이 그대로 받을 수 있는 shape으로 바꾼다. 이
 * 어댑터가 만드는 action은 "승인 전 검토 흐름"만 다룬다 — 승인 이후
 * 다음 작업(WordPress Draft 반영 등)은 여전히
 * fromPostApprovalNextActions가 담당하므로, approvalStatus==="approved"
 * 이후에는 호출 측이 이 어댑터 대신 그쪽을 써야 한다. href는 페이지마다
 * 실제 이동 위치가 다르므로 채우지 않는다(renderAction 콜백에서 채운다).
 * checking 상태는 primaryAction을 만들지 않는다 — 호출 측이
 * `progressContent`(JobProgressCard 등)로 진행 상태를 대신 보여준다.
 */
export function fromUserFacingReviewToNextAction(review: UserFacingReviewSummary): NextActionViewModel {
  const state = REVIEW_STATE_TO_NEXT_ACTION_STATE[review.state];

  if (state === "in_progress") {
    return { state, message: review.stateMessage };
  }

  const primaryAction: NextActionViewModelAction =
    review.state === "ready"
      ? { label: "승인", actionType: "approve" }
      : review.state === "needs_confirmation"
        ? { label: "확인할 내용 보기", actionType: "view_confirmation" }
        : review.state === "blocked"
          ? { label: "문제 확인", actionType: "view_blocking" }
          : { label: "다시 검토", actionType: "retry_review" };

  return { state, message: review.stateMessage, primaryAction };
}
