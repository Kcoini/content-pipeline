import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getSocialPostForDryRun = vi.fn();
const updatePlatformHandoffResult = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostForDryRun: (...args: unknown[]) => getSocialPostForDryRun(...args),
  updatePlatformHandoffResult: (...args: unknown[]) => updatePlatformHandoffResult(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { completePlatformExportHandoff } = await import("./platform-export-handoff-service");

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
    handoffStatus: "ready",
    handoffPayload: { type: "manual_copy_handoff" },
    handoffNotes: null,
    handoffCompletedAt: null,
    handoffCompletedBy: null,
    handoffError: null,
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostForDryRun.mockReset();
  updatePlatformHandoffResult.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
  updatePlatformHandoffResult.mockImplementation(async (id, patch) =>
    makeSocialPost({ id, handoffStatus: patch.status, handoffError: patch.error ?? null, handoffNotes: patch.notes ?? null, handoffCompletedBy: patch.completedBy ?? null })
  );
});

describe("completePlatformExportHandoff", () => {
  it("dry-run이 ready이고 handoff가 ready이면 완료 처리된다", async () => {
    getSocialPostForDryRun.mockResolvedValue(makeSocialPost());

    const result = await completePlatformExportHandoff("social-post-1", "editor", "확인했습니다");

    expect(result.success).toBe(true);
    expect(updatePlatformHandoffResult).toHaveBeenCalledWith(
      "social-post-1",
      expect.objectContaining({ status: "completed", completedBy: "editor" })
    );
  });

  it("handoff_status='completed'로 저장된다", async () => {
    getSocialPostForDryRun.mockResolvedValue(makeSocialPost());

    const result = await completePlatformExportHandoff("social-post-1");

    expect(result.socialPost?.handoffStatus).toBe("completed");
  });

  it("완료 처리해도 publish_status는 'published'로 바뀌지 않는다", async () => {
    getSocialPostForDryRun.mockResolvedValue(makeSocialPost());

    const result = await completePlatformExportHandoff("social-post-1");

    expect(result.socialPost?.publishStatus).not.toBe("published");
  });

  it("platform_publish_dry_run_status가 ready가 아니면 blocked된다", async () => {
    getSocialPostForDryRun.mockResolvedValue(makeSocialPost({ platformPublishDryRunStatus: "not_created" }));

    const result = await completePlatformExportHandoff("social-post-1");

    expect(result.success).toBe(false);
  });

  it("이미 published된 social post는 handoff를 완료할 수 없다", async () => {
    getSocialPostForDryRun.mockResolvedValue(makeSocialPost({ publishStatus: "published" }));

    const result = await completePlatformExportHandoff("social-post-1");

    expect(result.success).toBe(false);
  });

  it("logs에 full payload/full text/API key/auth token이 저장되지 않는다", async () => {
    getSocialPostForDryRun.mockResolvedValue(makeSocialPost());

    await completePlatformExportHandoff("social-post-1", "editor", "매우 긴 메모 텍스트입니다. ".repeat(20));

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("매우 긴 본문");
    expect(serialized).not.toContain("매우 긴 메모");
  });
});
