import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";
import type { SocialPostMetrics } from "./social-metrics-types";

const getSocialPostForRewritePerformanceComparison = vi.fn();
const getSocialPostById = vi.fn();
const getLatestMetricsBySocialPost = vi.fn();
const createRewritePerformanceComparison = vi.fn();
const updateSocialPostRewritePerformanceSummary = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostForRewritePerformanceComparison: (...args: unknown[]) => getSocialPostForRewritePerformanceComparison(...args),
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
}));
vi.mock("@/lib/repositories/social-metrics-repository", () => ({
  getLatestMetricsBySocialPost: (...args: unknown[]) => getLatestMetricsBySocialPost(...args),
}));
vi.mock("@/lib/repositories/social-rewrite-performance-comparisons-repository", () => ({
  createRewritePerformanceComparison: (...args: unknown[]) => createRewritePerformanceComparison(...args),
  updateSocialPostRewritePerformanceSummary: (...args: unknown[]) => updateSocialPostRewritePerformanceSummary(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { compareRewritePerformance } = await import("./rewrite-performance-comparison-service");

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
    publishStatus: "published",
    externalPostId: null,
    postUrl: "https://blog.naver.com/rewrite",
    exportFormat: null,
    exportPayload: {},
    errorMessage: null,
    generatedAt: null,
    reviewedAt: null,
    publishedAt: "2026-01-18T00:00:00.000Z",
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
    platformPublishGuardScore: 90,
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
    manualPostStatus: "posted",
    manualPostUrl: "https://blog.naver.com/rewrite",
    manualPostedAt: "2026-01-18T00:00:00.000Z",
    manualPostedBy: "editor",
    manualPostResultNotes: null,
    manualPostError: null,
    manualPostRecordedAt: "2026-01-18T00:00:00.000Z",
    manualPostRecordedBy: "editor",
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
    performanceStatus: "good",
    performanceSummary: {},
    latestRewriteSuggestionId: null,
    rewriteSuggestionStatus: "applied",
    rewriteSuggestionCount: 1,
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
    rewriteReexportStatus: "exported",
    rewriteReexportedAt: "2026-01-17T00:00:00.000Z",
    rewriteReexportedBy: "editor",
    rewriteReexportError: null,
    rewriteRepublishWorkflowStatus: "manual_post_recorded",
    rewriteRepublishWorkflowSummary: {},
    latestRewritePerformanceComparisonId: null,
    rewritePerformanceComparisonStatus: "not_compared",
    rewritePerformanceWinner: null,
    rewritePerformanceScoreDelta: null,
    rewritePerformanceImprovementRate: null,
    rewritePerformanceCheckedAt: null,
    rewritePerformanceSummary: {},
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<SocialPostMetrics> = {}): SocialPostMetrics {
  return {
    id: "metrics-1",
    socialPostId: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    measuredAt: "2026-01-19T00:00:00.000Z",
    recordedBy: "editor",
    views: 100,
    impressions: 200,
    likes: 10,
    comments: 2,
    shares: 1,
    saves: 0,
    clicks: 5,
    profileVisits: 0,
    follows: 0,
    reach: 150,
    engagementRate: 0.05,
    clickThroughRate: 0.02,
    conversionCount: 0,
    conversionRate: null,
    performanceScore: 50,
    notes: null,
    rawMetrics: {},
    createdAt: "2026-01-19T00:00:00.000Z",
    updatedAt: "2026-01-19T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostForRewritePerformanceComparison.mockReset();
  getSocialPostById.mockReset();
  getLatestMetricsBySocialPost.mockReset();
  createRewritePerformanceComparison.mockReset();
  updateSocialPostRewritePerformanceSummary.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
  createRewritePerformanceComparison.mockImplementation(async (input) => ({
    id: "perf-comparison-1",
    ...input,
    warnings: input.warnings ?? [],
    failures: input.failures ?? [],
    createdAt: "2026-01-20T00:00:00.000Z",
    updatedAt: "2026-01-20T00:00:00.000Z",
  }));
  updateSocialPostRewritePerformanceSummary.mockResolvedValue(makeSocialPost());
});

describe("compareRewritePerformance", () => {
  it("rewrite version과 original의 metrics가 모두 있으면 비교가 가능하다", async () => {
    getSocialPostForRewritePerformanceComparison.mockResolvedValue(makeSocialPost());
    getSocialPostById.mockResolvedValue(makeSocialPost({ id: "social-post-1", isRewriteVersion: false, versionNumber: 1 }));
    getLatestMetricsBySocialPost.mockImplementation(async (id: string) =>
      id === "social-post-1" ? makeMetrics({ performanceScore: 50 }) : makeMetrics({ id: "metrics-2", performanceScore: 65, views: 150 })
    );

    const result = await compareRewritePerformance("social-post-2", "editor");

    expect(result.success).toBe(true);
    expect(createRewritePerformanceComparison).toHaveBeenCalled();
    expect(updateSocialPostRewritePerformanceSummary).toHaveBeenCalled();
  });

  it("is_rewrite_version=false이면 blocked된다", async () => {
    getSocialPostForRewritePerformanceComparison.mockResolvedValue(makeSocialPost({ isRewriteVersion: false }));

    const result = await compareRewritePerformance("social-post-2");

    expect(result.success).toBe(false);
    expect(createRewritePerformanceComparison).not.toHaveBeenCalled();
  });

  it("parent_social_post_id/rewrite_applied_from_social_post_id가 없으면 blocked된다", async () => {
    getSocialPostForRewritePerformanceComparison.mockResolvedValue(
      makeSocialPost({ parentSocialPostId: null, rewriteAppliedFromSocialPostId: null })
    );

    const result = await compareRewritePerformance("social-post-2");

    expect(result.success).toBe(false);
    expect(createRewritePerformanceComparison).not.toHaveBeenCalled();
  });

  it("원본 metrics가 없으면 needs_more_data로 저장된다", async () => {
    getSocialPostForRewritePerformanceComparison.mockResolvedValue(makeSocialPost());
    getSocialPostById.mockResolvedValue(makeSocialPost({ id: "social-post-1", isRewriteVersion: false, versionNumber: 1 }));
    getLatestMetricsBySocialPost.mockImplementation(async (id: string) => (id === "social-post-1" ? null : makeMetrics()));

    const result = await compareRewritePerformance("social-post-2");

    expect(result.success).toBe(true);
    expect(createRewritePerformanceComparison).toHaveBeenCalledWith(expect.objectContaining({ comparisonStatus: "needs_more_data" }));
  });

  it("rewrite metrics가 없으면 needs_more_data로 저장된다", async () => {
    getSocialPostForRewritePerformanceComparison.mockResolvedValue(makeSocialPost());
    getSocialPostById.mockResolvedValue(makeSocialPost({ id: "social-post-1", isRewriteVersion: false, versionNumber: 1 }));
    getLatestMetricsBySocialPost.mockImplementation(async (id: string) => (id === "social-post-2" ? null : makeMetrics()));

    const result = await compareRewritePerformance("social-post-2");

    expect(result.success).toBe(true);
    expect(createRewritePerformanceComparison).toHaveBeenCalledWith(expect.objectContaining({ comparisonStatus: "needs_more_data" }));
  });

  it("둘 다 metrics가 없어도 blocked가 아니라 needs_more_data로 저장된다", async () => {
    getSocialPostForRewritePerformanceComparison.mockResolvedValue(makeSocialPost());
    getSocialPostById.mockResolvedValue(makeSocialPost({ id: "social-post-1", isRewriteVersion: false, versionNumber: 1 }));
    getLatestMetricsBySocialPost.mockResolvedValue(null);

    const result = await compareRewritePerformance("social-post-2");

    expect(result.success).toBe(true);
    expect(createRewritePerformanceComparison).toHaveBeenCalledWith(expect.objectContaining({ comparisonStatus: "needs_more_data" }));
  });

  it("performance_score_delta/개선율을 계산해 social_posts 요약에 반영한다", async () => {
    getSocialPostForRewritePerformanceComparison.mockResolvedValue(makeSocialPost());
    getSocialPostById.mockResolvedValue(makeSocialPost({ id: "social-post-1", isRewriteVersion: false, versionNumber: 1 }));
    getLatestMetricsBySocialPost.mockImplementation(async (id: string) =>
      id === "social-post-1" ? makeMetrics({ performanceScore: 50 }) : makeMetrics({ id: "metrics-2", performanceScore: 65 })
    );

    await compareRewritePerformance("social-post-2");

    expect(createRewritePerformanceComparison).toHaveBeenCalledWith(
      expect.objectContaining({ performanceScoreDelta: 15, performanceScoreDeltaRate: expect.closeTo(0.3, 5) })
    );
  });
});

describe("보안 요구사항", () => {
  it("logs에 full body/API key/auth token이 저장되지 않는다", async () => {
    getSocialPostForRewritePerformanceComparison.mockResolvedValue(makeSocialPost({ postBody: "매우 긴 본문 내용입니다. ".repeat(50) }));
    getSocialPostById.mockResolvedValue(
      makeSocialPost({ id: "social-post-1", isRewriteVersion: false, versionNumber: 1, postBody: "원본 본문입니다. ".repeat(50) })
    );
    getLatestMetricsBySocialPost.mockResolvedValue(makeMetrics());

    await compareRewritePerformance("social-post-2");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("매우 긴 본문");
    expect(serialized).not.toContain("원본 본문입니다");
  });
});
