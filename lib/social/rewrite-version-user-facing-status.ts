// Phase 3-24: /articles/[id]/rewrite 페이지에서 재작성 제안(suggestion)과
// rewrite version 카드에 쓰는 "사용자 친화적 상태 문구 + 다음 작업 버튼
// 하나" 계산 유틸. lib/social/social-post-user-facing-status.ts와 같은
// 패턴이다 — DB 값/타입은 바꾸지 않고 표시 방식만 다룬다.

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
  // draft/ready/needs_review 등 아직 승인 전
  return { kind: "approve_suggestion", label: "개선 제안 승인" };
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
 * 재승인 흐름(요청 전 → 검토 대기 → 승인 완료 이후 재내보내기 흐름) →
 * 재승인이 막혔으면 성과 확인으로 유도.
 */
export function getRewriteVersionNextAction(version: {
  rewriteReapprovalStatus: RewriteReapprovalStatus;
  rewriteReexportStatus: RewriteReexportStatus;
  hasComparisonTarget: boolean;
}): RewriteVersionAction {
  if (version.rewriteReapprovalStatus === "not_requested") {
    return version.hasComparisonTarget
      ? { kind: "compare", label: "원본과 비교" }
      : { kind: "request_reapproval", label: "재승인 요청" };
  }
  if (version.rewriteReapprovalStatus === "pending_review") {
    return { kind: "approve_reapproval", label: "재승인 승인하기" };
  }
  if (version.rewriteReapprovalStatus === "approved") {
    if (version.rewriteReexportStatus === "not_started") return { kind: "prepare_reexport", label: "재내보내기 준비" };
    if (version.rewriteReexportStatus === "ready") return { kind: "generate_reexport", label: "재내보내기 만들기" };
    return { kind: "view_performance", label: "성과 보기" };
  }
  // rejected/revoked/blocked/failed — 더 진행할 수 없으니 성과 확인으로 유도
  return { kind: "view_performance", label: "성과 보기" };
}

/** 재승인 요청 버튼이 disabled일 때 보여줄 이유. disabled가 아니면 null. */
export function describeRequestReapprovalDisabledReason(status: RewriteReapprovalStatus): string | null {
  if (status === "not_requested") return null;
  if (status === "pending_review") return "이미 재승인 요청이 진행 중입니다.";
  if (status === "approved") return "이미 재승인이 완료되었습니다.";
  return "현재 상태에서는 재승인을 다시 요청할 수 없습니다. 상세 상태를 확인하세요.";
}

/** 재승인 승인 버튼이 disabled일 때 보여줄 이유. disabled가 아니면 null. */
export function describeApproveReapprovalDisabledReason(status: RewriteReapprovalStatus): string | null {
  if (status === "pending_review") return null;
  if (status === "not_requested") return "아직 재승인을 요청하지 않았습니다. 먼저 재승인을 요청하세요.";
  if (status === "approved") return "이미 재승인이 완료되었습니다.";
  return "현재 상태에서는 재승인을 승인할 수 없습니다. 상세 상태를 확인하세요.";
}

/** 재내보내기 준비 버튼이 disabled일 때 보여줄 이유. disabled가 아니면 null. */
export function describePrepareReexportDisabledReason(status: RewriteReapprovalStatus): string | null {
  if (status === "approved") return null;
  return "재승인이 완료되어야 재내보내기를 준비할 수 있습니다.";
}

/** 재내보내기 만들기 버튼이 disabled일 때 보여줄 이유. disabled가 아니면 null. */
export function describeGenerateReexportDisabledReason(status: RewriteReapprovalStatus): string | null {
  if (status === "approved") return null;
  return "재승인이 완료되어야 재내보내기를 만들 수 있습니다.";
}

/** 원본과 비교 버튼이 disabled일 때 보여줄 이유. disabled가 아니면 null. */
export function describeCompareDisabledReason(hasComparisonTarget: boolean): string | null {
  if (hasComparisonTarget) return null;
  return "비교할 원본 글 정보를 찾을 수 없습니다.";
}
