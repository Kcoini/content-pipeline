import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";
import type { SocialPostRewriteSuggestion, SocialPostVersion } from "./social-rewrite-types";

const getSocialPostById = vi.fn();
const createRewriteVersion = vi.fn();
const updateSocialPostVersionStatus = vi.fn();
const listRewriteVersionsByRoot = vi.fn();
const getRewriteSuggestionById = vi.fn();
const updateRewriteSuggestionApplicationStatus = vi.fn();
const markRewriteSuggestionApplied = vi.fn();
const createSocialPostVersion = vi.fn();
const markSocialPostVersionStatus = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  createRewriteVersion: (...args: unknown[]) => createRewriteVersion(...args),
  updateSocialPostVersionStatus: (...args: unknown[]) => updateSocialPostVersionStatus(...args),
  listRewriteVersionsByRoot: (...args: unknown[]) => listRewriteVersionsByRoot(...args),
}));
vi.mock("@/lib/repositories/social-rewrite-suggestions-repository", () => ({
  getRewriteSuggestionById: (...args: unknown[]) => getRewriteSuggestionById(...args),
  updateRewriteSuggestionApplicationStatus: (...args: unknown[]) => updateRewriteSuggestionApplicationStatus(...args),
  markRewriteSuggestionApplied: (...args: unknown[]) => markRewriteSuggestionApplied(...args),
}));
vi.mock("@/lib/repositories/social-post-versions-repository", () => ({
  createSocialPostVersion: (...args: unknown[]) => createSocialPostVersion(...args),
  markSocialPostVersionStatus: (...args: unknown[]) => markSocialPostVersionStatus(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { applyRewriteSuggestion } = await import("./rewrite-application-service");

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "장기요양보험 신청 방법",
    postBody: "충분히 긴 본문 내용입니다. ".repeat(20),
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
    diagnosis: { performanceStatus: "low" },
    suggestedChanges: { improvementTargets: ["hook_weak"] },
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
    expectedImprovementReason: "개선 가능성이 있습니다.",
    generatedBy: "mock",
    generatedAt: "2026-01-11T00:00:00.000Z",
    reviewedBy: "editor",
    reviewedAt: "2026-01-12T00:00:00.000Z",
    appliedAt: null,
    rejectedReason: null,
    createdAt: "2026-01-11T00:00:00.000Z",
    updatedAt: "2026-01-12T00:00:00.000Z",
    appliedSocialPostId: null,
    applicationStatus: "not_applied",
    applicationError: null,
    applicationNotes: null,
    ...overrides,
  };
}

function makeVersion(overrides: Partial<SocialPostVersion> = {}): SocialPostVersion {
  return {
    id: "version-1",
    socialPostId: "social-post-1",
    articleId: "article-1",
    rootSocialPostId: "social-post-1",
    parentSocialPostId: null,
    versionNumber: 1,
    versionLabel: "원본",
    versionStatus: "current",
    platform: "naver_blog",
    toneStyle: "informational",
    rewriteSourceSuggestionId: null,
    changeSummary: {},
    appliedBy: null,
    appliedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostById.mockReset();
  createRewriteVersion.mockReset();
  updateSocialPostVersionStatus.mockReset();
  listRewriteVersionsByRoot.mockReset();
  getRewriteSuggestionById.mockReset();
  updateRewriteSuggestionApplicationStatus.mockReset();
  markRewriteSuggestionApplied.mockReset();
  createSocialPostVersion.mockReset();
  markSocialPostVersionStatus.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});

  listRewriteVersionsByRoot.mockResolvedValue([makeVersion()]);
  createRewriteVersion.mockImplementation(async (input) =>
    makeSocialPost({
      id: "social-post-2",
      postTitle: input.postTitle,
      postBody: input.postBody,
      hashtags: input.hashtags,
      versionNumber: input.versionNumber,
      parentSocialPostId: input.parentSocialPostId,
      rootSocialPostId: input.rootSocialPostId,
      isRewriteVersion: true,
      qualityStatus: "not_checked",
      approvalStatus: "not_requested",
      publishStatus: "not_published",
      exportStatus: "not_exported",
      platformPublishGuardStatus: "not_checked",
      platformPublishReady: false,
      platformPublishDryRunStatus: "not_created",
      handoffStatus: "not_started",
      manualPostStatus: "not_recorded",
      performanceStatus: "not_measured",
      latestPerformanceScore: null,
      rewriteSuggestionStatus: "not_created",
      rewriteSuggestionCount: 0,
    })
  );
  updateSocialPostVersionStatus.mockResolvedValue(makeSocialPost({ versionStatus: "superseded" }));
  createSocialPostVersion.mockResolvedValue(makeVersion({ id: "version-2", versionNumber: 2 }));
  markSocialPostVersionStatus.mockResolvedValue(makeVersion({ versionStatus: "superseded" }));
  markRewriteSuggestionApplied.mockResolvedValue(makeSuggestion({ suggestionStatus: "applied", applicationStatus: "applied", appliedSocialPostId: "social-post-2" }));
  updateRewriteSuggestionApplicationStatus.mockResolvedValue(makeSuggestion({ applicationStatus: "blocked" }));
});

