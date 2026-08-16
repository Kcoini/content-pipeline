import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPlatformPublishAdapter } from "./index";
import type { PlatformApiPublishPayloadInput } from "../platform-publish-adapter";
import type { SocialPlatform } from "../social-platform-types";

const ENV_KEYS = ["PLATFORM_API_PUBLISHING_ENABLED", "WORDPRESS_API_PUBLISH_ENABLED"] as const;
let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
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

function makeInput(platform: SocialPlatform, overrides: Partial<PlatformApiPublishPayloadInput> = {}): PlatformApiPublishPayloadInput {
  return {
    socialPostId: "post-1",
    articleId: "article-1",
    platform,
    postTitle: "제목",
    postBody: "본문 내용입니다.",
    caption: "caption 내용",
    excerpt: "요약",
    hashtags: ["ai", "블로그"],
    threadItems: [],
    cardItems: [{ order: 1, heading: "slide1", body: "내용" }],
    mediaRequirements: { count: 1 },
    postUrl: null,
    ...overrides,
  };
}

const PLATFORMS: SocialPlatform[] = ["wordpress_blog", "naver_blog", "naver_cafe", "x", "threads", "instagram"];

describe.each(PLATFORMS)("%s adapter", (platform) => {
  it("adapter를 생성할 수 있고 platform이 일치한다", () => {
    const adapter = getPlatformPublishAdapter(platform);
    expect(adapter.platform).toBe(platform);
  });

  it("buildDryRunPayload가 payloadShape를 만든다", async () => {
    const adapter = getPlatformPublishAdapter(platform);
    const payload = await adapter.buildDryRunPayload(makeInput(platform));
    expect(payload.platform).toBe(platform);
    expect(payload.payloadShape).toBeTypeOf("object");
  });

  it("validatePayload가 유효/무효 여부를 판단한다", async () => {
    const adapter = getPlatformPublishAdapter(platform);
    const payload = await adapter.buildDryRunPayload(makeInput(platform));
    const validation = await adapter.validatePayload(payload);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("필수 필드가 비어있으면 validatePayload가 invalid를 반환한다", async () => {
    const adapter = getPlatformPublishAdapter(platform);
    const emptyInput = makeInput(platform, {
      postTitle: null,
      postBody: null,
      caption: null,
      excerpt: null,
      hashtags: [],
      threadItems: [],
      cardItems: [],
      mediaRequirements: {},
    });
    const payload = await adapter.buildDryRunPayload(emptyInput);
    const validation = await adapter.validatePayload(payload);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it("publish()는 항상 disabled/not_implemented를 반환한다 (실제 게시 없음)", async () => {
    const adapter = getPlatformPublishAdapter(platform);
    const payload = await adapter.buildDryRunPayload(makeInput(platform));
    const result = await adapter.publish?.(payload);
    expect(result?.success).toBe(false);
    expect(["disabled", "not_implemented"]).toContain(result?.status);
  });

  it("checkReadiness는 readiness 결과를 반환한다(외부 호출 없이)", async () => {
    const adapter = getPlatformPublishAdapter(platform);
    const readiness = await adapter.checkReadiness();
    expect(readiness.platform).toBe(platform);
  });

  it("어떤 함수도 전역 fetch를 호출하지 않는다", async () => {
    const fetchSpy = vi.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    try {
      const adapter = getPlatformPublishAdapter(platform);
      const payload = await adapter.buildDryRunPayload(makeInput(platform));
      await adapter.validatePayload(payload);
      await adapter.checkReadiness();
      await adapter.publish?.(payload);
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
