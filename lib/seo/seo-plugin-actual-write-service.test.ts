import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/types/domain";

const getArticleById = vi.fn();
const saveSeoPluginActualWriteResult = vi.fn();
const saveSeoPluginCustomEndpointResult = vi.fn();
const savePublishLog = vi.fn();
const getSuccessfulWordPressDraft = vi.fn();
const updateSeoPluginMetadata = vi.fn();
const verifySeoPluginMetadata = vi.fn();
const updateRankMathSeoViaCustomEndpoint = vi.fn();
const isSeoCustomEndpointEnabled = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  saveSeoPluginActualWriteResult: (...args: unknown[]) => saveSeoPluginActualWriteResult(...args),
  saveSeoPluginCustomEndpointResult: (...args: unknown[]) => saveSeoPluginCustomEndpointResult(...args),
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  savePublishLog: (...args: unknown[]) => savePublishLog(...args),
  getSuccessfulWordPressDraft: (...args: unknown[]) => getSuccessfulWordPressDraft(...args),
}));
vi.mock("@/lib/publish/wordpress-client", () => ({
  updateSeoPluginMetadata: (...args: unknown[]) => updateSeoPluginMetadata(...args),
  verifySeoPluginMetadata: (...args: unknown[]) => verifySeoPluginMetadata(...args),
}));
vi.mock("./wordpress-seo-custom-endpoint-client", () => ({
  updateRankMathSeoViaCustomEndpoint: (...args: unknown[]) => updateRankMathSeoViaCustomEndpoint(...args),
  isSeoCustomEndpointEnabled: (...args: unknown[]) => isSeoCustomEndpointEnabled(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const {
  writeSeoPluginMetadataToWordPress,
  writeRankMathSeoViaCustomEndpoint,
  WORDPRESS_SEO_PLUGIN_TARGET,
  WORDPRESS_SEO_CUSTOM_ENDPOINT_TARGET,
} = await import("./seo-plugin-actual-write-service");

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
    articleMode: "monetized_blog",
    seoTitle: "SEO 제목",
    metaDescription: "메타 설명",
    slug: "long-term-care-guide",
    targetKeyword: "장기요양보험",
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
    seoPluginProvider: "rank_math",
    seoPluginPayload: {},
    seoPluginMetadataStatus: "generated",
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
  saveSeoPluginActualWriteResult.mockReset();
  saveSeoPluginCustomEndpointResult.mockReset();
  savePublishLog.mockReset();
  getSuccessfulWordPressDraft.mockReset();
  updateSeoPluginMetadata.mockReset();
  verifySeoPluginMetadata.mockReset();
  updateRankMathSeoViaCustomEndpoint.mockReset();
  isSeoCustomEndpointEnabled.mockReset();
  logEvent.mockReset();

  saveSeoPluginActualWriteResult.mockResolvedValue({});
  saveSeoPluginCustomEndpointResult.mockResolvedValue({});
  savePublishLog.mockResolvedValue({});
  logEvent.mockResolvedValue({});
  getSuccessfulWordPressDraft.mockResolvedValue({ externalPostId: "42", postUrl: "https://example-blog.test/?p=42" });
  verifySeoPluginMetadata.mockResolvedValue({ verified: true });
  isSeoCustomEndpointEnabled.mockReturnValue(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("writeSeoPluginMetadataToWordPress", () => {
  it("SEO_PLUGIN_PROVIDER=none이면 실제 write를 호출하지 않고 skipped_provider_none으로 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "none");
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "true");

    const result = await writeSeoPluginMetadataToWordPress("article-1");

    expect(result.success).toBe(false);
    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
    expect(saveSeoPluginActualWriteResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "skipped_provider_none" })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "seo_plugin_actual_write_skipped_provider_none" })
    );
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({ target: WORDPRESS_SEO_PLUGIN_TARGET, status: "skipped" })
    );
  });

  it("SEO_PLUGIN_WRITE_ENABLED=false이면 실제 write를 호출하지 않고 skipped_disabled로 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "false");

    const result = await writeSeoPluginMetadataToWordPress("article-1");

    expect(result.success).toBe(false);
    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
    expect(saveSeoPluginActualWriteResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "skipped_disabled" })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "seo_plugin_actual_write_skipped_disabled" })
    );
  });

  it("WordPress draft post id가 없으면 skipped_no_wordpress_post로 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "true");
    getSuccessfulWordPressDraft.mockResolvedValue(null);

    const result = await writeSeoPluginMetadataToWordPress("article-1");

    expect(result.success).toBe(false);
    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
    expect(saveSeoPluginActualWriteResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "skipped_no_wordpress_post" })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "seo_plugin_actual_write_skipped_no_wordpress_post" })
    );
  });

  it("rank_math provider로 updateSeoPluginMetadata를 호출한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ seoPluginProvider: "rank_math" }));
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "true");
    updateSeoPluginMetadata.mockResolvedValue({ success: true, postId: 42, fieldsAttempted: ["rank_math_title"] });

    await writeSeoPluginMetadataToWordPress("article-1");

    expect(updateSeoPluginMetadata).toHaveBeenCalledWith(
      42,
      "rank_math",
      expect.objectContaining({ seoTitle: "SEO 제목", metaDescription: "메타 설명", focusKeyword: "장기요양보험" })
    );
  });

  it("성공 시 articles.seo_plugin_actual_write_status=success로 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "true");
    updateSeoPluginMetadata.mockResolvedValue({ success: true, postId: 42, fieldsAttempted: ["rank_math_title"] });
    verifySeoPluginMetadata.mockResolvedValue({ verified: true });

    const result = await writeSeoPluginMetadataToWordPress("article-1");

    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    expect(saveSeoPluginActualWriteResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "success", verified: true })
    );
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        target: WORDPRESS_SEO_PLUGIN_TARGET,
        status: "success",
        externalPostId: "42",
        details: expect.objectContaining({ provider: "rank_math", verified: true }),
      })
    );
  });

  it("REST response에서 meta 확인이 안 되면 needs_custom_endpoint로 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "true");
    updateSeoPluginMetadata.mockResolvedValue({ success: true, postId: 42, fieldsAttempted: ["rank_math_title"] });
    verifySeoPluginMetadata.mockResolvedValue({
      verified: false,
      warning: "SEO meta may have been accepted but is not exposed in REST response.",
    });

    const result = await writeSeoPluginMetadataToWordPress("article-1");

    expect(result.success).toBe(true);
    expect(result.verified).toBe(false);
    expect(saveSeoPluginActualWriteResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "needs_custom_endpoint", verified: false })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "seo_plugin_actual_write_needs_custom_endpoint" })
    );
  });

  it("실패 시 safe error를 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "true");
    updateSeoPluginMetadata.mockResolvedValue({
      success: false,
      statusCode: 403,
      errorMessage: "WordPress SEO metadata 갱신 실패 (HTTP 403 Forbidden)",
      reasonCandidate: ["사용자 권한 부족"],
    });

    const result = await writeSeoPluginMetadataToWordPress("article-1");

    expect(result.success).toBe(false);
    expect(saveSeoPluginActualWriteResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "failed" })
    );
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({ target: WORDPRESS_SEO_PLUGIN_TARGET, status: "failed" })
    );
  });

  it("auth 정보가 logs에 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "true");
    updateSeoPluginMetadata.mockResolvedValue({ success: true, postId: 42, fieldsAttempted: ["rank_math_title"] });

    await writeSeoPluginMetadataToWordPress("article-1");

    const serialized = JSON.stringify([...logEvent.mock.calls, ...savePublishLog.mock.calls]).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("basic ");
  });

  it("article content 전체가 details_json에 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ content: "본문".repeat(2000) }));
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "true");
    updateSeoPluginMetadata.mockResolvedValue({ success: true, postId: 42, fieldsAttempted: ["rank_math_title"] });

    await writeSeoPluginMetadataToWordPress("article-1");

    const call = savePublishLog.mock.calls.find((c) => c[0].status === "success");
    const detailsStr = JSON.stringify(call![0].details);
    expect(detailsStr).not.toContain("본문".repeat(2000));
  });

  it("pipeline_logs는 event_name(type) 기준으로 기록된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "true");
    updateSeoPluginMetadata.mockResolvedValue({ success: true, postId: 42, fieldsAttempted: ["rank_math_title"] });

    await writeSeoPluginMetadataToWordPress("article-1");

    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "seo_plugin_actual_write_started" }));
  });

  it("provider=rank_math이고 custom endpoint가 활성화되어 있으면 표준 REST 대신 custom endpoint를 사용한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "true");
    isSeoCustomEndpointEnabled.mockReturnValue(true);
    updateRankMathSeoViaCustomEndpoint.mockResolvedValue({
      success: true,
      postId: 42,
      updatedKeys: ["rank_math_title"],
      verified: true,
    });

    await writeSeoPluginMetadataToWordPress("article-1");

    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
    expect(updateRankMathSeoViaCustomEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({ postId: 42 })
    );
  });

  it("target_keyword가 비어 있으면 실제 API를 호출하지 않고 skipped_missing_target_keyword로 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ targetKeyword: null }));
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "true");

    const result = await writeSeoPluginMetadataToWordPress("article-1");

    expect(result.success).toBe(false);
    expect(result.message).toContain("Focus keyword가 없어 Rank Math에 반영할 수 없습니다");
    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
    expect(updateRankMathSeoViaCustomEndpoint).not.toHaveBeenCalled();
    expect(saveSeoPluginActualWriteResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "skipped_missing_target_keyword" })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "seo_plugin_actual_write_skipped_missing_target_keyword" })
    );
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        target: WORDPRESS_SEO_PLUGIN_TARGET,
        status: "skipped",
        details: expect.objectContaining({ reason: "missing_target_keyword", focusKeywordPresent: false }),
      })
    );
  });

  it("성공 시 publish_logs.details_json에 focusKeywordPresent/targetKeywordSource/secondaryKeywordsCount를 저장한다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ targetKeyword: "장기요양보험", secondaryKeywords: ["요양원", "돌봄"] })
    );
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "yoast");
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "true");
    updateSeoPluginMetadata.mockResolvedValue({ success: true, postId: 42, fieldsAttempted: ["_yoast_wpseo_title"] });
    verifySeoPluginMetadata.mockResolvedValue({ verified: true });

    await writeSeoPluginMetadataToWordPress("article-1");

    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        details: expect.objectContaining({
          focusKeywordPresent: true,
          secondaryKeywordsCount: 2,
        }),
      })
    );
  });
});

