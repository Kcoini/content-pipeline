import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";
import type { SocialWritingContext } from "./social-writing-context-builder";

const createSocialPostDraft = vi.fn();
const updateSocialPostQuality = vi.fn();
const updateSocialPostPublishStatus = vi.fn();
const logEvent = vi.fn();
const buildSocialWritingContext = vi.fn();
const generateSocialPostWithAI = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  createSocialPostDraft: (...args: unknown[]) => createSocialPostDraft(...args),
  updateSocialPostQuality: (...args: unknown[]) => updateSocialPostQuality(...args),
  updateSocialPostPublishStatus: (...args: unknown[]) => updateSocialPostPublishStatus(...args),
}));
vi.mock("./social-ai-client", () => ({
  generateSocialPostWithAI: (...args: unknown[]) => generateSocialPostWithAI(...args),
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
    searchIntent: null,
    readerPersona: null,
    adSlots: [],
    monetizationScore: null,
    policyRiskScore: null,
    citedSourceIds: [],
    excerpt: "장기요양보험 신청 절차를 정리했습니다. ".repeat(3),
    keyPoints: ["신청은 공단에서 접수", "등급판정까지 30일"],
    sourceCount: 3,
    usableSourceCount: 3,
    sourceSummaries: [{ title: "출처1", publisher: "출처사", summary: "요약" }],
    platform: "naver_blog",
    toneStyle: "informational",
    platformConfig: getPlatformWritingConfig("naver_blog"),
    toneStyleConfig: getToneStyleConfig("informational"),
    safetyRules: ["협박형 문장 금지"],
    outputContractName: "naver-blog.schema.json",
    platformBrief: null,
    evidenceHighlights: [],
    verificationHighlights: [],
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
  updateSocialPostQuality.mockReset();
  updateSocialPostPublishStatus.mockReset();
  logEvent.mockReset();
  buildSocialWritingContext.mockReset();
  generateSocialPostWithAI.mockReset();

  buildSocialWritingContext.mockResolvedValue(makeContext());
  createSocialPostDraft.mockImplementation(async (input) => makeSocialPost(input));
  updateSocialPostQuality.mockImplementation(async (id, result) => makeSocialPost({ id, qualityStatus: result.status, qualityScore: result.score }));
  updateSocialPostPublishStatus.mockImplementation(async (id, patch) => makeSocialPost({ id, publishStatus: patch.status }));
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

  it("wordpress_blog draft를 생성할 수 있다", async () => {
    buildSocialWritingContext.mockResolvedValue(
      makeContext({ platform: "wordpress_blog", platformConfig: getPlatformWritingConfig("wordpress_blog") })
    );

    const result = await generateSocialDraft("article-1", "wordpress_blog", "informational");

    expect(result.success).toBe(true);
    expect(createSocialPostDraft).toHaveBeenCalledWith(
      expect.objectContaining({ postTitle: expect.any(String), postBody: expect.any(String) })
    );
  });

  it("wordpress_blog draft 생성 시 seoTitle/metaDescription/targetKeyword/answerSummary 등 게시용 metadata를 함께 생성해 platformMetadata에 저장한다", async () => {
    buildSocialWritingContext.mockResolvedValue(
      makeContext({ platform: "wordpress_blog", platformConfig: getPlatformWritingConfig("wordpress_blog") })
    );

    await generateSocialDraft("article-1", "wordpress_blog", "informational");

    const call = createSocialPostDraft.mock.calls[0][0];
    expect(call.platformMetadata.seoTitle).toEqual(expect.any(String));
    expect(call.platformMetadata.metaDescription).toEqual(expect.any(String));
    expect(call.platformMetadata.targetKeyword).toEqual(expect.any(String));
    expect(call.platformMetadata.answerSummary).toEqual(expect.any(String));
    expect(call.platformMetadata.eeatNotes === null || typeof call.platformMetadata.eeatNotes === "object").toBe(true);
    expect(call.platformMetadata.geoSummary).toEqual(expect.objectContaining({ keyFacts: [], caveats: [] }));
    expect(call.platformMetadata.monetizationScore).toEqual(expect.any(Number));
    expect(call.platformMetadata.policyRiskScore).toEqual(expect.any(Number));
  });

  it("article에 이미 seoTitle/targetKeyword가 있으면(monetized_blog) wordpress_blog 생성 시 참고용으로 재사용한다", async () => {
    buildSocialWritingContext.mockResolvedValue(
      makeContext({
        platform: "wordpress_blog",
        platformConfig: getPlatformWritingConfig("wordpress_blog"),
        seoTitle: "article SEO 제목",
        targetKeyword: "article 키워드",
      })
    );

    await generateSocialDraft("article-1", "wordpress_blog", "informational");

    const call = createSocialPostDraft.mock.calls[0][0];
    expect(call.platformMetadata.seoTitle).toBe("article SEO 제목");
    expect(call.platformMetadata.targetKeyword).toBe("article 키워드");
  });

  it("wordpress_blog가 아닌 platform은 게시용 metadata를 만들지 않는다 (naver_blog는 영향 없음)", async () => {
    await generateSocialDraft("article-1", "naver_blog", "informational");

    const call = createSocialPostDraft.mock.calls[0][0];
    expect(call.platformMetadata.seoTitle).toBeUndefined();
    expect(call.platformMetadata.answerSummary).toBeUndefined();
  });

  it("naver_cafe draft를 생성할 수 있다", async () => {
    buildSocialWritingContext.mockResolvedValue(
      makeContext({ platform: "naver_cafe", platformConfig: getPlatformWritingConfig("naver_cafe") })
    );

    const result = await generateSocialDraft("article-1", "naver_cafe", "curiosity");

    expect(result.success).toBe(true);
    expect(createSocialPostDraft).toHaveBeenCalledWith(
      expect.objectContaining({ postTitle: expect.any(String), postBody: expect.any(String) })
    );
  });

  it("naver_cafe: AI가 escape된 markdown(\\##, \\**, &#x20;)을 생성해도 저장 전에 plain text로 정리된다 (Phase 3-20)", async () => {
    vi.stubEnv("SOCIAL_AI_GENERATION_ENABLED", "true");
    buildSocialWritingContext.mockResolvedValue(
      makeContext({ platform: "naver_cafe", platformConfig: getPlatformWritingConfig("naver_cafe") })
    );
    generateSocialPostWithAI.mockResolvedValue({
      ok: true,
      output: { post_title: "질문 있어요", post_body: "\\## 제목\n\n\\*\\*굵게\\*\\*&#x20;내용" },
    });

    await generateSocialDraft("article-1", "naver_cafe", "curiosity");

    const call = createSocialPostDraft.mock.calls[0][0];
    expect(call.postBody).not.toMatch(/\\#|\\\*|&#x20;/);
    expect(call.postBody).toContain("제목");
    vi.unstubAllEnvs();
  });

  it("naver_blog는 AI가 markdown을 생성해도 그대로 저장한다(naver_cafe 전용 정리 로직의 영향을 받지 않는다)", async () => {
    vi.stubEnv("SOCIAL_AI_GENERATION_ENABLED", "true");
    buildSocialWritingContext.mockResolvedValue(
      makeContext({ platform: "naver_blog", platformConfig: getPlatformWritingConfig("naver_blog") })
    );
    generateSocialPostWithAI.mockResolvedValue({
      ok: true,
      output: { post_title: "제목", post_body: "## 소제목\n\n**굵게** 내용" },
    });

    await generateSocialDraft("article-1", "naver_blog", "informational");

    const call = createSocialPostDraft.mock.calls[0][0];
    expect(call.postBody).toBe("## 소제목\n\n**굵게** 내용");
    vi.unstubAllEnvs();
  });

  it("threads draft는 post_body를 생성한다", async () => {
    buildSocialWritingContext.mockResolvedValue(
      makeContext({ platform: "threads", platformConfig: getPlatformWritingConfig("threads") })
    );

    const result = await generateSocialDraft("article-1", "threads", "story");

    expect(result.success).toBe(true);
    expect(createSocialPostDraft).toHaveBeenCalledWith(expect.objectContaining({ postBody: expect.any(String) }));
  });

  it("quality gate 결과가 social_posts에 반영된다 (updateSocialPostQuality 호출)", async () => {
    await generateSocialDraft("article-1", "naver_blog", "informational");

    expect(updateSocialPostQuality).toHaveBeenCalledWith(
      "social-post-1",
      expect.objectContaining({ status: expect.any(String), score: expect.any(Number) })
    );
  });

  it("SOCIAL_AI_GENERATION_ENABLED=true이면 social-ai-client를 호출한다", async () => {
    vi.stubEnv("SOCIAL_AI_GENERATION_ENABLED", "true");
    generateSocialPostWithAI.mockResolvedValue({
      ok: true,
      output: { post_title: "AI 제목", post_body: "AI가 생성한 본문입니다." },
      usage: { inputTokens: 120, outputTokens: 80 },
    });

    const result = await generateSocialDraft("article-1", "naver_blog", "informational");

    expect(result.success).toBe(true);
    expect(generateSocialPostWithAI).toHaveBeenCalledTimes(1);
    expect(createSocialPostDraft).toHaveBeenCalledWith(
      expect.objectContaining({ postTitle: "AI 제목", postBody: "AI가 생성한 본문입니다." })
    );
    vi.unstubAllEnvs();
  });

  it("SOCIAL_AI_GENERATION_ENABLED=true인데 AI 호출이 실패하면 안전한 실패를 반환한다", async () => {
    vi.stubEnv("SOCIAL_AI_GENERATION_ENABLED", "true");
    generateSocialPostWithAI.mockResolvedValue({ ok: false, error: "AI 호출 실패" });

    const result = await generateSocialDraft("article-1", "naver_blog", "informational");

    expect(result.success).toBe(false);
    expect(createSocialPostDraft).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("logs에 API로 생성된 full post body가 저장되지 않는다 (AI 모드)", async () => {
    vi.stubEnv("SOCIAL_AI_GENERATION_ENABLED", "true");
    const fullBody = "AI가 생성한 매우 긴 본문입니다. ".repeat(50);
    generateSocialPostWithAI.mockResolvedValue({
      ok: true,
      output: { post_title: "AI 제목", post_body: fullBody },
      usage: { inputTokens: 120, outputTokens: 80 },
    });

    await generateSocialDraft("article-1", "naver_blog", "informational");

    const serialized = JSON.stringify(logEvent.mock.calls);
    expect(serialized).not.toContain(fullBody);
    vi.unstubAllEnvs();
  });

  describe("wordpress_blog single_source_mode(usable source 1개 허용)", () => {
    it("usable source가 0개면 wordpress_blog 생성을 차단한다", async () => {
      buildSocialWritingContext.mockResolvedValue(
        makeContext({ platform: "wordpress_blog", platformConfig: getPlatformWritingConfig("wordpress_blog"), usableSourceCount: 0 })
      );

      const result = await generateSocialDraft("article-1", "wordpress_blog", "informational");

      expect(result.success).toBe(false);
      expect(createSocialPostDraft).not.toHaveBeenCalled();
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "social_draft_generation_blocked_no_source" })
      );
    });

    it("usable source가 1개면 wordpress_blog 생성을 허용한다", async () => {
      buildSocialWritingContext.mockResolvedValue(
        makeContext({ platform: "wordpress_blog", platformConfig: getPlatformWritingConfig("wordpress_blog"), usableSourceCount: 1 })
      );

      const result = await generateSocialDraft("article-1", "wordpress_blog", "informational");

      expect(result.success).toBe(true);
      expect(createSocialPostDraft).toHaveBeenCalled();
    });

    it("usable source가 1개면 platformMetadata에 sourceMode=single_source/singleSourceMode=true/sourceLimitWarning을 저장한다", async () => {
      buildSocialWritingContext.mockResolvedValue(
        makeContext({ platform: "wordpress_blog", platformConfig: getPlatformWritingConfig("wordpress_blog"), usableSourceCount: 1 })
      );

      await generateSocialDraft("article-1", "wordpress_blog", "informational");

      const call = createSocialPostDraft.mock.calls[0][0];
      expect(call.platformMetadata.sourceMode).toBe("single_source");
      expect(call.platformMetadata.usableSourceCount).toBe(1);
      expect(call.platformMetadata.singleSourceMode).toBe(true);
      expect(call.platformMetadata.sourceLimitWarning).toEqual(expect.any(String));
    });

    it("single_source_mode 본문에는 확인 필요 사항 섹션이 최소 1,500자 이상으로 포함된다", async () => {
      buildSocialWritingContext.mockResolvedValue(
        makeContext({ platform: "wordpress_blog", platformConfig: getPlatformWritingConfig("wordpress_blog"), usableSourceCount: 1 })
      );

      await generateSocialDraft("article-1", "wordpress_blog", "informational");

      const call = createSocialPostDraft.mock.calls[0][0];
      expect(call.postBody).toContain("확인 필요 사항");
    });

    it("usable source가 2개 이상이면 sourceMode=multi_source로 저장한다 (기존 normal 모드)", async () => {
      buildSocialWritingContext.mockResolvedValue(
        makeContext({ platform: "wordpress_blog", platformConfig: getPlatformWritingConfig("wordpress_blog"), usableSourceCount: 2 })
      );

      await generateSocialDraft("article-1", "wordpress_blog", "informational");

      const call = createSocialPostDraft.mock.calls[0][0];
      expect(call.platformMetadata.sourceMode).toBe("multi_source");
      expect(call.platformMetadata.singleSourceMode).toBe(false);
      expect(call.platformMetadata.sourceLimitWarning).toBeUndefined();
    });

    it("naver_blog는 usable source가 0개여도 차단되지 않는다 (wordpress_blog 전용 제한)", async () => {
      buildSocialWritingContext.mockResolvedValue(makeContext({ platform: "naver_blog", usableSourceCount: 0 }));

      const result = await generateSocialDraft("article-1", "naver_blog", "informational");

      expect(result.success).toBe(true);
      expect(createSocialPostDraft).toHaveBeenCalled();
    });
  });
});
