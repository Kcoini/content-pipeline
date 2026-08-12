import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Article, Source } from "@/lib/types/domain";

const getArticleById = vi.fn();
const getSourcesByArticleId = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));
vi.mock("@/lib/repositories/source-repository", () => ({
  getSourcesByArticleId: (...args: unknown[]) => getSourcesByArticleId(...args),
}));

const { buildSocialWritingContext } = await import("./social-writing-context-builder");

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    themeId: "theme-1",
    title: "장기요양보험 신청 방법",
    content: "본문 내용입니다. ".repeat(200),
    status: "reviewed",
    citedSourceIds: ["source-1", "source-2", "source-3"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    reviewedAt: "2026-01-02T00:00:00.000Z",
    reviewedBy: "local-user",
    articleMode: "monetized_blog",
    seoTitle: "장기요양보험 신청 총정리",
    metaDescription: "장기요양보험 신청 방법을 정리했습니다.",
    slug: "care-insurance-guide",
    targetKeyword: "장기요양보험",
    secondaryKeywords: ["등급판정"],
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
    featuredImageSourceStatus: "none",
    featuredImageSourceError: null,
    featuredImageManualSourceSavedAt: null,
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
    publishQualityGateStatus: "not_checked",
    publishQualityGateScore: null,
    publishQualityGateSummary: {},
    publishQualityGateError: null,
    publishQualityGateCheckedAt: null,
    publishReady: false,
    publishBlockedReason: null,
    publicPublishApprovalStatus: "not_requested",
    publicPublishApproved: false,
    publicPublishApprovedAt: null,
    publicPublishApprovedBy: null,
    publicPublishApprovalError: null,
    publicPublishApprovalNotes: null,
    publicPublishStatus: "not_published",
    publicPublished: false,
    publicPublishedAt: null,
    publicPublishPostId: null,
    publicPublishUrl: null,
    publicPublishError: null,
    publicPublishAttemptedAt: null,
    ...overrides,
  };
}

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: "source-1",
    themeId: "theme-1",
    url: "https://example.com/a",
    title: "출처 제목",
    publisher: "출처사",
    publishedAt: "2026-01-01",
    summary: "출처 요약입니다.",
    createdAt: "2026-01-01T00:00:00.000Z",
    fetchStatus: "success",
    fetchError: null,
    rawContent: "<html>이건 원문 HTML이며 절대 context에 포함되면 안 됨</html>",
    summaryStatus: "success",
    summaryError: null,
    summarizedAt: "2026-01-01T00:00:00.000Z",
    keyPoints: ["포인트1", "포인트2"],
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  getSourcesByArticleId.mockReset();
  getArticleById.mockResolvedValue(makeArticle());
  getSourcesByArticleId.mockResolvedValue([makeSource()]);
});

describe("buildSocialWritingContext", () => {
  it("article/출처 요약을 포함한 compact context를 만든다", async () => {
    const context = await buildSocialWritingContext("article-1", { platform: "naver_blog", toneStyle: "informational" });

    expect(context.title).toBe("장기요양보험 신청 방법");
    expect(context.targetKeyword).toBe("장기요양보험");
    expect(context.sourceCount).toBe(1);
    expect(context.sourceSummaries[0].summary).toBe("출처 요약입니다.");
    expect(context.platformConfig.platform).toBe("naver_blog");
    expect(context.toneStyleConfig.toneStyle).toBe("informational");
  });

  it("출처 원문(raw HTML)을 포함하지 않는다", async () => {
    const context = await buildSocialWritingContext("article-1", { platform: "naver_blog", toneStyle: "informational" });

    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain("이건 원문 HTML");
  });

  it("API key/인증 정보 관련 문자열을 포함하지 않는다", async () => {
    const context = await buildSocialWritingContext("article-1", { platform: "naver_blog", toneStyle: "informational" });

    const serialized = JSON.stringify(context).toLowerCase();
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("app_password");
  });

  it("존재하지 않는 기사면 에러를 던진다", async () => {
    getArticleById.mockResolvedValue(undefined);

    await expect(
      buildSocialWritingContext("missing", { platform: "naver_blog", toneStyle: "informational" })
    ).rejects.toThrow();
  });
});