describe("writeRankMathSeoViaCustomEndpoint", () => {
  it("custom endpoint가 비활성화되어 있으면 실제 호출 없이 skipped_disabled로 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ seoPluginProvider: "rank_math" }));
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    isSeoCustomEndpointEnabled.mockReturnValue(false);

    const result = await writeRankMathSeoViaCustomEndpoint("article-1");

    expect(result.success).toBe(false);
    expect(updateRankMathSeoViaCustomEndpoint).not.toHaveBeenCalled();
    expect(saveSeoPluginCustomEndpointResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "skipped_disabled" })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "seo_plugin_custom_endpoint_skipped_disabled" })
    );
  });

  it("target_keyword가 비어 있으면 실제 API를 호출하지 않고 skipped_missing_target_keyword로 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ seoPluginProvider: "rank_math", targetKeyword: null }));
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    isSeoCustomEndpointEnabled.mockReturnValue(true);

    const result = await writeRankMathSeoViaCustomEndpoint("article-1");

    expect(result.success).toBe(false);
    expect(result.message).toContain("Focus keyword가 없어 Rank Math에 반영할 수 없습니다");
    expect(updateRankMathSeoViaCustomEndpoint).not.toHaveBeenCalled();
    expect(saveSeoPluginCustomEndpointResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "skipped_missing_target_keyword" })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "seo_plugin_custom_endpoint_skipped_missing_target_keyword" })
    );
  });

  it("provider가 rank_math가 아니면 skipped_provider_not_supported로 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ seoPluginProvider: "yoast" }));
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "yoast");
    isSeoCustomEndpointEnabled.mockReturnValue(true);

    const result = await writeRankMathSeoViaCustomEndpoint("article-1");

    expect(result.success).toBe(false);
    expect(updateRankMathSeoViaCustomEndpoint).not.toHaveBeenCalled();
    expect(saveSeoPluginCustomEndpointResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "skipped_provider_not_supported" })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "seo_plugin_custom_endpoint_skipped_provider_not_supported" })
    );
  });

  it("WordPress post id가 없으면 skipped_no_wordpress_post로 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ seoPluginProvider: "rank_math" }));
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    isSeoCustomEndpointEnabled.mockReturnValue(true);
    getSuccessfulWordPressDraft.mockResolvedValue(null);

    const result = await writeRankMathSeoViaCustomEndpoint("article-1");

    expect(result.success).toBe(false);
    expect(updateRankMathSeoViaCustomEndpoint).not.toHaveBeenCalled();
    expect(saveSeoPluginCustomEndpointResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "skipped_no_wordpress_post" })
    );
  });

  it("rank_math custom endpoint payload가 올바르게 생성된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({
        seoPluginProvider: "rank_math",
        seoTitle: "SEO 제목",
        metaDescription: "메타 설명",
        targetKeyword: "타깃 키워드",
        secondaryKeywords: ["보조1"],
      })
    );
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    isSeoCustomEndpointEnabled.mockReturnValue(true);
    updateRankMathSeoViaCustomEndpoint.mockResolvedValue({
      success: true,
      postId: 42,
      updatedKeys: ["rank_math_title"],
      verified: true,
    });

    await writeRankMathSeoViaCustomEndpoint("article-1");

    expect(updateRankMathSeoViaCustomEndpoint).toHaveBeenCalledWith({
      postId: 42,
      seoTitle: "SEO 제목",
      metaDescription: "메타 설명",
      focusKeyword: "타깃 키워드",
      secondaryKeywords: ["보조1"],
    });
  });

  it("custom endpoint 성공 시 articles.seo_plugin_custom_endpoint_status=success로 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ seoPluginProvider: "rank_math" }));
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    isSeoCustomEndpointEnabled.mockReturnValue(true);
    updateRankMathSeoViaCustomEndpoint.mockResolvedValue({
      success: true,
      postId: 42,
      updatedKeys: ["rank_math_title"],
      verified: true,
    });

    const result = await writeRankMathSeoViaCustomEndpoint("article-1");

    expect(result.success).toBe(true);
    expect(saveSeoPluginCustomEndpointResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "success", verified: true })
    );
  });

  it("custom endpoint 성공 시 seo_plugin_actual_write_verified=true로 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ seoPluginProvider: "rank_math" }));
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    isSeoCustomEndpointEnabled.mockReturnValue(true);
    updateRankMathSeoViaCustomEndpoint.mockResolvedValue({
      success: true,
      postId: 42,
      updatedKeys: ["rank_math_title"],
      verified: true,
    });

    await writeRankMathSeoViaCustomEndpoint("article-1");

    expect(saveSeoPluginActualWriteResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "success", verified: true, provider: "rank_math" })
    );
  });

  it("custom endpoint 실패 시 safe error를 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ seoPluginProvider: "rank_math" }));
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    isSeoCustomEndpointEnabled.mockReturnValue(true);
    updateRankMathSeoViaCustomEndpoint.mockResolvedValue({
      success: false,
      statusCode: 403,
      errorMessage: "custom endpoint 호출 실패 (HTTP 403 Forbidden)",
      reasonCandidate: ["사용자 권한 부족"],
    });

    const result = await writeRankMathSeoViaCustomEndpoint("article-1");

    expect(result.success).toBe(false);
    expect(saveSeoPluginCustomEndpointResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "failed" })
    );
    expect(saveSeoPluginActualWriteResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "failed" })
    );
  });

  it("publish_logs에 target=wordpress_seo_custom_endpoint로 저장된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ seoPluginProvider: "rank_math" }));
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    isSeoCustomEndpointEnabled.mockReturnValue(true);
    updateRankMathSeoViaCustomEndpoint.mockResolvedValue({
      success: true,
      postId: 42,
      updatedKeys: ["rank_math_title"],
      verified: true,
    });

    await writeRankMathSeoViaCustomEndpoint("article-1");

    expect(WORDPRESS_SEO_CUSTOM_ENDPOINT_TARGET).toBe("wordpress_seo_custom_endpoint");
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({ target: "wordpress_seo_custom_endpoint", status: "success" })
    );
  });

  it("pipeline_logs는 event_name 기준으로 저장된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ seoPluginProvider: "rank_math" }));
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    isSeoCustomEndpointEnabled.mockReturnValue(true);
    updateRankMathSeoViaCustomEndpoint.mockResolvedValue({
      success: true,
      postId: 42,
      updatedKeys: ["rank_math_title"],
      verified: true,
    });

    await writeRankMathSeoViaCustomEndpoint("article-1");

    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "seo_plugin_custom_endpoint_write_started" })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "seo_plugin_custom_endpoint_write_completed" })
    );
  });

  it("auth 정보가 logs에 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ seoPluginProvider: "rank_math" }));
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    isSeoCustomEndpointEnabled.mockReturnValue(true);
    updateRankMathSeoViaCustomEndpoint.mockResolvedValue({
      success: true,
      postId: 42,
      updatedKeys: ["rank_math_title"],
      verified: true,
    });

    await writeRankMathSeoViaCustomEndpoint("article-1");

    const serialized = JSON.stringify([...logEvent.mock.calls, ...savePublishLog.mock.calls]).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("basic ");
  });

  it("article content 전체가 details_json에 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ seoPluginProvider: "rank_math", content: "본문".repeat(2000) }));
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    isSeoCustomEndpointEnabled.mockReturnValue(true);
    updateRankMathSeoViaCustomEndpoint.mockResolvedValue({
      success: true,
      postId: 42,
      updatedKeys: ["rank_math_title"],
      verified: true,
    });

    await writeRankMathSeoViaCustomEndpoint("article-1");

    const call = savePublishLog.mock.calls.find((c) => c[0].status === "success");
    const detailsStr = JSON.stringify(call![0].details);
    expect(detailsStr).not.toContain("본문".repeat(2000));
  });
});
