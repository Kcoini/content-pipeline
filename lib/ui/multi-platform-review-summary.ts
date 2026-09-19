// Phase UX-04B: 하나의 article에 생성된 여러 platform post를 사용자가
// 하나씩 열어보지 않고 한눈에 파악할 수 있도록 집계하는 순수 함수.
// UX-04A에서 이미 구현한 `summarizeUserFacingReview()`(post 1개 기준
// 5단계 상태 계산)를 여러 post에 반복 적용해서 모을 뿐, 새 검토
// 로직을 만들지 않는다.

import type { UserFacingReviewSummary } from "@/lib/social/social-post-auto-review";

/**
 * "검토 완료(자동 검토가 문제없다고 판단)"과 "승인 완료(사람이 실제로
 * 승인 버튼을 눌렀음)"는 서로 다른 축이다 — approved 카운트를 review
 * state 카운트(checking/ready/needsConfirmation/blocked/failed)와
 * 합치거나 대체하지 않는다(governance: "검토 완료"와 "승인 완료"를
 * 절대 혼동하지 않는다).
 */
export interface MultiPlatformReviewSummary {
  total: number;
  checking: number;
  ready: number;
  needsConfirmation: number;
  blocked: number;
  failed: number;
  /** approvalStatus === "approved"인 post 수(review state와 무관하게 별도 집계). */
  approved: number;
  readyPostIds: string[];
  needsConfirmationPostIds: string[];
  blockedPostIds: string[];
  failedPostIds: string[];
  checkingPostIds: string[];
  approvedPostIds: string[];
  /** 일괄 승인 대상(state==="ready" && 아직 미승인)인 post id 목록. */
  bulkApprovalEligiblePostIds: string[];
}

export interface MultiPlatformReviewPostInput {
  id: string;
  approvalStatus: string;
  review: UserFacingReviewSummary;
}

/**
 * post 목록(각 post의 UserFacingReviewSummary 포함)을 받아 화면 요약에
 * 쓸 집계 결과를 계산한다. DB를 읽거나 쓰지 않는 순수 함수 — 항상 현재
 * 상태로부터 다시 계산한다.
 */
export function summarizeMultiPlatformReview(posts: readonly MultiPlatformReviewPostInput[]): MultiPlatformReviewSummary {
  const readyPostIds: string[] = [];
  const needsConfirmationPostIds: string[] = [];
  const blockedPostIds: string[] = [];
  const failedPostIds: string[] = [];
  const checkingPostIds: string[] = [];
  const approvedPostIds: string[] = [];
  const bulkApprovalEligiblePostIds: string[] = [];

  for (const post of posts) {
    switch (post.review.state) {
      case "checking":
        checkingPostIds.push(post.id);
        break;
      case "ready":
        readyPostIds.push(post.id);
        break;
      case "needs_confirmation":
        needsConfirmationPostIds.push(post.id);
        break;
      case "blocked":
        blockedPostIds.push(post.id);
        break;
      case "failed":
        failedPostIds.push(post.id);
        break;
    }

    if (post.approvalStatus === "approved") {
      approvedPostIds.push(post.id);
    } else if (post.review.state === "ready") {
      bulkApprovalEligiblePostIds.push(post.id);
    }
  }

  return {
    total: posts.length,
    checking: checkingPostIds.length,
    ready: readyPostIds.length,
    needsConfirmation: needsConfirmationPostIds.length,
    blocked: blockedPostIds.length,
    failed: failedPostIds.length,
    approved: approvedPostIds.length,
    readyPostIds,
    needsConfirmationPostIds,
    blockedPostIds,
    failedPostIds,
    checkingPostIds,
    approvedPostIds,
    bulkApprovalEligiblePostIds,
  };
}

const REVIEW_STATE_PRIORITY: Record<UserFacingReviewSummary["state"], number> = {
  blocked: 0,
  needs_confirmation: 1,
  failed: 2,
  checking: 3,
  ready: 4,
};

/**
 * "사람이 봐야 할 문제가 위로 오도록" 카드 정렬 우선순위를 계산한다
 * (차단 > 확인 필요 > 검토 실패 > 검토 중 > 문제 없음). 이미
 * approved인 post는 review state와 무관하게 항상 맨 아래로 보낸다 —
 * 이미 사람이 승인을 마친 글을 다시 우선 노출할 필요는 없다.
 */
export function getMultiPlatformReviewSortKey(post: MultiPlatformReviewPostInput): number {
  if (post.approvalStatus === "approved") return 5;
  return REVIEW_STATE_PRIORITY[post.review.state];
}
