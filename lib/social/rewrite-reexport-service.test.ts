import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getRewriteVersionForReapproval = vi.fn();
const updateRewriteReexportStatus = vi.fn();
const updateRewriteRepublishWorkflowStatus = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getRewriteVersionForReapproval: (...args: unknown[]) => getRewriteVersionForReapproval(...args),
  updateRewriteReexportStatus: (...args: unknown[]) => updateRewriteReexportStatus(...args),
  updateRewriteRepublishWorkflowStatus: (...args: unknown[]) => updateRewriteRepublishWorkflowStatus(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { prepareRewriteReexport, generateRewriteReexportPayload } = await import("./rewrite-reexport-service");

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
    approvalStatus: "approved",
    approvedBy: "editor",
    approvedAt: "2026-01-17T00:00:00.000Z",
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
    rewriteReapprovalStatus: "approved",
    rewriteReapprovalRequestedAt: "2026-01-17T00:00:00.000Z",
    rewriteReapprovalRequestedBy: "editor",
    rewriteReapprovedAt: "2026-01-17T00:00:00.000Z",
    rewriteReapprovedBy: "editor",
    rewriteReapprovalNotes: null,
    rewriteReapprovalError: null,
    rewriteReexportStatus: "not_started",
    rewriteReexportedAt: null,
    rewriteReexportedBy: null,
    rewriteReexportError: null,
    rewriteRepublishWorkflowStatus: "reapproved",
    rewriteRepublishWorkflowSummary: {},
    ...overrides,
  };
}

beforeEach(() => {
  getRewriteVersionForReapproval.mockReset();
  updateRewriteReexportStatus.mockReset();
  updateRewriteRepublishWorkflowStatus.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
  updateRewriteReexportStatus.mockImplementation(async (id, patch) =>
    makeSocialPost({
      id,
      rewriteReexportStatus: patch.rewriteReexportStatus,
      exportStatus: patch.exportStatus ?? "not_exported",
      exportPayload: patch.exportPayload ?? {},
      exportFormat: patch.exportFormat ?? null,
    })
  );
  updateRewriteRepublishWorkflowStatus.mockResolvedValue(makeSocialPost());
});

describe("prepareRewriteReexport", () => {
  it("approved rewrite version만 재export 준비가 가능하다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost());

    const result = await prepareRewriteReexport("social-post-2", "editor");

    expect(result.success).toBe(true);
    expect(updateRewriteReexportStatus).toHaveBeenCalledWith("social-post-2", expect.objectContaining({ rewriteReexportStatus: "ready" }));
  });

  it("rewrite_reapproval_status가 approved가 아니면 준비할 수 없다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ rewriteReapprovalStatus: "pending_review" }));

    const result = await prepareRewriteReexport("social-post-2");

    expect(result.success).toBe(false);
  });
});

describe("generateRewriteReexportPayload", () => {
  it("재export 시 export_payload가 생성된다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost());

    const result = await generateRewriteReexportPayload("social-post-2", "editor");

    expect(result.success).toBe(true);
    expect(updateRewriteReexportStatus).toHaveBeenCalledWith(
      "social-post-2",
      expect.objectContaining({ rewriteReexportStatus: "exported", exportStatus: "exported", exportPayload: expect.any(Object) })
    );
  });

  it("재export 시 rewrite_reexport_status='exported'가 된다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost());

    const result = await generateRewriteReexportPayload("social-post-2");

    expect(result.socialPost?.rewriteReexportStatus).toBe("exported");
  });

  it("publish_status='published'이면 재export할 수 없다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ publishStatus: "published" }));

    const result = await generateRewriteReexportPayload("social-post-2");

    expect(result.success).toBe(false);
  });

  it("quality_status가 ready가 아니면 재export할 수 없다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ qualityStatus: "needs_revision" }));

    const result = await generateRewriteReexportPayload("social-post-2");

    expect(result.success).toBe(false);
  });
});

describe("보안 요구사항", () => {
  it("logs에 full body/full export payload text/API key/auth token이 저장되지 않는다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ postBody: "매우 긴 개선된 본문 내용입니다. ".repeat(50) }));

    await generateRewriteReexportPayload("social-post-2");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("매우 긴 개선된 본문");
  });
});
