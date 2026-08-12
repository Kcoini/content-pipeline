import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getSocialPostForDryRun = vi.fn();
const updatePlatformPublishDryRunResult = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostForDryRun: (...args: unknown[]) => getSocialPostForDryRun(...args),
  updatePlatformPublishDryRunResult: (...args: unknown[]) => updatePlatformPublishDryRunResult(...args),
  SocialPostNotFoundError: class SocialPostNotFoundError extends Error {},
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { createPlatformPublishDryRun } = await import("./platform-publish-dry-run-service");

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "제목",
    postBody: "충분히 긴 본문 내용입니다.",
    caption: null,
    excerpt: null,
    hashtags: ["키워드1"],
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
    platformPublishDryRunStatus: "not_created",
    platformPublishDryRunPayload: {},
    platformPublishDryRunError: null,
    platformPublishDryRunCreatedAt: null,
    platformPublishDryRunCreatedBy: null,
    handoffStatus: "not_started",
    handoffPayload: {},
    handoffNotes: null,
    handoffCompletedAt: null,
    handoffCompletedBy: null,
    handoffError: null,
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostForDryRun.mockReset();
  updatePlatformPublishDryRunResult.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
  updatePlatformPublishDryRunResult.mockImplementation(async (id, patch) =>
    makeSocialPost({ id, platformPublishDryRunStatus: patch.status, platformPublishDryRunError: patch.error ?? null, handoffStatus: patch.handoffStatus ?? "not_started" })
  );
});

describe("createPlatformPublishDryRun", () => {
  it("platform_publish_ready=true이면 dry-run이 가능하다", async () => {
    getSocialPostForDryRun.mockResolvedValue(makeSocialPost());

    const result = await createPlatformPublishDryRun("social-post-1", "editor");

    expect(result.success).toBe(true);
    expect(updatePlatformPublishDryRunResult).toHaveBeenCalledWith(
      "social-post-1",
      expect.objectContaining({ status: "ready", handoffStatus: "ready" })
    );
  });

  it("platform_publish_guard_status가 ready가 아니면 blocked된다", async () => {
    getSocialPostForDryRun.mockResolvedValue(makeSocialPost({ platformPublishGuardStatus: "needs_revision" }));

    const result = await createPlatformPublishDryRun("social-post-1");

    expect(result.success).toBe(false);
    expect(updatePlatformPublishDryRunResult).toHaveBeenCalledWith(
      "social-post-1",
      expect.objectContaining({ status: "blocked" })
    );
  });

  it("approval_status가 approved가 아니면 blocked된다", async () => {
    getSocialPostForDryRun.mockResolvedValue(makeSocialPost({ approvalStatus: "pending_review" }));

    const result = await createPlatformPublishDryRun("social-post-1");

    expect(result.success).toBe(false);
  });

  it("quality_status가 ready가 아니면 blocked된다", async () => {
    getSocialPostForDryRun.mockResolvedValue(makeSocialPost({ qualityStatus: "needs_revision" }));

    const result = await createPlatformPublishDryRun("social-post-1");

    expect(result.success).toBe(false);
  });

  it("export_status가 ready/exported가 아니면 blocked된다", async () => {
    getSocialPostForDryRun.mockResolvedValue(makeSocialPost({ exportStatus: "not_exported" }));

    const result = await createPlatformPublishDryRun("social-post-1");

    expect(result.success).toBe(false);
  });

  it("publish_status='published'이면 blocked된다", async () => {
    getSocialPostForDryRun.mockResolvedValue(makeSocialPost({ publishStatus: "published" }));

    const result = await createPlatformPublishDryRun("social-post-1");

    expect(result.success).toBe(false);
  });

  it("성공 시 platform_publish_dry_run_status='ready'와 handoff_status='ready'를 저장한다", async () => {
    getSocialPostForDryRun.mockResolvedValue(makeSocialPost());

    await createPlatformPublishDryRun("social-post-1");

    expect(updatePlatformPublishDryRunResult).toHaveBeenCalledWith(
      "social-post-1",
      expect.objectContaining({ status: "ready", handoffStatus: "ready", dryRunPayload: expect.any(Object) })
    );
  });

  it("naver_blog/naver_cafe/x/threads/instagram/wordpress_blog 모두 dry-run을 생성할 수 있다", async () => {
    const platforms: Array<[SocialPost["platform"], Partial<SocialPost>]> = [
      ["wordpress_blog", {}],
      ["naver_blog", {}],
      ["naver_cafe", {}],
      ["x", { postBody: null, threadItems: [{ order: 1, text: "트윗" }] }],
      ["threads", {}],
      ["instagram", { postBody: null, caption: "캡션", mediaRequirements: { requiresImage: true } }],
    ];

    for (const [platform, overrides] of platforms) {
      getSocialPostForDryRun.mockResolvedValue(makeSocialPost({ platform, ...overrides }));
      const result = await createPlatformPublishDryRun("social-post-1");
      expect(result.success).toBe(true);
    }
  });

  it("logs에 full payload/full text/API key/auth token이 저장되지 않는다", async () => {
    getSocialPostForDryRun.mockResolvedValue(makeSocialPost({ postBody: "매우 긴 본문 내용입니다. ".repeat(50) }));

    await createPlatformPublishDryRun("social-post-1");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("매우 긴 본문");
  });
});
