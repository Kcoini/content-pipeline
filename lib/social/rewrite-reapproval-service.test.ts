import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getRewriteVersionForReapproval = vi.fn();
const updateRewriteReapprovalStatus = vi.fn();
const updateRewriteRepublishWorkflowStatus = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getRewriteVersionForReapproval: (...args: unknown[]) => getRewriteVersionForReapproval(...args),
  updateRewriteReapprovalStatus: (...args: unknown[]) => updateRewriteReapprovalStatus(...args),
  updateRewriteRepublishWorkflowStatus: (...args: unknown[]) => updateRewriteRepublishWorkflowStatus(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { requestRewriteReapproval, approveRewriteReapproval, rejectRewriteReapproval, revokeRewriteReapproval } = await import(
  "./rewrite-reapproval-service"
);

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-2",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "[개선 제안] 제목",
    postBody: "충분히 긴 개선된 본문 내용입니다. ".repeat(30),
    caption: null,
    excerpt: null,
    hashtags: ["장기요양보험"],
    threadItems: [],
    cardItems: [],
    mediaRequirements: {},
    platformMetadata: {},
    generationContext: {},
    qualityStatus: "ready",
    qualityScore: 90,
    qualitySummary: {},
    approvalStatus: "not_requested",
    approvedBy: null,
    approvedAt: null,
    publishStatus: "not_published",
    externalPostId: null,
    postUrl: null,
    exportFormat: null,
    exportPayload: {},
    errorMessage: null,
    generatedAt: null,
    reviewedAt: null,
    publishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    editedAt: null,
    editedBy: null,
    reviewNotes: null,
    revisionCount: 0,
    lastQualityCheckedAt: null,
    approvalRequestedAt: null,
    rejectionReason: null,
    revokedAt: null,
    revokedReason: null,
    exportStatus: "not_exported",
    exportedAt: null,
    exportedBy: null,
    exportError: null,
    exportCopyCount: 0,
    lastCopiedAt: null,
    exportNotes: null,
    platformPublishGuardStatus: "not_checked",
    platformPublishGuardScore: null,
    platformPublishGuardSummary: {},
    platformPublishGuardError: null,
    platformPublishGuardCheckedAt: null,
    platformPublishReady: false,
    platformPublishBlockedReason: null,
    platformPublishDryRunStatus: "not_created",
    platformPublishDryRunPayload: {},
    platformPublishDryRunError: null,
    platformPublishDryRunCreatedAt: null,
    platformPublishDryRunCreatedBy: null,
    handoffStatus: "not_started",
    handoffPayload: {},
    handoffNotes: null,
    handoffCompletedAt: null,
    handoffCompletedBy: null,
    handoffError: null,
    manualPostStatus: "not_recorded",
    manualPostUrl: null,
    manualPostedAt: null,
    manualPostedBy: null,
    manualPostResultNotes: null,
    manualPostError: null,
    manualPostRecordedAt: null,
    manualPostRecordedBy: null,
    manualPostChecklist: [],
    latestMetricsId: null,
    latestMetricsRecordedAt: null,
    latestViews: 0,
    latestImpressions: 0,
    latestLikes: 0,
    latestComments: 0,
    latestShares: 0,
    latestSaves: 0,
    latestClicks: 0,
    latestEngagementRate: null,
    latestClickThroughRate: null,
    latestPerformanceScore: null,
    performanceStatus: "not_measured",
    performanceSummary: {},
    latestRewriteSuggestionId: null,
    rewriteSuggestionStatus: "not_created",
    rewriteSuggestionCount: 0,
    latestRewriteSuggestedAt: null,
    parentSocialPostId: "social-post-1",
    rootSocialPostId: "social-post-1",
    versionNumber: 2,
    versionLabel: "Rewrite v2",
    versionStatus: "current",
    rewriteSourceSuggestionId: "suggestion-1",
    rewriteAppliedFromSocialPostId: "social-post-1",
    rewriteAppliedAt: "2026-01-15T00:00:00.000Z",
    rewriteAppliedBy: "editor",
    rewriteApplicationNotes: null,
    isRewriteVersion: true,
    latestVersionComparisonId: "comparison-1",
    versionComparisonStatus: "rewrite_better",
    versionComparisonScore: 90,
    recommendedForRepost: true,
    versionComparisonCheckedAt: "2026-01-16T00:00:00.000Z",
    rewriteReapprovalStatus: "not_requested",
    rewriteReapprovalRequestedAt: null,
    rewriteReapprovalRequestedBy: null,
    rewriteReapprovedAt: null,
    rewriteReapprovedBy: null,
    rewriteReapprovalNotes: null,
    rewriteReapprovalError: null,
    rewriteReexportStatus: "not_started",
    rewriteReexportedAt: null,
    rewriteReexportedBy: null,
    rewriteReexportError: null,
    rewriteRepublishWorkflowStatus: "not_started",
    rewriteRepublishWorkflowSummary: {},
    ...overrides,
  };
}

