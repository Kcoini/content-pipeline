import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";
import type { SocialPostRewriteSuggestion } from "./social-rewrite-types";

const getSocialPostById = vi.fn();
const getRewriteSuggestionById = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
}));
vi.mock("@/lib/repositories/social-rewrite-suggestions-repository", () => ({
  getRewriteSuggestionById: (...args: unknown[]) => getRewriteSuggestionById(...args),
}));

const { buildRewriteApplicationPreview } = await import("./rewrite-application-preview-builder");

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
    qualityScore: 90,
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
    latestPerformanceScore: 15,
    performanceStatus: "low",
    performanceSummary: {},
    latestRewriteSuggestionId: null,
    rewriteSuggestionStatus: "suggested",
    rewriteSuggestionCount: 1,
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
    ...overrides,
  };
}

function makeSuggestion(overrides: Partial<SocialPostRewriteSuggestion> = {}): SocialPostRewriteSuggestion {
  return {
    id: "suggestion-1",
    socialPostId: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    originalPerformanceStatus: "low",
    originalPerformanceScore: 15,
    suggestionStatus: "approved",
    diagnosis: {},
    suggestedChanges: {},
    suggestedTitle: "[개선 제안] 새 제목",
    suggestedHook: "개선된 도입부",
    suggestedBodyOutline: [],
    suggestedCta: "댓글로 남겨주세요.",
    suggestedHashtags: ["장기요양보험", "노인장기요양"],
    suggestedThreadItems: [],
    suggestedCardItems: [],
    suggestedToneStyle: null,
    riskNotes: [],
    qualityNotes: [],
    expectedImprovementReason: null,
    generatedBy: "mock",
    generatedAt: "2026-01-11T00:00:00.000Z",
    reviewedBy: null,
    reviewedAt: null,
    appliedAt: null,
    rejectedReason: null,
    createdAt: "2026-01-11T00:00:00.000Z",
    updatedAt: "2026-01-11T00:00:00.000Z",
    appliedSocialPostId: null,
    applicationStatus: "not_applied",
    applicationError: null,
    applicationNotes: null,
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostById.mockReset();
  getRewriteSuggestionById.mockReset();
});

describe("buildRewriteApplicationPreview", () => {
  it("정상적인 경우 original/proposed/changes를 반환한다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion());
    getSocialPostById.mockResolvedValue(makeSocialPost());

    const result = await buildRewriteApplicationPreview("suggestion-1");

    expect(result.ok).toBe(true);
    expect(result.original?.socialPostId).toBe("social-post-1");
    expect(result.proposed?.suggestedTitle).toContain("[개선 제안]");
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it("blocked 상태 suggestion은 blockedReasons를 포함한다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion({ suggestionStatus: "blocked" }));
    getSocialPostById.mockResolvedValue(makeSocialPost());

    const result = await buildRewriteApplicationPreview("suggestion-1");

    expect(result.blockedReasons.length).toBeGreaterThan(0);
  });

  it("approved가 아니면 warning을 반환한다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion({ suggestionStatus: "ready" }));
    getSocialPostById.mockResolvedValue(makeSocialPost());

    const result = await buildRewriteApplicationPreview("suggestion-1");

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("존재하지 않는 suggestion은 ok=false를 반환한다", async () => {
    getRewriteSuggestionById.mockResolvedValue(null);

    const result = await buildRewriteApplicationPreview("missing");

    expect(result.ok).toBe(false);
  });

  it("full body 전문을 그대로 노출하지 않는다 (미리보기는 잘림)", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion());
    getSocialPostById.mockResolvedValue(makeSocialPost({ postTitle: "가".repeat(200) }));

    const result = await buildRewriteApplicationPreview("suggestion-1");

    expect((result.original?.postTitlePreview ?? "").length).toBeLessThan(200);
  });
});
