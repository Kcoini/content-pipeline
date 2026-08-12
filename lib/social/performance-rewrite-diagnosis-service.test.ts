import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";
import type { SocialPostMetrics } from "./social-metrics-types";

const getSocialPostById = vi.fn();
const getLatestMetricsBySocialPost = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
}));
vi.mock("@/lib/repositories/social-metrics-repository", () => ({
  getLatestMetricsBySocialPost: (...args: unknown[]) => getLatestMetricsBySocialPost(...args),
}));

const { diagnoseSocialPostPerformance } = await import("./performance-rewrite-diagnosis-service");

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "장기요양보험 신청 방법",
    postBody: "충분히 긴 본문 내용입니다. ".repeat(40),
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
    approvedAt: null,
    publishStatus: "published",
    externalPostId: null,
    postUrl: "https://blog.naver.com/myid/1",
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
    manualPostUrl: "https://blog.naver.com/myid/1",
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
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<SocialPostMetrics> = {}): SocialPostMetrics {
  return {
    id: "metrics-1",
    socialPostId: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    measuredAt: "2026-01-10T00:00:00.000Z",
    recordedBy: "editor",
    views: 50,
    impressions: 0,
    likes: 2,
    comments: 0,
    shares: 0,
    saves: 0,
    clicks: 0,
    profileVisits: 0,
    follows: 0,
    reach: 0,
    engagementRate: 0.01,
    clickThroughRate: null,
    conversionCount: 0,
    conversionRate: null,
    performanceScore: 15,
    notes: null,
    rawMetrics: {},
    createdAt: "2026-01-10T00:00:00.000Z",
    updatedAt: "2026-01-10T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostById.mockReset();
  getLatestMetricsBySocialPost.mockReset();
});

describe("diagnoseSocialPostPerformance", () => {
  it("metrics가 없으면 status='needs_review'를 반환한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());
    getLatestMetricsBySocialPost.mockResolvedValue(null);

    const result = await diagnoseSocialPostPerformance("social-post-1");

    expect(result.status).toBe("needs_review");
    expect(result.improvementTargets).toContain("metrics_missing");
  });

  it("낮은 성과 지표에 대해 improvementTargets를 생성한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ performanceStatus: "low", latestPerformanceScore: 15 }));
    getLatestMetricsBySocialPost.mockResolvedValue(makeMetrics());

    const result = await diagnoseSocialPostPerformance("social-post-1");

    expect(result.status).toBe("ok");
    expect(result.improvementTargets.length).toBeGreaterThan(0);
    expect(result.improvementTargets).toContain("engagement_low");
  });

  it("존재하지 않는 social post는 blocked를 반환한다", async () => {
    getSocialPostById.mockResolvedValue(null);

    const result = await diagnoseSocialPostPerformance("missing");

    expect(result.status).toBe("blocked");
    expect(result.blockedReasons.length).toBeGreaterThan(0);
  });

  it("manual_post_status가 posted가 아니면 warning을 반환한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ manualPostStatus: "not_recorded" }));
    getLatestMetricsBySocialPost.mockResolvedValue(makeMetrics());

    const result = await diagnoseSocialPostPerformance("social-post-1");

    expect(result.warnings.some((w) => w.includes("manual_post_status"))).toBe(true);
  });
});
