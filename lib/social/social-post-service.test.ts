import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";
import type { SocialWritingContext } from "./social-writing-context-builder";

const createSocialPostDraft = vi.fn();
const getSocialPostById = vi.fn();
const updateSocialPostQuality = vi.fn();
const updateSocialPostApproval = vi.fn();
const updateSocialPostPublishStatus = vi.fn();
const savePublishLog = vi.fn();
const logEvent = vi.fn();
const buildSocialWritingContext = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  createSocialPostDraft: (...args: unknown[]) => createSocialPostDraft(...args),
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  updateSocialPostQuality: (...args: unknown[]) => updateSocialPostQuality(...args),
  updateSocialPostApproval: (...args: unknown[]) => updateSocialPostApproval(...args),
  updateSocialPostPublishStatus: (...args: unknown[]) => updateSocialPostPublishStatus(...args),
  SocialPostNotFoundError: class SocialPostNotFoundError extends Error {},
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  savePublishLog: (...args: unknown[]) => savePublishLog(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));
vi.mock("./social-writing-context-builder", () => ({
  buildSocialWritingContext: (...args: unknown[]) => buildSocialWritingContext(...args),
}));

const { generatePlaceholderDraft, runSocialPostQualityGateAndSave, decideSocialPostApproval, exportSocialPostDraft } =
  await import("./social-post-service");

function makeContext(overrides: Partial<SocialWritingContext> = {}): SocialWritingContext {
  return {
    articleId: "article-1",
    title: "장기요양보험 신청 방법",
    articleMode: "monetized_blog",
    targetKeyword: "장기요양보험",
    secondaryKeywords: [],
    seoTitle: null,
    metaDescription: null,
    excerpt: "요약",
    keyPoints: [],
    sourceCount: 3,
    sourceSummaries: [],
    platform: "naver_blog",
    toneStyle: "informational",
    platformConfig: {
      platform: "naver_blog",
      purpose: "search-friendly Korean blog post",
      supportsTitle: true,
      supportsBody: true,
      supportsCaption: false,
      supportsHashtags: true,
      supportsThreads: false,
      supportsImages: true,
      requiresImage: false,
      preferredLength: "medium_to_long",
      exportFormat: "markdown_copy",
      maxLength: 6000,
      minLength: 600,
      recommendedHashtagCount: 5,
      requiresHumanApproval: true,
      allowAutoPublish: false,
      prohibitedPatterns: [],
      qualityChecklistKeys: [],
    },
    toneStyleConfig: {
      toneStyle: "informational",
      label: "정보형",
      description: "",
      guidance: [],
      prohibitedPatterns: [],
    },
    ...overrides,
  };
}

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "제목",
    postBody: "본문",
    caption: null,
    excerpt: null,
    hashtags: [],
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
    generatedAt: "2026-01-01T00:00:00.000Z",
    reviewedAt: null,
    publishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  createSocialPostDraft.mockReset();
  getSocialPostById.mockReset();
  updateSocialPostQuality.mockReset();
  updateSocialPostApproval.mockReset();
  updateSocialPostPublishStatus.mockReset();
  savePublishLog.mockReset();
  logEvent.mockReset();
  buildSocialWritingContext.mockReset();

  buildSocialWritingContext.mockResolvedValue(makeContext());
  createSocialPostDraft.mockResolvedValue(makeSocialPost());
  savePublishLog.mockResolvedValue({});
  logEvent.mockResolvedValue({});
});

