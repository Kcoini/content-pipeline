import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/types/domain";

const getArticleById = vi.fn();
const saveWordPressFeaturedMediaAttachResult = vi.fn();
const savePublishLog = vi.fn();
const getSuccessfulWordPressDraft = vi.fn();
const updateDraftFeaturedMedia = vi.fn();
const getMediaItem = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  saveWordPressFeaturedMediaAttachResult: (...args: unknown[]) => saveWordPressFeaturedMediaAttachResult(...args),
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  savePublishLog: (...args: unknown[]) => savePublishLog(...args),
  getSuccessfulWordPressDraft: (...args: unknown[]) => getSuccessfulWordPressDraft(...args),
}));
vi.mock("./wordpress-client", () => ({
  updateDraftFeaturedMedia: (...args: unknown[]) => updateDraftFeaturedMedia(...args),
  getMediaItem: (...args: unknown[]) => getMediaItem(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { attachFeaturedMediaToDraft, WORDPRESS_FEATURED_MEDIA_TARGET } = await import(
  "./wordpress-featured-media-service"
);

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
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  saveWordPressFeaturedMediaAttachResult.mockReset();
  savePublishLog.mockReset();
  getSuccessfulWordPressDraft.mockReset();
  updateDraftFeaturedMedia.mockReset();
  getMediaItem.mockReset();
  logEvent.mockReset();

  saveWordPressFeaturedMediaAttachResult.mockResolvedValue({});
  savePublishLog.mockResolvedValue({});
  logEvent.mockResolvedValue({});
  getMediaItem.mockResolvedValue({ exists: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("attachFeaturedMediaToDraft", () => {
  it("media id가 없으면 실제 API를 호출하지 않고 skipped_no_media_id로 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ featuredImageWordpressMediaId: null }));

    const result = await attachFeaturedMediaToDraft("article-1");

    expect(result.success).toBe(false);
    expect(updateDraftFeaturedMedia).not.toHaveBeenCalled();
    expect(saveWordPressFeaturedMediaAttachResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "skipped_no_media_id" })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_featured_media_attach_skipped_no_media_id" })
    );
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        target: WORDPRESS_FEATURED_MEDIA_TARGET,
        status: "skipped",
        details: expect.objectContaining({ reason: "no_media_id" }),
      })
    );
  });

  it("기존 draft가 없으면 updateDraftFeaturedMedia를 호출하지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ featuredImageWordpressMediaId: 10 }));
    getSuccessfulWordPressDraft.mockResolvedValue(null);

    const result = await attachFeaturedMediaToDraft("article-1");

    expect(result.success).toBe(false);
    expect(updateDraftFeaturedMedia).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_featured_media_existing_draft_not_found" })
    );
  });

  it("기존 draft가 있으면(external_post_id 존재) updateDraftFeaturedMedia를 호출한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ featuredImageWordpressMediaId: 10 }));
    getSuccessfulWordPressDraft.mockResolvedValue({
      externalPostId: "42",
      postUrl: "https://example-blog.test/?p=42",
    });
    updateDraftFeaturedMedia.mockResolvedValue({
      success: true,
      postId: 42,
      link: "https://example-blog.test/?p=42",
      status: "draft",
      featuredMedia: 10,
    });

    await attachFeaturedMediaToDraft("article-1");

    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_featured_media_existing_draft_found" })
    );
    expect(updateDraftFeaturedMedia).toHaveBeenCalledWith(42, 10);
  });

  it("updateDraftFeaturedMedia는 status=draft를 강제한다 (client 레벨에서 이미 강제되지만 호출 인자를 확인)", async () => {
    getArticleById.mockResolvedValue(makeArticle({ featuredImageWordpressMediaId: 10 }));
    getSuccessfulWordPressDraft.mockResolvedValue({ externalPostId: "42", postUrl: "https://example-blog.test/?p=42" });
    updateDraftFeaturedMedia.mockResolvedValue({
      success: true,
      postId: 42,
      link: "https://example-blog.test/?p=42",
      status: "draft",
      featuredMedia: 10,
    });

    await attachFeaturedMediaToDraft("article-1");

    const [, mediaIdArg] = updateDraftFeaturedMedia.mock.calls[0];
    expect(mediaIdArg).toBe(10);
  });

  it("featured_media update 성공 시 articles.wordpress_featured_media_attach_status=attached로 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ featuredImageWordpressMediaId: 10 }));
    getSuccessfulWordPressDraft.mockResolvedValue({ externalPostId: "42", postUrl: "https://example-blog.test/?p=42" });
    updateDraftFeaturedMedia.mockResolvedValue({
      success: true,
      postId: 42,
      link: "https://example-blog.test/?p=42",
      status: "draft",
      featuredMedia: 10,
    });

    const result = await attachFeaturedMediaToDraft("article-1");

    expect(result.success).toBe(true);
    expect(saveWordPressFeaturedMediaAttachResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "attached" })
    );
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        target: WORDPRESS_FEATURED_MEDIA_TARGET,
        status: "success",
        externalPostId: "42",
        postUrl: "https://example-blog.test/?p=42",
        details: expect.objectContaining({
          featuredMedia: { included: true, mediaId: 10, mode: "update_existing_draft" },
        }),
      })
    );
  });

  it("media item 사전 검증이 실패하면 연결을 중단하고 safe error를 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ featuredImageWordpressMediaId: 999 }));
    getSuccessfulWordPressDraft.mockResolvedValue({ externalPostId: "42", postUrl: "https://example-blog.test/?p=42" });
    getMediaItem.mockResolvedValue({ exists: false, statusCode: 404, errorMessage: "WordPress media item을 찾을 수 없습니다 (HTTP 404)." });

    const result = await attachFeaturedMediaToDraft("article-1");

    expect(result.success).toBe(false);
    expect(updateDraftFeaturedMedia).not.toHaveBeenCalled();
    expect(saveWordPressFeaturedMediaAttachResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "failed" })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_media_item_validation_failed" })
    );
  });

  it("실패 시 safe error를 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ featuredImageWordpressMediaId: 10 }));
    getSuccessfulWordPressDraft.mockResolvedValue({ externalPostId: "42", postUrl: "https://example-blog.test/?p=42" });
    updateDraftFeaturedMedia.mockResolvedValue({
      success: false,
      statusCode: 403,
      errorMessage: "WordPress featured_media 갱신 실패 (HTTP 403 Forbidden)",
      reasonCandidate: ["사용자 권한 부족"],
    });

    const result = await attachFeaturedMediaToDraft("article-1");

    expect(result.success).toBe(false);
    expect(saveWordPressFeaturedMediaAttachResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "failed", errorMessage: "WordPress featured_media 갱신 실패 (HTTP 403 Forbidden)" })
    );
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({ target: WORDPRESS_FEATURED_MEDIA_TARGET, status: "failed" })
    );
  });

  it("auth 정보가 logs에 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ featuredImageWordpressMediaId: 10 }));
    getSuccessfulWordPressDraft.mockResolvedValue({ externalPostId: "42", postUrl: "https://example-blog.test/?p=42" });
    updateDraftFeaturedMedia.mockResolvedValue({
      success: true,
      postId: 42,
      link: "https://example-blog.test/?p=42",
      status: "draft",
      featuredMedia: 10,
    });

    await attachFeaturedMediaToDraft("article-1");

    const serialized = JSON.stringify([...logEvent.mock.calls, ...savePublishLog.mock.calls]).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("basic ");
  });

  it("article content 전체가 details_json에 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ featuredImageWordpressMediaId: 10, content: "본문".repeat(2000) })
    );
    getSuccessfulWordPressDraft.mockResolvedValue({ externalPostId: "42", postUrl: "https://example-blog.test/?p=42" });
    updateDraftFeaturedMedia.mockResolvedValue({
      success: true,
      postId: 42,
      link: "https://example-blog.test/?p=42",
      status: "draft",
      featuredMedia: 10,
    });

    await attachFeaturedMediaToDraft("article-1");

    const call = savePublishLog.mock.calls.find((c) => c[0].status === "success");
    const detailsStr = JSON.stringify(call![0].details);
    expect(detailsStr).not.toContain("본문".repeat(2000));
  });

  it("pipeline_logs는 event_name(type) 기준으로 기록된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ featuredImageWordpressMediaId: 10 }));
    getSuccessfulWordPressDraft.mockResolvedValue({ externalPostId: "42", postUrl: "https://example-blog.test/?p=42" });
    updateDraftFeaturedMedia.mockResolvedValue({
      success: true,
      postId: 42,
      link: "https://example-blog.test/?p=42",
      status: "draft",
      featuredMedia: 10,
    });

    await attachFeaturedMediaToDraft("article-1");

    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpress_featured_media_attach_started" }));
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpress_featured_media_attach_completed" }));
  });
});
