import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/types/domain";

const getArticleById = vi.fn();
const updateSeoPluginWriteStatus = vi.fn();
const saveWordPressCategoryTagIds = vi.fn();
const saveFeaturedImageUploadResult = vi.fn();
const getApprovalLogsByArticleId = vi.fn();
const savePublishLog = vi.fn();
const getSuccessfulWordPressDraft = vi.fn();
const createDraftPost = vi.fn();
const findOrCreateCategory = vi.fn();
const findOrCreateTag = vi.fn();
const uploadMediaToWordPress = vi.fn();
const testWordPressConnection = vi.fn();
const applySeoPluginMetadata = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  updateSeoPluginWriteStatus: (...args: unknown[]) => updateSeoPluginWriteStatus(...args),
  saveWordPressCategoryTagIds: (...args: unknown[]) => saveWordPressCategoryTagIds(...args),
  saveFeaturedImageUploadResult: (...args: unknown[]) => saveFeaturedImageUploadResult(...args),
}));
vi.mock("@/lib/repositories/approval-repository", () => ({
  getApprovalLogsByArticleId: (...args: unknown[]) => getApprovalLogsByArticleId(...args),
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  savePublishLog: (...args: unknown[]) => savePublishLog(...args),
  getSuccessfulWordPressDraft: (...args: unknown[]) => getSuccessfulWordPressDraft(...args),
}));
vi.mock("./wordpress-client", () => ({
  createDraftPost: (...args: unknown[]) => createDraftPost(...args),
  findOrCreateCategory: (...args: unknown[]) => findOrCreateCategory(...args),
  findOrCreateTag: (...args: unknown[]) => findOrCreateTag(...args),
  uploadMediaToWordPress: (...args: unknown[]) => uploadMediaToWordPress(...args),
  testWordPressConnection: (...args: unknown[]) => testWordPressConnection(...args),
}));
vi.mock("@/lib/seo/seo-plugin-writer", () => ({
  applySeoPluginMetadata: (...args: unknown[]) => applySeoPluginMetadata(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { publishArticleToWordPressDraft, resolveWordPressTitle, resolveWordPressExcerpt, runWordPressConnectionTest } =
  await import("./publish-service");

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
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  updateSeoPluginWriteStatus.mockReset();
  saveWordPressCategoryTagIds.mockReset();
  saveFeaturedImageUploadResult.mockReset();
  getApprovalLogsByArticleId.mockReset();
  savePublishLog.mockReset();
  getSuccessfulWordPressDraft.mockReset();
  createDraftPost.mockReset();
  findOrCreateCategory.mockReset();
  findOrCreateTag.mockReset();
  uploadMediaToWordPress.mockReset();
  testWordPressConnection.mockReset();
  applySeoPluginMetadata.mockReset();
  logEvent.mockReset();

  getApprovalLogsByArticleId.mockResolvedValue([
    { id: "approval-1", articleId: "article-1", themeId: "theme-1", targetType: "article", targetId: "article-1", action: "approve_article", status: "approved", approvedBy: "local-user", notes: null, createdAt: "2026-01-02T00:00:00.000Z" },
  ]);
  getSuccessfulWordPressDraft.mockResolvedValue(null);
  savePublishLog.mockResolvedValue({});
  updateSeoPluginWriteStatus.mockResolvedValue({});
  saveWordPressCategoryTagIds.mockResolvedValue({});
  saveFeaturedImageUploadResult.mockResolvedValue({});
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

  it("이미 success publish_logs(external_post_id 포함)가 있으면 중복 생성하지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "reviewed" }));
    getSuccessfulWordPressDraft.mockResolvedValue({
      externalPostId: "77",
      postUrl: "https://example-blog.test/?p=77",
    });
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");

    const result = await publishArticleToWordPressDraft("article-1");

    expect(result.success).toBe(true);
    expect(result.message).toContain("이미");
    expect(result.externalPostId).toBe("77");
    expect(result.postUrl).toBe("https://example-blog.test/?p=77");
    expect(createDraftPost).not.toHaveBeenCalled();
    expect(savePublishLog).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_actual_publish_skipped_duplicate" })
    );
  });

  it("duplicate skip 시 실제 WordPress API를 다시 호출하지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "reviewed" }));
    getSuccessfulWordPressDraft.mockResolvedValue({
      externalPostId: "77",
      postUrl: "https://example-blog.test/?p=77",
    });
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");

    await publishArticleToWordPressDraft("article-1");

    expect(createDraftPost).not.toHaveBeenCalled();
    expect(findOrCreateCategory).not.toHaveBeenCalled();
    expect(findOrCreateTag).not.toHaveBeenCalled();
  });

  it("article.status가 reviewed가 아니면 actual publish를 막는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "draft" }));
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");

    const result = await publishArticleToWordPressDraft("article-1");

    expect(result.success).toBe(false);
    expect(createDraftPost).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_actual_publish_skipped_not_reviewed" })
    );
  });

  it("WordPress API 실패 시 publish_logs에 failed가 저장된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "reviewed" }));
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    createDraftPost.mockResolvedValue({ success: false, errorMessage: "WordPress 인증 실패", statusCode: 401 });

    const result = await publishArticleToWordPressDraft("article-1");

    expect(result.success).toBe(false);
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorMessage: "WordPress 인증 실패",
        details: expect.objectContaining({
          actual: true,
          dryRun: false,
          statusCode: 401,
          endpointType: "wp/v2/posts",
          reasonCandidate: expect.arrayContaining(["username 또는 Application Password 오류"]),
        }),
      })
    );
  });

  it("WORDPRESS_PUBLISH_ENABLED=true이고 env(Application Password 등)가 없으면 failed로 저장된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "reviewed" }));
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    createDraftPost.mockResolvedValue({
      success: false,
      errorMessage: "WORDPRESS_BASE_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD가 설정되지 않았습니다.",
    });

    const result = await publishArticleToWordPressDraft("article-1");

    expect(result.success).toBe(false);
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" })
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
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          featuredMedia: expect.objectContaining({ included: true, mediaId: 42, mode: "create_draft" }),
        }),
      })
    );
  });

  it("featured_image_wordpress_media_id가 없으면 featured_media를 보내지 않고 details_json에도 included=false로 기록한다", async () => {
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

    expect(createDraftPost).toHaveBeenCalledWith(expect.objectContaining({ featuredMedia: undefined }));
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          featuredMedia: expect.objectContaining({ included: false, mediaId: null }),
        }),
      })
    );
  });

  it("실제 게시 성공 시 category/tag 동기화 결과를 articles.wp_category_ids/wp_tag_ids에 저장한다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({
        status: "reviewed",
        wpCategoryNames: ["복지"],
        wpTagNames: ["장기요양보험"],
        wpCategoryIds: [],
        wpTagIds: [],
      })
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

    expect(saveWordPressCategoryTagIds).toHaveBeenCalledWith("article-1", [11], [22]);
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpress_category_sync_completed" }));
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpress_tag_sync_completed" }));
  });

  it("category sync 실패 시 warning으로 처리되고 draft 생성은 계속 진행된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ status: "reviewed", wpCategoryNames: ["복지"], wpCategoryIds: [], wpTagNames: [] })
    );
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    findOrCreateCategory.mockRejectedValue(new Error("권한 부족"));
    createDraftPost.mockResolvedValue({
      success: true,
      externalPostId: 1,
      postUrl: "https://example-blog.test/?p=1",
      raw: {},
    });

    const result = await publishArticleToWordPressDraft("article-1");

    expect(result.success).toBe(true);
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpress_category_sync_failed" }));
    expect(createDraftPost).toHaveBeenCalledWith(expect.objectContaining({ categories: undefined }));
  });

  it("WORDPRESS_MEDIA_UPLOAD_ENABLED=false이면 실제 업로드를 시도하지 않는다 (media upload skipped_deferred)", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ status: "reviewed", generatedImageUrl: "/mock/generated-images/article-1.webp" })
    );
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "false");
    createDraftPost.mockResolvedValue({
      success: true,
      externalPostId: 1,
      postUrl: "https://example-blog.test/?p=1",
      raw: {},
    });

    await publishArticleToWordPressDraft("article-1");

    expect(uploadMediaToWordPress).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_media_upload_skipped_deferred" })
    );
  });

  it("Phase 2-9: WORDPRESS_MEDIA_UPLOAD_ENABLED=true이고 생성된 이미지가 있어도 실제 업로드는 이번 단계에서 시도하지 않는다 (skipped_deferred)", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ status: "reviewed", generatedImageUrl: "/mock/generated-images/article-1.webp" })
    );
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    createDraftPost.mockResolvedValue({
      success: true,
      externalPostId: 1,
      postUrl: "https://example-blog.test/?p=1",
      raw: {},
    });

    const result = await publishArticleToWordPressDraft("article-1");

    expect(result.success).toBe(true);
    expect(uploadMediaToWordPress).not.toHaveBeenCalled();
    expect(saveFeaturedImageUploadResult).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_media_upload_skipped_deferred" })
    );
    expect(createDraftPost).toHaveBeenCalledWith(expect.objectContaining({ featuredMedia: undefined }));
  });

  it("WordPress media id가 이미 있으면(사전 업로드) 새 업로드 없이 featured_media로 연결한다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ status: "reviewed", featuredImageWordpressMediaId: 42 })
    );
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    createDraftPost.mockResolvedValue({
      success: true,
      externalPostId: 1,
      postUrl: "https://example-blog.test/?p=1",
      raw: {},
    });

    await publishArticleToWordPressDraft("article-1");

    expect(uploadMediaToWordPress).not.toHaveBeenCalled();
    expect(createDraftPost).toHaveBeenCalledWith(expect.objectContaining({ featuredMedia: 42 }));
  });

  it("details_json(details)에 기사 본문 전체를 저장하지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "reviewed", content: "본문".repeat(2000) }));
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    createDraftPost.mockResolvedValue({
      success: true,
      externalPostId: 1,
      postUrl: "https://example-blog.test/?p=1",
      raw: { id: 1, link: "https://example-blog.test/?p=1", status: "draft", slug: "slug" },
    });

    await publishArticleToWordPressDraft("article-1");

    const call = savePublishLog.mock.calls.find((c) => c[0].status === "success");
    const detailsStr = JSON.stringify(call![0].details);
    expect(detailsStr.length).toBeLessThan(2000);
    expect(detailsStr).not.toContain("본문".repeat(2000));
  });

  it("auth header/password가 pipeline_logs details에 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "reviewed" }));
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    createDraftPost.mockResolvedValue({
      success: true,
      externalPostId: 1,
      postUrl: "https://example-blog.test/?p=1",
      raw: {},
    });

    await publishArticleToWordPressDraft("article-1");

    for (const call of logEvent.mock.calls) {
      const serialized = JSON.stringify(call[0]);
      expect(serialized.toLowerCase()).not.toContain("authorization");
      expect(serialized.toLowerCase()).not.toContain("app_password");
    }
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

  it("Phase 2-9: SEO_PLUGIN_WRITE_ENABLED=true여도 실제 SEO plugin write는 이번 단계에서 시도하지 않는다 (skipped_deferred)", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "reviewed", seoPluginProvider: "yoast" }));
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "true");
    createDraftPost.mockResolvedValue({
      success: true,
      externalPostId: 1,
      postUrl: "https://example-blog.test/?p=1",
      raw: {},
    });

    await publishArticleToWordPressDraft("article-1");

    expect(applySeoPluginMetadata).not.toHaveBeenCalled();
    expect(updateSeoPluginWriteStatus).toHaveBeenCalledWith("article-1", "skipped_dry_run");
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "seo_plugin_write_skipped_deferred" })
    );
  });

  it("actual publish 성공 시 publish_logs.details_json에 mediaUpload/seoPluginWrite가 skipped_deferred로 저장된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "reviewed", seoPluginProvider: "yoast" }));
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    createDraftPost.mockResolvedValue({
      success: true,
      externalPostId: 1,
      postUrl: "https://example-blog.test/?p=1",
      raw: {},
    });

    await publishArticleToWordPressDraft("article-1");

    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        details: expect.objectContaining({
          actual: true,
          dryRun: false,
          wordpressStatus: "draft",
          mediaUpload: { status: "skipped_deferred" },
          seoPluginWrite: { status: "skipped_deferred" },
        }),
      })
    );
  });
});

