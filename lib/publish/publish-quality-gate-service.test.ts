import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/types/domain";
import { AD_SLOT_MARKERS, adSlotMarkerComment } from "@/lib/articles/article-modes";

const getArticleById = vi.fn();
const savePublishQualityGateResult = vi.fn();
const savePublishLog = vi.fn();
const getSuccessfulWordPressDraft = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  savePublishQualityGateResult: (...args: unknown[]) => savePublishQualityGateResult(...args),
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  savePublishLog: (...args: unknown[]) => savePublishLog(...args),
  getSuccessfulWordPressDraft: (...args: unknown[]) => getSuccessfulWordPressDraft(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { runPublishQualityGate, PUBLISH_QUALITY_GATE_TARGET } = await import("./publish-quality-gate-service");

function makeFullAdSlotContent(): string {
  return AD_SLOT_MARKERS.map((position) => adSlotMarkerComment(position)).join(
    "\n\n" + "본문 문장입니다. 참고 자료를 바탕으로 작성했습니다. ".repeat(20) + "\n\n"
  );
}

function makeLongContent(words: number): string {
  return Array.from({ length: words }, (_, i) => `단어${i}`).join(" ") + " 참고 자료를 인용했습니다.";
}

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    themeId: "theme-1",
    title: "기사 제목",
    content: makeLongContent(700),
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
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  savePublishQualityGateResult.mockReset();
  savePublishLog.mockReset();
  getSuccessfulWordPressDraft.mockReset();
  logEvent.mockReset();

  savePublishQualityGateResult.mockResolvedValue({});
  savePublishLog.mockResolvedValue({});
  logEvent.mockResolvedValue({});
  getSuccessfulWordPressDraft.mockResolvedValue({
    externalPostId: "42",
    postUrl: "https://example-blog.test/?p=42",
  });
});

describe("runPublishQualityGate", () => {
  it("target_keyword가 없으면 blocked로 처리된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ targetKeyword: null }));

    const result = await runPublishQualityGate("article-1");

    expect(result.status).toBe("blocked");
    const targetKeywordItem = result.checklist?.find((entry) => entry.key === "target_keyword_present");
    expect(targetKeywordItem?.status).toBe("blocked");
  });

  it("출처가 없으면 blocked로 처리된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ citedSourceIds: [] }));

    const result = await runPublishQualityGate("article-1");

    expect(result.status).toBe("blocked");
    const sourceItem = result.checklist?.find((entry) => entry.key === "source_citation_exists");
    expect(sourceItem?.status).toBe("blocked");
  });

  it("WordPress draft post id가 없으면 blocked로 처리된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    getSuccessfulWordPressDraft.mockResolvedValue(null);

    const result = await runPublishQualityGate("article-1");

    expect(result.status).toBe("blocked");
    const draftItem = result.checklist?.find((entry) => entry.key === "wordpress_draft_exists");
    expect(draftItem?.status).toBe("blocked");
  });

  it("article.status가 reviewed/approved가 아니면 blocked로 처리된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ status: "draft" }));

    const result = await runPublishQualityGate("article-1");

    expect(result.status).toBe("blocked");
    const statusItem = result.checklist?.find((entry) => entry.key === "status_reviewed");
    expect(statusItem?.status).toBe("blocked");
  });

  it("monetized_blog에서 SEO title이 없으면 blocked 또는 fail로 기록된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ articleMode: "monetized_blog", seoTitle: null, content: makeFullAdSlotContent() + makeLongContent(700) })
    );

    const result = await runPublishQualityGate("article-1");

    const seoTitleItem = result.checklist?.find((entry) => entry.key === "seo_title_present");
    expect(["blocked", "fail"]).toContain(seoTitleItem?.status);
  });

  it("Rank Math custom endpoint가 success/verified면 pass로 기록된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    const result = await runPublishQualityGate("article-1");

    const item = result.checklist?.find((entry) => entry.key === "seo_metadata_custom_endpoint");
    expect(item?.status).toBe("pass");
  });

  it("monetized_blog에서 featured image가 없으면 fail로 기록된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({
        articleMode: "monetized_blog",
        featuredImageWordpressMediaId: null,
        featuredImageWordpressUrl: null,
        content: makeFullAdSlotContent() + makeLongContent(700),
      })
    );

    const result = await runPublishQualityGate("article-1");

    const item = result.checklist?.find((entry) => entry.key === "featured_image_present");
    expect(item?.status).toBe("fail");
  });

  it("monetized_blog에서 AD_SLOT marker가 없으면 warning으로 기록된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ articleMode: "monetized_blog", content: makeLongContent(700) })
    );

    const result = await runPublishQualityGate("article-1");

    const item = result.checklist?.find((entry) => entry.key === "ad_slot_marker_present");
    expect(item?.status).toBe("warning");
  });

  it("광고 클릭 유도 문구가 있으면 blocked로 처리된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({
        articleMode: "monetized_blog",
        content: makeFullAdSlotContent() + makeLongContent(700) + " 지금 바로 광고 클릭 하세요.",
      })
    );

    const result = await runPublishQualityGate("article-1");

    expect(result.status).toBe("blocked");
    const item = result.checklist?.find((entry) => entry.key === "monetization_banned_phrases");
    expect(item?.status).toBe("blocked");
  });

  it("score가 85 이상이고 fail이 없으면 ready_to_publish가 된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    const result = await runPublishQualityGate("article-1");

    expect(result.status).toBe("ready_to_publish");
    expect(result.publishReady).toBe(true);
  });

  it("publish_ready는 ready_to_publish일 때만 true다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ citedSourceIds: [] }));

    const result = await runPublishQualityGate("article-1");

    expect(result.status).toBe("blocked");
    expect(result.publishReady).toBe(false);
  });

  it("category가 없으면 needs_revision 방향으로 fail이 기록된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ wpCategoryIds: [], wpCategoryNames: [] }));

    const result = await runPublishQualityGate("article-1");

    const item = result.checklist?.find((entry) => entry.key === "category_present");
    expect(item?.status).toBe("fail");
    expect(result.status).toBe("needs_revision");
  });

  it("article content 전체가 publish_logs에 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ content: makeLongContent(5000) }));

    await runPublishQualityGate("article-1");

    const call = savePublishLog.mock.calls[0];
    const detailsStr = JSON.stringify(call[0].details);
    expect(detailsStr.length).toBeLessThan(5000);
  });

  it("auth 정보가 logs에 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    await runPublishQualityGate("article-1");

    const serialized = JSON.stringify([...logEvent.mock.calls, ...savePublishLog.mock.calls]).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("basic ");
  });

  it("pipeline_logs는 event_name(type) 기준으로 저장된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    await runPublishQualityGate("article-1");

    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "publish_quality_gate_started" }));
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "publish_quality_gate_completed" }));
  });

  it("publish_logs에 target=publish_quality_gate로 저장된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    await runPublishQualityGate("article-1");

    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({ target: PUBLISH_QUALITY_GATE_TARGET })
    );
  });

  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await runPublishQualityGate("missing");

    expect(result.success).toBe(false);
    expect(savePublishQualityGateResult).not.toHaveBeenCalled();
  });

  it("실행 중 예외가 발생해도 Runtime Error로 터지지 않고 안전한 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    getSuccessfulWordPressDraft.mockRejectedValue(new Error("DB 오류"));

    const result = await runPublishQualityGate("article-1");

    expect(result.success).toBe(false);
    expect(result.status).toBe("failed");
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "publish_quality_gate_failed" }));
  });
});
