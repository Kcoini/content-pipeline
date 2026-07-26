import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/types/domain";

const getArticleById = vi.fn();
const saveSeoPluginMetadata = vi.fn();
const markSeoPluginMetadataReviewed = vi.fn();
const getThemeById = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  saveSeoPluginMetadata: (...args: unknown[]) => saveSeoPluginMetadata(...args),
  markSeoPluginMetadataReviewed: (...args: unknown[]) => markSeoPluginMetadataReviewed(...args),
}));
vi.mock("@/lib/repositories/theme-repository", () => ({
  getThemeById: (...args: unknown[]) => getThemeById(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { generateSeoPluginPayload, reviewSeoPluginMetadata } = await import("./seo-plugin-metadata-service");

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    themeId: "theme-1",
    title: "요양원과 요양병원 차이",
    content: "본문 내용입니다.".repeat(50),
    status: "reviewed",
    citedSourceIds: ["source-1", "source-2", "source-3"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    reviewedAt: "2026-01-02T00:00:00.000Z",
    reviewedBy: "local-user",
    articleMode: "monetized_blog",
    seoTitle: "요양원 vs 요양병원 완벽 비교",
    metaDescription: "요양원과 요양병원의 차이를 정리했습니다.",
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
    wpTagNames: ["장기요양보험", "요양원"],
    wpCategoryIds: [],
    wpTagIds: [],
    wpMetadataStatus: "generated",
    wpMetadataGeneratedAt: "2026-01-01T00:00:00.000Z",
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
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  saveSeoPluginMetadata.mockReset();
  markSeoPluginMetadataReviewed.mockReset();
  getThemeById.mockReset();
  logEvent.mockReset();

  saveSeoPluginMetadata.mockResolvedValue({});
  markSeoPluginMetadataReviewed.mockResolvedValue({});
  getThemeById.mockResolvedValue(undefined);
  logEvent.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateSeoPluginPayload", () => {
  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await generateSeoPluginPayload("missing");

    expect(result.success).toBe(false);
    expect(saveSeoPluginMetadata).not.toHaveBeenCalled();
  });

  it("providerOverride가 없으면 SEO_PLUGIN_PROVIDER 환경변수를 사용한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");

    const result = await generateSeoPluginPayload("article-1");

    expect(result.provider).toBe("rank_math");
    expect(result.payload?.rawPluginMeta).toHaveProperty("rank_math_title");
  });

  it("providerOverride가 있으면 환경변수보다 우선한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");

    const result = await generateSeoPluginPayload("article-1", "aioseo");

    expect(result.provider).toBe("aioseo");
  });

  it("환경변수가 없으면 기본값 none을 사용한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "");

    const result = await generateSeoPluginPayload("article-1");

    expect(result.provider).toBe("none");
  });

  it("생성된 payload와 provider를 articles에 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    await generateSeoPluginPayload("article-1", "yoast");

    expect(saveSeoPluginMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ articleId: "article-1", provider: "yoast", status: "generated" })
    );
  });

  it("실패 시 failed 상태로 저장을 시도하고 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    saveSeoPluginMetadata.mockRejectedValueOnce(new Error("DB 오류")).mockResolvedValueOnce({});

    const result = await generateSeoPluginPayload("article-1", "yoast");

    expect(result.success).toBe(false);
    expect(result.message).toContain("DB 오류");
    expect(saveSeoPluginMetadata).toHaveBeenCalledTimes(2);
  });

  it("target_keyword가 있으면 payload의 focusKeyword에 그대로 반영된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ targetKeyword: "요양원 요양병원 차이" }));

    const result = await generateSeoPluginPayload("article-1", "rank_math");

    expect(result.payload?.focusKeyword).toBe("요양원 요양병원 차이");
    expect(saveSeoPluginMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ targetKeyword: undefined, targetKeywordSource: "explicit" })
    );
  });

  it("target_keyword가 없고 theme keyword가 있으면 theme keyword로 채우고 articles.target_keyword에도 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ targetKeyword: null }));
    getThemeById.mockResolvedValue({
      id: "theme-1",
      title: "요양원 테마",
      keywords: ["요양원 추천"],
      description: null,
      language: "ko",
      status: "sources_ready",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await generateSeoPluginPayload("article-1", "rank_math");

    expect(result.payload?.focusKeyword).toBe("요양원 추천");
    expect(saveSeoPluginMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ targetKeyword: "요양원 추천", targetKeywordSource: "theme" })
    );
  });

  it("target_keyword/theme keyword가 모두 없으면 title에서 추출하고 fallback 이벤트를 기록한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ targetKeyword: null, title: "요양원 완벽 가이드 총정리" }));
    getThemeById.mockResolvedValue(undefined);

    const result = await generateSeoPluginPayload("article-1", "rank_math");

    expect(result.payload?.focusKeyword).toBeTruthy();
    expect(saveSeoPluginMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ targetKeywordSource: "title_fallback" })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_metadata_target_keyword_fallback_used" })
    );
  });
});

describe("reviewSeoPluginMetadata", () => {
  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await reviewSeoPluginMetadata("missing");

    expect(result.success).toBe(false);
    expect(markSeoPluginMetadataReviewed).not.toHaveBeenCalled();
  });

  it("검토 완료를 표시한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ seoPluginMetadataStatus: "generated" }));

    const result = await reviewSeoPluginMetadata("article-1");

    expect(result.success).toBe(true);
    expect(markSeoPluginMetadataReviewed).toHaveBeenCalledWith("article-1");
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "seo_plugin_metadata_reviewed" }));
  });
});
