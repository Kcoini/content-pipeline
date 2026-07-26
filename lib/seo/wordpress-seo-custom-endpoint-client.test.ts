import { afterEach, describe, expect, it, vi } from "vitest";
import {
  updateRankMathSeoViaCustomEndpoint,
  isSeoCustomEndpointEnabled,
  getSeoCustomEndpointPath,
} from "./wordpress-seo-custom-endpoint-client";

const ENV_KEYS = [
  "WORDPRESS_BASE_URL",
  "WORDPRESS_USERNAME",
  "WORDPRESS_APP_PASSWORD",
  "WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED",
  "WORDPRESS_SEO_CUSTOM_ENDPOINT_PATH",
] as const;

function clearWordPressEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function setWordPressEnv() {
  process.env.WORDPRESS_BASE_URL = "https://example-blog.test";
  process.env.WORDPRESS_USERNAME = "test-user";
  process.env.WORDPRESS_APP_PASSWORD = "dummy-app-password-for-tests";
}

describe("isSeoCustomEndpointEnabled / getSeoCustomEndpointPath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    clearWordPressEnv();
  });

  it("기본값은 false다", () => {
    delete process.env.WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED;
    expect(isSeoCustomEndpointEnabled()).toBe(false);
  });

  it("true로 설정하면 true를 반환한다", () => {
    vi.stubEnv("WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED", "true");
    expect(isSeoCustomEndpointEnabled()).toBe(true);
  });

  it("경로가 없으면 기본 경로를 반환한다", () => {
    delete process.env.WORDPRESS_SEO_CUSTOM_ENDPOINT_PATH;
    expect(getSeoCustomEndpointPath()).toBe("/wp-json/ai-pipeline/v1/seo-meta");
  });

  it("경로가 설정되어 있으면 그 값을 반환한다", () => {
    vi.stubEnv("WORDPRESS_SEO_CUSTOM_ENDPOINT_PATH", "/wp-json/custom/v1/seo");
    expect(getSeoCustomEndpointPath()).toBe("/wp-json/custom/v1/seo");
  });
});

describe("updateRankMathSeoViaCustomEndpoint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearWordPressEnv();
  });

  const input = {
    postId: 42,
    seoTitle: "SEO 제목",
    metaDescription: "메타 설명",
    focusKeyword: "타깃 키워드",
    secondaryKeywords: ["보조1", "보조2"],
  };

  it("환경변수가 없으면 실제 fetch 호출 없이 실패를 반환한다", async () => {
    clearWordPressEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateRankMathSeoViaCustomEndpoint(input);

    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("올바른 endpoint/payload로 POST 요청을 보낸다", async () => {
    setWordPressEnv();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          postId: 42,
          provider: "rank_math",
          updatedKeys: ["rank_math_title", "rank_math_description", "rank_math_focus_keyword"],
          verified: true,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateRankMathSeoViaCustomEndpoint(input);

    expect(result.success).toBe(true);
    const [endpoint, init] = fetchMock.mock.calls[0];
    expect(String(endpoint)).toBe("https://example-blog.test/wp-json/ai-pipeline/v1/seo-meta");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      postId: 42,
      provider: "rank_math",
      seoTitle: "SEO 제목",
      metaDescription: "메타 설명",
      focusKeyword: "타깃 키워드",
      secondaryKeywords: ["보조1", "보조2"],
    });
  });

  it("Authorization header에 Basic auth를 사용하고 password를 평문으로 보내지 않는다", async () => {
    setWordPressEnv();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, postId: 42, updatedKeys: [], verified: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateRankMathSeoViaCustomEndpoint(input);

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Basic /);
    expect(headers.Authorization).not.toContain("dummy-app-password-for-tests");
  });

  it("성공 시 postId/updatedKeys/verified를 반환한다", async () => {
    setWordPressEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, postId: 99, updatedKeys: ["rank_math_title"], verified: true }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    const result = await updateRankMathSeoViaCustomEndpoint(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.postId).toBe(99);
      expect(result.updatedKeys).toEqual(["rank_math_title"]);
      expect(result.verified).toBe(true);
    }
  });

  it("HTTP 오류 응답이면 statusCode/reasonCandidate를 포함한 실패를 반환한다", async () => {
    setWordPressEnv();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("forbidden", { status: 403, statusText: "Forbidden" })));

    const result = await updateRankMathSeoViaCustomEndpoint(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.statusCode).toBe(403);
      expect(result.reasonCandidate.length).toBeGreaterThan(0);
    }
  });

  it("네트워크 오류 시 예외를 던지지 않고 안전한 실패를 반환한다", async () => {
    setWordPressEnv();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await updateRankMathSeoViaCustomEndpoint(input);

    expect(result.success).toBe(false);
  });

  it("응답의 success가 true가 아니면 실패로 처리한다", async () => {
    setWordPressEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false }), { status: 200, headers: { "content-type": "application/json" } })
      )
    );

    const result = await updateRankMathSeoViaCustomEndpoint(input);

    expect(result.success).toBe(false);
  });

  it("반환값에 Authorization header/password가 포함되지 않는다", async () => {
    setWordPressEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, postId: 1, updatedKeys: [], verified: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    const result = await updateRankMathSeoViaCustomEndpoint(input);

    const serialized = JSON.stringify(result).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("dummy-app-password-for-tests");
    expect(serialized).not.toContain("basic ");
  });
});
