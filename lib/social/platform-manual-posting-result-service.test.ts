import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getSocialPostForManualPosting = vi.fn();
const updateManualPostingChecklist = vi.fn();
const updateManualPostingResult = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostForManualPosting: (...args: unknown[]) => getSocialPostForManualPosting(...args),
  updateManualPostingChecklist: (...args: unknown[]) => updateManualPostingChecklist(...args),
  updateManualPostingResult: (...args: unknown[]) => updateManualPostingResult(...args),
  SocialPostNotFoundError: class SocialPostNotFoundError extends Error {},
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { prepareManualPostingRecord, recordManualPostingResult, markManualPostingSkipped, markManualPostingFailed } =
  await import("./platform-manual-posting-result-service");

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "제목",
    postBody: "매우 긴 본문 내용입니다. ".repeat(20),
    caption: null,
    excerpt: null,
    hashtags: [],
    threadItems: [],
    cardItems: [],
    mediaRequirements: {},
    platformMetadata: {},
    generationContext: {},
    qualityStatus: "ready",
    qualityScore: 90,
    qualitySummary: {},
    approvalStatus: "approved",
    approvedBy: "editor",
    approvedAt: "2026-01-01T00:00:00.000Z",
    publishStatus: "exported",
    externalPostId: null,
    postUrl: null,
    exportFormat: "naver_blog_markdown_copy",
    exportPayload: { exportTitle: "제목" },
    errorMessage: null,
    generatedAt: "2026-01-01T00:00:00.000Z",
    reviewedAt: null,
    publishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    editedAt: null,
    editedBy: null,
    reviewNotes: null,
    revisionCount: 0,
    lastQualityCheckedAt: null,
    approvalRequestedAt: null,
    rejectionReason: null,
    revokedAt: null,
    revokedReason: null,
    exportStatus: "exported",
    exportedAt: "2026-01-02T00:00:00.000Z",
    exportedBy: "editor",
    exportError: null,
    exportCopyCount: 0,
    lastCopiedAt: null,
    exportNotes: null,
    platformPublishGuardStatus: "ready",
    platformPublishGuardScore: 95,
    platformPublishGuardSummary: {},
    platformPublishGuardError: null,
    platformPublishGuardCheckedAt: "2026-01-03T00:00:00.000Z",
    platformPublishReady: true,
    platformPublishBlockedReason: null,
    platformPublishDryRunStatus: "ready",
    platformPublishDryRunPayload: { type: "manual_copy_handoff" },
    platformPublishDryRunError: null,
    platformPublishDryRunCreatedAt: "2026-01-04T00:00:00.000Z",
    platformPublishDryRunCreatedBy: "editor",
    handoffStatus: "completed",
    handoffPayload: { type: "manual_copy_handoff" },
    handoffNotes: null,
    handoffCompletedAt: "2026-01-05T00:00:00.000Z",
    handoffCompletedBy: "editor",
    handoffError: null,
    manualPostStatus: "not_recorded",
    manualPostUrl: null,
    manualPostedAt: null,
    manualPostedBy: null,
    manualPostResultNotes: null,
    manualPostError: null,
    manualPostRecordedAt: null,
    manualPostRecordedBy: null,
    manualPostChecklist: [],
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostForManualPosting.mockReset();
  updateManualPostingChecklist.mockReset();
  updateManualPostingResult.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
  updateManualPostingChecklist.mockImplementation(async (id, checklist) =>
    makeSocialPost({ id, manualPostStatus: "ready_to_record", manualPostChecklist: checklist })
  );
  updateManualPostingResult.mockImplementation(async (id, patch) =>
    makeSocialPost({
      id,
      manualPostStatus: patch.status,
      manualPostUrl: patch.manualPostUrl ?? null,
      manualPostedAt: patch.manualPostedAt ?? null,
      manualPostedBy: patch.manualPostedBy ?? null,
      manualPostError: patch.error ?? null,
      manualPostResultNotes: patch.notes ?? null,
      publishStatus: patch.status === "posted" && patch.markPublished ? "published" : "exported",
      postUrl: patch.status === "posted" && patch.markPublished ? patch.manualPostUrl ?? null : null,
    })
  );
});

describe("prepareManualPostingRecord", () => {
  it("handoff_status='completed'이면 준비가 가능하다", async () => {
    getSocialPostForManualPosting.mockResolvedValue(makeSocialPost({ handoffStatus: "completed" }));

    const result = await prepareManualPostingRecord("social-post-1");

    expect(result.success).toBe(true);
    expect(updateManualPostingChecklist).toHaveBeenCalled();
  });

  it("handoff_status가 completed가 아니면 blocked된다", async () => {
    getSocialPostForManualPosting.mockResolvedValue(makeSocialPost({ handoffStatus: "ready" }));

    const result = await prepareManualPostingRecord("social-post-1");

    expect(result.success).toBe(false);
    expect(updateManualPostingResult).toHaveBeenCalledWith("social-post-1", expect.objectContaining({ status: "blocked" }));
  });
});

