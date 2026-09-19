// Phase 3-24: /articles/[id]/rewrite 페이지에서 재작성 제안(suggestion)과
// rewrite version 카드에 쓰는 "사용자 친화적 상태 문구 + 다음 작업 버튼
// 하나" 계산 유틸. lib/social/social-post-user-facing-status.ts와 같은
// 패턴이다 — DB 값/타입은 바꾸지 않고 표시 방식만 다룬다.
//
// Phase UX-03B2: 이 화면에는 실제로 다른 의미를 가진 3개의 "승인"류
// 액션이 있었다 — ① 개선 제안 자체를 채택할지(아직 아무 글도 만들어지지
// 않은 단계), ② 이미 만들어진 재작성 글을 재게시용으로 다시 검토해
// 달라고 요청하는 것, ③ 그 재검토를 실제로 확정하는 최종 게이트(quality/
// forbidden-pattern guard를 거치는 유일한 실질적 승인). 세 단계 모두
// "승인"이라는 단어를 쓰면 사용자가 구분하기 어려워, 각 액션이 실제로
// 하는 일에 맞는 동사로 라벨을 나눈다(state machine/DB 값은 그대로
// 유지 — 라벨만 바꾼다):
//   suggestionStatus="approved" (①) → "개선안 선택"
//   rewriteReapprovalStatus="not_requested"→"pending_review" (②) → "재검토 요청"
//   rewriteReapprovalStatus="pending_review"→"approved" (③, 유일한 최종 게이트) → "최종 승인"

import type { RewriteSuggestionStatus, RewriteReapprovalStatus, RewriteReexportStatus } from "./social-platform-types";

export type RewriteSuggestionActionKind = "approve_suggestion" | "reject_suggestion" | "apply_suggestion" | "done";

export interface RewriteSuggestionAction {
  kind: RewriteSuggestionActionKind;
  label: string;
}

/** 재작성 제안 카드의 다음 작업 버튼 하나를 결정한다. */
export function getRewriteSuggestionNextAction(suggestion: {
  suggestionStatus: RewriteSuggestionStatus;
  applicationStatus: string;
}): RewriteSuggestionAction {
  if (suggestion.applicationStatus === "applied") {
    return { kind: "done", label: "적용 완료 — 아래 재작성 버전에서 확인" };
  }
  if (suggestion.suggestionStatus === "approved") {
    return { kind: "apply_suggestion", label: "개선안 적용" };
  }
  if (suggestion.suggestionStatus === "rejected" || suggestion.suggestionStatus === "blocked" || suggestion.suggestionStatus === "failed") {
    return { kind: "done", label: "이 제안은 더 진행할 수 없습니다" };
  }
  // draft/ready/needs_review 등 아직 선택 전
  return { kind: "approve_suggestion", label: "개선안 선택" };
}

/**
 * suggestionStatus 전용 라벨. 공용 describeStatusValue의 "approved" →
 * "승인 완료" 매핑을 그대로 쓰지 않는다 — 이 필드의 "approved"는 위
 * ①단계(아직 최종 승인이 아닌, 제안을 선택한 것)를 뜻하므로 "선택됨"
 * 으로 고정한다(rewriteReapprovalStatus의 "approved"=최종 승인과
 * 혼동하지 않기 위해 일부러 공용 맵과 분리했다).
 */
const REWRITE_SUGGESTION_STATUS_LABELS: Record<RewriteSuggestionStatus, string> = {
  draft: "초안",
  ready: "검토 준비됨",
  needs_review: "검토 필요",
  approved: "선택됨",
  rejected: "반려됨",
  applied: "적용됨",
  blocked: "진행 불가",
  failed: "실패",
};

/** suggestionStatus 하나를 한국어 라벨로 바꾼다. */
export function describeRewriteSuggestionStatus(status: RewriteSuggestionStatus): string {
  return REWRITE_SUGGESTION_STATUS_LABELS[status] ?? status;
}

/**
 * "개선안 선택" 버튼이 disabled일 때 보여줄 이유. disabled가 아니면
 * null. Phase UX-03C: 이미 선택/반려/적용된 제안에도 이 버튼이 계속
 * primary처럼 활성 상태로 남아 있던 문제(완료된 action 반복 표시 금지
 * 원칙 위반)를 다른 버튼들과 동일한 disabled+이유 패턴으로 맞춘다.
 */
