import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Article, Theme } from "@/lib/types/domain";

const getArticleById = vi.fn();
const saveFeaturedImageMetadata = vi.fn();
const markFeaturedImageReviewed = vi.fn();
const getThemeById = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  saveFeaturedImageMetadata: (...args: unknown[]) => saveFeaturedImageMetadata(...args),
  markFeaturedImageReviewed: (...args: unknown[]) => markFeaturedImageReviewed(...args),
}));
vi.mock("@/lib/repositories/theme-repository", () => ({
  getThemeById: (...args: unknown[]) => getThemeById(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { prepareFeaturedImage, reviewFeaturedImage } = await import("./featured-image-preparation-service");

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    themeId: "theme-1",
    title: "요양원과 요양병원 차이",
    content: "본문 내용입니다.".repeat(50),
    status: "draft",
    citedSourceIds: ["source-1", "source-2", "source-3"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    reviewedAt: null,
    reviewedBy: null,
    articleMode: "monetized_blog",
    seoTitle: "요양원 vs 요양병원 완벽 비교",
    metaDescription: "요양원과 요양병원의 차이를 정리했습니다. 비용과 입소 기준도 함께 확인하세요.",
    slug: "care-facility-guide",
    targetKeyword: "요양원 요양병원 차이",
    secondaryKeywords: ["장기요양보험", "부모님 돌봄"],
    searchIntent: null,
    readerPersona: null,
    adSlots: [],
    internalLinkSuggestions: [],
    monetizationScore: null,
    policyRiskScore: null,
    formatMetadata: {},
    wpCategoryNames: ["복지"],
    wpTagNames: ["장기요양보험"],
    wpCategoryIds: [],
    wpTagIds: [],
    wpMetadataStatus: "generated",
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

function makeTheme(overrides: Partial<Theme> = {}): Theme {
  return {
    id: "theme-1",
    title: "장기요양보험 가이드",
    description: "장기요양보험 관련 정보",
    keywords: ["장기요양", "요양원", "요양병원"],
    language: "ko",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  saveFeaturedImageMetadata.mockReset();
  markFeaturedImageReviewed.mockReset();
  getThemeById.mockReset();
  logEvent.mockReset();

  saveFeaturedImageMetadata.mockResolvedValue({});
  markFeaturedImageReviewed.mockResolvedValue({});
  logEvent.mockResolvedValue({});
  getThemeById.mockResolvedValue(makeTheme());
});

describe("prepareFeaturedImage", () => {
  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await prepareFeaturedImage("missing");

    expect(result.success).toBe(false);
    expect(saveFeaturedImageMetadata).not.toHaveBeenCalled();
  });

  it("article에서 featured image metadata를 준비할 수 있다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    const result = await prepareFeaturedImage("article-1");

    expect(result.success).toBe(true);
    expect(result.metadata).toBeDefined();
    expect(saveFeaturedImageMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ articleId: "article-1", status: "prepared" })
    );
  });

  it("general_news는 뉴스형 이미지 prompt가 생성된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ articleMode: "general_news" }));

    const result = await prepareFeaturedImage("article-1");

    expect(result.metadata!.style).toContain("editorial news photo");
    expect(result.metadata!.prompt).toContain("symbolic editorial scene");
  });

  it("source_based_explainer는 설명형 이미지 prompt가 생성된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ articleMode: "source_based_explainer" }));

    const result = await prepareFeaturedImage("article-1");

    expect(result.metadata!.style).toContain("explanatory editorial illustration");
    expect(result.metadata!.prompt).toContain("infographic-style visualization");
  });

  it("monetized_blog는 수익형 블로그 썸네일 prompt가 생성된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ articleMode: "monetized_blog" }));

    const result = await prepareFeaturedImage("article-1");

    expect(result.metadata!.style).toContain("trustworthy blog thumbnail");
    expect(result.metadata!.prompt).toContain("checklist or documents");
  });

  it("alt text가 생성된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    const result = await prepareFeaturedImage("article-1");

    expect(result.metadata!.altText).toBeTruthy();
    expect(result.metadata!.altText.length).toBeGreaterThan(0);
    expect(result.metadata!.altText.length).toBeLessThanOrEqual(141);
  });

  it("caption이 생성된다 (metaDescription 첫 문장 기반)", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    const result = await prepareFeaturedImage("article-1");

    expect(result.metadata!.caption).toBeTruthy();
  });

  it("이미지 안에 텍스트를 넣으라는 지시가 포함되지 않는다 (오히려 no text 지시가 포함된다)", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    const result = await prepareFeaturedImage("article-1");

    expect(result.metadata!.prompt).toContain("no text in image");
    expect(result.metadata!.prompt.toLowerCase()).not.toContain("include the title text");
  });

  it("실제 인물/유명인/로고를 금지하는 지시가 포함된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    const result = await prepareFeaturedImage("article-1");

    expect(result.metadata!.prompt).toContain("no real people's names or depictions");
    expect(result.metadata!.prompt).toContain("no celebrity likeness");
    expect(result.metadata!.prompt).toContain("no brand logos or trademarks");
  });

  it("실패 시 failed 상태로 저장을 시도하고 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    saveFeaturedImageMetadata.mockRejectedValueOnce(new Error("DB 오류")).mockResolvedValueOnce({});

    const result = await prepareFeaturedImage("article-1");

    expect(result.success).toBe(false);
    expect(result.message).toContain("DB 오류");
    expect(saveFeaturedImageMetadata).toHaveBeenCalledTimes(2);
    expect(saveFeaturedImageMetadata).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failed" }));
  });
});

describe("reviewFeaturedImage", () => {
  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await reviewFeaturedImage("missing");

    expect(result.success).toBe(false);
    expect(markFeaturedImageReviewed).not.toHaveBeenCalled();
  });

  it("검토 완료를 표시한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ featuredImageStatus: "prepared" }));

    const result = await reviewFeaturedImage("article-1");

    expect(result.success).toBe(true);
    expect(markFeaturedImageReviewed).toHaveBeenCalledWith("article-1");
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "featured_image_reviewed" }));
  });
});
