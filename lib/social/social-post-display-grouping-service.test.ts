import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const listSocialPostsByArticle = vi.fn();
const getArticleById = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  listSocialPostsByArticle: (...args: unknown[]) => listSocialPostsByArticle(...args),
}));
vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { groupSocialPostsForArticle } = await import("./social-post-display-grouping-service");

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "제목",
    postBody: "매우 긴 본문 내용입니다. ".repeat(50),
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
    apiPublishPreparationStatus: "not_checked",
    apiPublishReadinessStatus: null,
    apiPublishEligibleForDryRun: false,
    apiPublishEligibleForActualPublish: false,
    apiPublishPreparationSummary: {},
    apiPublishPreparedAt: null,
    apiPublishPreparedBy: null,
    apiPublishBlockedReason: null,
    ...overrides,
  };
}

beforeEach(() => {
  listSocialPostsByArticle.mockReset();
  getArticleById.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
});

describe("groupSocialPostsForArticle (SocialPost[] 입력)", () => {
  it("blogPosts/communityPosts/socialPosts/rewriteVersions를 분리한다", async () => {
    const posts = [
      makeSocialPost({ id: "p1", platform: "wordpress_blog", isRewriteVersion: false }),
      makeSocialPost({ id: "p2", platform: "naver_cafe", isRewriteVersion: false }),
      makeSocialPost({ id: "p3", platform: "x", isRewriteVersion: false }),
      makeSocialPost({ id: "p4", platform: "naver_blog", isRewriteVersion: true }),
    ];

    const grouped = await groupSocialPostsForArticle(posts);

    expect(grouped.blogPosts.map((p) => p.id)).toEqual(["p1"]);
    expect(grouped.communityPosts.map((p) => p.id)).toEqual(["p2"]);
    expect(grouped.socialPosts.map((p) => p.id)).toEqual(["p3"]);
    expect(grouped.rewriteVersions.map((p) => p.id)).toEqual(["p4"]);
    expect(grouped.originalArticle).toBeNull();
    expect(listSocialPostsByArticle).not.toHaveBeenCalled();
  });

  it("manual_post_status='posted'이고 metrics 미입력이면 metricsMissingItems에 포함된다", async () => {
    const posts = [makeSocialPost({ id: "p1", manualPostStatus: "posted", latestMetricsRecordedAt: null })];

    const grouped = await groupSocialPostsForArticle(posts);

    expect(grouped.metricsMissingItems.map((p) => p.id)).toEqual(["p1"]);
  });

  it("performance_status가 low/needs_review이면 lowPerformanceItems에 포함된다", async () => {
    const posts = [
      makeSocialPost({ id: "p1", performanceStatus: "low" }),
      makeSocialPost({ id: "p2", performanceStatus: "needs_review" }),
      makeSocialPost({ id: "p3", performanceStatus: "good" }),
    ];

    const grouped = await groupSocialPostsForArticle(posts);

    expect(grouped.lowPerformanceItems.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });
});

describe("groupSocialPostsForArticle (articleId 입력)", () => {
  it("article과 social_posts를 조회하고 로그를 남긴다", async () => {
    getArticleById.mockResolvedValue({ id: "article-1", title: "테스트 기사" });
    listSocialPostsByArticle.mockResolvedValue([makeSocialPost({ id: "p1", platform: "wordpress_blog" })]);

    const grouped = await groupSocialPostsForArticle("article-1");

    expect(grouped.originalArticle).toEqual({ id: "article-1", title: "테스트 기사" });
    expect(grouped.blogPosts).toHaveLength(1);
    const types = logEvent.mock.calls.map((call) => call[0].type);
    expect(types).toContain("content_grouping_started");
    expect(types).toContain("content_grouping_completed");
  });

  it("조회 중 오류가 나면 content_grouping_failed 로그를 남기고 다시 throw한다", async () => {
    getArticleById.mockRejectedValue(new Error("boom"));
    listSocialPostsByArticle.mockResolvedValue([]);

    await expect(groupSocialPostsForArticle("article-1")).rejects.toThrow("boom");

    const types = logEvent.mock.calls.map((call) => call[0].type);
    expect(types).toContain("content_grouping_failed");
  });
});

describe("보안 요구사항", () => {
  it("logs에 full post_body/API key/auth token이 저장되지 않는다", async () => {
    getArticleById.mockResolvedValue({ id: "article-1", title: "테스트 기사" });
    listSocialPostsByArticle.mockResolvedValue([makeSocialPost({ postBody: "매우 긴 본문 내용입니다. ".repeat(50) })]);

    await groupSocialPostsForArticle("article-1");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("매우 긴 본문");
  });
});
