// Phase UX-03B1: "현재 상태"를 여러 화면에서 같은 방식으로 표현하기
// 위한 공통 ViewModel. 기존 상태 계산 로직(getWordPressPublishPrepState
// 등)을 다시 만들지 않고, 그 결과를 이 shape으로 바꾸는 어댑터만
// 제공한다.

import type { WordPressPublishPrepState } from "@/lib/social/wordpress-blog-publish-prep-state";
import type { SocialPostCardActionState } from "@/lib/social/social-post-card-action-state";
import type { UserFacingReviewSummary } from "@/lib/social/social-post-auto-review";

export type WorkflowState = "idle" | "in_progress" | "needs_attention" | "ready" | "completed" | "blocked";

export interface WorkflowStatusViewModel {
  state: WorkflowState;
  title: string;
  message?: string;
  completedItems?: string[];
  remainingItems?: string[];
}

/**
 * getWordPressPublishPrepState 결과를 WorkflowStatusViewModel로 바꾼다.
 * title은 statusLabel(이미 사용자 친화적 한국어 한 줄 요약)을 그대로
 * 쓴다 — raw DB enum을 title로 쓰지 않는다.
 *
 * state 판단 기준(completedItems/remainingItems는 품질검사·승인·대표
 * 이미지·체크리스트·SEO 5가지만 추적한다 — Draft 생성/게시 준비 확인
 * 같은 마지막 단계는 primaryAction.actionType으로 따로 구분한다):
 *   - "completed": 더 볼 것 없이 결과만 확인하면 됨(primaryAction이 Draft 보기)
 *   - "idle": 아직 아무것도 완료되지 않음(completedItems가 비어 있음)
 *   - "needs_attention": 일부는 끝났지만 사용자가 채워야 하는 항목이 남음
 *   - "in_progress": 추적 대상 항목은 모두 끝났지만 마지막 반영 단계가 남음
 */
export function fromWordPressPublishPrepStateToWorkflowStatus(prep: WordPressPublishPrepState): WorkflowStatusViewModel {
  const state: WorkflowState =
    prep.primaryAction.actionType === "view_draft"
      ? "completed"
      : prep.completedItems.length === 0
        ? "idle"
        : prep.remainingItems.length > 0
          ? "needs_attention"
          : "in_progress";

  return {
    state,
    title: prep.statusLabel,
    completedItems: prep.completedItems,
    remainingItems: prep.remainingItems,
  };
}

const NEEDS_ATTENTION_BADGES = new Set(["수정 필요"]);
const COMPLETED_BADGES = new Set(["export 완료"]);

/**
 * getSocialPostCardActionState 결과를 WorkflowStatusViewModel로 바꾼다.
 * statusBadge는 이미 사용자 친화적 한국어 한 줄 요약이므로 title로
 * 그대로 쓴다(raw enum 아님).
 */
export function fromSocialPostCardActionStateToWorkflowStatus(cardState: SocialPostCardActionState): WorkflowStatusViewModel {
  const state: WorkflowState = NEEDS_ATTENTION_BADGES.has(cardState.statusBadge)
    ? "needs_attention"
    : COMPLETED_BADGES.has(cardState.statusBadge)
      ? "completed"
      : "ready";

  return { state, title: cardState.statusBadge };
}

const REVIEW_STATE_TO_WORKFLOW_STATE: Record<UserFacingReviewSummary["state"], WorkflowState> = {
  checking: "in_progress",
  ready: "ready",
  needs_confirmation: "needs_attention",
  blocked: "blocked",
  failed: "needs_attention",
};

/**
 * Phase UX-04A: summarizeUserFacingReview(social-post-auto-review.ts)
 * 결과를 WorkflowStatusCard가 그대로 받을 수 있는 shape으로 바꾼다.
 * 새 상태 판단 로직을 여기서 추가하지 않는다 — summarizeUserFacingReview가
 * 이미 계산한 state/stateLabel/stateMessage를 그대로 옮긴다.
 */
export function fromUserFacingReviewToWorkflowStatus(review: UserFacingReviewSummary): WorkflowStatusViewModel {
  return {
    state: REVIEW_STATE_TO_WORKFLOW_STATE[review.state],
    title: review.stateLabel,
    message: review.stateMessage,
  };
}
