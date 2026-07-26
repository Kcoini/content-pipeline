import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/types/domain";

const getArticleById = vi.fn();
const savePublicPublishApprovalResult = vi.fn();
const savePublishLog = vi.fn();
const getSuccessfulWordPressDraft = vi.fn();
const saveApprovalLog = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  savePublicPublishApprovalResult: (...args: unknown[]) => savePublicPublishApprovalResult(...args),
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  savePublishLog: (...args: unknown[]) => savePublishLog(...args),
  getSuccessfulWordPressDraft: (...args: unknown[]) => getSuccessfulWordPressDraft(...args),
}));
vi.mock("@/lib/repositories/approval-repository", () => ({
  saveApprovalLog: (...args: unknown[]) => saveApprovalLog(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { approvePublicPublish, revokePublicPublishApproval, PUBLIC_PUBLISH_APPROVAL_TARGET } = await import(
  "./public-publish-approval-service"
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
    publishQualityGateStatus: "ready_to_publish",
    publishQualityGateScore: 100,
    publishQualityGateSummary: {},
    publishQualityGateError: null,
    publishQualityGateCheckedAt: "2026-01-03T00:00:00.000Z",
    publishReady: true,
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
  savePublicPublishApprovalResult.mockReset();
  savePublishLog.mockReset();
  getSuccessfulWordPressDraft.mockReset();
  saveApprovalLog.mockReset();
  logEvent.mockReset();

  savePublicPublishApprovalResult.mockResolvedValue({});
  savePublishLog.mockResolvedValue({});
  saveApprovalLog.mockResolvedValue({});
  logEvent.mockResolvedValue({});
  getSuccessfulWordPressDraft.mockResolvedValue({
    externalPostId: "42",
    postUrl: "https://example-blog.test/?p=42",
  });
});

describe("approvePublicPublish", () => {
  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await approvePublicPublish("missing");

    expect(result.success).toBe(false);
    expect(savePublicPublishApprovalResult).not.toHaveBeenCalled();
  });

  it("publish_ready=false이면 승인 불가", async () => {
    getArticleById.mockResolvedValue(makeArticle({ publishReady: false }));

    const result = await approvePublicPublish("article-1");

    expect(result.success).toBe(false);
    expect(result.status).toBe("blocked");
    expect(savePublicPublishApprovalResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "blocked", approved: false })
    );
  });

  it("publish_quality_gate_status가 ready_to_publish가 아니면 승인 불가", async () => {
    getArticleById.mockResolvedValue(makeArticle({ publishQualityGateStatus: "needs_revision" }));

    const result = await approvePublicPublish("article-1");

    expect(result.status).toBe("blocked");
    expect(result.blockedReasons?.some((reason) => reason.includes("ready_to_publish"))).toBe(true);
  });

  it("WordPress draft post id가 없으면 승인 불가", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    getSuccessfulWordPressDraft.mockResolvedValue(null);

    const result = await approvePublicPublish("article-1");

    expect(result.status).toBe("blocked");
    expect(result.blockedReasons?.some((reason) => reason.includes("WordPress draft"))).toBe(true);
  });

  it("조건 충족 시 approval status approved로 저장되고 public_publish_approved=true가 된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    const result = await approvePublicPublish("article-1", "editor-kim", "최종 확인 완료");

    expect(result.success).toBe(true);
    expect(result.status).toBe("approved");
    expect(savePublicPublishApprovalResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "approved", approved: true, approvedBy: "editor-kim" })
    );
  });

  it("승인 성공 시 approval_logs에 기록된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    await approvePublicPublish("article-1", "editor-kim");

    expect(saveApprovalLog).toHaveBeenCalledWith(
      expect.objectContaining({
        articleId: "article-1",
        targetType: "article",
        targetId: "article-1",
        action: "public_publish_approved",
        status: "approved",
      })
    );
  });

  it("승인 성공 시 publish_logs에 target=public_publish_approval로 저장된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    await approvePublicPublish("article-1");

    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({ target: PUBLIC_PUBLISH_APPROVAL_TARGET, status: "success" })
    );
  });

  it("이미 approved 상태에서 다시 승인하면 duplicate로 처리된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ publicPublishApprovalStatus: "approved", publicPublishApproved: true })
    );

    const result = await approvePublicPublish("article-1");

    expect(result.status).toBe("duplicate");
    expect(savePublicPublishApprovalResult).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "public_publish_approval_duplicate" }));
  });

  it("공개 publish는 실행하지 않는다 (details_json.actual/publicPublishAction=false)", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    await approvePublicPublish("article-1");

    const call = savePublishLog.mock.calls.find((c) => c[0].status === "success");
    expect(call![0].details.actual).toBe(false);
    expect(call![0].details.publicPublishAction).toBe(false);
  });

  it("auth 정보가 logs에 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    await approvePublicPublish("article-1");

    const serialized = JSON.stringify([...logEvent.mock.calls, ...savePublishLog.mock.calls]).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("basic ");
  });

  it("article content 전체가 logs에 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ content: "본문".repeat(2000) }));

    await approvePublicPublish("article-1");

    const call = savePublishLog.mock.calls.find((c) => c[0].status === "success");
    expect(JSON.stringify(call![0].details)).not.toContain("본문".repeat(2000));
  });

  it("pipeline_logs는 event_name 기준으로 저장된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    await approvePublicPublish("article-1");

    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "public_publish_approval_started" }));
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "public_publish_approval_completed" }));
  });

  it("실행 중 예외가 발생해도 Runtime Error로 터지지 않고 안전한 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    getSuccessfulWordPressDraft.mockRejectedValue(new Error("DB 오류"));

    const result = await approvePublicPublish("article-1");

    expect(result.success).toBe(false);
    expect(result.status).toBe("failed");
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "public_publish_approval_failed" }));
  });
});

describe("revokePublicPublishApproval", () => {
  it("승인된 상태가 아니면 취소할 수 없다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ publicPublishApprovalStatus: "not_requested" }));

    const result = await revokePublicPublishApproval("article-1");

    expect(result.success).toBe(false);
    expect(result.status).toBe("not_approved");
    expect(savePublicPublishApprovalResult).not.toHaveBeenCalled();
  });

  it("승인된 상태이면 revoked로 저장된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ publicPublishApprovalStatus: "approved", publicPublishApproved: true })
    );

    const result = await revokePublicPublishApproval("article-1", "editor-kim", "정책 위반 발견");

    expect(result.success).toBe(true);
    expect(result.status).toBe("revoked");
    expect(savePublicPublishApprovalResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "revoked", approved: false })
    );
    expect(saveApprovalLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "public_publish_approval_revoked", status: "revoked" })
    );
    expect(savePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({ target: PUBLIC_PUBLISH_APPROVAL_TARGET, status: "success" })
    );
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "public_publish_approval_revoked" }));
  });

  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await revokePublicPublishApproval("missing");

    expect(result.success).toBe(false);
  });
});
