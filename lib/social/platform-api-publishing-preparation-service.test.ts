import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSocialPostForApiPublishPreparation = vi.fn();
const updateApiPublishPreparationSummary = vi.fn();
const getSocialPostById = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostForApiPublishPreparation: (...args: unknown[]) => getSocialPostForApiPublishPreparation(...args),
  updateApiPublishPreparationSummary: (...args: unknown[]) => updateApiPublishPreparationSummary(...args),
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { preparePlatformApiPublishing } = await import("./platform-api-publishing-preparation-service");

const ENV_KEYS = ["PLATFORM_API_PUBLISHING_ENABLED", "WORDPRESS_API_PUBLISH_ENABLED", "WORDPRESS_BASE_URL", "WORDPRESS_USERNAME", "WORDPRESS_APP_PASSWORD"] as const;
let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  getSocialPostForApiPublishPreparation.mockReset();
  updateApiPublishPreparationSummary.mockReset();
  getSocialPostById.mockReset();
  logEvent.mockReset();
  updateApiPublishPreparationSummary.mockResolvedValue({});

  originalEnv = {};
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function makeSocialPost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    articleId: "article-1",
    platform: "wordpress_blog",
    postTitle: "제목",
    postBody: "본문",
    caption: null,
    excerpt: null,
    hashtags: [],
    threadItems: [],
    cardItems: [],
    mediaRequirements: {},
    postUrl: null,
    qualityStatus: "ready",
    approvalStatus: "approved",
    exportStatus: "ready",
    platformPublishGuardStatus: "ready",
    platformPublishReady: true,
    platformPublishDryRunStatus: "ready",
    handoffStatus: "completed",
    publishStatus: "not_published",
    manualPostStatus: "not_recorded",
    isRewriteVersion: false,
    ...overrides,
  };
}

describe("preparePlatformApiPublishing", () => {
  it("social post를 찾을 수 없으면 예외를 던진다", async () => {
    getSocialPostForApiPublishPreparation.mockResolvedValue(null);

    await expect(preparePlatformApiPublishing("missing")).rejects.toThrow();
  });

  it("준비 결과(readiness/eligibility/dryRunPayload)를 반환한다", async () => {
    const post = makeSocialPost();
    getSocialPostForApiPublishPreparation.mockResolvedValue(post);
    getSocialPostById.mockResolvedValue(post);

    const result = await preparePlatformApiPublishing("post-1", "tester");

    expect(result.socialPostId).toBe("post-1");
    expect(result.platform).toBe("wordpress_blog");
    expect(result.readiness.status).toBe("disabled"); // feature flag가 꺼져 있으므로
    expect(result.dryRunPayload).not.toBeNull();
  });

  it("social_posts의 preparation summary를 갱신한다", async () => {
    const post = makeSocialPost();
    getSocialPostForApiPublishPreparation.mockResolvedValue(post);
    getSocialPostById.mockResolvedValue(post);

    await preparePlatformApiPublishing("post-1", "tester");

    expect(updateApiPublishPreparationSummary).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({ preparationStatus: expect.any(String), preparedBy: "tester" })
    );
  });

  it("logEvent 호출의 details에 full post_body/API key/token을 담지 않는다", async () => {
    const post = makeSocialPost({ postBody: "전체 본문 원문입니다 - 절대 로그에 남으면 안 됨" });
    getSocialPostForApiPublishPreparation.mockResolvedValue(post);
    getSocialPostById.mockResolvedValue(post);

    await preparePlatformApiPublishing("post-1", "tester");

    for (const call of logEvent.mock.calls) {
      const details = call[0]?.details;
      const serialized = JSON.stringify(details ?? {});
      expect(serialized).not.toContain("전체 본문 원문입니다");
      expect(serialized.toLowerCase()).not.toContain("token");
      expect(serialized.toLowerCase()).not.toContain("api_key");
      expect(serialized.toLowerCase()).not.toContain("authorization");
    }
  });
});
