import { describe, expect, it } from "vitest";
import { getSocialPostCardActionState, type SocialPostCardActionStateInput } from "./social-post-card-action-state";

function makeInput(overrides: Partial<SocialPostCardActionStateInput> = {}): SocialPostCardActionStateInput {
  return {
    qualityStatus: "ready",
    approvalStatus: "not_requested",
    exportStatus: "not_exported",
    ...overrides,
  };
}

describe("getSocialPostCardActionState", () => {
  it("quality_status가 not_checked이면 [품질검사]가 primary다", () => {
    const state = getSocialPostCardActionState(makeInput({ qualityStatus: "not_checked" }));
    expect(state.statusBadge).toBe("품질검사 전");
    expect(state.primaryAction).toEqual({ label: "품질검사", actionType: "run_quality_gate" });
  });

  it("quality_status가 needs_revision이면 [문제 확인하기]가 primary이고 [본문 수정]이 secondary다", () => {
    const state = getSocialPostCardActionState(makeInput({ qualityStatus: "needs_revision" }));
    expect(state.statusBadge).toBe("수정 필요");
    expect(state.primaryAction).toEqual({ label: "문제 확인하기", actionType: "review_quality_issues" });
    expect(state.secondaryActions).toContainEqual({ label: "본문 수정", actionType: "edit_body" });
  });

  it("quality_status가 blocked/failed이면 [문제 확인하기]가 primary다", () => {
    expect(getSocialPostCardActionState(makeInput({ qualityStatus: "blocked" })).primaryAction.actionType).toBe(
      "review_quality_issues"
    );
    expect(getSocialPostCardActionState(makeInput({ qualityStatus: "failed" })).primaryAction.actionType).toBe(
      "review_quality_issues"
    );
  });

  it("자동 검토 통과 + 미승인 상태에서는 [승인]이 primary로 표시된다(승인 요청 단계 없이 바로)", () => {
    const state = getSocialPostCardActionState(makeInput({ qualityStatus: "ready", approvalStatus: "not_requested" }));
    expect(state.statusBadge).toBe("자동 검토 통과");
    expect(state.primaryAction).toEqual({ label: "승인", actionType: "approve" });
    expect(state.secondaryActions).toContainEqual({ label: "본문 수정", actionType: "edit_body" });
    expect(state.secondaryActions.some((a) => a.actionType === "view_detail")).toBe(true);
  });

  it("pending_review 상태에서도 [승인]이 primary다(승인 요청은 필수가 아님)", () => {
    const state = getSocialPostCardActionState(makeInput({ approvalStatus: "pending_review" }));
    expect(state.primaryAction).toEqual({ label: "승인", actionType: "approve" });
  });

  it("approved 상태에서는 [승인] 버튼이 사라지고 [복사/export 준비]가 primary로 표시된다", () => {
    const state = getSocialPostCardActionState(makeInput({ approvalStatus: "approved" }));
    expect(state.statusBadge).toBe("승인 완료");
    expect(state.primaryAction).toEqual({ label: "복사/export 준비", actionType: "prepare_export" });
    expect(state.primaryAction.actionType).not.toBe("approve");
  });

  it("export_status가 ready면 [복사하기]가 primary다", () => {
    const state = getSocialPostCardActionState(makeInput({ approvalStatus: "approved", exportStatus: "ready" }));
    expect(state.statusBadge).toBe("export 준비 완료");
    expect(state.primaryAction).toEqual({ label: "복사하기", actionType: "copy_or_view_export" });
    expect(state.secondaryActions).toContainEqual({ label: "게시 결과 기록", actionType: "record_manual_result" });
  });

  it("export_status가 exported면 [내보내기 보기]가 primary다", () => {
    const state = getSocialPostCardActionState(makeInput({ approvalStatus: "approved", exportStatus: "exported" }));
    expect(state.statusBadge).toBe("export 완료");
    expect(state.primaryAction).toEqual({ label: "내보내기 보기", actionType: "copy_or_view_export" });
  });

  it("한 상태에는 primaryAction이 항상 정확히 하나다(배열이 아님)", () => {
    const state = getSocialPostCardActionState(makeInput());
    expect(Array.isArray(state.primaryAction)).toBe(false);
    expect(typeof state.primaryAction.label).toBe("string");
  });
});