export function describeSelectSuggestionDisabledReason(status: RewriteSuggestionStatus): string | null {
  if (status === "draft" || status === "ready" || status === "needs_review") return null;
  if (status === "approved") return "이미 선택된 개선안입니다.";
  if (status === "applied") return "이미 적용된 개선안입니다.";
  if (status === "rejected") return "반려된 개선안입니다.";
  return "진행 불가 상태의 개선안입니다.";
}

export type RewriteVersionActionKind =
  | "compare"
  | "request_reapproval"
  | "approve_reapproval"
  | "prepare_reexport"
  | "generate_reexport"
  | "view_performance";

export interface RewriteVersionAction {
  kind: RewriteVersionActionKind;
  label: string;
}

/**
 * rewrite version 카드의 다음 작업 버튼 하나를 결정한다. 우선순위:
 * 재검토 흐름(요청 전 → 검토 대기 → 최종 승인 완료 이후 재내보내기
 * 흐름) → 막혔으면 성과 확인으로 유도.
 */
export function getRewriteVersionNextAction(version: {
  rewriteReapprovalStatus: RewriteReapprovalStatus;
  rewriteReexportStatus: RewriteReexportStatus;
  hasComparisonTarget: boolean;
}): RewriteVersionAction {
  if (version.rewriteReapprovalStatus === "not_requested") {
    return version.hasComparisonTarget
      ? { kind: "compare", label: "원본과 비교" }
      : { kind: "request_reapproval", label: "재검토 요청" };
  }
  if (version.rewriteReapprovalStatus === "pending_review") {
    return { kind: "approve_reapproval", label: "최종 승인" };
  }
  if (version.rewriteReapprovalStatus === "approved") {
    if (version.rewriteReexportStatus === "not_started") return { kind: "prepare_reexport", label: "재내보내기 준비" };
    if (version.rewriteReexportStatus === "ready") return { kind: "generate_reexport", label: "재내보내기 만들기" };
    return { kind: "view_performance", label: "성과 보기" };
  }
  // rejected/revoked/blocked/failed — 더 진행할 수 없으니 성과 확인으로 유도
  return { kind: "view_performance", label: "성과 보기" };
}

/** 재검토 요청 버튼이 disabled일 때 보여줄 이유. disabled가 아니면 null. */
export function describeRequestReapprovalDisabledReason(status: RewriteReapprovalStatus): string | null {
  if (status === "not_requested") return null;
  if (status === "pending_review") return "이미 재검토 요청이 진행 중입니다.";
  if (status === "approved") return "이미 최종 승인이 완료되었습니다.";
  return "현재 상태에서는 재검토를 다시 요청할 수 없습니다. 상세 상태를 확인하세요.";
}

/** 최종 승인 버튼이 disabled일 때 보여줄 이유. disabled가 아니면 null. */
export function describeApproveReapprovalDisabledReason(status: RewriteReapprovalStatus): string | null {
  if (status === "pending_review") return null;
  if (status === "not_requested") return "아직 재검토를 요청하지 않았습니다. 먼저 재검토를 요청하세요.";
  if (status === "approved") return "이미 최종 승인이 완료되었습니다.";
  return "현재 상태에서는 최종 승인을 할 수 없습니다. 상세 상태를 확인하세요.";
}

/** 재내보내기 준비 버튼이 disabled일 때 보여줄 이유. disabled가 아니면 null. */
export function describePrepareReexportDisabledReason(status: RewriteReapprovalStatus): string | null {
  if (status === "approved") return null;
  return "최종 승인이 완료되어야 재내보내기를 준비할 수 있습니다.";
}

/** 재내보내기 만들기 버튼이 disabled일 때 보여줄 이유. disabled가 아니면 null. */
export function describeGenerateReexportDisabledReason(status: RewriteReapprovalStatus): string | null {
  if (status === "approved") return null;
  return "최종 승인이 완료되어야 재내보내기를 만들 수 있습니다.";
}

/** 원본과 비교 버튼이 disabled일 때 보여줄 이유. disabled가 아니면 null. */
export function describeCompareDisabledReason(hasComparisonTarget: boolean): string | null {
  if (hasComparisonTarget) return null;
  return "비교할 원본 글 정보를 찾을 수 없습니다.";
}
