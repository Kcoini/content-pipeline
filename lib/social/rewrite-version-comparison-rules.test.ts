import { describe, expect, it } from "vitest";
import {
  compareVersionQuality,
  comparePlatformFit,
  compareToneFit,
  compareStructure,
  calculateVersionComparisonScore,
  decideRecommendedVersion,
} from "./rewrite-version-comparison-rules";
import type { SocialPost } from "./social-platform-types";

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "장기요양보험 신청 방법 총정리",
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

describe("compareVersionQuality / comparePlatformFit / compareToneFit / compareStructure", () => {
  it("금지 표현이 있으면 compareToneFit이 blocked 항목을 반환한다", () => {
    const rewrite = makeSocialPost({ postBody: "수익 보장 상품입니다." });
    const checklist = compareToneFit(makeSocialPost(), rewrite);
    expect(checklist.some((c) => c.status === "blocked")).toBe(true);
  });

  it("x는 thread item 수/길이를 평가한다", () => {
    const rewrite = makeSocialPost({ platform: "x", threadItems: [{ order: 1, text: "짧은 트윗" }] });
    const checklist = compareStructure(makeSocialPost({ platform: "x" }), rewrite);
    expect(checklist.some((c) => c.key === "x_thread_item_count")).toBe(true);
  });

  it("instagram은 caption/hashtags/card_items/media_requirements를 평가한다", () => {
    const rewrite = makeSocialPost({ platform: "instagram", caption: "캡션", cardItems: [{ order: 1, heading: "h", body: "b" }] });
    const checklist = compareStructure(makeSocialPost({ platform: "instagram" }), rewrite);
    const keys = checklist.map((c) => c.key);
    expect(keys).toContain("instagram_caption_present");
    expect(keys).toContain("instagram_card_items_present");
    expect(keys).toContain("instagram_media_requirements");
  });

  it("comparePlatformFit/compareVersionQuality는 비어있지 않은 checklist를 반환한다", () => {
    const original = makeSocialPost();
    const rewrite = makeSocialPost({ id: "social-post-2", qualityScore: 80 });
    expect(compareVersionQuality(original, rewrite).length).toBeGreaterThan(0);
    expect(comparePlatformFit(original, rewrite).length).toBeGreaterThan(0);
  });
});

describe("calculateVersionComparisonScore", () => {
  it("모두 pass면 100점이다", () => {
    expect(calculateVersionComparisonScore({ checklist: [{ key: "a", label: "a", status: "pass", message: "" }] })).toBe(100);
  });

  it("빈 checklist는 0점이다", () => {
    expect(calculateVersionComparisonScore({ checklist: [] })).toBe(0);
  });
});

describe("decideRecommendedVersion", () => {
  it("rewrite quality_score가 원본보다 10점 이상 높으면 rewrite_better다", () => {
    const original = makeSocialPost({ qualityScore: 60, qualityStatus: "ready" });
    const rewrite = makeSocialPost({ id: "social-post-2", qualityScore: 90, qualityStatus: "ready" });
    const result = decideRecommendedVersion({ original, rewrite, checklist: [] });
    expect(result.comparisonStatus).toBe("rewrite_better");
    expect(result.recommendedSocialPostId).toBe("social-post-2");
    expect(result.recommendedForRepost).toBe(true);
  });

  it("rewrite가 blocked이면 blocked checklist가 있을 때 blocked를 반환한다", () => {
    const original = makeSocialPost({ qualityStatus: "ready" });
    const rewrite = makeSocialPost({ id: "social-post-2", qualityStatus: "blocked" });
    const result = decideRecommendedVersion({
      original,
      rewrite,
      checklist: [{ key: "x", label: "x", status: "blocked", message: "금지 표현" }],
    });
    expect(result.comparisonStatus).toBe("blocked");
    expect(result.recommendedForRepost).toBe(false);
  });

  it("rewrite가 blocked이고 checklist에 blocked 항목이 없으면 original_better다", () => {
    const original = makeSocialPost({ qualityStatus: "ready" });
    const rewrite = makeSocialPost({ id: "social-post-2", qualityStatus: "blocked" });
    const result = decideRecommendedVersion({ original, rewrite, checklist: [] });
    expect(result.comparisonStatus).toBe("original_better");
  });

  it("original이 ready이고 rewrite가 needs_revision이면 original_better다", () => {
    const original = makeSocialPost({ qualityStatus: "ready", qualityScore: 90 });
    const rewrite = makeSocialPost({ id: "social-post-2", qualityStatus: "needs_revision", qualityScore: 50 });
    const result = decideRecommendedVersion({ original, rewrite, checklist: [] });
    expect(result.comparisonStatus).toBe("original_better");
  });

  it("둘 다 ready이고 점수 차이가 작으면 similar다", () => {
    const original = makeSocialPost({ qualityStatus: "ready", qualityScore: 85 });
    const rewrite = makeSocialPost({ id: "social-post-2", qualityStatus: "ready", qualityScore: 88 });
    const result = decideRecommendedVersion({ original, rewrite, checklist: [] });
    expect(result.comparisonStatus).toBe("similar");
  });

  it("performance_score가 없어도 비교 가능하다 (quality 중심)", () => {
    const original = makeSocialPost({ qualityStatus: "ready", qualityScore: 60, performanceStatus: "not_measured" });
    const rewrite = makeSocialPost({ id: "social-post-2", qualityStatus: "ready", qualityScore: 90, performanceStatus: "not_measured" });
    const result = decideRecommendedVersion({ original, rewrite, checklist: [] });
    expect(result.comparisonStatus).toBe("rewrite_better");
  });

  it("quality_status가 not_checked이면 needs_review다", () => {
    const original = makeSocialPost({ qualityStatus: "ready" });
    const rewrite = makeSocialPost({ id: "social-post-2", qualityStatus: "not_checked" });
    const result = decideRecommendedVersion({ original, rewrite, checklist: [] });
    expect(result.comparisonStatus).toBe("needs_review");
  });
});
