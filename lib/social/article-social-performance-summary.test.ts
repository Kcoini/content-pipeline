import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const listPerformanceSummaryByArticle = vi.fn();

vi.mock("@/lib/repositories/social-metrics-repository", () => ({
  listPerformanceSummaryByArticle: (...args: unknown[]) => listPerformanceSummaryByArticle(...args),
}));

const { buildArticleSocialPerformanceSummary } = await import("./article-social-performance-summary");

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: null,
    postBody: null,
    caption: null,
    excerpt: null,
    hashtags: [],
    threadItems: [],
    cardItems: [],
    mediaRequirements: {},
    platformMetadata: {},
    generationContext: {},
    qualityStatus: "ready",
    qualityScore: null,
    qualitySummary: {},
    approvalStatus: "approved",
    approvedBy: null,
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
    performanceStatus: "not_measured",
    performanceSummary: {},
    ...overrides,
  };
}

beforeEach(() => {
  listPerformanceSummaryByArticle.mockReset();
});

describe("buildArticleSocialPerformanceSummary", () => {
  it("플랫폼별/문체별 최고 점수와 best platform/tone_style을 계산한다", async () => {
    listPerformanceSummaryByArticle.mockResolvedValue([
      makeSocialPost({ id: "sp-1", platform: "naver_blog", toneStyle: "informational", latestPerformanceScore: 90, performanceStatus: "excellent" }),
      makeSocialPost({ id: "sp-2", platform: "x", toneStyle: "curiosity", latestPerformanceScore: 60, performanceStatus: "average" }),
      makeSocialPost({ id: "sp-3", platform: "instagram", toneStyle: "story", latestPerformanceScore: null, performanceStatus: "not_measured" }),
    ]);

    const summary = await buildArticleSocialPerformanceSummary("article-1");

    expect(summary.totalPosts).toBe(3);
    expect(summary.postsMeasuredCount).toBe(2);
    expect(summary.postsNotMeasuredCount).toBe(1);
    expect(summary.bestPlatform).toBe("naver_blog");
    expect(summary.bestToneStyle).toBe("informational");
    expect(summary.byPlatform.naver_blog).toBe(90);
    expect(summary.byPlatform.instagram).toBeNull();
  });

  it("social post가 없으면 빈 요약을 반환한다", async () => {
    listPerformanceSummaryByArticle.mockResolvedValue([]);

    const summary = await buildArticleSocialPerformanceSummary("article-1");

    expect(summary.totalPosts).toBe(0);
    expect(summary.bestPlatform).toBeNull();
    expect(summary.bestToneStyle).toBeNull();
  });
});
