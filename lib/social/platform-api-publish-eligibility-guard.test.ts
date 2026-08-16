import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSocialPostById = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
}));

const { checkPlatformApiPublishEligibility } = await import("./platform-api-publish-eligibility-guard");

const ENV_KEYS = ["PLATFORM_API_PUBLISHING_ENABLED", "WORDPRESS_API_PUBLISH_ENABLED", "WORDPRESS_BASE_URL", "WORDPRESS_USERNAME", "WORDPRESS_APP_PASSWORD"] as const;
let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  getSocialPostById.mockReset();
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
    platform: "wordpress_blog",
    qualityStatus: "ready",
    approvalStatus: "approved",
    exportStatus: "ready",
    platformPublishGuardStatus: "ready",
    platformPublishReady: true,
    platformPublishDryRunStatus: "ready",
    handoffStatus: "completed",
    publishStatus: "not_published",
    manualPostStatus: "not_recorded",
    ...overrides,
  };
}

describe("checkPlatformApiPublishEligibility", () => {
  it("social post가 없으면 둘 다 false다", async () => {
    getSocialPostById.mockResolvedValue(null);
    const result = await checkPlatformApiPublishEligibility("missing");
    expect(result.eligibleForDryRun).toBe(false);
    expect(result.eligibleForActualPublish).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it("quality_status가 ready가 아니면 blocker다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ qualityStatus: "not_checked" }));
    const result = await checkPlatformApiPublishEligibility("post-1");
    expect(result.blockers.some((b) => b.includes("quality_status"))).toBe(true);
  });

  it("approval_status가 approved가 아니면 blocker다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ approvalStatus: "pending_review" }));
    const result = await checkPlatformApiPublishEligibility("post-1");
    expect(result.blockers.some((b) => b.includes("approval_status"))).toBe(true);
  });

  it("publish_status가 published면 blocker다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ publishStatus: "published" }));
    const result = await checkPlatformApiPublishEligibility("post-1");
    expect(result.blockers.some((b) => b.includes("published"))).toBe(true);
  });

  it("manual_post_status가 posted면 warning이다(blocker 아님)", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ manualPostStatus: "posted" }));
    const result = await checkPlatformApiPublishEligibility("post-1");
    expect(result.warnings.some((w) => w.includes("posted"))).toBe(true);
    expect(result.blockers.some((b) => b.includes("manual_post_status"))).toBe(false);
  });

  it("모든 조건이 충족되면 eligibleForDryRun=true다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());
    const result = await checkPlatformApiPublishEligibility("post-1");
    expect(result.eligibleForDryRun).toBe(true);
  });

  it("feature flag가 disabled이면 조건이 모두 충족돼도 eligibleForActualPublish는 false다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());
    // PLATFORM_API_PUBLISHING_ENABLED를 설정하지 않음 → disabled
    const result = await checkPlatformApiPublishEligibility("post-1");
    expect(result.eligibleForActualPublish).toBe(false);
  });

  it("PLATFORM_API_DRY_RUN_ONLY가 기본값(true)이면 eligibleForActualPublish는 false다", async () => {
    process.env.PLATFORM_API_PUBLISHING_ENABLED = "true";
    process.env.WORDPRESS_API_PUBLISH_ENABLED = "true";
    process.env.WORDPRESS_BASE_URL = "https://example.com";
    process.env.WORDPRESS_USERNAME = "user";
    process.env.WORDPRESS_APP_PASSWORD = "pass";
    getSocialPostById.mockResolvedValue(makeSocialPost());

    const result = await checkPlatformApiPublishEligibility("post-1");

    expect(result.eligibleForActualPublish).toBe(false);
    expect(result.eligibleForDryRun).toBe(true);
  });
});
