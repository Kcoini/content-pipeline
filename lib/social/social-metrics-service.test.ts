import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getSocialPostById = vi.fn();
const createSocialPostMetrics = vi.fn();
const updateSocialPostLatestMetrics = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
}));
vi.mock("@/lib/repositories/social-metrics-repository", () => ({
  createSocialPostMetrics: (...args: unknown[]) => createSocialPostMetrics(...args),
  updateSocialPostLatestMetrics: (...args: unknown[]) => updateSocialPostLatestMetrics(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { recordSocialPostMetrics } = await import("./social-metrics-service");

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "제목",
    postBody: "매우 긴 본문 내용입니다. ".repeat(20),
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
    approvedAt: "2026-01-01T00:00:00.000Z",
    publishStatus: "published",
    externalPostId: null,
    postUrl: "https://blog.naver.com/myid/1",
    exportFormat: "naver_blog_markdown_copy",
    exportPayload: { exportTitle: "제목" },
    errorMessage: null,
    generatedAt: "2026-01-01T00:00:00.000Z",
    reviewedAt: null,
    publishedAt: "2026-01-06T00:00:00.000Z",
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
    exportedAt: "2026-01-02T00:00:00.000Z",
    exportedBy: "editor",
    exportError: null,
    exportCopyCount: 0,
    lastCopiedAt: null,
    exportNotes: null,
    platformPublishGuardStatus: "ready",
    platformPublishGuardScore: 95,
    platformPublishGuardSummary: {},
    platformPublishGuardError: null,
    platformPublishGuardCheckedAt: "2026-01-03T00:00:00.000Z",
    platformPublishReady: true,
    platformPublishBlockedReason: null,
    platformPublishDryRunStatus: "ready",
    platformPublishDryRunPayload: {},
    platformPublishDryRunError: null,
    platformPublishDryRunCreatedAt: "2026-01-04T00:00:00.000Z",
    platformPublishDryRunCreatedBy: "editor",
    handoffStatus: "completed",
    handoffPayload: {},
    handoffNotes: null,
    handoffCompletedAt: "2026-01-05T00:00:00.000Z",
    handoffCompletedBy: "editor",
    handoffError: null,
    manualPostStatus: "posted",
    manualPostUrl: "https://blog.naver.com/myid/1",
    manualPostedAt: "2026-01-06T00:00:00.000Z",
    manualPostedBy: "editor",
    manualPostResultNotes: null,
    manualPostError: null,
    manualPostRecordedAt: "2026-01-06T00:00:00.000Z",
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
    performanceStatus: "not_measured",
    performanceSummary: {},
    ...overrides,
  };
}

function makeMetricsRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "metrics-1",
    socialPostId: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    measuredAt: "2026-01-10T00:00:00.000Z",
    recordedBy: "editor",
    views: 1000,
    impressions: 0,
    likes: 50,
    comments: 20,
    shares: 10,
    saves: 5,
    clicks: 0,
    profileVisits: 0,
    follows: 0,
    reach: 0,
    engagementRate: 0.085,
    clickThroughRate: null,
    conversionCount: 0,
    conversionRate: null,
    performanceScore: 70,
    notes: null,
    rawMetrics: {},
    createdAt: "2026-01-10T00:00:00.000Z",
    updatedAt: "2026-01-10T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostById.mockReset();
  createSocialPostMetrics.mockReset();
  updateSocialPostLatestMetrics.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
  createSocialPostMetrics.mockImplementation(async () => makeMetricsRow());
  updateSocialPostLatestMetrics.mockImplementation(async (id, summary) => makeSocialPost({ id, ...summary }));
});

describe("recordSocialPostMetrics", () => {
  it("metrics 입력 시 social_post_metrics row가 생성된다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());

    const result = await recordSocialPostMetrics("social-post-1", { views: 1000, likes: 50, comments: 20, shares: 10, saves: 5 });

    expect(result.success).toBe(true);
    expect(createSocialPostMetrics).toHaveBeenCalledWith(expect.objectContaining({ socialPostId: "social-post-1", views: 1000 }));
  });

  it("metrics 입력 시 social_posts latest_* 컬럼이 업데이트된다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());

    await recordSocialPostMetrics("social-post-1", { views: 1000, likes: 50 });

    expect(updateSocialPostLatestMetrics).toHaveBeenCalledWith(
      "social-post-1",
      expect.objectContaining({ latestMetricsId: "metrics-1" })
    );
  });

  it("음수 지표는 validation 실패로 저장되지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());

    const result = await recordSocialPostMetrics("social-post-1", { views: -5 });

    expect(result.success).toBe(false);
    expect(createSocialPostMetrics).not.toHaveBeenCalled();
  });

  it("manual_post_status가 posted가 아니면 warning을 반환한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ manualPostStatus: "not_recorded" }));

    const result = await recordSocialPostMetrics("social-post-1", { views: 100 });

    expect(result.success).toBe(true);
    expect(result.warnings?.some((w) => w.includes("manual_post_status"))).toBe(true);
  });

  it("존재하지 않는 social post는 실패를 반환한다", async () => {
    getSocialPostById.mockResolvedValue(null);

    const result = await recordSocialPostMetrics("missing", { views: 1 });

    expect(result.success).toBe(false);
    expect(createSocialPostMetrics).not.toHaveBeenCalled();
  });
});

describe("보안 요구사항", () => {
  it("logs에 full notes/full content/API key/auth token이 저장되지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());

    await recordSocialPostMetrics("social-post-1", { views: 100, notes: "매우 긴 메모 텍스트입니다. ".repeat(20) });

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("매우 긴 메모");
    expect(serialized).not.toContain("매우 긴 본문");
  });
});
