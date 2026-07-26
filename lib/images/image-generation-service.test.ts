import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/types/domain";

const getArticleById = vi.fn();
const markGeneratedImageGenerating = vi.fn();
const saveGeneratedImageResult = vi.fn();
const markGeneratedImageReviewed = vi.fn();
const generateImageMock = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  markGeneratedImageGenerating: (...args: unknown[]) => markGeneratedImageGenerating(...args),
  saveGeneratedImageResult: (...args: unknown[]) => saveGeneratedImageResult(...args),
  markGeneratedImageReviewed: (...args: unknown[]) => markGeneratedImageReviewed(...args),
}));
vi.mock("./providers", () => ({
  getImageProviderClient: () => ({ generateImage: (...args: unknown[]) => generateImageMock(...args) }),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { generateFeaturedImage, reviewGeneratedImage } = await import("./image-generation-service");

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
    metaDescription: "요양원과 요양병원의 차이를 정리했습니다.",
    slug: "care-facility-guide",
    targetKeyword: "요양원 요양병원 차이",
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
    featuredImageStatus: "reviewed",
    featuredImagePrompt: "A clean editorial illustration of care facility comparison, no text in image, 16:9.",
    featuredImageAltText: "요양원 요양병원 선택 기준을 비교하는 일러스트",
    featuredImageCaption: "요양시설 선택 전 확인할 기준을 정리했습니다.",
    featuredImageStyle: "clickable but trustworthy blog thumbnail",
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
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  markGeneratedImageGenerating.mockReset();
  saveGeneratedImageResult.mockReset();
  markGeneratedImageReviewed.mockReset();
  generateImageMock.mockReset();
  logEvent.mockReset();

  markGeneratedImageGenerating.mockResolvedValue({});
  saveGeneratedImageResult.mockResolvedValue({});
  markGeneratedImageReviewed.mockResolvedValue({});
  logEvent.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateFeaturedImage", () => {
  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await generateFeaturedImage("missing");

    expect(result.success).toBe(false);
    expect(generateImageMock).not.toHaveBeenCalled();
  });

  it("featured_image_prompt가 없으면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ featuredImagePrompt: null }));

    const result = await generateFeaturedImage("article-1");

    expect(result.success).toBe(false);
    expect(result.message).toContain("대표 이미지");
    expect(generateImageMock).not.toHaveBeenCalled();
  });

  it("article에서 image generation request를 만들고 provider를 호출할 수 있다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    generateImageMock.mockResolvedValue({
      status: "generated",
      provider: "mock",
      imageUrl: "/mock/generated-images/article-1.webp",
      width: 1536,
      height: 864,
      format: "webp",
      metadata: { mock: true },
    });

    const result = await generateFeaturedImage("article-1");

    expect(result.success).toBe(true);
    expect(generateImageMock).toHaveBeenCalledTimes(1);
    const request = generateImageMock.mock.calls[0][0];
    expect(request.articleId).toBe("article-1");
    expect(request.prompt).toBe(makeArticle().featuredImagePrompt);
  });

  it("featured_image_prompt가 request로 반영된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    generateImageMock.mockResolvedValue({ status: "generated", provider: "mock", metadata: {} });

    await generateFeaturedImage("article-1");

    const request = generateImageMock.mock.calls[0][0];
    expect(request.prompt).toContain("clean editorial illustration");
  });

  it("negative prompt가 포함된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    generateImageMock.mockResolvedValue({ status: "generated", provider: "mock", metadata: {} });

    await generateFeaturedImage("article-1");

    const request = generateImageMock.mock.calls[0][0];
    expect(request.negativePrompt).toContain("text overlay");
    expect(request.negativePrompt).toContain("watermark");
    expect(request.negativePrompt).toContain("logo");
  });

  it("mock provider가 generated 상태와 mock URL을 반환하면 articles.generated_image_* 필드가 저장된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    generateImageMock.mockResolvedValue({
      status: "generated",
      provider: "mock",
      model: "mock-image-generator-v1",
      imageUrl: "/mock/generated-images/article-1.webp",
      width: 1536,
      height: 864,
      format: "webp",
      metadata: { mock: true },
    });

    const result = await generateFeaturedImage("article-1");

    expect(result.success).toBe(true);
    expect(saveGeneratedImageResult).toHaveBeenCalledWith(
      expect.objectContaining({
        articleId: "article-1",
        status: "generated",
        imageUrl: "/mock/generated-images/article-1.webp",
        width: 1536,
        height: 864,
        format: "webp",
      })
    );
  });

  it("생성 실패 시 generated_image_status = failed가 저장된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    generateImageMock.mockResolvedValue({
      status: "failed",
      provider: "mock",
      metadata: {},
      error: "provider 오류",
    });

    const result = await generateFeaturedImage("article-1");

    expect(result.success).toBe(false);
    expect(saveGeneratedImageResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", error: "provider 오류" })
    );
  });

  it("provider가 예외를 던져도 Runtime Error 없이 안전하게 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    generateImageMock.mockRejectedValue(new Error("unexpected provider crash"));

    const result = await generateFeaturedImage("article-1");

    expect(result.success).toBe(false);
    expect(result.message).toContain("unexpected provider crash");
    expect(saveGeneratedImageResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" })
    );
  });

  it("IMAGE_GENERATION_ENABLED=false이면 dryRun=true로 request가 만들어진다 (mock 또는 disabled-safe path)", async () => {
    vi.stubEnv("IMAGE_GENERATION_ENABLED", "false");
    getArticleById.mockResolvedValue(makeArticle());
    generateImageMock.mockResolvedValue({ status: "generated", provider: "mock", metadata: {} });

    await generateFeaturedImage("article-1");

    const request = generateImageMock.mock.calls[0][0];
    expect(request.dryRun).toBe(true);
  });
});

describe("reviewGeneratedImage", () => {
  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await reviewGeneratedImage("missing");

    expect(result.success).toBe(false);
    expect(markGeneratedImageReviewed).not.toHaveBeenCalled();
  });

  it("검토 완료를 표시한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ generatedImageStatus: "generated" }));

    const result = await reviewGeneratedImage("article-1");

    expect(result.success).toBe(true);
    expect(markGeneratedImageReviewed).toHaveBeenCalledWith("article-1");
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "generated_image_reviewed" }));
  });
});
