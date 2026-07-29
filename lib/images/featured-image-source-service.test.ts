import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/types/domain";

const getArticleById = vi.fn();
const saveFeaturedImageSourceResult = vi.fn();
const savePublishLog = vi.fn();
const logEvent = vi.fn();
const saveLocalUploadFile = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  saveFeaturedImageSourceResult: (...args: unknown[]) => saveFeaturedImageSourceResult(...args),
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  savePublishLog: (...args: unknown[]) => savePublishLog(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));
vi.mock("@/lib/images/featured-image-local-storage", () => ({
  saveLocalUploadFile: (...args: unknown[]) => saveLocalUploadFile(...args),
}));

const { saveExternalImageUrl, saveExistingWordPressMedia, saveLocalImageUpload, FEATURED_IMAGE_SOURCE_TARGET } =
  await import("./featured-image-source-service");

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

beforeEach(() => {
  getArticleById.mockReset();
  saveFeaturedImageSourceResult.mockReset();
  savePublishLog.mockReset();
  logEvent.mockReset();
  saveLocalUploadFile.mockReset();

  getArticleById.mockResolvedValue(makeArticle());
  saveFeaturedImageSourceResult.mockResolvedValue({});
  savePublishLog.mockResolvedValue({});
  logEvent.mockResolvedValue({});
});

describe("saveExternalImageUrl", () => {
  it("external URL 저장 시 source_status=prepared가 된다", async () => {
    const result = await saveExternalImageUrl("article-1", { url: "https://example.com/photo.png" });

    expect(result.success).toBe(true);
    expect(saveFeaturedImageSourceResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ sourceType: "external_url", sourceStatus: "prepared", uploadStatus: "prepared" })
    );
  });

  it("/mock/... URL은 invalid 처리한다", async () => {
    const result = await saveExternalImageUrl("article-1", { url: "/mock/images/sample.jpg" });

    expect(result.success).toBe(false);
    expect(saveFeaturedImageSourceResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ sourceStatus: "invalid" })
    );
  });

  it("http/https가 아니면 거부한다", async () => {
    const result = await saveExternalImageUrl("article-1", { url: "ftp://example.com/a.jpg" });

    expect(result.success).toBe(false);
  });

  it("jpg/png/webp MIME type은 허용한다", async () => {
    for (const mimeType of ["image/jpeg", "image/png", "image/webp"]) {
      saveFeaturedImageSourceResult.mockClear();
      const result = await saveExternalImageUrl("article-1", { url: "https://example.com/image.jpg", mimeType });
      expect(result.success).toBe(true);
    }
  });

  it("성공 시 pipeline_logs에 event_name 기준으로 저장된다", async () => {
    await saveExternalImageUrl("article-1", { url: "https://example.com/photo.png" });

    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "featured_image_source_saved" }));
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "featured_image_external_url_saved" }));
  });
});

describe("saveExistingWordPressMedia", () => {
  it("existing WordPress media id 저장 시 upload_status=uploaded가 된다", async () => {
    const result = await saveExistingWordPressMedia("article-1", { mediaId: 42 });

    expect(result.success).toBe(true);
    expect(saveFeaturedImageSourceResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({
        sourceType: "wordpress_media_existing",
        sourceStatus: "prepared",
        uploadStatus: "uploaded",
        wordpressMediaId: 42,
      })
    );
  });

  it("media id가 없으면(0 이하) 거부한다", async () => {
    const result = await saveExistingWordPressMedia("article-1", { mediaId: 0 });

    expect(result.success).toBe(false);
    expect(saveFeaturedImageSourceResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ sourceStatus: "invalid" })
    );
  });

  it("publish_logs에 target=featured_image_manual_source로 저장된다", async () => {
    await saveExistingWordPressMedia("article-1", { mediaId: 42 });

    expect(savePublishLog).toHaveBeenCalledWith(expect.objectContaining({ target: FEATURED_IMAGE_SOURCE_TARGET }));
  });
});

describe("saveLocalImageUpload", () => {
  it("성공 시 source_status=prepared, upload_status=prepared로 저장된다", async () => {
    saveLocalUploadFile.mockResolvedValue({
      success: true,
      url: "https://example-project.supabase.co/storage/v1/object/public/featured-images/article-1/photo.jpg",
      filename: "photo.jpg",
      mimeType: "image/jpeg",
    });
    const file = new File([new Uint8Array(10)], "photo.jpg", { type: "image/jpeg" });

    const result = await saveLocalImageUpload("article-1", file);

    expect(result.success).toBe(true);
    expect(saveFeaturedImageSourceResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ sourceType: "local_upload", sourceStatus: "prepared", uploadStatus: "prepared" })
    );
  });

  it("파일 저장이 실패하면 invalid로 기록된다", async () => {
    saveLocalUploadFile.mockResolvedValue({ success: false, error: "허용되지 않는 이미지 형식입니다." });
    const file = new File([new Uint8Array(10)], "photo.gif", { type: "image/gif" });

    const result = await saveLocalImageUpload("article-1", file);

    expect(result.success).toBe(false);
    expect(saveFeaturedImageSourceResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ sourceStatus: "invalid" })
    );
  });
});

describe("보안/안전 요구사항", () => {
  it("auth 정보와 image binary가 logs에 저장되지 않는다", async () => {
    saveLocalUploadFile.mockResolvedValue({
      success: true,
      url: "https://example-project.supabase.co/storage/v1/object/public/featured-images/article-1/photo.jpg",
      filename: "photo.jpg",
      mimeType: "image/jpeg",
    });

    await saveExternalImageUrl("article-1", { url: "https://example.com/photo.png" });
    await saveExistingWordPressMedia("article-1", { mediaId: 1 });
    await saveLocalImageUpload("article-1", new File([new Uint8Array(10)], "photo.jpg", { type: "image/jpeg" }));

    const serialized = JSON.stringify([...logEvent.mock.calls, ...savePublishLog.mock.calls]).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("basic ");

    const call = savePublishLog.mock.calls[0];
    const keys = Object.keys(call[0].details);
    expect(keys.sort()).toEqual(
      ["sourceType", "sourceStatus", "filename", "mimeType", "hasUrl", "hasLocalPath", "hasWordPressMediaId"].sort()
    );
  });

  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await saveExternalImageUrl("missing", { url: "https://example.com/a.jpg" });

    expect(result.success).toBe(false);
    expect(saveFeaturedImageSourceResult).not.toHaveBeenCalled();
  });
});
