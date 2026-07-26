import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/types/domain";

const getArticleById = vi.fn();
const getSuccessfulWordPressDraft = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  getSuccessfulWordPressDraft: (...args: unknown[]) => getSuccessfulWordPressDraft(...args),
}));

const { assertCanPublicPublish, PublicPublishNotAllowedError } = await import("./public-publish-guards");

function makeApprovedArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    themeId: "theme-1",
    title: "기사 제목",
    content: "본문 내용입니다.",
    status: "reviewed",
    citedSourceIds: ["source-1"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    reviewedAt: "2026-01-02T00:00:00.000Z",
    reviewedBy: "local-user",
    articleMode: "source_based_explainer",
    seoTitle: null,
    metaDescription: null,
    slug: null,
    targetKeyword: "장기요양보험",
    secondaryKeywords: [],
    searchIntent: null,
    readerPersona: null,
    adSlots: [],
    internalLinkSuggestions: [],
    monetizationScore: null,
    policyRiskScore: null,
    formatMetadata: {},
    wpCategoryNames: [],
    wpTagNames: [],
    wpCategoryIds: [],
    wpTagIds: [],
    wpMetadataStatus: "not_ready",
    wpMetadataGeneratedAt: null,
    seoPluginProvider: "none",
    seoPluginPayload: {},
    seoPluginMetadataStatus: "not_ready",
    seoPluginMetadataGeneratedAt: null,
    seoPluginWriteStatus: "not_attempted",
    seoPluginWriteError: null,
    featuredImageStatus: "not_ready",
    featuredImagePrompt: null,
    featuredImageAltText: null,
    featuredImageCaption: null,
    featuredImageStyle: null,
    featuredImageAspectRatio: "16:9",
    featuredImageMetadata: {},
    featuredImageGeneratedAt: null,
    featuredImageReviewedAt: null,
    featuredImageWordpressMediaId: null,
    featuredImageWordpressUrl: null,
    featuredImageError: null,
    featuredImageSourceType: "none",
    featuredImageSourceUrl: null,
    featuredImageLocalPath: null,
    featuredImageFilename: null,
    featuredImageMimeType: null,
    featuredImageUploadStatus: "not_ready",
    featuredImageUploadPayload: {},
    featuredImageUploadError: null,
    featuredImageUploadAttemptedAt: null,
    generatedImageStatus: "not_generated",
    generatedImageProvider: "mock",
    generatedImageModel: null,
    generatedImagePrompt: null,
    generatedImageNegativePrompt: null,
    generatedImageUrl: null,
    generatedImageLocalPath: null,
    generatedImageWidth: null,
    generatedImageHeight: null,
    generatedImageFormat: null,
    generatedImageMetadata: {},
    generatedImageError: null,
    generatedImageRequestedAt: null,
    generatedImageCompletedAt: null,
    generatedImageReviewedAt: null,
    wordpressFeaturedMediaAttachStatus: "not_attached",
    wordpressFeaturedMediaAttachedAt: null,
    wordpressFeaturedMediaAttachError: null,
    seoPluginActualWriteStatus: "not_attempted",
    seoPluginActualWriteProvider: null,
    seoPluginActualWritePostId: null,
    seoPluginActualWriteError: null,
    seoPluginActualWriteAttemptedAt: null,
    seoPluginActualWriteVerified: false,
    seoPluginActualWriteWarning: null,
    seoPluginCustomEndpointStatus: "not_attempted",
    seoPluginCustomEndpointVerified: false,
    seoPluginCustomEndpointError: null,
    seoPluginCustomEndpointAttemptedAt: null,
    wordpressFinalDraftReviewStatus: "not_reviewed",
    wordpressFinalDraftReviewScore: null,
    wordpressFinalDraftReviewSummary: {},
    wordpressFinalDraftReviewError: null,
    wordpressFinalDraftReviewedAt: null,
    publishQualityGateStatus: "ready_to_publish",
    publishQualityGateScore: 100,
    publishQualityGateSummary: {},
    publishQualityGateError: null,
    publishQualityGateCheckedAt: "2026-01-03T00:00:00.000Z",
    publishReady: true,
    publishBlockedReason: null,
    publicPublishApprovalStatus: "approved",
    publicPublishApproved: true,
    publicPublishApprovedAt: "2026-01-04T00:00:00.000Z",
    publicPublishApprovedBy: "editor-kim",
    publicPublishApprovalError: null,
    publicPublishApprovalNotes: null,
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  getSuccessfulWordPressDraft.mockReset();
  getSuccessfulWordPressDraft.mockResolvedValue({
    externalPostId: "42",
    postUrl: "https://example-blog.test/?p=42",
  });
});

describe("assertCanPublicPublish", () => {
  it("승인 전에는(public_publish_approval_status != approved) 실패한다", async () => {
    getArticleById.mockResolvedValue(
      makeApprovedArticle({ publicPublishApprovalStatus: "not_requested", publicPublishApproved: false })
    );

    await expect(assertCanPublicPublish("article-1")).rejects.toThrow(PublicPublishNotAllowedError);
  });

  it("승인 후에는(모든 조건 충족) 통과한다", async () => {
    getArticleById.mockResolvedValue(makeApprovedArticle());

    await expect(assertCanPublicPublish("article-1")).resolves.toBeUndefined();
  });

  it("publish_ready가 false이면 실패한다", async () => {
    getArticleById.mockResolvedValue(makeApprovedArticle({ publishReady: false }));

    await expect(assertCanPublicPublish("article-1")).rejects.toThrow(PublicPublishNotAllowedError);
  });

  it("WordPress draft post id가 없으면 실패한다", async () => {
    getArticleById.mockResolvedValue(makeApprovedArticle());
    getSuccessfulWordPressDraft.mockResolvedValue(null);

    await expect(assertCanPublicPublish("article-1")).rejects.toThrow(PublicPublishNotAllowedError);
  });

  it("존재하지 않는 기사면 실패한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    await expect(assertCanPublicPublish("missing")).rejects.toThrow(PublicPublishNotAllowedError);
  });
});