beforeEach(() => {
  getRewriteVersionForReapproval.mockReset();
  updateRewriteReapprovalStatus.mockReset();
  updateRewriteRepublishWorkflowStatus.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
  updateRewriteReapprovalStatus.mockImplementation(async (id, patch) =>
    makeSocialPost({
      id,
      rewriteReapprovalStatus: patch.rewriteReapprovalStatus,
      approvalStatus: patch.approvalStatus ?? "not_requested",
      approvedBy: patch.approvedBy ?? null,
      approvedAt: patch.approvedAt ?? null,
    })
  );
  updateRewriteRepublishWorkflowStatus.mockResolvedValue(makeSocialPost());
});

describe("requestRewriteReapproval", () => {
  it("추천된 rewrite version은 재승인을 요청할 수 있다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost());

    const result = await requestRewriteReapproval("social-post-2", "editor");

    expect(result.success).toBe(true);
    expect(updateRewriteReapprovalStatus).toHaveBeenCalledWith(
      "social-post-2",
      expect.objectContaining({ rewriteReapprovalStatus: "pending_review", approvalStatus: "pending_review" })
    );
  });

  it("is_rewrite_version=false이면 blocked된다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ isRewriteVersion: false }));

    const result = await requestRewriteReapproval("social-post-2");

    expect(result.success).toBe(false);
    expect(updateRewriteReapprovalStatus).not.toHaveBeenCalled();
  });

  it("quality_status가 ready가 아니면 warning을 반환하되 요청은 허용한다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ qualityStatus: "needs_revision" }));

    const result = await requestRewriteReapproval("social-post-2");

    expect(result.success).toBe(true);
    expect(result.warnings?.some((w) => w.includes("quality_status"))).toBe(true);
  });

  it("recommended_for_repost=false이면 warning을 반환한다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ recommendedForRepost: false, versionComparisonStatus: "similar" }));

    const result = await requestRewriteReapproval("social-post-2");

    expect(result.warnings?.some((w) => w.includes("recommended_for_repost"))).toBe(true);
  });
});

describe("approveRewriteReapproval", () => {
  it("pending_review 상태에서 승인 가능하다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ rewriteReapprovalStatus: "pending_review" }));

    const result = await approveRewriteReapproval("social-post-2", "editor");

    expect(result.success).toBe(true);
    expect(updateRewriteReapprovalStatus).toHaveBeenCalledWith(
      "social-post-2",
      expect.objectContaining({ rewriteReapprovalStatus: "approved", approvalStatus: "approved", approvedBy: "editor", approvedAt: expect.any(String) })
    );
  });

  it("pending_review가 아니면 승인할 수 없다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ rewriteReapprovalStatus: "not_requested" }));

    const result = await approveRewriteReapproval("social-post-2");

    expect(result.success).toBe(false);
  });

  it("quality_status가 ready가 아니면 승인할 수 없다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ rewriteReapprovalStatus: "pending_review", qualityStatus: "needs_revision" }));

    const result = await approveRewriteReapproval("social-post-2");

    expect(result.success).toBe(false);
  });

  it("금지 표현이 있으면 승인할 수 없다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(
      makeSocialPost({ rewriteReapprovalStatus: "pending_review", postBody: "수익 보장 상품입니다." })
    );

    const result = await approveRewriteReapproval("social-post-2");

    expect(result.success).toBe(false);
  });
});

describe("rejectRewriteReapproval / revokeRewriteReapproval", () => {
  it("반려 시 approval_status가 rejected로 저장된다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ rewriteReapprovalStatus: "pending_review" }));
    updateRewriteReapprovalStatus.mockResolvedValue(makeSocialPost({ rewriteReapprovalStatus: "rejected", approvalStatus: "rejected" }));

    const result = await rejectRewriteReapproval("social-post-2", "editor", "부적절");

    expect(result.success).toBe(true);
    expect(result.socialPost?.approvalStatus).toBe("rejected");
    expect(updateRewriteReapprovalStatus).toHaveBeenCalledWith(
      "social-post-2",
      expect.objectContaining({ rewriteReapprovalStatus: "rejected", approvalStatus: "rejected", rejectionReason: "부적절" })
    );
  });

  it("approved 상태만 승인을 취소할 수 있다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ rewriteReapprovalStatus: "pending_review" }));

    const result = await revokeRewriteReapproval("social-post-2", "editor", "재검토");

    expect(result.success).toBe(false);
    expect(updateRewriteReapprovalStatus).not.toHaveBeenCalled();
  });

  it("approved 상태에서 취소하면 approval_status가 revoked가 된다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ rewriteReapprovalStatus: "approved" }));
    updateRewriteReapprovalStatus.mockResolvedValue(makeSocialPost({ rewriteReapprovalStatus: "revoked", approvalStatus: "revoked" }));

    const result = await revokeRewriteReapproval("social-post-2", "editor", "재검토");

    expect(result.success).toBe(true);
    expect(result.socialPost?.approvalStatus).toBe("revoked");
  });
});

describe("보안 요구사항", () => {
  it("logs에 full body/API key/auth token이 저장되지 않는다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ postBody: "매우 긴 본문 내용입니다. ".repeat(50) }));

    await requestRewriteReapproval("social-post-2");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("매우 긴 본문");
  });
});
