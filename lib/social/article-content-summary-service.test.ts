import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getArticleById = vi.fn();
const getSourcesByArticleId = vi.fn();
const groupSocialPostsForArticle = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));
vi.mock("@/lib/repositories/source-repository", () => ({
  getSourcesByArticleId: (...args: unknown[]) => getSourcesByArticleId(...args),
}));
vi.mock("./social-post-display-grouping-service", () => ({
  groupSocialPostsForArticle: (...args: unknown[]) => groupSocialPostsForArticle(...args),
}));

const { buildArticleContentSummary } = await import("./article-content-summary-service");

function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "wordpress_blog",
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
    approvalStatus: "approved",
    approvedBy: "editor",
    approvedAt: null,
    publishStatus: "published",
    externalPostId: null,
    postUrl: null,
    exportFormat: null,
    exportPayload: {},
    errorMessage: null,
    generatedAt: null,
    reviewedAt: null,
    publishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-05T00:00:00.000Z",
    editedAt: null,
    editedBy: null,
    reviewNotes: null,
    revisionCount: 0,
    lastQualityCheckedAt: null,
    approvalRequestedAt: null,
    rejectionReason: null,
    revokedAt: null,
    revokedReason: null,
    exportStatus: "exported",
    exportedAt: null,
    exportedBy: null,
    exportError: null,
    exportCopyCount: 0,
    lastCopiedAt: null,
    exportNotes: null,
    platformPublishGuardStatus: "ready",
    platformPublishGuardScore: null,
    platformPublishGuardSummary: {},
    platformPublishGuardError: null,
    platformPublishGuardCheckedAt: null,
    platformPublishReady: true,
    platformPublishBlockedReason: null,
    platformPublishDryRunStatus: "ready",
    platformPublishDryRunPayload: {},
    platformPublishDryRunError: null,
    platformPublishDryRunCreatedAt: null,
    platformPublishDryRunCreatedBy: null,
    handoffStatus: "completed",
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
    rootSocialPostId: null,
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
    latestRewritePerformanceComparisonId: null,
    rewritePerformanceComparisonStatus: "not_compared",
    rewritePerformanceWinner: null,
    rewritePerformanceScoreDelta: null,
    rewritePerformanceImprovementRate: null,
    rewritePerformanceCheckedAt: null,
    rewritePerformanceSummary: {},
    abTestStatus: "not_in_test",
    latestAbTestId: null,
    abTestVariantRole: null,
    abTestVariantLabel: null,
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  getSourcesByArticleId.mockReset();
  groupSocialPostsForArticle.mockReset();
});

describe("buildArticleContentSummary", () => {
  it("article이 없으면 null을 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);
    getSourcesByArticleId.mockResolvedValue([]);

    const summary = await buildArticleContentSummary("missing-article");

    expect(summary).toBeNull();
  });

  it("blog/community/social/rewrite 개수와 posted/metrics/low performance 개수를 계산한다", async () => {
    getArticleById.mockResolvedValue({ id: "article-1", title: "테스트 기사", updatedAt: "2026-01-01T00:00:00.000Z" });
    getSourcesByArticleId.mockResolvedValue([{ id: "source-1" }, { id: "source-2" }, { id: "source-3" }]);
    groupSocialPostsForArticle.mockResolvedValue({
      originalArticle: null,
      blogPosts: [makePost({ id: "p1", manualPostStatus: "posted", latestMetricsRecordedAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" })],
      communityPosts: [makePost({ id: "p2", platform: "naver_cafe" })],
      socialPosts: [makePost({ id: "p3", platform: "x" }), makePost({ id: "p4", platform: "threads" })],
      rewriteVersions: [makePost({ id: "p5", isRewriteVersion: true, recommendedForRepost: true })],
      performanceItems: [],
      metricsMissingItems: [makePost({ id: "p6", manualPostStatus: "posted", latestMetricsRecordedAt: null })],
      lowPerformanceItems: [makePost({ id: "p7", performanceStatus: "low" })],
    });

    const summary = await buildArticleContentSummary("article-1");

    expect(summary).not.toBeNull();
    expect(summary!.sourceCount).toBe(3);
    expect(summary!.blogPostCount).toBe(1);
    expect(summary!.communityPostCount).toBe(1);
    expect(summary!.socialPostCount).toBe(2);
    expect(summary!.rewriteVersionCount).toBe(1);
    expect(summary!.postedCount).toBe(1);
    expect(summary!.metricsMeasuredCount).toBe(1);
    expect(summary!.metricsMissingCount).toBe(1);
    expect(summary!.lowPerformanceCount).toBe(1);
    expect(summary!.recommendedRewriteCount).toBe(1);
  });
});
