import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";
import type { SocialPostMetrics } from "./social-metrics-types";

const getSocialPostForRewritePerformanceComparison = vi.fn();
const getSocialPostById = vi.fn();
const getLatestMetricsBySocialPost = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostForRewritePerformanceComparison: (...args: unknown[]) => getSocialPostForRewritePerformanceComparison(...args),
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
}));
vi.mock("@/lib/repositories/social-metrics-repository", () => ({
  getLatestMetricsBySocialPost: (...args: unknown[]) => getLatestMetricsBySocialPost(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { buildRewritePerformanceComparisonPreview } = await import("./rewrite-performance-comparison-preview-builder");

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-2",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "[개선 제안] 제목",
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
    postUrl: "https://blog.naver.com/rewrite",
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
    manualPostStatus: "posted",
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
    latestVersionComparisonId: null,
    versionComparisonStatus: "rewrite_better",
    versionComparisonScore: 90,
    recommendedForRepost: true,
    versionComparisonCheckedAt: null,
    rewriteReapprovalStatus: "approved",
    rewriteReapprovalRequestedAt: null,
    rewriteReapprovalRequestedBy: null,
    rewriteReapprovedAt: null,
    rewriteReapprovedBy: null,
    rewriteReapprovalNotes: null,
    rewriteReapprovalError: null,
    rewriteReexportStatus: "exported",
    rewriteReexportedAt: null,
    rewriteReexportedBy: null,
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
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
});

describe("buildRewritePerformanceComparisonPreview", () => {
  it("원본/rewrite 모두 metrics가 있으면 canCompare=true를 반환한다", async () => {
    getSocialPostForRewritePerformanceComparison.mockResolvedValue(makeSocialPost());
    getSocialPostById.mockResolvedValue(makeSocialPost({ id: "social-post-1", isRewriteVersion: false, versionNumber: 1 }));
    getLatestMetricsBySocialPost.mockResolvedValue(makeMetrics());

    const preview = await buildRewritePerformanceComparisonPreview("social-post-2");

    expect(preview.canCompare).toBe(true);
    expect(preview.original?.socialPostId).toBe("social-post-1");
    expect(preview.rewrite?.socialPostId).toBe("social-post-2");
  });

  it("rewrite social post를 찾을 수 없으면 canCompare=false를 반환한다", async () => {
    getSocialPostForRewritePerformanceComparison.mockResolvedValue(null);

    const preview = await buildRewritePerformanceComparisonPreview("missing");

    expect(preview.canCompare).toBe(false);
    expect(preview.missingData.length).toBeGreaterThan(0);
  });

  it("metrics가 하나라도 없으면 canCompare=false이고 warnings에 needs_more_data가 기록된다", async () => {
    getSocialPostForRewritePerformanceComparison.mockResolvedValue(makeSocialPost());
    getSocialPostById.mockResolvedValue(makeSocialPost({ id: "social-post-1", isRewriteVersion: false, versionNumber: 1 }));
    getLatestMetricsBySocialPost.mockImplementation(async (id: string) => (id === "social-post-2" ? null : makeMetrics()));

    const preview = await buildRewritePerformanceComparisonPreview("social-post-2");

    expect(preview.canCompare).toBe(false);
    expect(preview.warnings.some((w) => (w as Record<string, unknown>).reasonCode === "needs_more_data")).toBe(true);
  });
});

describe("보안 요구사항", () => {
  it("logs에 full body/API key/auth token이 저장되지 않는다", async () => {
    getSocialPostForRewritePerformanceComparison.mockResolvedValue(makeSocialPost({ postBody: "매우 긴 본문 내용입니다. ".repeat(50) }));
    getSocialPostById.mockResolvedValue(
      makeSocialPost({ id: "social-post-1", isRewriteVersion: false, versionNumber: 1, postBody: "원본 본문입니다. ".repeat(50) })
    );
    getLatestMetricsBySocialPost.mockResolvedValue(makeMetrics());

    await buildRewritePerformanceComparisonPreview("social-post-2");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("매우 긴 본문");
  });
});
