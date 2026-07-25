import { afterEach, describe, expect, it, vi } from "vitest";
import { applySeoPluginMetadata } from "./seo-plugin-writer";
import type { SeoPluginPayload } from "./seo-plugin-types";

const payload: SeoPluginPayload = {
  provider: "yoast",
  seoTitle: "SEO 제목",
  metaDescription: "메타 설명",
  secondaryKeywords: [],
  rawPluginMeta: { _yoast_wpseo_title: "SEO 제목" },
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("applySeoPluginMetadata", () => {
  it("provider가 none이면 skipped_provider_none을 반환한다", async () => {
    const result = await applySeoPluginMetadata("post-1", "none", payload);
    expect(result.status).toBe("skipped_provider_none");
  });

  it("SEO_PLUGIN_WRITE_ENABLED=false이면 skipped_dry_run을 반환한다", async () => {
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "false");
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");

    const result = await applySeoPluginMetadata("post-1", "yoast", payload);
    expect(result.status).toBe("skipped_dry_run");
  });

  it("WORDPRESS_PUBLISH_ENABLED가 true가 아니면 SEO_PLUGIN_WRITE_ENABLED=true여도 skipped_dry_run을 반환한다", async () => {
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "true");
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "false");

    const result = await applySeoPluginMetadata("post-1", "yoast", payload);
    expect(result.status).toBe("skipped_dry_run");
  });

  it("두 조건이 모두 충족되어도 실제 write는 아직 구현되지 않아 failed를 반환한다 (safe stub)", async () => {
    vi.stubEnv("SEO_PLUGIN_WRITE_ENABLED", "true");
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");

    const result = await applySeoPluginMetadata("post-1", "yoast", payload);
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBeTruthy();
  });
});
