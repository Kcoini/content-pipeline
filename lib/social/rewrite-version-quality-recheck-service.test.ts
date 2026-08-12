import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getSocialPostById = vi.fn();
const updateSocialPostQuality = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  updateSocialPostQuality: (...args: unknown[]) => updateSocialPostQuality(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { recheckRewriteVersionQuality } = await import("./rewrite-version-quality-recheck-service");

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-2",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "[개선 제안] 제목",
    postBody: "충분히 긴 개선된 본문 내용입니다. ".repeat(40),
    caption: null,
    excerpt: null,
    hashtags: ["장기요양보험"],
    threadItems: [],
    cardItems: [],
    mediaRequirements: {},
    platformMetadata: {},
    generationContext: {},
    qualityStatus: "not_checked",
    qualityScore: null,
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
    latestVersionComparisonId: null,
    versionComparisonStatus: "not_compared",
    versionComparisonScore: null,
    recommendedForRepost: false,
    versionComparisonCheckedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostById.mockReset();
  updateSocialPostQuality.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
  updateSocialPostQuality.mockImplementation(async (id, result) => makeSocialPost({ id, qualityStatus: result.status, qualityScore: result.score }));
});

describe("recheckRewriteVersionQuality", () => {
  it("rewrite version quality recheck를 실행할 수 있다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());

    const result = await recheckRewriteVersionQuality("social-post-2", "editor");

    expect(result.success).toBe(true);
    expect(updateSocialPostQuality).toHaveBeenCalled();
  });

  it("is_rewrite_version=false이면 warning을 남기지만 실행은 계속한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ isRewriteVersion: false }));

    const result = await recheckRewriteVersionQuality("social-post-2");

    expect(result.success).toBe(true);
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("is_rewrite_version=false") }));
  });

  it("quality recheck 후 social_posts quality_status/score가 업데이트된다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ postBody: "충분히 긴 개선된 본문 내용입니다. ".repeat(40) }));

    const result = await recheckRewriteVersionQuality("social-post-2");

    expect(result.socialPost?.qualityStatus).toBeDefined();
    expect(updateSocialPostQuality).toHaveBeenCalledWith("social-post-2", expect.objectContaining({ status: expect.any(String) }));
  });

  it("존재하지 않는 social post는 실패를 반환한다", async () => {
    getSocialPostById.mockResolvedValue(null);

    const result = await recheckRewriteVersionQuality("missing");

    expect(result.success).toBe(false);
  });
});

describe("보안 요구사항", () => {
  it("logs에 full body/API key/auth token이 저장되지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ postBody: "매우 긴 본문 내용입니다. ".repeat(50) }));

    await recheckRewriteVersionQuality("social-post-2");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("매우 긴 본문");
  });
});
