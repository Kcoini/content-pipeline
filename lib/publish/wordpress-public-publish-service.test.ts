import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/types/domain";

const getArticleById = vi.fn();
const savePublicPublishResult = vi.fn();
const savePublishLog = vi.fn();
const checkPublicPublishGuard = vi.fn();
const publishWordPressPost = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  savePublicPublishResult: (...args: unknown[]) => savePublicPublishResult(...args),
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  savePublishLog: (...args: unknown[]) => savePublishLog(...args),
}));
vi.mock("@/lib/publish/public-publish-guards", () => ({
  checkPublicPublishGuard: (...args: unknown[]) => checkPublicPublishGuard(...args),
}));
vi.mock("@/lib/publish/wordpress-client", () => ({
  publishWordPressPost: (...args: unknown[]) => publishWordPressPost(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { publishApprovedArticleToWordPress, WORDPRESS_PUBLIC_PUBLISH_TARGET } = await import(
  "./wordpress-public-publish-service"
);

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    themeId: "theme-1",
    title: "기사 제목",
    content: "본문 내용입니다.".repeat(500),
    status: "reviewed",
    citedSourceIds: ["source-1", "source-2", "source-3"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    reviewedAt: "2026-01-02T00:00:00.000Z",
    reviewedBy: "local-user",
    articleMode: "source_based_explainer",
    seoTitle: "장기요양보험 완벽 가이드",
    metaDescription: "장기요양보험에 대해 알아봅니다.",
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
    wpCategoryNames: ["복지"],
    wpTagNames: ["장기요양보험"],
    wpCategoryIds: [1],
    wpTagIds: [2],
    wpMetadataStatus: "generated",
    wpMetadataGeneratedAt: null,
    seoPluginProvider: "rank_math",
    seoPluginPayload: {},
    seoPluginMetadataStatus: "generated",
    seoPluginMetadataGeneratedAt: null,
    seoPluginWriteStatus: "not_attempted",
    seoPluginWriteError: null,
    featuredImageStatus: "prepared",
    featuredImagePrompt: null,
    featuredImageAltText: null,
    featuredImageCaption: null,
    featuredImageStyle: null,
    featuredImageAspectRatio: "16:9",
    featuredImageMetadata: {},
    featuredImageGeneratedAt: null,
    featuredImageReviewedAt: null,
    featuredImageWordpressMediaId: 99,
    featuredImageWordpressUrl: "https://example-blog.test/uploads/photo.webp",
    featuredImageError: null,
    featuredImageSourceType: "uploaded",
    featuredImageSourceUrl: null,
    featuredImageLocalPath: null,
    featuredImageFilename: null,
    featuredImageMimeType: null,
    featuredImageUploadStatus: "uploaded",
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
    wordpressFeaturedMediaAttachStatus: "attached",
    wordpressFeaturedMediaAttachedAt: null,
    wordpressFeaturedMediaAttachError: null,
    seoPluginActualWriteStatus: "success",
    seoPluginActualWriteProvider: "rank_math",
    seoPluginActualWritePostId: 42,
    seoPluginActualWriteError: null,
    seoPluginActualWriteAttemptedAt: null,
    seoPluginActualWriteVerified: true,
    seoPluginActualWriteWarning: null,
    seoPluginCustomEndpointStatus: "success",
    seoPluginCustomEndpointVerified: true,
    seoPluginCustomEndpointError: null,
    seoPluginCustomEndpointAttemptedAt: null,
    wordpressFinalDraftReviewStatus: "reviewed",
    wordpressFinalDraftReviewScore: 100,
    wordpressFinalDraftReviewSummary: { failedItems: [] },
    wordpressFinalDraftReviewError: null,
    wordpressFinalDraftReviewedAt: null,
    publishQualityGateStatus: "ready_to_publish",
    publishQualityGateScore: 100,
    publishQualityGateSummary: {},
    publishQualityGateError: null,
    publishQualityGateCheckedAt: "2026-01-03T00:00:00.000Z",
    publishReady: true,
    publishBlockedReason: null,
    publicPublishApprovalStatus: "approved",
    publicPublishApproved: true,
    publicPublishApprovedAt: "2026-01-04T00:00:00.000Z",
    publicPublishApprovedBy: "editor-kim",
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

function makePassingGuard(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    canPublish: true,
    reason: null,
    reasons: [],
    alreadyPublished: false,
    wordpressPostId: "42",
    wordpressPostUrl: "https://example-blog.test/?p=42",
    summary: {
      publishReady: true,
      qualityGateStatus: "ready_to_publish",
      approvalStatus: "approved",
      articleStatus: "reviewed",
    },
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  savePublicPublishResult.mockReset();
  savePublishLog.mockReset();
  checkPublicPublishGuard.mockReset();
  publishWordPressPost.mockReset();
  logEvent.mockReset();

  savePublicPublishResult.mockResolvedValue({});
  savePublishLog.mockResolvedValue({});
  logEvent.mockResolvedValue({});
  getArticleById.mockResolvedValue(makeArticle());
  checkPublicPublishGuard.mockResolvedValue(makePassingGuard());
  publishWordPressPost.mockResolvedValue({
    success: true,
    postId: 42,
    status: "publish",
    link: "https://example-blog.test/2026/07/26/long-term-care-guide/",
    slug: "long-term-care-guide",
    modified: "2026-07-26T00:00:00.000Z",
    date: "2026-07-26T00:00:00.000Z",
  });
});

describe("publishApprovedArticleToWordPress", () => {
  it("publish_ready=false이면 WordPress API를 호출하지 않고 blocked 처리한다", async () => {
    checkPublicPublishGuard.mockResolvedValue(
      makePassingGuard({ canPublish: false, reason: "publish_ready가 true가 아닙니다.", reasons: ["publish_ready가 true가 아닙니다."] })
    );

    const result = await publishApprovedArticleToWordPress("article-1");

    expect(result.status).toBe("blocked");
    expect(publishWordPressPost).not.toHaveBeenCalled();
  });

  it("quality gate가 ready_to_publish가 아니면 blocked 처리한다", async () => {
    checkPublicPublishGuard.mockResolvedValue(
      makePassingGuard({
        canPublish: false,
        reason: "publish_quality_gate_status=needs_revision (ready_to_publish가 아닙니다).",
        reasons: ["publish_quality_gate_status=needs_revision (ready_to_publish가 아닙니다)."],
      })
    );

    const result = await publishApprovedArticleToWordPress("article-1");

    expect(result.status).toBe("blocked");
    expect(publishWordPressPost).not.toHaveBeenCalled();
  });

  it("approval_status가 approved가 아니면 blocked 처리한다", async () => {
    checkPublicPublishGuard.mockResolvedValue(
      makePassingGuard({
        canPublish: false,
        reason: "public_publish_approval_status=not_requested (approved가 아닙니다).",
        reasons: ["public_publish_approval_status=not_requested (approved가 아닙니다)."],
      })
    );

    const result = await publishApprovedArticleToWordPress("article-1");

    expect(result.status).toBe("blocked");
    expect(publishWordPressPost).not.toHaveBeenCalled();
  });

  it("public_publish_approved=false이면 blocked 처리한다", async () => {
    checkPublicPublishGuard.mockResolvedValue(
      makePassingGuard({
        canPublish: false,
        reason: "public_publish_approved가 true가 아닙니다.",
        reasons: ["public_publish_approved가 true가 아닙니다."],
      })
    );

    const result = await publishApprovedArticleToWordPress("article-1");

    expect(result.status).toBe("blocked");
    expect(publishWordPressPost).not.toHaveBeenCalled();
  });

  it("WordPress draft post id가 없으면 blocked 처리한다", async () => {
    checkPublicPublishGuard.mockResolvedValue(
      makePassingGuard({
        canPublish: false,
        wordpressPostId: null,
        reason: "WordPress draft post id가 존재하지 않습니다.",
        reasons: ["WordPress draft post id가 존재하지 않습니다."],
      })
    );

    const result = await publishApprovedArticleToWordPress("article-1");

    expect(result.status).toBe("blocked");
    expect(publishWordPressPost).not.toHaveBeenCalled();
  });

  it("guard를 통과한 경우에만 publishWordPressPost가 호출된다", async () => {
    await publishApprovedArticleToWordPress("article-1");

    expect(publishWordPressPost).toHaveBeenCalledTimes(1);
    expect(publishWordPressPost).toHaveBeenCalledWith(42);
  });

  it("성공 시 articles.public_publish_status=published로 저장된다", async () => {
    await publishApprovedArticleToWordPress("article-1");

    expect(savePublicPublishResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "published", published: true })
    );
  });

  it("성공 시 public_publish_url이 저장된다", async () => {
    await publishApprovedArticleToWordPress("article-1");

    expect(savePublicPublishResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ postUrl: "https://example-blog.test/2026/07/26/long-term-care-guide/" })
    );
  });

  it("이미 published된 경우 skipped_already_published로 처리하고 WordPress API를 호출하지 않는다", async () => {
    checkPublicPublishGuard.mockResolvedValue(makePassingGuard({ canPublish: false, alreadyPublished: true }));

    const result = await publishApprovedArticleToWordPress("article-1");

    expect(result.status).toBe("skipped_already_published");
    expect(publishWordPressPost).not.toHaveBeenCalled();
    expect(savePublicPublishResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "skipped_already_published", published: true })
    );
  });

  it("WordPress API 실패 시 safe error가 저장된다", async () => {
    publishWordPressPost.mockResolvedValue({
      success: false,
      statusCode: 500,
      errorMessage: "WordPress public publish 실패 (HTTP 500 Internal Server Error)",
      reasonCandidate: ["서버 오류"],
    });

    const result = await publishApprovedArticleToWordPress("article-1");

    expect(result.status).toBe("failed");
    expect(savePublicPublishResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "failed", published: false })
    );
  });

  it("publish_logs에 target=wordpress_public_publish로 저장된다", async () => {
    await publishApprovedArticleToWordPress("article-1");

    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({ target: WORDPRESS_PUBLIC_PUBLISH_TARGET, status: "success" })
    );
  });

  it("pipeline_logs는 event_name 기준으로 저장된다", async () => {
    await publishApprovedArticleToWordPress("article-1");

    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpress_public_publish_started" }));
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpress_public_publish_guard_passed" }));
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpress_public_publish_completed" }));
  });

  it("auth 정보가 logs에 저장되지 않는다", async () => {
    await publishApprovedArticleToWordPress("article-1");

    const serialized = JSON.stringify([...logEvent.mock.calls, ...savePublishLog.mock.calls]).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("basic ");
  });

  it("article content 전체가 details_json에 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ content: "본문".repeat(5000) }));

    await publishApprovedArticleToWordPress("article-1");

    const call = savePublishLog.mock.calls.find((c) => c[0].status === "success");
    expect(JSON.stringify(call![0].details)).not.toContain("본문".repeat(5000));
  });

  it("공개 게시는 단일 article에 대해서만 실행된다 (articleId 하나만 처리)", async () => {
    await publishApprovedArticleToWordPress("article-1");

    expect(getArticleById).toHaveBeenCalledTimes(1);
    expect(getArticleById).toHaveBeenCalledWith("article-1");
    expect(publishWordPressPost).toHaveBeenCalledTimes(1);
  });

  it("존재하지 않는 기사면 실패를 반환하고 WordPress API를 호출하지 않는다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await publishApprovedArticleToWordPress("missing");

    expect(result.success).toBe(false);
    expect(publishWordPressPost).not.toHaveBeenCalled();
  });

  it("실행 중 예외가 발생해도 Runtime Error로 터지지 않고 안전한 실패를 반환한다", async () => {
    checkPublicPublishGuard.mockRejectedValue(new Error("DB 오류"));

    const result = await publishApprovedArticleToWordPress("article-1");

    expect(result.success).toBe(false);
    expect(result.status).toBe("failed");
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpress_public_publish_failed" }));
  });
});