describe("applyRewriteSuggestion", () => {
  it("approved suggestion만 적용 가능하다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion({ suggestionStatus: "approved" }));
    getSocialPostById.mockResolvedValue(makeSocialPost());

    const result = await applyRewriteSuggestion("suggestion-1", "editor");

    expect(result.success).toBe(true);
    expect(createRewriteVersion).toHaveBeenCalled();
  });

  it("rejected suggestion은 적용할 수 없다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion({ suggestionStatus: "rejected" }));
    getSocialPostById.mockResolvedValue(makeSocialPost());

    const result = await applyRewriteSuggestion("suggestion-1");

    expect(result.success).toBe(false);
    expect(createRewriteVersion).not.toHaveBeenCalled();
  });

  it("blocked suggestion은 적용할 수 없다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion({ suggestionStatus: "blocked" }));
    getSocialPostById.mockResolvedValue(makeSocialPost());

    const result = await applyRewriteSuggestion("suggestion-1");

    expect(result.success).toBe(false);
    expect(createRewriteVersion).not.toHaveBeenCalled();
  });

  it("이미 applied된 suggestion은 중복 적용할 수 없다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion({ suggestionStatus: "approved", applicationStatus: "applied" }));
    getSocialPostById.mockResolvedValue(makeSocialPost());

    const result = await applyRewriteSuggestion("suggestion-1");

    expect(result.success).toBe(false);
    expect(createRewriteVersion).not.toHaveBeenCalled();
  });

  it("적용 시 기존 social_post를 덮어쓰지 않고 새 row를 생성한다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion());
    getSocialPostById.mockResolvedValue(makeSocialPost());

    const result = await applyRewriteSuggestion("suggestion-1", "editor");

    expect(result.newSocialPost?.id).not.toBe("social-post-1");
    expect(createRewriteVersion).toHaveBeenCalledWith(
      expect.objectContaining({ parentSocialPostId: "social-post-1", rootSocialPostId: "social-post-1" })
    );
  });

  it("version_number가 기존 최대값+1로 증가한다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion());
    getSocialPostById.mockResolvedValue(makeSocialPost());
    listRewriteVersionsByRoot.mockResolvedValue([makeVersion({ versionNumber: 1 }), makeVersion({ id: "v2", versionNumber: 2 })]);

    await applyRewriteSuggestion("suggestion-1");

    expect(createRewriteVersion).toHaveBeenCalledWith(expect.objectContaining({ versionNumber: 3 }));
  });

  it("social_post_versions row가 생성된다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion());
    getSocialPostById.mockResolvedValue(makeSocialPost());

    await applyRewriteSuggestion("suggestion-1");

    expect(createSocialPostVersion).toHaveBeenCalled();
  });

  it("suggestion application_status/applied_social_post_id가 갱신된다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion());
    getSocialPostById.mockResolvedValue(makeSocialPost());

    await applyRewriteSuggestion("suggestion-1");

    expect(markRewriteSuggestionApplied).toHaveBeenCalledWith("suggestion-1", "social-post-2", null);
  });

  it("새 버전은 quality/approval/publish/export/manual_post/performance 상태가 모두 초기화된다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion());
    getSocialPostById.mockResolvedValue(makeSocialPost());

    const result = await applyRewriteSuggestion("suggestion-1");

    expect(result.newSocialPost?.qualityStatus).toBe("not_checked");
    expect(result.newSocialPost?.approvalStatus).toBe("not_requested");
    expect(result.newSocialPost?.publishStatus).toBe("not_published");
    expect(result.newSocialPost?.exportStatus).toBe("not_exported");
    expect(result.newSocialPost?.manualPostStatus).toBe("not_recorded");
    expect(result.newSocialPost?.performanceStatus).toBe("not_measured");
  });

  it("원본 social_post의 게시 기록(postUrl 등)은 보존된다 (원본을 수정하지 않음)", async () => {
    const original = makeSocialPost({ postUrl: "https://blog.naver.com/myid/1" });
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion());
    getSocialPostById.mockResolvedValue(original);

    await applyRewriteSuggestion("suggestion-1");

    // 원본 객체 자체가 변형되지 않았는지 확인 (in-memory mutation 없음)
    expect(original.postUrl).toBe("https://blog.naver.com/myid/1");
    expect(original.publishStatus).toBe("published");
  });
});

describe("보안 요구사항", () => {
  it("logs에 full body/full suggestion/API key/auth token이 저장되지 않는다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion());
    getSocialPostById.mockResolvedValue(makeSocialPost({ postBody: "매우 긴 원본 본문입니다. ".repeat(30) }));

    await applyRewriteSuggestion("suggestion-1", "editor", "적용 메모");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("매우 긴 원본 본문");
  });
});
