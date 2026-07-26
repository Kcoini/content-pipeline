import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/types/domain";

const getArticleById = vi.fn();
const updateWordPressMediaUploadStatus = vi.fn();
const saveFeaturedImageUploadResult = vi.fn();
const savePublishLog = vi.fn();
const uploadMediaToWordPress = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  updateWordPressMediaUploadStatus: (...args: unknown[]) => updateWordPressMediaUploadStatus(...args),
  saveFeaturedImageUploadResult: (...args: unknown[]) => saveFeaturedImageUploadResult(...args),
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  savePublishLog: (...args: unknown[]) => savePublishLog(...args),
}));
vi.mock("./wordpress-client", () => ({
  uploadMediaToWordPress: (...args: unknown[]) => uploadMediaToWordPress(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { uploadFeaturedImageToWordPress, WORDPRESS_MEDIA_TARGET } = await import("./wordpress-media-upload-service");

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    themeId: "theme-1",
    title: "기사 제목",
    content: "본문 내용입니다.".repeat(50),
    status: "reviewed",
    citedSourceIds: ["source-1", "source-2", "source-3"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    reviewedAt: "2026-01-02T00:00:00.000Z",
    reviewedBy: "local-user",
    articleMode: "source_based_explainer",
    seoTitle: null,
    metaDescription: null,
    slug: "long-term-care-guide",
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
    featuredImageStatus: "prepared",
    featuredImagePrompt: null,
    featuredImageAltText: "대표 이미지 alt text",
    featuredImageCaption: "대표 이미지 caption",
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
  updateWordPressMediaUploadStatus.mockReset();
  saveFeaturedImageUploadResult.mockReset();
  savePublishLog.mockReset();
  uploadMediaToWordPress.mockReset();
  logEvent.mockReset();

  updateWordPressMediaUploadStatus.mockResolvedValue({});
  saveFeaturedImageUploadResult.mockResolvedValue({});
  savePublishLog.mockResolvedValue({});
  logEvent.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("uploadFeaturedImageToWordPress", () => {
  it("WORDPRESS_MEDIA_UPLOAD_ENABLED=false이면 실제 업로드를 호출하지 않고 skipped 처리한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "false");

    const result = await uploadFeaturedImageToWordPress("article-1");

    expect(result.success).toBe(true);
    expect(uploadMediaToWordPress).not.toHaveBeenCalled();
    expect(updateWordPressMediaUploadStatus).toHaveBeenCalledWith("article-1", "skipped");
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_media_upload_skipped_disabled" })
    );
    expect(savePublishLog).not.toHaveBeenCalled();
  });

  it("sourceType이 none이면(업로드할 이미지가 없으면) skipped_no_source로 처리한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ featuredImageSourceUrl: null, featuredImageLocalPath: null }));
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");

    const result = await uploadFeaturedImageToWordPress("article-1");

    expect(result.success).toBe(false);
    expect(uploadMediaToWordPress).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_media_upload_skipped_no_source" })
    );
  });

  it("mock 또는 상대경로 이미지만 있으면 wordpress_media_source_invalid로 처리하고 실제 업로드를 호출하지 않는다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({
        generatedImageStatus: "generated",
        generatedImageUrl: "/mock/generated-images/article-1.webp",
      })
    );
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");

    const result = await uploadFeaturedImageToWordPress("article-1");

    expect(result.success).toBe(false);
    expect(uploadMediaToWordPress).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_media_source_invalid" })
    );
  });

  it("generated_image_status가 generated이고 http URL이면 generated_url을 source로 사용한다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({
        generatedImageStatus: "generated",
        generatedImageUrl: "https://images.example.com/article-1.webp",
      })
    );
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    uploadMediaToWordPress.mockResolvedValue({
      status: "uploaded",
      wordpressMediaId: 10,
      wordpressUrl: "https://example-blog.test/uploads/article-1.webp",
      metadataUpdateStatus: "success",
    });

    await uploadFeaturedImageToWordPress("article-1");

    expect(uploadMediaToWordPress).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "generated_url", sourceUrl: "https://images.example.com/article-1.webp" })
    );
  });

  it("external_url(featured_image_source_url)이 http/https이면 sourceType=external_url로 업로드를 시도한다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ featuredImageSourceUrl: "https://images.example.com/external.webp" })
    );
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    uploadMediaToWordPress.mockResolvedValue({
      status: "uploaded",
      wordpressMediaId: 11,
      wordpressUrl: "https://example-blog.test/uploads/external.webp",
      metadataUpdateStatus: "not_attempted",
    });

    await uploadFeaturedImageToWordPress("article-1");

    expect(uploadMediaToWordPress).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "external_url", sourceUrl: "https://images.example.com/external.webp" })
    );
  });

  it("업로드 성공 시 articles.featured_image_wordpress_media_id/url을 저장한다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ featuredImageSourceUrl: "https://images.example.com/external.webp" })
    );
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    uploadMediaToWordPress.mockResolvedValue({
      status: "uploaded",
      wordpressMediaId: 77,
      wordpressUrl: "https://example-blog.test/uploads/photo.webp",
      metadataUpdateStatus: "success",
    });

    const result = await uploadFeaturedImageToWordPress("article-1");

    expect(result.success).toBe(true);
    expect(saveFeaturedImageUploadResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({
        status: "uploaded",
        wordpressMediaId: 77,
        wordpressUrl: "https://example-blog.test/uploads/photo.webp",
        sourceType: "uploaded",
      })
    );
  });

  it("publish_logs에 target=wordpress_media, status=success로 저장된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ featuredImageSourceUrl: "https://images.example.com/external.webp" })
    );
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    uploadMediaToWordPress.mockResolvedValue({
      status: "uploaded",
      wordpressMediaId: 5,
      wordpressUrl: "https://example-blog.test/uploads/photo.webp",
      metadataUpdateStatus: "success",
    });

    await uploadFeaturedImageToWordPress("article-1");

    expect(WORDPRESS_MEDIA_TARGET).toBe("wordpress_media");
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        target: "wordpress_media",
        status: "success",
        externalPostId: "5",
        postUrl: "https://example-blog.test/uploads/photo.webp",
        details: expect.objectContaining({
          actual: true,
          mediaUpload: true,
          mediaId: 5,
          sourceType: "external_url",
          metadataUpdateStatus: "success",
          altTextPresent: true,
          captionPresent: true,
        }),
      })
    );
  });

  it("metadata update 실패는 upload success를 failed로 바꾸지 않는다 (warning 처리)", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ featuredImageSourceUrl: "https://images.example.com/external.webp" })
    );
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    uploadMediaToWordPress.mockResolvedValue({
      status: "uploaded",
      wordpressMediaId: 6,
      wordpressUrl: "https://example-blog.test/uploads/photo.webp",
      metadataUpdateStatus: "failed",
    });

    const result = await uploadFeaturedImageToWordPress("article-1");

    expect(result.success).toBe(true);
    expect(saveFeaturedImageUploadResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "uploaded" })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_media_metadata_update_failed" })
    );
  });

  it("업로드 실패 시 articles.featured_image_upload_status=failed와 safe error를 저장한다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ featuredImageSourceUrl: "https://images.example.com/external.webp" })
    );
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    uploadMediaToWordPress.mockResolvedValue({ status: "failed", error: "WordPress media 업로드 실패 (HTTP 401)", statusCode: 401 });

    const result = await uploadFeaturedImageToWordPress("article-1");

    expect(result.success).toBe(false);
    expect(saveFeaturedImageUploadResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "failed", errorMessage: "WordPress media 업로드 실패 (HTTP 401)" })
    );
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({ target: "wordpress_media", status: "failed" })
    );
  });

  it("auth 정보가 logs(pipeline_logs/publish_logs)에 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ featuredImageSourceUrl: "https://images.example.com/external.webp" })
    );
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    uploadMediaToWordPress.mockResolvedValue({
      status: "uploaded",
      wordpressMediaId: 8,
      wordpressUrl: "https://example-blog.test/uploads/photo.webp",
      metadataUpdateStatus: "success",
    });

    await uploadFeaturedImageToWordPress("article-1");

    const serializedLogs = JSON.stringify(logEvent.mock.calls).toLowerCase();
    const serializedPublish = JSON.stringify(savePublishLog.mock.calls).toLowerCase();
    for (const serialized of [serializedLogs, serializedPublish]) {
      expect(serialized).not.toContain("authorization");
      expect(serialized).not.toContain("app_password");
      expect(serialized).not.toContain("basic ");
    }
  });

  it("image binary가 logs에 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ featuredImageSourceUrl: "https://images.example.com/external.webp" })
    );
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    uploadMediaToWordPress.mockResolvedValue({
      status: "uploaded",
      wordpressMediaId: 9,
      wordpressUrl: "https://example-blog.test/uploads/photo.webp",
      metadataUpdateStatus: "success",
    });

    await uploadFeaturedImageToWordPress("article-1");

    const serialized = JSON.stringify([...logEvent.mock.calls, ...savePublishLog.mock.calls]);
    expect(serialized.length).toBeLessThan(5000);
  });

  it("pipeline_logs는 event_name(type) 기준으로 기록되며 wordpress_media_upload_started가 포함된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ featuredImageSourceUrl: "https://images.example.com/external.webp" })
    );
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    uploadMediaToWordPress.mockResolvedValue({
      status: "uploaded",
      wordpressMediaId: 12,
      wordpressUrl: "https://example-blog.test/uploads/photo.webp",
      metadataUpdateStatus: "not_attempted",
    });

    await uploadFeaturedImageToWordPress("article-1");

    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpress_media_upload_started" }));
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpress_media_upload_completed" }));
  });
});
