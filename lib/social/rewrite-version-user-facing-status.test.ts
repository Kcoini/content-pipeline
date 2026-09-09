import { describe, expect, it } from "vitest";
import {
  getRewriteSuggestionNextAction,
  getRewriteVersionNextAction,
  describeRequestReapprovalDisabledReason,
  describeApproveReapprovalDisabledReason,
  describePrepareReexportDisabledReason,
  describeGenerateReexportDisabledReason,
  describeCompareDisabledReason,
} from "./rewrite-version-user-facing-status";

describe("getRewriteSuggestionNextAction (Phase 3-24)", () => {
  it("적용 완료면 done을 반환한다", () => {
    expect(getRewriteSuggestionNextAction({ suggestionStatus: "approved", applicationStatus: "applied" })).toEqual({
      kind: "done",
      label: "적용 완료 — 아래 재작성 버전에서 확인",
    });
  });

  it("승인되었지만 아직 적용 전이면 apply_suggestion을 반환한다", () => {
    expect(getRewriteSuggestionNextAction({ suggestionStatus: "approved", applicationStatus: "not_applied" })).toEqual(
      { kind: "apply_suggestion", label: "개선안 적용" }
    );
  });

  it("반려/차단/실패면 done(더 진행 불가)을 반환한다", () => {
    for (const status of ["rejected", "blocked", "failed"] as const) {
      expect(getRewriteSuggestionNextAction({ suggestionStatus: status, applicationStatus: "not_applied" }).kind).toBe(
        "done"
      );
    }
  });

  it("초안/검토 필요 상태면 approve_suggestion을 반환한다", () => {
    expect(getRewriteSuggestionNextAction({ suggestionStatus: "draft", applicationStatus: "not_applied" }).kind).toBe(
      "approve_suggestion"
    );
  });
});

describe("getRewriteVersionNextAction (Phase 3-24)", () => {
  it("재승인 요청 전 + 비교 대상 있음 → compare", () => {
    expect(
      getRewriteVersionNextAction({ rewriteReapprovalStatus: "not_requested", rewriteReexportStatus: "not_started", hasComparisonTarget: true })
    ).toEqual({ kind: "compare", label: "원본과 비교" });
  });

  it("재승인 요청 전 + 비교 대상 없음 → request_reapproval", () => {
    expect(
      getRewriteVersionNextAction({ rewriteReapprovalStatus: "not_requested", rewriteReexportStatus: "not_started", hasComparisonTarget: false })
    ).toEqual({ kind: "request_reapproval", label: "재승인 요청" });
  });

  it("재승인 검토 대기 → approve_reapproval", () => {
    expect(
      getRewriteVersionNextAction({ rewriteReapprovalStatus: "pending_review", rewriteReexportStatus: "not_started", hasComparisonTarget: false }).kind
    ).toBe("approve_reapproval");
  });

  it("재승인 완료 + 재내보내기 시작 전 → prepare_reexport", () => {
    expect(
      getRewriteVersionNextAction({ rewriteReapprovalStatus: "approved", rewriteReexportStatus: "not_started", hasComparisonTarget: false }).kind
    ).toBe("prepare_reexport");
  });

  it("재승인 완료 + 재내보내기 준비 완료 → generate_reexport", () => {
    expect(
      getRewriteVersionNextAction({ rewriteReapprovalStatus: "approved", rewriteReexportStatus: "ready", hasComparisonTarget: false }).kind
    ).toBe("generate_reexport");
  });

  it("반려/취소/차단/실패 → view_performance", () => {
    for (const status of ["rejected", "revoked", "blocked", "failed"] as const) {
      expect(
        getRewriteVersionNextAction({ rewriteReapprovalStatus: status, rewriteReexportStatus: "not_started", hasComparisonTarget: false }).kind
      ).toBe("view_performance");
    }
  });
});

describe("disabled 버튼 이유 helper (Phase 3-24)", () => {
  it("재승인 요청: not_requested가 아니면 이유를 반환하고, not_requested면 null이다", () => {
    expect(describeRequestReapprovalDisabledReason("not_requested")).toBeNull();
    expect(describeRequestReapprovalDisabledReason("pending_review")).toContain("진행 중");
    expect(describeRequestReapprovalDisabledReason("approved")).toContain("완료");
  });

  it("재승인 승인: pending_review가 아니면 이유를 반환한다", () => {
    expect(describeApproveReapprovalDisabledReason("pending_review")).toBeNull();
    expect(describeApproveReapprovalDisabledReason("not_requested")).toContain("먼저 재승인을 요청");
  });

  it("재내보내기 준비/생성: approved가 아니면 이유를 반환한다", () => {
    expect(describePrepareReexportDisabledReason("approved")).toBeNull();
    expect(describePrepareReexportDisabledReason("not_requested")).toContain("재승인이 완료되어야");
    expect(describeGenerateReexportDisabledReason("approved")).toBeNull();
    expect(describeGenerateReexportDisabledReason("not_requested")).toContain("재승인이 완료되어야");
  });

  it("비교: 비교 대상이 없으면 이유를 반환한다", () => {
    expect(describeCompareDisabledReason(true)).toBeNull();
    expect(describeCompareDisabledReason(false)).toContain("찾을 수 없습니다");
  });
});
