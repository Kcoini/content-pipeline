import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getSocialPostById = vi.fn();
const incrementExportCopyCount = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  incrementExportCopyCount: (...args: unknown[]) => incrementExportCopyCount(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { recordSocialPostCopied } = await import("./social-copy-tracking-service");

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
    exportStatus: "exported",
    exportedAt: "2026-01-02T00:00:00.000Z",
    exportedBy: "editor",
    exportError: null,
    exportCopyCount: 0,
    lastCopiedAt: null,
    exportNotes: null,
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostById.mockReset();
  incrementExportCopyCount.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
});

describe("recordSocialPostCopied", () => {
  it("복사 시 export_copy_count가 증가한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());
    incrementExportCopyCount.mockResolvedValue(makeSocialPost({ exportCopyCount: 1 }));

    const result = await recordSocialPostCopied("social-post-1", "editor", "title");

    expect(result.success).toBe(true);
    expect(incrementExportCopyCount).toHaveBeenCalledWith("social-post-1");
    expect(result.socialPost?.exportCopyCount).toBe(1);
  });

  it("pipeline_logs에 social_manual_export_copied 이벤트가 기록된다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());
    incrementExportCopyCount.mockResolvedValue(makeSocialPost({ exportCopyCount: 1 }));

    await recordSocialPostCopied("social-post-1", "editor", "body");

    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "social_manual_export_copied" }));
  });

  it("복사한 전문 텍스트/post_body 전문/API key가 로그에 저장되지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());
    incrementExportCopyCount.mockResolvedValue(makeSocialPost({ exportCopyCount: 1 }));

    await recordSocialPostCopied("social-post-1", "editor", "body");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("매우 긴 본문");
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
  });

  it("존재하지 않는 social post는 실패를 반환한다", async () => {
    getSocialPostById.mockResolvedValue(null);

    const result = await recordSocialPostCopied("missing");

    expect(result.success).toBe(false);
    expect(incrementExportCopyCount).not.toHaveBeenCalled();
  });
});
