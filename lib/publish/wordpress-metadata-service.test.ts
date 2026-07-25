import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Article, Theme } from "@/lib/types/domain";

const getArticleById = vi.fn();
const saveWordPressMetadata = vi.fn();
const markWordPressMetadataReviewed = vi.fn();
const getThemeById = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  saveWordPressMetadata: (...args: unknown[]) => saveWordPressMetadata(...args),
  markWordPressMetadataReviewed: (...args: unknown[]) => markWordPressMetadataReviewed(...args),
}));
vi.mock("@/lib/repositories/theme-repository", () => ({
  getThemeById: (...args: unknown[]) => getThemeById(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { generateWordPressMetadata, reviewWordPressMetadata } = await import("./wordpress-metadata-service");

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    themeId: "theme-1",
    title: "요양원과 요양병원 차이",
    content: [
      "# 요양원과 요양병원 차이",
      "## 도입부",
      "요양원과 요양병원은 다르다.".repeat(20),
      "## 비용 비교",
      "비용 항목을 정리한다.".repeat(20),
    ].join("\n\n"),
    status: "draft",
    citedSourceIds: ["source-1", "source-2", "source-3"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    reviewedAt: null,
    reviewedBy: null,
    articleMode: "source_based_explainer",
    seoTitle: null,
    metaDescription: null,
    slug: null,
    targetKeyword: null,
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
    ...overrides,
  };
}

function makeTheme(overrides: Partial<Theme> = {}): Theme {
  return {
    id: "theme-1",
    title: "장기요양보험 가이드",
    description: "장기요양보험 관련 정보",
    keywords: ["장기요양", "요양원", "요양병원", "돌봄"],
    language: "ko",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  saveWordPressMetadata.mockReset();
  markWordPressMetadataReviewed.mockReset();
  getThemeById.mockReset();
  logEvent.mockReset();

  saveWordPressMetadata.mockResolvedValue({});
  markWordPressMetadataReviewed.mockResolvedValue({});
  logEvent.mockResolvedValue({});
  getThemeById.mockResolvedValue(makeTheme());
});

describe("generateWordPressMetadata", () => {
  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await generateWordPressMetadata("missing");

    expect(result.success).toBe(false);
    expect(saveWordPressMetadata).not.toHaveBeenCalled();
  });

  it("article에서 metadata를 생성할 수 있다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    const result = await generateWordPressMetadata("article-1");

    expect(result.success).toBe(true);
    expect(result.metadata).toBeDefined();
    expect(saveWordPressMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ articleId: "article-1", status: "generated" })
    );
  });

  it("monetized_blog는 seo_title, meta_description, target_keyword, category, tag가 생성된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({
        articleMode: "monetized_blog",
        seoTitle: "요양원 vs 요양병원 완벽 비교",
        metaDescription: "요양원과 요양병원의 차이를 정리했습니다.",
        targetKeyword: "요양원 요양병원 차이",
        secondaryKeywords: ["장기요양보험", "부모님 돌봄"],
      })
    );

    const result = await generateWordPressMetadata("article-1");

    expect(result.success).toBe(true);
    const metadata = result.metadata!;
    expect(metadata.seoTitle).toBe("요양원 vs 요양병원 완벽 비교");
    expect(metadata.metaDescription).toBe("요양원과 요양병원의 차이를 정리했습니다.");
    expect(metadata.targetKeyword).toBeTruthy();
    expect(metadata.categoryNames.length).toBeGreaterThan(0);
    expect(metadata.tagNames.length).toBeGreaterThanOrEqual(6);
  });

  it("general_news는 간단한 category/tag가 생성된다 (3~5개 태그)", async () => {
    getArticleById.mockResolvedValue(makeArticle({ articleMode: "general_news" }));

    const result = await generateWordPressMetadata("article-1");

    expect(result.success).toBe(true);
    const metadata = result.metadata!;
    expect(metadata.categoryNames.length).toBeGreaterThan(0);
    expect(metadata.categoryNames.length).toBeLessThanOrEqual(2);
    expect(metadata.tagNames.length).toBeGreaterThanOrEqual(3);
    expect(metadata.tagNames.length).toBeLessThanOrEqual(5);
  });

  it("source_based_explainer는 설명형 metadata(태그 5~8개)가 생성된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ articleMode: "source_based_explainer" }));

    const result = await generateWordPressMetadata("article-1");

    expect(result.success).toBe(true);
    const metadata = result.metadata!;
    expect(metadata.tagNames.length).toBeGreaterThanOrEqual(5);
    expect(metadata.tagNames.length).toBeLessThanOrEqual(8);
  });

  it("복지/돌봄 관련 키워드가 있으면 복지 카테고리를 추천한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    const result = await generateWordPressMetadata("article-1");

    expect(result.metadata!.categoryNames).toContain("복지");
  });

  it("slug가 안전하게 생성된다 (targetKeyword 우선, 없으면 title)", async () => {
    getArticleById.mockResolvedValue(makeArticle({ targetKeyword: "long term care guide" }));

    const result = await generateWordPressMetadata("article-1");

    expect(result.metadata!.slug).toBe("long-term-care-guide");
  });

  it("WORDPRESS_PUBLISH_ENABLED=false에서도 metadata 생성이 동작한다 (실제 API 미호출)", async () => {
    const original = process.env.WORDPRESS_PUBLISH_ENABLED;
    process.env.WORDPRESS_PUBLISH_ENABLED = "false";
    getArticleById.mockResolvedValue(makeArticle());

    const result = await generateWordPressMetadata("article-1");

    expect(result.success).toBe(true);
    if (original !== undefined) process.env.WORDPRESS_PUBLISH_ENABLED = original;
    else delete process.env.WORDPRESS_PUBLISH_ENABLED;
  });

  it("저장 실패 시 failed 상태로 저장을 시도하고 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    saveWordPressMetadata
      .mockRejectedValueOnce(new Error("DB 오류"))
      .mockResolvedValueOnce({});

    const result = await generateWordPressMetadata("article-1");

    expect(result.success).toBe(false);
    expect(result.message).toContain("DB 오류");
    expect(saveWordPressMetadata).toHaveBeenCalledTimes(2);
    expect(saveWordPressMetadata).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failed" }));
  });
});

describe("reviewWordPressMetadata", () => {
  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await reviewWordPressMetadata("missing");

    expect(result.success).toBe(false);
    expect(markWordPressMetadataReviewed).not.toHaveBeenCalled();
  });

  it("검토 완료를 표시한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ wpMetadataStatus: "generated" }));

    const result = await reviewWordPressMetadata("article-1");

    expect(result.success).toBe(true);
    expect(markWordPressMetadataReviewed).toHaveBeenCalledWith("article-1");
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_metadata_reviewed" })
    );
  });
});