describe("recordManualPostingResult", () => {
  it("모든 조건을 만족하면 posted로 기록되고 publish_status='published'가 된다", async () => {
    getSocialPostForManualPosting.mockResolvedValue(makeSocialPost());

    const result = await recordManualPostingResult("social-post-1", {
      manualPostUrl: "https://blog.naver.com/myid/12345",
      manualPostedBy: "editor",
    });

    expect(result.success).toBe(true);
    expect(result.socialPost?.manualPostStatus).toBe("posted");
    expect(result.socialPost?.publishStatus).toBe("published");
  });

  it("posted 기록 시 post_url/manual_post_url이 저장된다", async () => {
    getSocialPostForManualPosting.mockResolvedValue(makeSocialPost());

    const result = await recordManualPostingResult("social-post-1", { manualPostUrl: "https://blog.naver.com/myid/12345" });

    expect(result.socialPost?.manualPostUrl).toBe("https://blog.naver.com/myid/12345");
    expect(result.socialPost?.postUrl).toBe("https://blog.naver.com/myid/12345");
  });

  it("approval_status가 approved가 아니면 blocked된다", async () => {
    getSocialPostForManualPosting.mockResolvedValue(makeSocialPost({ approvalStatus: "pending_review" }));

    const result = await recordManualPostingResult("social-post-1", { manualPostUrl: "https://blog.naver.com/x" });

    expect(result.success).toBe(false);
  });

  it("quality_status가 ready가 아니면 blocked된다", async () => {
    getSocialPostForManualPosting.mockResolvedValue(makeSocialPost({ qualityStatus: "needs_revision" }));

    const result = await recordManualPostingResult("social-post-1", { manualPostUrl: "https://blog.naver.com/x" });

    expect(result.success).toBe(false);
  });

  it("platform_publish_guard_status가 ready가 아니면 blocked된다", async () => {
    getSocialPostForManualPosting.mockResolvedValue(makeSocialPost({ platformPublishGuardStatus: "needs_revision" }));

    const result = await recordManualPostingResult("social-post-1", { manualPostUrl: "https://blog.naver.com/x" });

    expect(result.success).toBe(false);
  });

  it("platform_publish_ready=false이면 blocked된다", async () => {
    getSocialPostForManualPosting.mockResolvedValue(makeSocialPost({ platformPublishReady: false }));

    const result = await recordManualPostingResult("social-post-1", { manualPostUrl: "https://blog.naver.com/x" });

    expect(result.success).toBe(false);
  });

  it("platform_publish_dry_run_status가 ready가 아니면 blocked된다", async () => {
    getSocialPostForManualPosting.mockResolvedValue(makeSocialPost({ platformPublishDryRunStatus: "not_created" }));

    const result = await recordManualPostingResult("social-post-1", { manualPostUrl: "https://blog.naver.com/x" });

    expect(result.success).toBe(false);
  });

  it("handoff_status가 completed가 아니면 blocked된다", async () => {
    getSocialPostForManualPosting.mockResolvedValue(makeSocialPost({ handoffStatus: "ready" }));

    const result = await recordManualPostingResult("social-post-1", { manualPostUrl: "https://blog.naver.com/x" });

    expect(result.success).toBe(false);
  });

  it("URL이 없으면 blocked된다", async () => {
    getSocialPostForManualPosting.mockResolvedValue(makeSocialPost());

    const result = await recordManualPostingResult("social-post-1", { manualPostUrl: "" });

    expect(result.success).toBe(false);
  });

  it("URL 형식이 올바르지 않으면 blocked된다", async () => {
    getSocialPostForManualPosting.mockResolvedValue(makeSocialPost());

    const result = await recordManualPostingResult("social-post-1", { manualPostUrl: "이것은 URL이 아닙니다" });

    expect(result.success).toBe(false);
  });
});

describe("markManualPostingFailed / markManualPostingSkipped", () => {
  it("failed 기록 시 publish_status가 published로 바뀌지 않는다", async () => {
    getSocialPostForManualPosting.mockResolvedValue(makeSocialPost());

    const result = await markManualPostingFailed("social-post-1", { reason: "네이버 로그인 실패" });

    expect(result.success).toBe(true);
    expect(result.socialPost?.publishStatus).not.toBe("published");
    expect(updateManualPostingResult).toHaveBeenCalledWith("social-post-1", expect.objectContaining({ status: "failed" }));
  });

  it("skipped 기록 시 publish_status가 published로 바뀌지 않는다", async () => {
    getSocialPostForManualPosting.mockResolvedValue(makeSocialPost());

    const result = await markManualPostingSkipped("social-post-1", { reason: "보류" });

    expect(result.success).toBe(true);
    expect(result.socialPost?.publishStatus).not.toBe("published");
    expect(updateManualPostingResult).toHaveBeenCalledWith("social-post-1", expect.objectContaining({ status: "skipped" }));
  });
});

describe("보안 요구사항", () => {
  it("logs에 full content/API key/auth token이 저장되지 않는다", async () => {
    getSocialPostForManualPosting.mockResolvedValue(makeSocialPost());

    await recordManualPostingResult("social-post-1", { manualPostUrl: "https://blog.naver.com/myid/12345" });

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("매우 긴 본문");
  });
});
