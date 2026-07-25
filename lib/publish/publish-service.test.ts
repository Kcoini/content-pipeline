import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/types/domain";

const getArticleById = vi.fn();
const updateSeoPluginWriteStatus = vi.fn();
const getApprovalLogsByArticleId = vi.fn();
const savePublishLog = vi.fn();
const hasSuccessfulPublishLog = vi.fn();
const createDraftPost = vi.fn();
const findOrCreateCategory = vi.fn();
const findOrCreateTag = vi.fn();
const applySeoPluginMetadata = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  updateSeoPluginWriteStatus: (...args: unknown[]) => updateSeoPluginWriteStatus(...args),
}));
vi.mock("@/lib/repositories/approval-repository", () => ({
  getApprovalLogsByArticleId: (...args: unknown[]) => getApprovalLogsByArticleId(...args),
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  savePublishLog: (...args: unknown[]) => savePublishLog(...args),
  hasSuccessfulPublishLog: (...args: unknown[]) => hasSuccessfulPublishLog(...args),
}));
vi.mock("./wordpress-client", () => ({
  createDraftPost: (...args: unknown[]) => createDraftPost(...args),
  findOrCreateCategory: (...args: unknown[]) => findOrCreateCategory(...args),
  findOrCreateTag: (...args: unknown[]) => findOrCreateTag(...args),
}));
vi.mock("@/lib/seo/seo-plugin-writer", () => ({
  applySeoPluginMetadata: (...args: unknown[]) => applySeoPluginMetadata(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { publishArticleToWordPressDraft, resolveWordPressTitle, resolveWordPressExcerpt } = await import(
  "./publish-service"
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

beforeEach(() => {
  getArticleById.mockReset();
  updateSeoPluginWriteStatus.mockReset();
  getApprovalLogsByArticleId.mockReset();
  savePublishLog.mockReset();
  hasSuccessfulPublishLog.mockReset();
  createDraftPost.mockReset();
  findOrCreateCategory.mockReset();
  findOrCreateTag.mockReset();
  applySeoPluginMetadata.mockReset();
  logEvent.mockReset();

  getApprovalLogsByArticleId.mockResolvedValue([
    { id: "approval-1", articleId: "article-1", themeId: "theme-1", targetType: "article", targetId: "article-1", action: "approve_article", status: "approved", approvedBy: "local-user", notes: null, createdAt: "2026-01-02T00:00:00.000Z" },
  ]);
  hasSuccessfulPublishLog.mockResolvedValue(false);
  savePublishLog.mockResolvedValue({});
  updateSeoPluginWriteStatus.mockResolvedValue({});
  logEvent.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveWordPressTitle", () => {
  it("monetized_blog이고 seoTitle이 있으면 seoTitle을 사용한다", () => {
    const article = makeArticle({ articleMode: "monetized_blog", seoTitle: "SEO 제목" });
    expect(resolveWordPressTitle(article)).toBe("SEO 제목");
  });

  it("monetized_blog이어도 seoTitle이 없으면 article.title을 사용한다", () => {
    const article = makeArticle({ articleMode: "monetized_blog", seoTitle: null });
    expect(resolveWordPressTitle(article)).toBe("기사 제목");
  });

  it("general_news/source_based_explainer는 항상 article.title을 사용한다", () => {
    const article = makeArticle({ articleMode: "general_news", seoTitle: "무시되어야 함" });
    expect(resolveWordPressTitle(article)).toBe("기사 제목");
  });
});

describe("resolveWordPressExcerpt", () => {
  it("metaDescription이 있으면 그대로 사용한다", () => {
    const article = makeArticle({ metaDescription: "메타 설명" });
    expect(resolveWordPressExcerpt(article)).toBe("메타 설명");
  });

  it("metaDescription이 없으면 본문 앞부분에서 생성한다", () => {
    const article = makeArticle({ metaDescription: null, content: "본문 시작 부분입니다. ".repeat(20) });
    const excerpt = resolveWordPressExcerpt(article);
    expect(excerpt).toBeTruthy();
    expect(excerpt!.length).toBeLessThanOrEqual(161);
  });
});

describe("publishArticleToWordPressDraft", () => {
  it("draft 상태 기사는 게시 대상이 아니다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "draft" }));

    const result = await publishArticleToWordPressDraft("article-1");

    expect(result.success).toBe(false);
    expect(result.message).toContain("reviewed");
    expect(createDraftPost).not.toHaveBeenCalled();
    expect(savePublishLog).not.toHaveBeenCalled();
  });

  it("reviewed 상태 기사만 게시 가능하다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "reviewed" }));
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "false");

    const result = await publishArticleToWordPressDraft("article-1");

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
  });

  it("approval_logs가 없으면 게시하지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "reviewed" }));
    getApprovalLogsByArticleId.mockResolvedValue([]);

    const result = await publishArticleToWordPressDraft("article-1");

    expect(result.success).toBe(false);
    expect(result.message).toContain("승인 기록");
    expect(createDraftPost).not.toHaveBeenCalled();
  });

  it("WORDPRESS_PUBLISH_ENABLED=false이면 dry-run이 실행되고 실제 client는 호출되지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "reviewed" }));
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "false");

    const result = await publishArticleToWordPressDraft("article-1");

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(createDraftPost).not.toHaveBeenCalled();
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "dry_run", target: "wordpress" })
    );
  });

  it("dry-run publish details에 category/tag names가 포함된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ status: "reviewed", wpCategoryNames: ["복지"], wpTagNames: ["장기요양보험", "요양원"] })
    );
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "false");

    await publishArticleToWordPressDraft("article-1");

    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "dry_run",
        details: expect.objectContaining({
          categoryNames: ["복지"],
          tagNames: ["장기요양보험", "요양원"],
        }),
      })
    );
  });

  it("WORDPRESS_PUBLISH_ENABLED=false이면 WordPress category/tag API를 호출하지 않는다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ status: "reviewed", wpCategoryNames: ["복지"], wpTagNames: ["장기요양보험"] })
    );
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "false");

    await publishArticleToWordPressDraft("article-1");

    expect(findOrCreateCategory).not.toHaveBeenCalled();
    expect(findOrCreateTag).not.toHaveBeenCalled();
  });

  it("WORDPRESS_PUBLISH_ENABLED=true이고 category/tag id가 이미 있으면 동기화 없이 그대로 사용한다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ status: "reviewed", wpCategoryIds: [5], wpTagIds: [7, 8] })
    );
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    createDraftPost.mockResolvedValue({
      success: true,
      externalPostId: 1,
      postUrl: "https://example-blog.test/?p=1",
      raw: {},
    });

    await publishArticleToWordPressDraft("article-1");

    expect(findOrCreateCategory).not.toHaveBeenCalled();
    expect(findOrCreateTag).not.toHaveBeenCalled();
    expect(createDraftPost).toHaveBeenCalledWith(
      expect.objectContaining({ categories: [5], tags: [7, 8] })
    );
  });

  it("WORDPRESS_PUBLISH_ENABLED=true이고 id가 없지만 이름이 있으면 findOrCreateCategory/Tag로 동기화한다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ status: "reviewed", wpCategoryNames: ["복지"], wpTagNames: ["장기요양보험"] })
    );
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    findOrCreateCategory.mockResolvedValue({ success: true, id: 11, name: "복지" });
    findOrCreateTag.mockResolvedValue({ success: true, id: 22, name: "장기요양보험" });
    createDraftPost.mockResolvedValue({
      success: true,
      externalPostId: 1,
      postUrl: "https://example-blog.test/?p=1",
      raw: {},
    });

    await publishArticleToWordPressDraft("article-1");

    expect(findOrCreateCategory).toHaveBeenCalledWith("복지");
    expect(findOrCreateTag).toHaveBeenCalledWith("장기요양보험");
    expect(createDraftPost).toHaveBeenCalledWith(
      expect.objectContaining({ categories: [11], tags: [22] })
    );
  });

  it("이미 success publish_logs가 있으면 중복 생성하지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "reviewed" }));
    hasSuccessfulPublishLog.mockResolvedValue(true);
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");

    const result = await publishArticleToWordPressDraft("article-1");

    expect(result.success).toBe(true);
    expect(result.message).toContain("이미");
    expect(createDraftPost).not.toHaveBeenCalled();
    expect(savePublishLog).not.toHaveBeenCalled();
  });

  it("WordPress API 실패 시 publish_logs에 failed가 저장된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "reviewed" }));
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    createDraftPost.mockResolvedValue({ success: false, errorMessage: "WordPress 인증 실패" });

    const result = await publishArticleToWordPressDraft("article-1");

    expect(result.success).toBe(false);
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorMessage: "WordPress 인증 실패" })
    );
  });

  it("WordPress API 성공 시 publish_logs에 success와 external_post_id가 저장된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "reviewed" }));
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    createDraftPost.mockResolvedValue({
      success: true,
      externalPostId: 99,
      postUrl: "https://example-blog.test/?p=99",
      raw: { id: 99 },
    });

    const result = await publishArticleToWordPressDraft("article-1");

    expect(result.success).toBe(true);
    expect(result.postUrl).toBe("https://example-blog.test/?p=99");
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", externalPostId: "99", postUrl: "https://example-blog.test/?p=99" })
    );
  });

  it("기존 article generation/review/approval 흐름과 독립적으로 동작한다 (article 조회만 사용)", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await publishArticleToWordPressDraft("missing-article");

    expect(result.success).toBe(false);
    expect(result.message).toContain("찾을 수 없습니다");
  });

  it("dry-run details에 SEO plugin payload 요약(provider/seoTitle/focusKeyword)이 포함된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({
        status: "reviewed",
        seoPluginProvider: "yoast",
        seoPluginMetadataStatus: "generated",
        seoPluginPayload: { seoTitle: "SEO 제목", focusKeyword: "타깃 키워드" },
      })
    );
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "false");

    await publishArticleToWordPressDraft("article-1");

    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "dry_run",
        details: expect.objectContaining({
          seoPlugin: { provider: "yoast", metadataStatus: "generated", seoTitle: "SEO 제목", focusKeyword: "타깃 키워드" },
        }),
      })
    );
  });

  it("dry-run details에 featured image summary(status/altText/caption/style/aspectRatio)가 포함된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({
        status: "reviewed",
        featuredImageStatus: "prepared",
        featuredImageAltText: "요양원 비교 일러스트",
        featuredImageCaption: "핵심 기준을 정리했습니다.",
        featuredImageStyle: "clickable but trustworthy blog thumbnail",
        featuredImageAspectRatio: "16:9",
      })
    );
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "false");

    await publishArticleToWordPressDraft("article-1");

    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "dry_run",
        details: expect.objectContaining({
          featuredImage: {
            status: "prepared",
            altText: "요양원 비교 일러스트",
            caption: "핵심 기준을 정리했습니다.",
            style: "clickable but trustworthy blog thumbnail",
            aspectRatio: "16:9",
          },
        }),
      })
    );
  });

  it("dry-run details에 featuredImageUpload 요약(uploadStatus/sourceType/filename/mimeType/wouldAttachAsFeatured)이 포함된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({
        status: "reviewed",
        featuredImageUploadStatus: "prepared",
        featuredImageSourceType: "none",
        featuredImageFilename: "care-guide-featured.webp",
        featuredImageMimeType: "image/webp",
        featuredImageWordpressMediaId: null,
      })
    );
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "false");

    await publishArticleToWordPressDraft("article-1");

    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "dry_run",
        details: expect.objectContaining({
          featuredImageUpload: expect.objectContaining({
            uploadStatus: "prepared",
            sourceType: "none",
            filename: "care-guide-featured.webp",
            mimeType: "image/webp",
            wordpressMediaId: null,
            wouldAttachAsFeatured: false,
          }),
        }),
      })
    );
  });

  it("dry-run details에 generatedImage 요약(status/provider/model/imageUrl/width/height/format)이 포함된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({
        status: "reviewed",
        generatedImageStatus: "generated",
        generatedImageProvider: "mock",
        generatedImageModel: "mock-image-generator-v1",
        generatedImageUrl: "/mock/generated-images/article-1.webp",
        generatedImageWidth: 1536,
        generatedImageHeight: 864,
        generatedImageFormat: "webp",
      })
    );
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "false");

    await publishArticleToWordPressDraft("article-1");

    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "dry_run",
        details: expect.objectContaining({
          generatedImage: {
            status: "generated",
            provider: "mock",
            model: "mock-image-generator-v1",
            imageUrl: "/mock/generated-images/article-1.webp",
            width: 1536,
            height: 864,
            format: "webp",
          },
        }),
      })
    );
  });

  it("featured_image_wordpress_media_id가 없으면 실제 게시 시 featuredMedia를 보내지 않고 skip 이벤트를 기록한다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ status: "reviewed", featuredImageWordpressMediaId: null })
    );
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    createDraftPost.mockResolvedValue({
      success: true,
      externalPostId: 1,
      postUrl: "https://example-blog.test/?p=1",
      raw: {},
    });

    await publishArticleToWordPressDraft("article-1");

    expect(createDraftPost).toHaveBeenCalledWith(
      expect.objectContaining({ featuredMedia: undefined })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "featured_image_upload_skipped_not_implemented" })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_featured_image_skipped_no_media" })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_featured_media_skipped_no_media_id" })
    );
  });

  it("featured_image_wordpress_media_id가 있으면 실제 게시 시 featuredMedia로 전달한다 (구조만 준비, 업로드는 하지 않음)", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ status: "reviewed", featuredImageWordpressMediaId: 42 })
    );
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    createDraftPost.mockResolvedValue({
      success: true,
      externalPostId: 1,
      postUrl: "https://example-blog.test/?p=1",
      raw: {},
    });

    await publishArticleToWordPressDraft("article-1");

    expect(createDraftPost).toHaveBeenCalledWith(expect.objectContaining({ featuredMedia: 42 }));
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_featured_media_prepared" })
    );
  });

  it("SEO plugin provider가 none이면 실제 API 게시 성공 시 write를 시도하지 않고 skipped_provider_none으로 기록한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "reviewed", seoPluginProvider: "none" }));
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    createDraftPost.mockResolvedValue({
      success: true,
      externalPostId: 1,
      postUrl: "https://example-blog.test/?p=1",
      raw: {},
    });

    await publishArticleToWordPressDraft("article-1");

    expect(applySeoPluginMetadata).not.toHaveBeenCalled();
    expect(updateSeoPluginWriteStatus).toHaveBeenCalledWith("article-1", "skipped_provider_none");
  });

  it("SEO_PLUGIN_WRITE_ENABLED=false이면 provider가 있어도 실제 write를 시도하지 않는다 (stub이 skipped_dry_run 반환)", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "reviewed", seoPluginProvider: "yoast" }));
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "false");
    createDraftPost.mockResolvedValue({
      success: true,
      externalPostId: 1,
      postUrl: "https://example-blog.test/?p=1",
      raw: {},
    });
    applySeoPluginMetadata.mockResolvedValue({ status: "skipped_dry_run" });

    await publishArticleToWordPressDraft("article-1");

    expect(applySeoPluginMetadata).toHaveBeenCalled();
    expect(updateSeoPluginWriteStatus).toHaveBeenCalledWith("article-1", "skipped_dry_run");
  });
});
