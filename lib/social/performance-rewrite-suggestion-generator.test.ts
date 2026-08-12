import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";
import type { PerformanceDiagnosisResult, SocialPostRewriteSuggestion } from "./social-rewrite-types";

const getSocialPostById = vi.fn();
const diagnoseSocialPostPerformance = vi.fn();
const createRewriteSuggestion = vi.fn();
const updateSocialPostRewriteSuggestionSummary = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
}));
vi.mock("./performance-rewrite-diagnosis-service", () => ({
  diagnoseSocialPostPerformance: (...args: unknown[]) => diagnoseSocialPostPerformance(...args),
}));
vi.mock("@/lib/repositories/social-rewrite-suggestions-repository", () => ({
  createRewriteSuggestion: (...args: unknown[]) => createRewriteSuggestion(...args),
  updateSocialPostRewriteSuggestionSummary: (...args: unknown[]) => updateSocialPostRewriteSuggestionSummary(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { generatePerformanceRewriteSuggestion } = await import("./performance-rewrite-suggestion-generator");

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
    latestPerformanceScore: 15,
    performanceStatus: "low",
    performanceSummary: {},
    latestRewriteSuggestionId: null,
    rewriteSuggestionStatus: "not_created",
    rewriteSuggestionCount: 0,
    latestRewriteSuggestedAt: null,
    ...overrides,
  };
}

function makeDiagnosis(overrides: Partial<PerformanceDiagnosisResult> = {}): PerformanceDiagnosisResult {
  return {
    status: "ok",
    diagnosis: { performanceScore: 15, performanceStatus: "low", engagementLow: true },
    improvementTargets: ["engagement_low", "hook_weak"],
    warnings: [],
    blockedReasons: [],
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
    suggestionStatus: "ready",
    diagnosis: {},
    suggestedChanges: { improvementTargets: ["engagement_low"] },
    suggestedTitle: "[개선 제안] 제목",
    suggestedHook: "개선된 도입부",
    suggestedBodyOutline: [],
    suggestedCta: "댓글로 남겨주세요.",
    suggestedHashtags: ["장기요양보험"],
    suggestedThreadItems: [],
    suggestedCardItems: [],
    suggestedToneStyle: "informational",
    riskNotes: [],
    qualityNotes: [],
    expectedImprovementReason: "개선 가능성이 있습니다.",
    generatedBy: "mock",
    generatedAt: "2026-01-11T00:00:00.000Z",
    reviewedBy: null,
    reviewedAt: null,
    appliedAt: null,
    rejectedReason: null,
    createdAt: "2026-01-11T00:00:00.000Z",
    updatedAt: "2026-01-11T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostById.mockReset();
  diagnoseSocialPostPerformance.mockReset();
  createRewriteSuggestion.mockReset();
  updateSocialPostRewriteSuggestionSummary.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
  createRewriteSuggestion.mockImplementation(async (input) => makeSuggestion({ suggestionStatus: input.suggestionStatus }));
  updateSocialPostRewriteSuggestionSummary.mockImplementation(async (id, suggestion) =>
    makeSocialPost({ id, rewriteSuggestionCount: 1, latestRewriteSuggestionId: suggestion.id })
  );
});

describe("generatePerformanceRewriteSuggestion", () => {
  it("low 성과 social post에 대해 suggestion을 생성한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ performanceStatus: "low" }));
    diagnoseSocialPostPerformance.mockResolvedValue(makeDiagnosis());

    const result = await generatePerformanceRewriteSuggestion("social-post-1");

    expect(result.success).toBe(true);
    expect(createRewriteSuggestion).toHaveBeenCalledWith(expect.objectContaining({ suggestionStatus: "ready" }));
  });

  it("needs_review 진단이면 suggestion_status='needs_review'로 생성한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ performanceStatus: "not_measured" }));
    diagnoseSocialPostPerformance.mockResolvedValue(makeDiagnosis({ status: "needs_review", improvementTargets: ["metrics_missing"] }));

    const result = await generatePerformanceRewriteSuggestion("social-post-1");

    expect(result.success).toBe(true);
    expect(createRewriteSuggestion).toHaveBeenCalledWith(expect.objectContaining({ suggestionStatus: "needs_review" }));
  });

  it("good/excellent 성과에도 optional suggestion을 생성할 수 있다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ performanceStatus: "excellent", latestPerformanceScore: 90 }));
    diagnoseSocialPostPerformance.mockResolvedValue(makeDiagnosis({ improvementTargets: [] }));

    const result = await generatePerformanceRewriteSuggestion("social-post-1");

    expect(result.success).toBe(true);
    expect(createRewriteSuggestion).toHaveBeenCalled();
  });

  it("진단이 blocked이면 suggestion을 생성하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());
    diagnoseSocialPostPerformance.mockResolvedValue(makeDiagnosis({ status: "blocked", blockedReasons: ["지원하지 않는 platform입니다"] }));

    const result = await generatePerformanceRewriteSuggestion("social-post-1");

    expect(result.success).toBe(false);
    expect(createRewriteSuggestion).not.toHaveBeenCalled();
  });

  it("warning 문체에서 협박 표현을 생성하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ toneStyle: "warning" }));
    diagnoseSocialPostPerformance.mockResolvedValue(makeDiagnosis());

    await generatePerformanceRewriteSuggestion("social-post-1");

    const call = createRewriteSuggestion.mock.calls[0][0];
    const text = JSON.stringify(call);
    expect(text).not.toContain("협박");
    expect(text).not.toContain("가만두지 않겠다");
  });

  it("loss_aversion 문체에서 과장 손실 표현을 생성하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ toneStyle: "loss_aversion" }));
    diagnoseSocialPostPerformance.mockResolvedValue(makeDiagnosis());

    await generatePerformanceRewriteSuggestion("social-post-1");

    const call = createRewriteSuggestion.mock.calls[0][0];
    const text = JSON.stringify(call);
    expect(text).not.toContain("모르면 큰일");
    expect(text).not.toContain("지금 안 하면 후회");
  });

  it("suggestion 저장 시 social_posts rewrite_suggestion_count가 갱신된다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());
    diagnoseSocialPostPerformance.mockResolvedValue(makeDiagnosis());

    const result = await generatePerformanceRewriteSuggestion("social-post-1");

    expect(updateSocialPostRewriteSuggestionSummary).toHaveBeenCalledWith("social-post-1", expect.objectContaining({ id: "suggestion-1" }));
    expect(result.success).toBe(true);
  });
});

describe("보안 요구사항", () => {
  it("logs에 full post_body/API key/auth token이 저장되지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());
    diagnoseSocialPostPerformance.mockResolvedValue(makeDiagnosis());

    await generatePerformanceRewriteSuggestion("social-post-1");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("충분히 긴 본문");
  });
});
