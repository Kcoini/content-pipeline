import { describe, expect, it } from "vitest";
import {
  getUserFacingStatus,
  getNextRecommendedAction,
  describeSocialPostStatusFields,
} from "./social-post-user-facing-status";

function makeStatus(overrides: Partial<{ qualityStatus: string; approvalStatus: string; exportStatus: string }> = {}) {
  return {
    qualityStatus: "not_checked",
    approvalStatus: "not_requested",
    exportStatus: "not_exported",
    ...overrides,
  } as never;
}

describe("getUserFacingStatus (Phase 3-22: 내부 상태값 사용자 친화 번역)", () => {
  it("품질검사 전이면 '품질검사 전입니다'를 반환한다", () => {
    expect(getUserFacingStatus(makeStatus())).toBe("품질검사 전입니다");
  });

  it("품질검사 통과 + 승인 요청 전이면 '검토가 필요합니다' 류 문구를 반환한다", () => {
    expect(getUserFacingStatus(makeStatus({ qualityStatus: "ready" }))).toContain("검토가 필요");
  });

  it("승인 대기 중이면 '현재 검토가 필요합니다'를 반환한다", () => {
    expect(getUserFacingStatus(makeStatus({ qualityStatus: "ready", approvalStatus: "pending_review" }))).toBe(
      "현재 검토가 필요합니다"
    );
  });

  it("승인 완료면 '복사/export' 관련 문구를 반환한다", () => {
    expect(getUserFacingStatus(makeStatus({ qualityStatus: "ready", approvalStatus: "approved" }))).toContain(
      "복사/export"
    );
  });

  it("내보내기 완료면 export 완료 문구를 반환한다", () => {
    expect(
      getUserFacingStatus(makeStatus({ qualityStatus: "ready", approvalStatus: "approved", exportStatus: "exported" }))
    ).toContain("내보내기(export)까지 완료");
  });

  it("품질검사 실패면 실패 문구를 반환한다", () => {
    expect(getUserFacingStatus(makeStatus({ qualityStatus: "failed" }))).toContain("실패");
  });

  it("반려되면 반려 문구를 반환한다", () => {
    expect(getUserFacingStatus(makeStatus({ approvalStatus: "rejected" }))).toContain("반려");
  });

  it("raw 상태값 문자열(예: 'pending_review')을 그대로 노출하지 않는다", () => {
    const result = getUserFacingStatus(makeStatus({ approvalStatus: "pending_review", qualityStatus: "ready" }));
    expect(result).not.toContain("pending_review");
    expect(result).not.toContain("ready");
  });
});

describe("getNextRecommendedAction (Phase 3-22: 카드당 주요 버튼 하나 결정)", () => {
  it("post가 없으면(생성 전) '글 생성하기'를 반환한다", () => {
    expect(getNextRecommendedAction(null)).toEqual({ kind: "generate", label: "글 생성하기" });
  });

  it("품질검사 통과 + 승인 요청 전이면 '글 검토하기'를 반환한다", () => {
    expect(getNextRecommendedAction(makeStatus({ qualityStatus: "ready" }))).toEqual({
      kind: "review",
      label: "글 검토하기",
    });
  });

  it("승인 대기 중이면 '승인하기'를 반환한다", () => {
    expect(getNextRecommendedAction(makeStatus({ qualityStatus: "ready", approvalStatus: "pending_review" }))).toEqual(
      { kind: "approve", label: "승인하기" }
    );
  });

  it("승인 완료면 '복사/export 준비하기'를 반환한다", () => {
    expect(getNextRecommendedAction(makeStatus({ qualityStatus: "ready", approvalStatus: "approved" }))).toEqual({
      kind: "export",
      label: "복사/export 준비하기",
    });
  });

  it("내보내기 완료면 '기존 글 보기'를 반환한다", () => {
    expect(
      getNextRecommendedAction(makeStatus({ qualityStatus: "ready", approvalStatus: "approved", exportStatus: "exported" }))
    ).toEqual({ kind: "view_existing", label: "기존 글 보기" });
  });

  it("실패/차단이면 '다시 생성하기'를 반환한다", () => {
    expect(getNextRecommendedAction(makeStatus({ qualityStatus: "failed" }))).toEqual({
      kind: "retry",
      label: "다시 생성하기",
    });
    expect(getNextRecommendedAction(makeStatus({ qualityStatus: "blocked" }))).toEqual({
      kind: "retry",
      label: "다시 생성하기",
    });
  });

  it("반려/취소되면 '다시 검토 요청하기'를 반환한다", () => {
    expect(getNextRecommendedAction(makeStatus({ approvalStatus: "rejected" }))).toEqual({
      kind: "review",
      label: "다시 검토 요청하기",
    });
  });

  it("항상 정확히 하나의 액션만 반환한다(배열이 아니라 단일 객체)", () => {
    const result = getNextRecommendedAction(makeStatus({ qualityStatus: "ready", approvalStatus: "approved" }));
    expect(typeof result.kind).toBe("string");
    expect(typeof result.label).toBe("string");
  });
});

describe("describeSocialPostStatusFields (Phase 3-22: 상세 상태 보기용 원문+라벨)", () => {
  it("각 필드의 원문 값과 한국어 라벨을 함께 반환한다", () => {
    const result = describeSocialPostStatusFields(
      makeStatus({ qualityStatus: "ready", approvalStatus: "pending_review", exportStatus: "blocked" })
    );
    const quality = result.find((r) => r.key === "qualityStatus");
    expect(quality?.rawValue).toBe("ready");
    expect(quality?.label).toBe("품질검사 통과");
    const approval = result.find((r) => r.key === "approvalStatus");
    expect(approval?.rawValue).toBe("pending_review");
    expect(approval?.label).toBe("검토 대기 중");
  });
});
