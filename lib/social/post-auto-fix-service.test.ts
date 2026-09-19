import { beforeEach, describe, expect, it, vi } from "vitest";

const getSocialPostById = vi.fn();
const editSocialPostContent = vi.fn();
const runSocialPostQualityGateAndSave = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
}));
vi.mock("./social-post-service", () => ({
  editSocialPostContent: (...args: unknown[]) => editSocialPostContent(...args),
  runSocialPostQualityGateAndSave: (...args: unknown[]) => runSocialPostQualityGateAndSave(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { runAutoFixAndRecheck } = await import("./post-auto-fix-service");

function makeChecklistItem(overrides: Record<string, unknown> = {}) {
  return { key: "some_key", label: "라벨", status: "fail", message: "메시지", ...overrides };
}

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    articleId: "article-1",
    platform: "wordpress_blog",
    postBody: "## 리드문\n\n내용",
    qualityStatus: "needs_revision",
    approvalStatus: "not_requested",
    qualitySummary: { checklist: [makeChecklistItem({ key: "no_internal_section_headings" })] },
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostById.mockReset();
  editSocialPostContent.mockReset();
  runSocialPostQualityGateAndSave.mockReset();
  logEvent.mockReset();

  getSocialPostById.mockResolvedValue(makePost());
  editSocialPostContent.mockResolvedValue({
    success: true,
    message: "저장 완료",
    socialPost: makePost({ postBody: "내용", qualityStatus: "not_checked" }),
  });
  runSocialPostQualityGateAndSave.mockResolvedValue({
    success: true,
    message: "검토 완료",
    socialPost: makePost({
      postBody: "내용",
      qualityStatus: "ready",
      qualitySummary: { checklist: [makeChecklistItem({ key: "no_internal_section_headings", status: "pass" })] },
    }),
  });
});

describe("runAutoFixAndRecheck", () => {
  it("post를 찾을 수 없으면 실패를 반환한다", async () => {
    getSocialPostById.mockResolvedValue(null);
    const result = await runAutoFixAndRecheck("missing");
    expect(result.success).toBe(false);
    expect(result.finalState).toBe("blocked");
  });

  it("auto_fixable(구현됨) issue가 있으면 본문을 자동 정리해서 저장한다", async () => {
    const result = await runAutoFixAndRecheck("post-1");

    expect(editSocialPostContent).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({ editedBy: "system:auto_fix" })
    );
    const savedBody = editSocialPostContent.mock.calls[0][1].postBody;
    expect(savedBody).not.toContain("리드문");
    expect(result.changesApplied.length).toBeGreaterThan(0);
  });

  it("자동 수정 후 항상 자동 재검토를 실행한다", async () => {
    await runAutoFixAndRecheck("post-1");
    expect(runSocialPostQualityGateAndSave).toHaveBeenCalledWith("post-1");
  });

  it("재검토가 pass로 통과하면 finalState가 approvable이다", async () => {
    const result = await runAutoFixAndRecheck("post-1");
    expect(result.finalState).toBe("approvable");
    expect(result.remainingBlockingIssues).toEqual([]);
    expect(result.remainingUserConfirmationIssues).toEqual([]);
  });

  it("재검토 후 user_confirmation_required issue가 남으면 finalState가 user_confirmation_required다", async () => {
    runSocialPostQualityGateAndSave.mockResolvedValue({
      success: true,
      message: "검토 완료",
      socialPost: makePost({
        postBody: "내용",
        qualityStatus: "needs_revision",
        qualitySummary: {
          checklist: [
            makeChecklistItem({ key: "no_internal_section_headings", status: "pass" }),
            makeChecklistItem({ key: "wordpress_blog_single_source_verification_needed_section", status: "fail" }),
          ],
        },
      }),
    });

    const result = await runAutoFixAndRecheck("post-1");
    expect(result.finalState).toBe("user_confirmation_required");
    expect(result.remainingUserConfirmationIssues.map((i) => i.key)).toContain(
      "wordpress_blog_single_source_verification_needed_section"
    );
  });

  it("재검토 후 blocking issue가 남으면 finalState가 blocked다", async () => {
    runSocialPostQualityGateAndSave.mockResolvedValue({
      success: true,
      message: "검토 완료",
      socialPost: makePost({
        postBody: "내용",
        qualityStatus: "blocked",
        qualitySummary: { checklist: [makeChecklistItem({ key: "no_pii_exposure", status: "blocked" })] },
      }),
    });

    const result = await runAutoFixAndRecheck("post-1");
    expect(result.finalState).toBe("blocked");
    expect(result.remainingBlockingIssues.map((i) => i.key)).toContain("no_pii_exposure");
  });

  it("자동 수정 대상이 없어도 재검토는 실행한다(noSafeChangesFound=true)", async () => {
    getSocialPostById.mockResolvedValue(
      makePost({
        postBody: "이미 정리된 본문",
        qualitySummary: { checklist: [makeChecklistItem({ key: "no_internal_section_headings", status: "pass" })] },
      })
    );

    const result = await runAutoFixAndRecheck("post-1");
    expect(editSocialPostContent).not.toHaveBeenCalled();
    expect(runSocialPostQualityGateAndSave).toHaveBeenCalled();
    expect(result.noSafeChangesFound).toBe(true);
  });

  it("user_confirmation_required issue(출처 부족 등)는 자동으로 고치지 않는다 — editSocialPostContent에 새 내용을 추가하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(
      makePost({
        postBody: "정상 본문",
        qualitySummary: {
          checklist: [makeChecklistItem({ key: "wordpress_blog_single_source_verification_needed_section", status: "fail" })],
        },
      })
    );

    await runAutoFixAndRecheck("post-1");
    expect(editSocialPostContent).not.toHaveBeenCalled();
  });

  it("approval_status를 직접 바꾸지 않는다(승인은 이 함수의 책임이 아니다)", async () => {
    const result = await runAutoFixAndRecheck("post-1");
    expect(result.socialPost?.approvalStatus).not.toBe("approved");
  });

  it("로그에 full body를 남기지 않는다", async () => {
    await runAutoFixAndRecheck("post-1");
    for (const call of logEvent.mock.calls) {
      expect(JSON.stringify(call[0])).not.toContain("리드문");
    }
  });

  describe("Phase UX-05A: x/threads/instagram markdown/HTML 잔여물 자동 정리", () => {
    it("X: thread item의 markdown 잔여물을 자동 정리해서 threadItems로 저장한다(postBody는 건드리지 않는다)", async () => {
      getSocialPostById.mockResolvedValue(
        makePost({
          platform: "x",
          postBody: null,
          threadItems: [
            { order: 1, text: "## 오늘의 발표" },
            { order: 2, text: "정상적인 두 번째 글" },
          ],
          cardItems: [],
          qualitySummary: { checklist: [makeChecklistItem({ key: "platform_markup_residue" })] },
        })
      );

      await runAutoFixAndRecheck("post-1");

      expect(editSocialPostContent).toHaveBeenCalledWith(
        "post-1",
        expect.objectContaining({ editedBy: "system:auto_fix" })
      );
      const call = editSocialPostContent.mock.calls[0][1];
      expect(call.threadItems[0].text).toBe("오늘의 발표");
      expect(call.threadItems[1].text).toBe("정상적인 두 번째 글");
      expect(call.postBody).toBeUndefined();
    });

    it("Threads: postBody의 markdown 잔여물을 자동 정리한다", async () => {
      getSocialPostById.mockResolvedValue(
        makePost({
          platform: "threads",
          postBody: "\\*\\*중요 발표\\*\\*가 있었습니다.",
          threadItems: [],
          cardItems: [],
          qualitySummary: { checklist: [makeChecklistItem({ key: "platform_markup_residue" })] },
        })
      );

      const result = await runAutoFixAndRecheck("post-1");

      const savedBody = editSocialPostContent.mock.calls[0][1].postBody;
      expect(savedBody).toBe("중요 발표가 있었습니다.");
      expect(result.changesApplied.length).toBeGreaterThan(0);
    });

    it("Instagram: caption과 card_items의 markdown/HTML 잔여물을 함께 자동 정리한다", async () => {
      getSocialPostById.mockResolvedValue(
        makePost({
          platform: "instagram",
          postBody: null,
          caption: "<p>오늘의 이야기</p>",
          threadItems: [],
          cardItems: [{ order: 1, heading: "## 핵심 요약", body: "정상 본문" }],
          qualitySummary: { checklist: [makeChecklistItem({ key: "platform_markup_residue" })] },
        })
      );

      await runAutoFixAndRecheck("post-1");

      const call = editSocialPostContent.mock.calls[0][1];
      expect(call.caption).toBe("오늘의 이야기");
      expect(call.cardItems[0].heading).toBe("핵심 요약");
      expect(call.cardItems[0].body).toBe("정상 본문");
    });

    it("naver_cafe의 기존 자동 수정 경로는 이 변경으로 영향받지 않는다(회귀 확인)", async () => {
      getSocialPostById.mockResolvedValue(
        makePost({
          platform: "naver_cafe",
          postBody: "\\## 제목\n\n내용",
          qualitySummary: { checklist: [makeChecklistItem({ key: "naver_cafe_no_markdown_escape" })] },
        })
      );

      await runAutoFixAndRecheck("post-1");

      const savedBody = editSocialPostContent.mock.calls[0][1].postBody;
      expect(savedBody).not.toContain("\\##");
      expect(savedBody).toContain("내용");
    });
  });
});
