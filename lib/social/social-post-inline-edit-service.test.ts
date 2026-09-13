import { beforeEach, describe, expect, it, vi } from "vitest";

const getSocialPostById = vi.fn();
const editSocialPostContent = vi.fn();
const runSocialPostQualityGateAndSave = vi.fn();
const approveSocialPost = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
}));
vi.mock("./social-post-service", () => ({
  editSocialPostContent: (...args: unknown[]) => editSocialPostContent(...args),
  runSocialPostQualityGateAndSave: (...args: unknown[]) => runSocialPostQualityGateAndSave(...args),
}));
vi.mock("./social-post-approval-service", () => ({
  approveSocialPost: (...args: unknown[]) => approveSocialPost(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { getSocialPostEditableField, saveSocialPostBodyAndProcess } = await import("./social-post-inline-edit-service");

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    articleId: "article-1",
    platform: "naver_cafe",
    postBody: "기존 본문",
    caption: null,
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

  getSocialPostById.mockResolvedValue(makePost());
  editSocialPostContent.mockResolvedValue({ success: true, message: "저장 완료", socialPost: makePost({ postBody: "새 본문", qualityStatus: "not_checked" }) });
  runSocialPostQualityGateAndSave.mockResolvedValue({ success: true, message: "검토 완료", socialPost: makePost({ postBody: "새 본문", qualityStatus: "ready" }) });
  approveSocialPost.mockResolvedValue({ success: true, message: "승인됨", socialPost: makePost({ postBody: "새 본문", qualityStatus: "ready", approvalStatus: "approved" }) });
});

describe("getSocialPostEditableField", () => {
  it("naver_cafe/naver_blog/wordpress_blog/threads는 postBody다", () => {
    expect(getSocialPostEditableField("naver_cafe")).toBe("postBody");
    expect(getSocialPostEditableField("naver_blog")).toBe("postBody");
    expect(getSocialPostEditableField("wordpress_blog")).toBe("postBody");
    expect(getSocialPostEditableField("threads")).toBe("postBody");
  });

  it("instagram은 caption이다", () => {
    expect(getSocialPostEditableField("instagram")).toBe("caption");
  });

  it("x는 threadItems 배열 기반이라 null(지원 안 함)이다", () => {
    expect(getSocialPostEditableField("x")).toBeNull();
  });
});

describe("saveSocialPostBodyAndProcess", () => {
  it("본문이 비어 있으면 저장 자체를 차단한다", async () => {
    const result = await saveSocialPostBodyAndProcess("post-1", "   ", "save_only", "tester");
    expect(result.success).toBe(false);
    expect(result.message).toContain("비어 있어");
    expect(editSocialPostContent).not.toHaveBeenCalled();
  });

  it("x 플랫폼은 지원하지 않는다는 메시지와 함께 차단된다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "x" }));
    const result = await saveSocialPostBodyAndProcess("post-1", "새 내용", "save_only", "tester");
    expect(result.success).toBe(false);
    expect(result.message).toContain("상세 페이지");
    expect(editSocialPostContent).not.toHaveBeenCalled();
  });

  it("naver_cafe는 postBody 필드로 저장한다", async () => {
    await saveSocialPostBodyAndProcess("post-1", "새 본문", "save_only", "tester");
    expect(editSocialPostContent).toHaveBeenCalledWith("post-1", { postBody: "새 본문", editedBy: "tester" });
  });

  it("instagram은 caption 필드로 저장한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "instagram" }));
    await saveSocialPostBodyAndProcess("post-1", "새 캡션", "save_only", "tester");
    expect(editSocialPostContent).toHaveBeenCalledWith("post-1", { caption: "새 캡션", editedBy: "tester" });
  });

  it("save_only는 저장만 하고 자동 검토를 실행하지 않는다", async () => {
    const result = await saveSocialPostBodyAndProcess("post-1", "새 본문", "save_only", "tester");
    expect(result.success).toBe(true);
    expect(result.stage).toBe("saved");
    expect(result.message).toContain("자동 검토가 다시 필요");
    expect(runSocialPostQualityGateAndSave).not.toHaveBeenCalled();
    expect(approveSocialPost).not.toHaveBeenCalled();
  });

  it("save_and_review는 저장 후 자동 검토를 실행하고, 통과하면 승인 가능 상태를 알린다", async () => {
    const result = await saveSocialPostBodyAndProcess("post-1", "새 본문", "save_and_review", "tester");
    expect(runSocialPostQualityGateAndSave).toHaveBeenCalledWith("post-1");
    expect(approveSocialPost).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.stage).toBe("reviewed_passed");
    expect(result.message).toContain("자동 검토를 통과했습니다");
  });

  it("save_and_review에서 검토가 통과하지 못하면 문제를 표시하고 승인을 호출하지 않는다", async () => {
    runSocialPostQualityGateAndSave.mockResolvedValue({
      success: true,
      message: "검토 완료",
      socialPost: makePost({ qualityStatus: "needs_revision", qualitySummary: { checklist: [{ key: "x", status: "fail", message: "문제 발생", axisLabel: "구조" }] } }),
    });
    const result = await saveSocialPostBodyAndProcess("post-1", "새 본문", "save_and_review", "tester");
    expect(result.success).toBe(false);
    expect(result.stage).toBe("reviewed_failed");
    expect(approveSocialPost).not.toHaveBeenCalled();
  });

  it("save_review_and_approve는 저장 → 검토 → 승인 순서로 처리하고, 통과 시 승인된다", async () => {
    const result = await saveSocialPostBodyAndProcess("post-1", "새 본문", "save_review_and_approve", "tester");
    expect(editSocialPostContent).toHaveBeenCalled();
    expect(runSocialPostQualityGateAndSave).toHaveBeenCalledWith("post-1");
    expect(approveSocialPost).toHaveBeenCalledWith("post-1", "tester");
    expect(result.success).toBe(true);
    expect(result.stage).toBe("approved");
    expect(result.message).toContain("글이 승인되었습니다");
    expect(result.socialPost?.approvalStatus).toBe("approved");
  });

  it("save_review_and_approve에서 승인이 거부되면(quality gate 문제) approval_status가 approved로 바뀌지 않는다", async () => {
    approveSocialPost.mockResolvedValue({ success: false, message: "quality gate 결과에 차단 사유가 남아 있습니다." });
    const result = await saveSocialPostBodyAndProcess("post-1", "새 본문", "save_review_and_approve", "tester");
    expect(result.success).toBe(false);
    expect(result.stage).toBe("approve_blocked");
    expect(result.socialPost?.approvalStatus).not.toBe("approved");
    expect(result.message).toContain("승인하지 않았습니다");
  });

  it("호출 순서는 항상 저장 → 검토 → 승인이다(승인을 먼저 시도하지 않는다)", async () => {
    const callOrder: string[] = [];
    editSocialPostContent.mockImplementation(async () => {
      callOrder.push("save");
      return { success: true, message: "ok", socialPost: makePost() };
    });
    runSocialPostQualityGateAndSave.mockImplementation(async () => {
      callOrder.push("review");
      return { success: true, message: "ok", socialPost: makePost({ qualityStatus: "ready" }) };
    });
    approveSocialPost.mockImplementation(async () => {
      callOrder.push("approve");
      return { success: true, message: "ok", socialPost: makePost({ approvalStatus: "approved" }) };
    });

    await saveSocialPostBodyAndProcess("post-1", "새 본문", "save_review_and_approve", "tester");
    expect(callOrder).toEqual(["save", "review", "approve"]);
  });
});
