import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getSocialPostForVersionComparison = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostForVersionComparison: (...args: unknown[]) => getSocialPostForVersionComparison(...args),
}));

const { buildRewriteVersionComparisonPreview } = await import("./rewrite-version-comparison-preview-builder");

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "장기요양보험 신청 방법",
    postBody: "본문 내용입니다.",
    caption: null,
    excerpt: null,
    hashtags: ["장기요양보험"],
    threadItems: [],
    cardItems: [],
    mediaRequirements: {},
    platformMetadata: {},
    generationContext: {},
    qualityStatus: "ready",
    qualityScore: 70,
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
    parentSocialPostId: null,
    rootSocialPostId: "social-post-1",
    versionNumber: 1,
    versionLabel: null,
    versionStatus: "current",
    rewriteSourceSuggestionId: null,
    rewriteAppliedFromSocialPostId: null,
    rewriteAppliedAt: null,
    rewriteAppliedBy: null,
    rewriteApplicationNotes: null,
    isRewriteVersion: false,
    latestVersionComparisonId: null,
    versionComparisonStatus: "not_compared",
    versionComparisonScore: null,
    recommendedForRepost: false,
    versionComparisonCheckedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostForVersionComparison.mockReset();
});

describe("buildRewriteVersionComparisonPreview", () => {
  it("정상적인 경우 original/rewrite/differences를 반환한다", async () => {
    getSocialPostForVersionComparison.mockImplementation(async (id: string) =>
      id === "social-post-2"
        ? makeSocialPost({ id: "social-post-2", postTitle: "새 제목", parentSocialPostId: "social-post-1", isRewriteVersion: true })
        : makeSocialPost({ id: "social-post-1" })
    );

    const result = await buildRewriteVersionComparisonPreview("social-post-2");

    expect(result.ok).toBe(true);
    expect(result.original?.id).toBe("social-post-1");
    expect(result.rewrite?.id).toBe("social-post-2");
    expect(result.differences).toContain("post_title이 다릅니다.");
  });

  it("parent가 없으면 ok=false를 반환한다", async () => {
    getSocialPostForVersionComparison.mockResolvedValue(makeSocialPost({ id: "social-post-2", parentSocialPostId: null }));

    const result = await buildRewriteVersionComparisonPreview("social-post-2");

    expect(result.ok).toBe(false);
  });

  it("성과 데이터가 없으면 warning을 반환한다", async () => {
    getSocialPostForVersionComparison.mockImplementation(async (id: string) =>
      id === "social-post-2"
        ? makeSocialPost({ id: "social-post-2", parentSocialPostId: "social-post-1", isRewriteVersion: true, performanceStatus: "not_measured" })
        : makeSocialPost({ id: "social-post-1" })
    );

    const result = await buildRewriteVersionComparisonPreview("social-post-2");

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("post_title 미리보기는 잘려서 노출된다", async () => {
    getSocialPostForVersionComparison.mockImplementation(async (id: string) =>
      id === "social-post-2"
        ? makeSocialPost({ id: "social-post-2", parentSocialPostId: "social-post-1", isRewriteVersion: true, postTitle: "가".repeat(200) })
        : makeSocialPost({ id: "social-post-1" })
    );

    const result = await buildRewriteVersionComparisonPreview("social-post-2");

    expect((result.rewrite?.postTitlePreview ?? "").length).toBeLessThan(200);
  });
});