describe("generatePlaceholderDraft", () => {
  it("placeholder draft를 생성한다", async () => {
    const result = await generatePlaceholderDraft("article-1", "naver_blog", "informational");

    expect(result.success).toBe(true);
    expect(createSocialPostDraft).toHaveBeenCalledWith(
      expect.objectContaining({ articleId: "article-1", platform: "naver_blog", toneStyle: "informational" })
    );
  });

  it("x 플랫폼은 thread_items placeholder를 생성한다", async () => {
    buildSocialWritingContext.mockResolvedValue(makeContext({ platform: "x", toneStyle: "curiosity" }));

    await generatePlaceholderDraft("article-1", "x", "curiosity");

    expect(createSocialPostDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        threadItems: expect.arrayContaining([expect.objectContaining({ order: 1 })]),
      })
    );
  });

  it("instagram은 caption/card_items placeholder를 생성한다", async () => {
    buildSocialWritingContext.mockResolvedValue(makeContext({ platform: "instagram", toneStyle: "story" }));

    await generatePlaceholderDraft("article-1", "instagram", "story");

    expect(createSocialPostDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        caption: expect.any(String),
        cardItems: expect.arrayContaining([expect.objectContaining({ heading: expect.any(String) })]),
      })
    );
  });

  it("pipeline_logs는 event_name 기준으로 저장된다", async () => {
    await generatePlaceholderDraft("article-1", "naver_blog", "informational");

    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "social_post_placeholder_generation_started" })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "social_post_placeholder_generation_completed" })
    );
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "social_post_created" }));
  });

  it("publish_logs에 target=social_draft로 저장된다", async () => {
    await generatePlaceholderDraft("article-1", "naver_blog", "informational");

    expect(savePublishLog).toHaveBeenCalledWith(expect.objectContaining({ target: "social_draft" }));
  });

  it("실행 중 예외가 발생해도 안전한 실패를 반환한다", async () => {
    buildSocialWritingContext.mockRejectedValue(new Error("기사를 찾을 수 없습니다"));

    const result = await generatePlaceholderDraft("missing", "naver_blog", "informational");

    expect(result.success).toBe(false);
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "social_post_placeholder_generation_failed" })
    );
  });
});

describe("runSocialPostQualityGateAndSave", () => {
  it("quality gate 실행 결과를 저장한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ postBody: "충분히 긴 본문 내용입니다. ".repeat(30) }));
    updateSocialPostQuality.mockResolvedValue(makeSocialPost({ qualityStatus: "ready" }));

    const result = await runSocialPostQualityGateAndSave("social-post-1");

    expect(result.success).toBe(true);
    expect(updateSocialPostQuality).toHaveBeenCalled();
  });

  it("blocked 판정이면 social_quality_gate_blocked 이벤트를 남긴다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ postBody: "" }));
    updateSocialPostQuality.mockResolvedValue(makeSocialPost({ qualityStatus: "blocked" }));

    await runSocialPostQualityGateAndSave("social-post-1");

    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "social_quality_gate_blocked" }));
  });
});

describe("decideSocialPostApproval", () => {
  it("quality_status가 ready가 아니면 승인을 거부한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ qualityStatus: "needs_revision" }));

    const result = await decideSocialPostApproval("social-post-1", "approved", "editor");

    expect(result.success).toBe(false);
    expect(updateSocialPostApproval).not.toHaveBeenCalled();
  });

  it("quality_status가 ready이면 승인이 가능하다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ qualityStatus: "ready" }));
    updateSocialPostApproval.mockResolvedValue(makeSocialPost({ approvalStatus: "approved" }));

    const result = await decideSocialPostApproval("social-post-1", "approved", "editor");

    expect(result.success).toBe(true);
  });
});

describe("exportSocialPostDraft", () => {
  it("승인되지 않은 social post는 export를 거부한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ approvalStatus: "not_requested" }));

    const result = await exportSocialPostDraft("social-post-1");

    expect(result.success).toBe(false);
    expect(updateSocialPostPublishStatus).not.toHaveBeenCalled();
  });

  it("승인된 social post는 export payload를 생성한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ approvalStatus: "approved", platform: "naver_cafe" }));
    updateSocialPostPublishStatus.mockResolvedValue(makeSocialPost({ publishStatus: "exported" }));

    const result = await exportSocialPostDraft("social-post-1");

    expect(result.success).toBe(true);
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "social_export_completed" }));
  });
});

describe("보안 요구사항", () => {
  it("API key/auth token이 logs에 저장되지 않는다", async () => {
    await generatePlaceholderDraft("article-1", "naver_blog", "informational");
    getSocialPostById.mockResolvedValue(makeSocialPost({ approvalStatus: "approved" }));
    updateSocialPostPublishStatus.mockResolvedValue(makeSocialPost({ publishStatus: "exported" }));
    await exportSocialPostDraft("social-post-1");

    const serialized = JSON.stringify([...logEvent.mock.calls, ...savePublishLog.mock.calls]).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("basic ");
  });
});
