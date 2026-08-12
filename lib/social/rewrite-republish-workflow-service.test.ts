import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getRewriteVersionForReapproval = vi.fn();
const updateRewriteRepublishWorkflowStatus = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getRewriteVersionForReapproval: (...args: unknown[]) => getRewriteVersionForReapproval(...args),
  updateRewriteRepublishWorkflowStatus: (...args: unknown[]) => updateRewriteRepublishWorkflowStatus(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { getRewriteRepublishWorkflowStatus, refreshRewriteRepublishWorkflowStatus } = await import("./rewrite-republish-workflow-service");

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-2",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "제목",
    postBody: "본문",
    caption: null,
    excerpt: null,
    hashtags: [],
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
  updateRewriteRepublishWorkflowStatus.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
  updateRewriteRepublishWorkflowStatus.mockImplementation(async (id, patch) =>
    makeSocialPost({ id, rewriteRepublishWorkflowStatus: patch.status, rewriteRepublishWorkflowSummary: patch.summary ?? {} })
  );
});

describe("getRewriteRepublishWorkflowStatus", () => {
  it("rewrite_reapproval_status='not_requested'이면 ready_for_reapproval을 반환한다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ rewriteReapprovalStatus: "not_requested" }));

    const result = await getRewriteRepublishWorkflowStatus("social-post-2");

    expect(result?.status).toBe("ready_for_reapproval");
  });

  it("rewrite_reapproval_status='pending_review'이면 reapproval_pending을 반환한다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ rewriteReapprovalStatus: "pending_review" }));

    const result = await getRewriteRepublishWorkflowStatus("social-post-2");

    expect(result?.status).toBe("reapproval_pending");
  });

  it("approved + reexport not_started이면 reapproved를 반환한다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ rewriteReapprovalStatus: "approved", rewriteReexportStatus: "not_started" }));

    const result = await getRewriteRepublishWorkflowStatus("social-post-2");

    expect(result?.status).toBe("reapproved");
  });

  it("reexport_status='ready'이면 reexport_ready를 반환한다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ rewriteReapprovalStatus: "approved", rewriteReexportStatus: "ready" }));

    const result = await getRewriteRepublishWorkflowStatus("social-post-2");

    expect(result?.status).toBe("reexport_ready");
  });

  it("reexport_status='exported'이면 reexported를 반환한다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ rewriteReapprovalStatus: "approved", rewriteReexportStatus: "exported" }));

    const result = await getRewriteRepublishWorkflowStatus("social-post-2");

    expect(result?.status).toBe("reexported");
  });

  it("guard ready + platformPublishReady=true이면 guard_ready를 반환한다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(
      makeSocialPost({ rewriteReapprovalStatus: "approved", rewriteReexportStatus: "exported", platformPublishGuardStatus: "ready", platformPublishReady: true })
    );

    const result = await getRewriteRepublishWorkflowStatus("social-post-2");

    expect(result?.status).toBe("guard_ready");
  });

  it("dry_run_status='ready'이면 dry_run_ready를 반환한다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(
      makeSocialPost({
        rewriteReapprovalStatus: "approved",
        rewriteReexportStatus: "exported",
        platformPublishGuardStatus: "ready",
        platformPublishReady: true,
        platformPublishDryRunStatus: "ready",
      })
    );

    const result = await getRewriteRepublishWorkflowStatus("social-post-2");

    expect(result?.status).toBe("dry_run_ready");
  });

  it("handoff_status='ready'이면 handoff_ready를, 'completed'이면 handoff_completed를 반환한다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ handoffStatus: "ready" }));
    expect((await getRewriteRepublishWorkflowStatus("social-post-2"))?.status).toBe("handoff_ready");

    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ handoffStatus: "completed" }));
    expect((await getRewriteRepublishWorkflowStatus("social-post-2"))?.status).toBe("handoff_completed");
  });

  it("manual_post_status='posted'이면 manual_post_recorded를 반환한다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ manualPostStatus: "posted", handoffStatus: "completed" }));

    const result = await getRewriteRepublishWorkflowStatus("social-post-2");

    expect(result?.status).toBe("manual_post_recorded");
  });

  it("rewrite_reapproval_status='rejected'이면 blocked를 반환한다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ rewriteReapprovalStatus: "rejected" }));

    const result = await getRewriteRepublishWorkflowStatus("social-post-2");

    expect(result?.status).toBe("blocked");
  });

  it("존재하지 않으면 null을 반환한다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(null);

    const result = await getRewriteRepublishWorkflowStatus("missing");

    expect(result).toBeNull();
  });
});

describe("refreshRewriteRepublishWorkflowStatus", () => {
  it("계산된 상태를 social_posts에 저장한다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ rewriteReapprovalStatus: "pending_review" }));

    const result = await refreshRewriteRepublishWorkflowStatus("social-post-2");

    expect(result.success).toBe(true);
    expect(updateRewriteRepublishWorkflowStatus).toHaveBeenCalledWith(
      "social-post-2",
      expect.objectContaining({ status: "reapproval_pending" })
    );
  });
});

describe("보안 요구사항", () => {
  it("logs에 full body/API key/auth token이 저장되지 않는다", async () => {
    getRewriteVersionForReapproval.mockResolvedValue(makeSocialPost({ postBody: "매우 긴 본문 내용입니다. ".repeat(50) }));

    await refreshRewriteRepublishWorkflowStatus("social-post-2");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("매우 긴 본문");
  });
});
