import { describe, expect, it } from "vitest";
import { validateManualExportPayload } from "./social-export-validator";
import { buildManualExportPayload } from "./social-export-builder";
import type { SocialPost } from "./social-platform-types";

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "제목",
    postBody: "본문 내용입니다.",
    caption: null,
    excerpt: null,
    hashtags: ["키워드1"],
    threadItems: [],
    cardItems: [],
    mediaRequirements: {},
    platformMetadata: {},
    generationContext: {},
    qualityStatus: "ready",
    qualityScore: 100,
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

describe("validateManualExportPayload", () => {
  it("naver_blog는 title/body가 있으면 valid하다", () => {
    const post = makeSocialPost({ platform: "naver_blog" });
    const result = validateManualExportPayload(post, buildManualExportPayload(post));

    expect(result.valid).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it("instagram은 caption이 없으면 invalid하다", () => {
    const post = makeSocialPost({ platform: "instagram", postBody: null, caption: null });
    const result = validateManualExportPayload(post, buildManualExportPayload(post));

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("x는 280자를 초과하는 thread item에 대해 warning을 반환한다", () => {
    const post = makeSocialPost({
      platform: "x",
      postBody: null,
      threadItems: [{ order: 1, text: "가".repeat(300) }],
    });
    const result = validateManualExportPayload(post, buildManualExportPayload(post));

    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("금지 표현이 있으면 blocked=true, valid=false를 반환한다", () => {
    const post = makeSocialPost({ platform: "naver_blog", postBody: "수익 보장 상품입니다." });
    const result = validateManualExportPayload(post, buildManualExportPayload(post));

    expect(result.blocked).toBe(true);
    expect(result.valid).toBe(false);
  });

  it("빈 export text(ok=false)는 invalid를 반환한다", () => {
    const post = makeSocialPost({ platform: "threads", postTitle: null, postBody: "" });
    const result = validateManualExportPayload(post, buildManualExportPayload(post));

    expect(result.valid).toBe(false);
  });
});
