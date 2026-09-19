// Phase UX-06: Journey 3 — X thread. "thread 본문을 인라인으로 수정 →
// 저장 → 자동 검토 → 승인 → 이미 승인/게시된 글을 다시 수정하면 정책대로
// 막히거나 무효화되는가"를 실제 서비스 함수를 체이닝해서 검증한다.
// repository 경계만 mock한다(social-post-inline-edit-service.test.ts와
// 동일한 패턴).
//
// 사용자 click/판단 단계 tally(참고용):
//   사람이 직접 눌러야 하는 것: [본문 수정] 클릭 → thread item별 textarea
//     수정 → 저장(저장만/저장+검토/저장+승인 중 선택) → (필요시) 최종 승인 = 최대 4회
//   시스템 자동: 저장 후 자동 검토 재실행(저장+검토/저장+승인 선택 시) = 1단계
//   반복 불필요 click: 없음 — "본문 수정"은 항상 같은 카드 안 inline
//     편집이며 상세 페이지 이동이 없다(UX-03B2에서 X도 통일됨)

import { beforeEach, describe, expect, it, vi } from "vitest";

const getSocialPostById = vi.fn();
const editSocialPostContent = vi.fn();
const runSocialPostQualityGateAndSave = vi.fn();
const approveSocialPost = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
}));
vi.mock("@/lib/social/social-post-service", () => ({
  editSocialPostContent: (...args: unknown[]) => editSocialPostContent(...args),
  runSocialPostQualityGateAndSave: (...args: unknown[]) => runSocialPostQualityGateAndSave(...args),
}));
vi.mock("@/lib/social/social-post-approval-service", () => ({
  approveSocialPost: (...args: unknown[]) => approveSocialPost(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { saveSocialPostThreadAndProcess } = await import("@/lib/social/social-post-inline-edit-service");
const { runSocialPostQualityGate } = await import("@/lib/social/social-quality-gate");

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    articleId: "article-1",
    platform: "x",
    postBody: null,
    caption: null,
    threadItems: [
      { order: 1, text: "첫 번째 트윗" },
      { order: 2, text: "두 번째 트윗" },
    ],
    qualityStatus: "ready",
    approvalStatus: "not_requested",
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostById.mockReset();
  editSocialPostContent.mockReset();
  runSocialPostQualityGateAndSave.mockReset();
  approveSocialPost.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});

  getSocialPostById.mockResolvedValue(makePost());
  editSocialPostContent.mockResolvedValue({
    success: true,
    message: "저장 완료",
    socialPost: makePost({ qualityStatus: "not_checked", approvalStatus: "not_requested" }),
  });
  runSocialPostQualityGateAndSave.mockResolvedValue({
    success: true,
    message: "검토 완료",
    socialPost: makePost({ qualityStatus: "ready" }),
  });
});

describe("Journey 3 — X thread: inline 편집 → 순서 보존 → 검토 → 승인 → 재수정 정책 (Phase UX-06)", () => {
  it("1단계: 280자 초과 thread item은 quality gate가 잡아낸다(기존 규칙 재사용, 새 제한 아님)", () => {
    const result = runSocialPostQualityGate({
      platform: "x",
      toneStyle: "informational",
      threadItems: [{ order: 1, text: "x".repeat(281) }],
    });
    const item = result.checklist.find((c) => c.key === "x_thread_item_length");
    expect(item?.status).not.toBe("pass");
  });

  it("2단계: 빈 item은 저장 시 제거되고 순서가 다시 매겨진다(FormData 순서 그대로 반영)", async () => {
    await saveSocialPostThreadAndProcess("post-1", ["첫 번째", "  ", "세 번째"], "save_only", "editor");
    expect(editSocialPostContent).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({
        threadItems: [
          { order: 1, text: "첫 번째" },
          { order: 2, text: "세 번째" },
        ],
      })
    );
  });

  it("3단계: 전부 빈 item이면 저장 자체를 막는다(완전히 빈 thread 저장 방지)", async () => {
    const result = await saveSocialPostThreadAndProcess("post-1", ["  ", ""], "save_only", "editor");
    expect(result.success).toBe(false);
    expect(editSocialPostContent).not.toHaveBeenCalled();
  });

  it("4단계: save_review_and_approve로 저장하면 저장 → 재검토 → 승인까지 한 번에 이어진다(사람이 세 번 누를 필요 없음)", async () => {
    editSocialPostContent.mockResolvedValue({
      success: true,
      message: "저장 완료",
      socialPost: makePost({ qualityStatus: "not_checked" }),
    });
    runSocialPostQualityGateAndSave.mockResolvedValue({
      success: true,
      message: "검토 완료",
      socialPost: makePost({ qualityStatus: "ready" }),
    });
    approveSocialPost.mockResolvedValue({
      success: true,
      message: "승인됨",
      socialPost: makePost({ qualityStatus: "ready", approvalStatus: "approved" }),
    });

    const result = await saveSocialPostThreadAndProcess("post-1", ["첫 번째", "두 번째"], "save_review_and_approve", "editor");

    expect(editSocialPostContent).toHaveBeenCalledTimes(1);
    expect(runSocialPostQualityGateAndSave).toHaveBeenCalledTimes(1);
    expect(approveSocialPost).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  it("5단계(성공 계약): 승인된 post를 다시 수정하면 저장소 정책에 따라 quality_status/approval_status가 초기화된다 — 이 파일은 repository를 mock하므로 실제 초기화 로직 자체는 saveSocialPostRevision(lib/repositories/social-posts-repository.ts)에서 보장되고, 여기서는 editSocialPostContent 호출이 항상 일어난다는 계약만 확인한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ qualityStatus: "ready", approvalStatus: "approved" }));
    editSocialPostContent.mockResolvedValue({
      success: true,
      message: "수정 완료 — 재검토가 필요합니다.",
      socialPost: makePost({ qualityStatus: "not_checked", approvalStatus: "not_requested" }),
    });

    const result = await saveSocialPostThreadAndProcess("post-1", ["수정된 첫 번째"], "save_only", "editor");
    expect(result.success).toBe(true);
    expect(result.socialPost?.approvalStatus).toBe("not_requested");
    expect(result.socialPost?.qualityStatus).toBe("not_checked");
  });

  it("6단계: 이미 게시 완료(publishStatus=published)로 표시된 post를 수정하려 하면 자연어 오류로 막힌다(크래시 없음)", async () => {
    editSocialPostContent.mockResolvedValue({
      success: false,
      message: "이미 게시된 social post는 수정할 수 없습니다.",
    });

    const result = await saveSocialPostThreadAndProcess("post-1", ["수정 시도"], "save_only", "editor");
    expect(result.success).toBe(false);
    expect(result.message).toContain("이미 게시된");
    expect(result.message).not.toMatch(/Error:|undefined|null pointer/i);
  });
});
