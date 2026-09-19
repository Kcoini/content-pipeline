// Phase UX-06: Journey 5 — Rewrite. "개선안 선택 → 개선안 적용 → 재검토
// 요청 → 최종 승인"까지, "승인"이라는 단어가 실제 최종 게이트에만
// 쓰이는지 실제 서비스 함수를 체이닝해서 검증한다. 전부 순수 함수라
// mock이 필요 없다.
//
// 사용자 click/판단 단계 tally(참고용):
//   사람이 직접 눌러야 하는 것: 개선안 선택 → 개선안 적용 → 원본과 비교(선택) →
//     재검토 요청 → 최종 승인 = 최대 5회
//   시스템 자동: 없음(rewrite 흐름은 quality-gate/auto-fix 시스템과 무관 —
//     UX-04A/05A에서 이미 확인된 사실 재확인)
//   반복 불필요 click: 완료된 단계는 disabled 사유가 항상 제공되어 다시
//     누를 수 없다(describe*DisabledReason 계열 helper가 보장)

import { describe, expect, it } from "vitest";
import {
  getRewriteSuggestionNextAction,
  describeRewriteSuggestionStatus,
  describeSelectSuggestionDisabledReason,
  getRewriteVersionNextAction,
  describeRequestReapprovalDisabledReason,
  describeApproveReapprovalDisabledReason,
} from "@/lib/social/rewrite-version-user-facing-status";

describe("Journey 5 — Rewrite: 개선안 선택 → 적용 → 재검토 요청 → 최종 승인 (Phase UX-06)", () => {
  it("1단계: 초안 상태의 개선안은 '개선안 선택'이 다음 action이다(라벨에 '승인'을 쓰지 않는다)", () => {
    const action = getRewriteSuggestionNextAction({ suggestionStatus: "draft", applicationStatus: "not_applied" });
    expect(action.kind).toBe("approve_suggestion"); // 내부 kind 이름은 유지(state machine 불변)
    expect(action.label).toBe("개선안 선택");
    expect(action.label).not.toContain("승인");
  });

  it("2단계: 개선안을 선택(suggestionStatus=approved)한 뒤에는 다시 '선택'이 반복되지 않고 '개선안 적용'이 다음이다", () => {
    const action = getRewriteSuggestionNextAction({ suggestionStatus: "approved", applicationStatus: "not_applied" });
    expect(action.kind).toBe("apply_suggestion");
    expect(action.label).toBe("개선안 적용");

    const disabledReason = describeSelectSuggestionDisabledReason("approved");
    expect(disabledReason).toBeTruthy(); // 이미 선택된 개선안은 다시 "개선안 선택" primary로 나오면 안 된다
  });

  it("3단계: suggestionStatus='approved'의 사용자 라벨은 '선택됨'이다 — '승인 완료'가 아니다(최종 승인과 혼동 방지, UX-03B2 semantic split)", () => {
    expect(describeRewriteSuggestionStatus("approved")).toBe("선택됨");
    expect(describeRewriteSuggestionStatus("approved")).not.toBe("승인 완료");
  });

  it("4단계: 재검토 요청 전(not_requested) + 비교 대상 없음 → '재검토 요청'이 다음이다(라벨에 '재승인' 쓰지 않는다)", () => {
    const action = getRewriteVersionNextAction({
      rewriteReapprovalStatus: "not_requested",
      rewriteReexportStatus: "not_started",
      hasComparisonTarget: false,
    });
    expect(action.label).toBe("재검토 요청");
    expect(action.label).not.toContain("재승인");
  });

  it("5단계: 재검토 요청 후(pending_review) → '최종 승인'이 다음이다 — 이 화면에서 '승인'이라는 단어가 쓰이는 유일한 지점", () => {
    const action = getRewriteVersionNextAction({
      rewriteReapprovalStatus: "pending_review",
      rewriteReexportStatus: "not_started",
      hasComparisonTarget: false,
    });
    expect(action.label).toBe("최종 승인");

    const requestDisabledReason = describeRequestReapprovalDisabledReason("pending_review");
    expect(requestDisabledReason).toBeTruthy(); // 이미 재검토 요청 중이면 다시 요청할 수 없다(반복 방지)
    const approveDisabledReason = describeApproveReapprovalDisabledReason("pending_review");
    expect(approveDisabledReason).toBeNull(); // 지금은 승인 가능해야 한다
  });

  it("성공 계약: 최종 승인(rewriteReapprovalStatus=approved) 도달 후에는 재내보내기 준비가 다음이고, '최종 승인'이 다시 나오지 않는다", () => {
    const action = getRewriteVersionNextAction({
      rewriteReapprovalStatus: "approved",
      rewriteReexportStatus: "not_started",
      hasComparisonTarget: false,
    });
    expect(action.label).not.toBe("최종 승인");
    expect(action.kind).toBe("prepare_reexport");

    const approveDisabledReason = describeApproveReapprovalDisabledReason("approved");
    expect(approveDisabledReason).toBeTruthy(); // 이미 승인 완료 — 다시 누를 수 없다(반복 노출 금지)
  });

  it("전체 흐름에서 raw 상태값(suggestion_status/rewrite_reapproval_status)이 사용자 라벨에 그대로 노출되지 않는다", () => {
    const labels = [
      getRewriteSuggestionNextAction({ suggestionStatus: "draft", applicationStatus: "not_applied" }).label,
      getRewriteSuggestionNextAction({ suggestionStatus: "approved", applicationStatus: "not_applied" }).label,
      describeRewriteSuggestionStatus("approved"),
      getRewriteVersionNextAction({ rewriteReapprovalStatus: "not_requested", rewriteReexportStatus: "not_started", hasComparisonTarget: false }).label,
      getRewriteVersionNextAction({ rewriteReapprovalStatus: "pending_review", rewriteReexportStatus: "not_started", hasComparisonTarget: false }).label,
    ];
    for (const label of labels) {
      expect(label).not.toContain("suggestion_status");
      expect(label).not.toContain("rewrite_reapproval_status");
      expect(label).not.toMatch(/^(draft|approved|pending_review|not_requested)$/);
    }
  });
});
