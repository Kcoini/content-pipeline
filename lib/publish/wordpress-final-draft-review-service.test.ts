import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/types/domain";
import { AD_SLOT_MARKERS, adSlotMarkerComment } from "@/lib/articles/article-modes";

const getArticleById = vi.fn();
const saveWordPressFinalDraftReviewResult = vi.fn();
const savePublishLog = vi.fn();
const getSuccessfulWordPressDraft = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  saveWordPressFinalDraftReviewResult: (...args: unknown[]) => saveWordPressFinalDraftReviewResult(...args),
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  savePublishLog: (...args: unknown[]) => savePublishLog(...args),
  getSuccessfulWordPressDraft: (...args: unknown[]) => getSuccessfulWordPressDraft(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { reviewWordPressFinalDraft, WORDPRESS_FINAL_DRAFT_REVIEW_TARGET } = await import(
  "./wordpress-final-draft-review-service"
);

function makeFullAdSlotContent(): string {
  return AD_SLOT_MARKERS.map((position) => adSlotMarkerComment(position)).join("\n\n본문 내용입니다.\n\n");
}

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
  saveWordPressFinalDraftReviewResult.mockReset();
  savePublishLog.mockReset();
  getSuccessfulWordPressDraft.mockReset();
  logEvent.mockReset();

  saveWordPressFinalDraftReviewResult.mockResolvedValue({});
  savePublishLog.mockResolvedValue({});
  logEvent.mockResolvedValue({});
  getSuccessfulWordPressDraft.mockResolvedValue({
    externalPostId: "42",
    postUrl: "https://example-blog.test/?p=42",
  });
});

describe("reviewWordPressFinalDraft", () => {
  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await reviewWordPressFinalDraft("missing");

    expect(result.success).toBe(false);
    expect(saveWordPressFinalDraftReviewResult).not.toHaveBeenCalled();
  });

  it("기존 WordPress draft가 없으면 missing_wordpress_draft로 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    getSuccessfulWordPressDraft.mockResolvedValue(null);

    const result = await reviewWordPressFinalDraft("article-1");

    expect(result.success).toBe(false);
    expect(result.status).toBe("missing_wordpress_draft");
    expect(saveWordPressFinalDraftReviewResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "missing_wordpress_draft" })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_final_draft_review_skipped_missing_draft" })
    );
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({ target: WORDPRESS_FINAL_DRAFT_REVIEW_TARGET, status: "skipped" })
    );
  });

  it("모든 체크리스트 항목을 통과하면 score=100으로 저장한다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ articleMode: "monetized_blog", content: makeFullAdSlotContent() })
    );

    const result = await reviewWordPressFinalDraft("article-1");

    expect(result.success).toBe(true);
    expect(result.status).toBe("reviewed");
    expect(result.score).toBe(100);
    expect(saveWordPressFinalDraftReviewResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "reviewed", score: 100 })
    );
  });

  it("category/tag가 없으면 해당 항목이 failed로 기록되고 score가 낮아진다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ wpCategoryIds: [], wpCategoryNames: [], wpTagIds: [], wpTagNames: [] })
    );

    const result = await reviewWordPressFinalDraft("article-1");

    expect(result.success).toBe(true);
    expect(result.score).toBeLessThan(100);
    const categoryTagItem = result.checklist?.find((item) => item.key === "category_tag");
    expect(categoryTagItem?.status).toBe("failed");
  });

  it("출처 인용이 3개 미만이면 source_citation 항목이 failed로 기록된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ citedSourceIds: ["source-1"] }));

    const result = await reviewWordPressFinalDraft("article-1");

    const item = result.checklist?.find((item) => item.key === "source_citation");
    expect(item?.status).toBe("failed");
  });

  it("monetized_blog에서 AD_SLOT marker가 누락되면 failed로 기록된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ articleMode: "monetized_blog", content: "AD_SLOT marker가 없는 본문입니다." })
    );

    const result = await reviewWordPressFinalDraft("article-1");

    const item = result.checklist?.find((item) => item.key === "ad_slot_marker");
    expect(item?.status).toBe("failed");
  });

  it("SEO metadata 반영이 확인되지 않으면 seo_metadata 항목이 failed로 기록된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ seoPluginActualWriteStatus: "failed", seoPluginActualWriteVerified: false })
    );

    const result = await reviewWordPressFinalDraft("article-1");

    const item = result.checklist?.find((item) => item.key === "seo_metadata");
    expect(item?.status).toBe("failed");
  });

  it("publish_logs에 target=wordpress_final_draft_review, status=success로 저장된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    await reviewWordPressFinalDraft("article-1");

    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        target: WORDPRESS_FINAL_DRAFT_REVIEW_TARGET,
        status: "success",
        externalPostId: "42",
        postUrl: "https://example-blog.test/?p=42",
      })
    );
  });

  it("pipeline_logs는 event_name(type) 기준으로 저장된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    await reviewWordPressFinalDraft("article-1");

    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpress_final_draft_review_started" }));
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpress_final_draft_review_completed" }));
  });

  it("auth 정보가 logs에 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    await reviewWordPressFinalDraft("article-1");

    const serialized = JSON.stringify([...logEvent.mock.calls, ...savePublishLog.mock.calls]).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("basic ");
  });

  it("article content 전체가 details_json에 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ content: "본문".repeat(2000) }));

    await reviewWordPressFinalDraft("article-1");

    const call = savePublishLog.mock.calls.find((c) => c[0].status === "success");
    const detailsStr = JSON.stringify(call![0].details);
    expect(detailsStr).not.toContain("본문".repeat(2000));
  });

  it("실행 중 예외가 발생해도 Runtime Error로 터지지 않고 안전한 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    getSuccessfulWordPressDraft.mockRejectedValue(new Error("DB 오류"));

    const result = await reviewWordPressFinalDraft("article-1");

    expect(result.success).toBe(false);
    expect(result.status).toBe("failed");
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpress_final_draft_review_failed" }));
  });
});
