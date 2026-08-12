import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getSocialPostById = vi.fn();
const updateSocialPostExport = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  updateSocialPostExport: (...args: unknown[]) => updateSocialPostExport(...args),
  SocialPostNotFoundError: class SocialPostNotFoundError extends Error {},
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { generateManualExport } = await import("./social-manual-export-service");

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "제목",
    postBody: "충분히 긴 본문 내용입니다. ".repeat(10),
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
    publishStatus: "not_published",
    externalPostId: null,
    postUrl: null,
    exportFormat: null,
    exportPayload: {},
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
    exportStatus: "not_exported",
    exportedAt: null,
    exportedBy: null,
    exportError: null,
    exportCopyCount: 0,
    lastCopiedAt: null,
    exportNotes: null,
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostById.mockReset();
  updateSocialPostExport.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
  updateSocialPostExport.mockImplementation(async (id, patch) =>
    makeSocialPost({ id, exportStatus: patch.exportStatus, exportError: patch.exportError ?? null })
  );
});

describe("generateManualExport", () => {
  it("quality_status='ready'이고 approval_status='approved'이면 export가 가능하다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ qualityStatus: "ready", approvalStatus: "approved" }));

    const result = await generateManualExport("social-post-1", "editor");

    expect(result.success).toBe(true);
    expect(updateSocialPostExport).toHaveBeenCalledWith(
      "social-post-1",
      expect.objectContaining({ exportStatus: "exported", markPublishStatusExported: true })
    );
  });

  it("quality_status='needs_revision'이면 export가 blocked된다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ qualityStatus: "needs_revision" }));

    const result = await generateManualExport("social-post-1");

    expect(result.success).toBe(false);
    expect(updateSocialPostExport).toHaveBeenCalledWith(
      "social-post-1",
      expect.objectContaining({ exportStatus: "blocked" })
    );
  });

  it("quality_status='blocked'이면 export가 blocked된다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ qualityStatus: "blocked" }));

    const result = await generateManualExport("social-post-1");

    expect(result.success).toBe(false);
  });

  it("approval_status가 'approved'가 아니면 export가 blocked된다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ approvalStatus: "pending_review" }));

    const result = await generateManualExport("social-post-1");

    expect(result.success).toBe(false);
  });

  it("approval_status='rejected'면 export가 blocked된다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ approvalStatus: "rejected" }));

    const result = await generateManualExport("social-post-1");

    expect(result.success).toBe(false);
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "social_manual_export_blocked" }));
  });

  it("approval_status='revoked'면 export가 blocked된다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ approvalStatus: "revoked" }));

    const result = await generateManualExport("social-post-1");

    expect(result.success).toBe(false);
  });

  it("x/instagram 등 플랫폼별 export도 생성한다", async () => {
    getSocialPostById.mockResolvedValue(
      makeSocialPost({ platform: "x", postBody: null, threadItems: [{ order: 1, text: "첫 트윗" }] })
    );

    const result = await generateManualExport("social-post-1");

    expect(result.success).toBe(true);
    expect(result.exportPayload?.exportThreadItems).toEqual(["첫 트윗"]);
  });

  it("logs에 full post_body/API key/auth token이 저장되지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());

    await generateManualExport("social-post-1");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("충분히 긴 본문");
  });
});