describe("runWordPressConnectionTest", () => {
  it("실행 시작 시 wordpress_connection_test_started를 기록한다", async () => {
    testWordPressConnection.mockResolvedValue({ connected: false, testedAt: "2026-01-01T00:00:00.000Z" });

    await runWordPressConnectionTest();

    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_connection_test_started", status: "info" })
    );
  });

  it("연결 성공 시 wordpress_connection_test_completed를 기록하고 결과를 반환한다", async () => {
    testWordPressConnection.mockResolvedValue({
      connected: true,
      baseUrl: "https://example-blog.test",
      username: "content-bot",
      displayName: "Content Bot",
      testedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await runWordPressConnectionTest();

    expect(result.connected).toBe(true);
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wordpress_connection_test_completed",
        status: "success",
        details: expect.objectContaining({
          baseUrlHost: "example-blog.test",
          connected: true,
          statusCode: 200,
          endpointType: "wp/v2/users/me",
        }),
      })
    );
  });

  it("연결 실패 시 wordpress_connection_test_failed를 기록한다", async () => {
    testWordPressConnection.mockResolvedValue({
      connected: false,
      baseUrl: "https://example-blog.test",
      statusCode: 401,
      errorMessage: "WordPress 연결 실패 (HTTP 401 Unauthorized)",
      testedAt: "2026-01-01T00:00:00.000Z",
    });

    await runWordPressConnectionTest();

    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wordpress_connection_test_failed",
        status: "failed",
        details: expect.objectContaining({
          baseUrlHost: "example-blog.test",
          connected: false,
          statusCode: 401,
          endpointType: "wp/v2/users/me",
        }),
      })
    );
  });

  it("details_json에 stage 필드를 사용하지 않고 event 관련 필드만 저장한다", async () => {
    testWordPressConnection.mockResolvedValue({
      connected: false,
      statusCode: 404,
      errorMessage: "WordPress 연결 실패 (HTTP 404 Not Found)",
      testedAt: "2026-01-01T00:00:00.000Z",
    });

    await runWordPressConnectionTest();

    for (const call of logEvent.mock.calls) {
      const input = call[0] as { details?: Record<string, unknown>; type: string };
      expect(input).not.toHaveProperty("stage");
      if (input.details) {
        const allowedKeys = ["baseUrlHost", "connected", "statusCode", "endpointType", "safeMessage"];
        expect(Object.keys(input.details).every((key) => allowedKeys.includes(key))).toBe(true);
      }
    }
  });

  it("Authorization header/password/API key가 로그에 저장되지 않는다", async () => {
    testWordPressConnection.mockResolvedValue({
      connected: false,
      baseUrl: "https://example-blog.test",
      statusCode: 401,
      errorMessage: "WordPress 연결 실패 (HTTP 401 Unauthorized)",
      testedAt: "2026-01-01T00:00:00.000Z",
    });

    await runWordPressConnectionTest();

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("basic ");
    expect(serialized).not.toContain("api_key");
  });

  it("pipeline_logs 저장이 실패해도 연결 테스트 결과는 그대로 반환된다", async () => {
    testWordPressConnection.mockResolvedValue({
      connected: true,
      baseUrl: "https://example-blog.test",
      username: "content-bot",
      testedAt: "2026-01-01T00:00:00.000Z",
    });
    logEvent.mockRejectedValue(new Error("DB insert failed"));

    const result = await runWordPressConnectionTest();

    expect(result.connected).toBe(true);
  });
});
