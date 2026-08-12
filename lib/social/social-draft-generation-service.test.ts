import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";
import type { SocialWritingContext } from "./social-writing-context-builder";

const createSocialPostDraft = vi.fn();
const logEvent = vi.fn();
const buildSocialWritingContext = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  createSocialPostDraft: (...args: unknown[]) => createSocialPostDraft(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));
vi.mock("./social-writing-context-builder", async () => {
  const actual = await vi.importActual<typeof import("./social-writing-context-builder")>(
    "./social-writing-context-builder"
  );
  return { ...actual, buildSocialWritingContext: (...args: unknown[]) => buildSocialWritingContext(...args) };
});

const { generateSocialDraft } = await import("./social-draft-generation-service");
const { getPlatformWritingConfig } = await import("./platform-writing-config");
const { getToneStyleConfig } = await import("./tone-style-config");

function makeContext(overrides: Partial<SocialWritingContext> = {}): SocialWritingContext {
  return {
    articleId: "article-1",
    title: "장기요양보험 신청 방법",
    articleMode: "monetized_blog",
    targetKeyword: "장기요양보험",
    secondaryKeywords: [],
    seoTitle: null,
    metaDescription: null,
    excerpt: "장기요양보험 신청 절차를 정리했습니다. ".repeat(3),
    keyPoints: ["신청은 공단에서 접수", "등급판정까지 30일"],
    sourceCount: 3,
    sourceSummaries: [{ title: "출처1", publisher: "출처사", summary: "요약" }],
    platform: "naver_blog",
    toneStyle: "informational",
    platformConfig: getPlatformWritingConfig("naver_blog"),
    toneStyleConfig: getToneStyleConfig("informational"),
    safetyRules: ["협박형 문장 금지"],
    outputContractName: "naver-blog.schema.json",
    ...overrides,
  };
}

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "[mock] 제목",
    postBody: "[mock] 본문",
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
  logEvent.mockReset();
  buildSocialWritingContext.mockReset();

  buildSocialWritingContext.mockResolvedValue(makeContext());
  createSocialPostDraft.mockImplementation(async (input) => makeSocialPost(input));
  logEvent.mockResolvedValue({});
});

describe("generateSocialDraft", () => {
  it("naver_blog draft를 mock으로 생성하고 저장한다", async () => {
    const result = await generateSocialDraft("article-1", "naver_blog", "informational");

    expect(result.success).toBe(true);
    expect(result.valid).toBe(true);
    expect(createSocialPostDraft).toHaveBeenCalledWith(
      expect.objectContaining({ articleId: "article-1", platform: "naver_blog", toneStyle: "informational" })
    );
  });

  it("x 플랫폼은 thread_items를 생성한다", async () => {
    buildSocialWritingContext.mockResolvedValue(
      makeContext({ platform: "x", toneStyle: "curiosity", platformConfig: getPlatformWritingConfig("x") })
    );

    const result = await generateSocialDraft("article-1", "x", "curiosity");

    expect(result.success).toBe(true);
    expect(createSocialPostDraft).toHaveBeenCalledWith(
      expect.objectContaining({ threadItems: expect.arrayContaining([expect.objectContaining({ order: 1 })]) })
    );
  });

  it("instagram은 caption/hashtags/card_items를 생성한다", async () => {
    buildSocialWritingContext.mockResolvedValue(
      makeContext({ platform: "instagram", toneStyle: "story", platformConfig: getPlatformWritingConfig("instagram") })
    );

    const result = await generateSocialDraft("article-1", "instagram", "story");

    expect(result.success).toBe(true);
    expect(createSocialPostDraft).toHaveBeenCalledWith(
      expect.objectContaining({ caption: expect.any(String), hashtags: expect.arrayContaining([expect.any(String)]) })
    );
  });

  it("pipeline_logs는 event_name 기준으로 저장된다 (prompt assembly/contract validation/draft generation)", async () => {
    await generateSocialDraft("article-1", "naver_blog", "informational");

    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "social_draft_generation_started" }));
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "social_prompt_assembly_started" }));
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "social_prompt_assembly_completed" }));
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "social_contract_validation_started" }));
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "social_contract_validation_completed" }));
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "social_draft_generation_completed" }));
  });

  it("실행 중 예외가 발생해도 안전한 실패를 반환한다", async () => {
    buildSocialWritingContext.mockRejectedValue(new Error("기사를 찾을 수 없습니다"));

    const result = await generateSocialDraft("missing", "naver_blog", "informational");

    expect(result.success).toBe(false);
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "social_draft_generation_failed" }));
  });

  it("logs에 full prompt/article content/API key/auth token이 저장되지 않는다", async () => {
    await generateSocialDraft("article-1", "naver_blog", "informational");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    // context.excerpt(원문에서 파생된 긴 텍스트)가 통째로 로그에 들어가지 않아야 함
    expect(serialized).not.toContain("장기요양보험 신청 절차를 정리했습니다. 장기요양보험");
  });
});
