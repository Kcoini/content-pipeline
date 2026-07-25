import { afterEach, describe, expect, it, vi } from "vitest";
import { validateSeoPluginProvider, getSeoPluginProvider, isSeoPluginWriteEnabled } from "./seo-plugin-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("validateSeoPluginProvider", () => {
  it("유효한 값(none/yoast/rank_math/aioseo)은 그대로 반환한다", () => {
    expect(validateSeoPluginProvider("none")).toEqual({ provider: "none" });
    expect(validateSeoPluginProvider("yoast")).toEqual({ provider: "yoast" });
    expect(validateSeoPluginProvider("rank_math")).toEqual({ provider: "rank_math" });
    expect(validateSeoPluginProvider("aioseo")).toEqual({ provider: "aioseo" });
  });

  it("값이 없으면(undefined/null/빈문자열) warning 없이 none을 반환한다", () => {
    expect(validateSeoPluginProvider(undefined)).toEqual({ provider: "none" });
    expect(validateSeoPluginProvider(null)).toEqual({ provider: "none" });
    expect(validateSeoPluginProvider("")).toEqual({ provider: "none" });
  });

  it("잘못된 provider 값이면 none으로 fallback하고 warning을 반환한다", () => {
    const result = validateSeoPluginProvider("wordpress-seo-pro");
    expect(result.provider).toBe("none");
    expect(result.warning).toBeTruthy();
  });
});

describe("getSeoPluginProvider", () => {
  it("SEO_PLUGIN_PROVIDER 기본값은 none이다 (환경변수 미설정)", () => {
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "");
    expect(getSeoPluginProvider()).toBe("none");
  });

  it("환경변수 값을 그대로 사용한다", () => {
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");
    expect(getSeoPluginProvider()).toBe("rank_math");
  });

  it("잘못된 환경변수 값이면 none으로 fallback한다", () => {
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "invalid-provider");
    expect(getSeoPluginProvider()).toBe("none");
  });
});

describe("isSeoPluginWriteEnabled", () => {
  it("기본값(미설정)은 false이다", () => {
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "");
    expect(isSeoPluginWriteEnabled()).toBe(false);
  });

  it("true로 설정하면 true를 반환한다", () => {
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "true");
    expect(isSeoPluginWriteEnabled()).toBe(true);
  });
});
