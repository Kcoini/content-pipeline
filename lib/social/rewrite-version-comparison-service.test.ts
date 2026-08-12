import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";
import type { SocialPostVersionComparison } from "./social-rewrite-types";

const getSocialPostForVersionComparison = vi.fn();
const createVersionComparison = vi.fn();
const updateSocialPostVersionComparisonSummary = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostForVersionComparison: (...args: unknown[]) => getSocialPostForVersionComparison(...args),
}));
vi.mock("@/lib/repositories/social-version-comparisons-repository", () => ({
  createVersionComparison: (...args: unknown[]) => createVersionComparison(...args),
  updateSocialPostVersionComparisonSummary: (...args: unknown[]) => updateSocialPostVersionComparisonSummary(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { compareRewriteVersion } = await import("./rewrite-version-comparison-service");

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

function makeComparison(overrides: Partial<SocialPostVersionComparison> = {}): SocialPostVersionComparison {
  return {
    id: "comparison-1",
    articleId: "article-1",
    rootSocialPostId: "social-post-1",
    originalSocialPostId: "social-post-1",
    rewriteSocialPostId: "social-post-2",
    rewriteSourceSuggestionId: null,
    platform: "naver_blog",
    originalVersionNumber: 1,
    rewriteVersionNumber: 2,
    originalQualityStatus: "ready",
    originalQualityScore: 70,
    rewriteQualityStatus: "ready",
    rewriteQualityScore: 90,
    originalPerformanceStatus: "not_measured",
    originalPerformanceScore: null,
    rewritePerformanceStatus: "not_measured",
    rewritePerformanceScore: null,
    comparisonStatus: "rewrite_better",
    comparisonScore: 90,
    recommendedSocialPostId: "social-post-2",
    recommendationReason: "rewrite가 더 좋습니다.",
    comparisonSummary: {},
    checklist: [],
    warnings: [],
    failures: [],
    comparedBy: "editor",
    comparedAt: "2026-01-20T00:00:00.000Z",
    createdAt: "2026-01-20T00:00:00.000Z",
    updatedAt: "2026-01-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostForVersionComparison.mockReset();
  createVersionComparison.mockReset();
  updateSocialPostVersionComparisonSummary.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
  createVersionComparison.mockResolvedValue(makeComparison());
  updateSocialPostVersionComparisonSummary.mockResolvedValue(makeSocialPost({ id: "social-post-2" }));
});

describe("compareRewriteVersion", () => {
  it("rewrite version과 원본을 비교할 수 있다", async () => {
    getSocialPostForVersionComparison.mockImplementation(async (id: string) =>
      id === "social-post-2"
        ? makeSocialPost({ id: "social-post-2", parentSocialPostId: "social-post-1", rewriteAppliedFromSocialPostId: "social-post-1", isRewriteVersion: true, qualityScore: 90 })
        : makeSocialPost({ id: "social-post-1", qualityScore: 70 })
    );

    const result = await compareRewriteVersion("social-post-2", "editor");

    expect(result.success).toBe(true);
    expect(createVersionComparison).toHaveBeenCalled();
    expect(updateSocialPostVersionComparisonSummary).toHaveBeenCalledWith("social-post-2", expect.any(Object));
  });

  it("parent_social_post_id가 없으면 comparison이 blocked된다", async () => {
    getSocialPostForVersionComparison.mockResolvedValue(
      makeSocialPost({ id: "social-post-2", parentSocialPostId: null, rewriteAppliedFromSocialPostId: null, isRewriteVersion: true })
    );

    const result = await compareRewriteVersion("social-post-2");

    expect(result.success).toBe(false);
    expect(createVersionComparison).not.toHaveBeenCalled();
  });

  it("social_post_version_comparisons row가 생성된다", async () => {
    getSocialPostForVersionComparison.mockImplementation(async (id: string) =>
      id === "social-post-2"
        ? makeSocialPost({ id: "social-post-2", parentSocialPostId: "social-post-1", isRewriteVersion: true })
        : makeSocialPost({ id: "social-post-1" })
    );

    await compareRewriteVersion("social-post-2");

    expect(createVersionComparison).toHaveBeenCalledWith(
      expect.objectContaining({ originalSocialPostId: "social-post-1", rewriteSocialPostId: "social-post-2" })
    );
  });

  it("social_posts의 latest_version_comparison_id/version_comparison_status가 업데이트된다", async () => {
    getSocialPostForVersionComparison.mockImplementation(async (id: string) =>
      id === "social-post-2"
        ? makeSocialPost({ id: "social-post-2", parentSocialPostId: "social-post-1", isRewriteVersion: true })
        : makeSocialPost({ id: "social-post-1" })
    );

    const result = await compareRewriteVersion("social-post-2");

    expect(result.success).toBe(true);
    expect(updateSocialPostVersionComparisonSummary).toHaveBeenCalled();
  });
});

describe("보안 요구사항", () => {
  it("logs에 full body/caption/API key/auth token이 저장되지 않는다", async () => {
    getSocialPostForVersionComparison.mockImplementation(async (id: string) =>
      id === "social-post-2"
        ? makeSocialPost({ id: "social-post-2", parentSocialPostId: "social-post-1", isRewriteVersion: true, postBody: "매우 긴 rewrite 본문입니다. ".repeat(30) })
        : makeSocialPost({ id: "social-post-1", postBody: "매우 긴 원본 본문입니다. ".repeat(30) })
    );

    await compareRewriteVersion("social-post-2");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("매우 긴 원본 본문");
    expect(serialized).not.toContain("매우 긴 rewrite 본문");
  });
});
