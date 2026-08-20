import { beforeEach, describe, expect, it, vi } from "vitest";

const getArticleById = vi.fn();
const getSocialPostById = vi.fn();
const updateSocialPostContent = vi.fn();
const getSuccessfulWordPressDraft = vi.fn();
const savePublishLog = vi.fn();
const updateSeoPluginMetadata = vi.fn();
const verifySeoPluginMetadata = vi.fn();
const updateRankMathSeoViaCustomEndpoint = vi.fn();
const isSeoCustomEndpointEnabled = vi.fn();
const isSeoPluginWriteEnabled = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));
vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  updateSocialPostContent: (...args: unknown[]) => updateSocialPostContent(...args),
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  getSuccessfulWordPressDraft: (...args: unknown[]) => getSuccessfulWordPressDraft(...args),
  savePublishLog: (...args: unknown[]) => savePublishLog(...args),
}));
vi.mock("@/lib/publish/wordpress-client", () => ({
  updateSeoPluginMetadata: (...args: unknown[]) => updateSeoPluginMetadata(...args),
  verifySeoPluginMetadata: (...args: unknown[]) => verifySeoPluginMetadata(...args),
}));
vi.mock("@/lib/seo/wordpress-seo-custom-endpoint-client", () => ({
  updateRankMathSeoViaCustomEndpoint: (...args: unknown[]) => updateRankMathSeoViaCustomEndpoint(...args),
  isSeoCustomEndpointEnabled: (...args: unknown[]) => isSeoCustomEndpointEnabled(...args),
}));
vi.mock("@/lib/seo/seo-plugin-config", () => ({
  isSeoPluginWriteEnabled: (...args: unknown[]) => isSeoPluginWriteEnabled(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { writeWordPressBlogSeoPluginMetadata, saveWordPressBlogSeoPluginProvider } = await import(
  "./wordpress-blog-seo-plugin-service"
);

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    platform: "wordpress_blog",
    qualityStatus: "ready",
    approvalStatus: "approved",
    postTitle: "제목",
    postBody: "본문입니다. 충분히 깁니다.",
    platformMetadata: {
      seoTitle: "블로그 SEO 제목",
      metaDescription: "블로그 메타 설명",
      targetKeyword: "블로그 키워드",
      secondaryKeywords: ["보조1"],
      seoPluginProvider: "rank_math",
    },
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  getSocialPostById.mockReset();
  updateSocialPostContent.mockReset();
  getSuccessfulWordPressDraft.mockReset();
  savePublishLog.mockReset();
  updateSeoPluginMetadata.mockReset();
  verifySeoPluginMetadata.mockReset();
  updateRankMathSeoViaCustomEndpoint.mockReset();
  isSeoCustomEndpointEnabled.mockReset();
  isSeoPluginWriteEnabled.mockReset();
  logEvent.mockReset();

  getSocialPostById.mockResolvedValue(makePost());
  getArticleById.mockResolvedValue({ themeId: "theme-1" });
  updateSocialPostContent.mockResolvedValue({});
  getSuccessfulWordPressDraft.mockResolvedValue({ externalPostId: "42", postUrl: "https://example.com/?p=42" });
  isSeoPluginWriteEnabled.mockReturnValue(true);
  isSeoCustomEndpointEnabled.mockReturnValue(true);
  updateSeoPluginMetadata.mockResolvedValue({ success: true, fieldsAttempted: ["seo_title"] });
  verifySeoPluginMetadata.mockResolvedValue({ verified: true });
  updateRankMathSeoViaCustomEndpoint.mockResolvedValue({ success: true, postId: 42, updatedKeys: ["rank_math_title"], verified: true });
  savePublishLog.mockResolvedValue({});
});

describe("saveWordPressBlogSeoPluginProvider", () => {
  it("wordpress_blog 글의 platformMetadata에 provider 선택을 저장한다", async () => {
    const result = await saveWordPressBlogSeoPluginProvider("post-1", "yoast");
    expect(result.success).toBe(true);
    expect(updateSocialPostContent).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({ platformMetadata: expect.objectContaining({ seoPluginProvider: "yoast" }) })
    );
  });

  it("허용되지 않은 provider는 차단한다", async () => {
    const result = await saveWordPressBlogSeoPluginProvider("post-1", "invalid");
    expect(result.success).toBe(false);
  });

  it("naver_blog에서는 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "naver_blog" }));
    const result = await saveWordPressBlogSeoPluginProvider("post-1", "rank_math");
    expect(result.success).toBe(false);
    expect(updateSocialPostContent).not.toHaveBeenCalled();
  });
});

describe("writeWordPressBlogSeoPluginMetadata", () => {
  it("provider=rank_math면 updateSeoPluginMetadata를 wordpress_blog seoTitle/metaDescription/targetKeyword로 호출한다", async () => {
    const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");

    expect(result.success).toBe(true);
    expect(updateSeoPluginMetadata).toHaveBeenCalledWith(
      42,
      "rank_math",
      expect.objectContaining({
        seoTitle: "블로그 SEO 제목",
        metaDescription: "블로그 메타 설명",
        focusKeyword: "블로그 키워드",
      })
    );
  });

  it("article title/content를 사용하지 않는다 (getArticleById는 로그용으로만 조회, write에는 미사용)", async () => {
    await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
    const call = updateSeoPluginMetadata.mock.calls[0][2];
    expect(call.seoTitle).toBe("블로그 SEO 제목");
    expect(JSON.stringify(call)).not.toContain("article");
  });

  it("provider=none이면 skip 처리하고 write를 호출하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platformMetadata: { ...makePost().platformMetadata, seoPluginProvider: "none" } }));
    const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1");
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
  });

  it("provider=custom_endpoint면 updateRankMathSeoViaCustomEndpoint를 호출한다", async () => {
    const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "custom_endpoint");
    expect(result.success).toBe(true);
    expect(updateRankMathSeoViaCustomEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({ postId: 42, focusKeyword: "블로그 키워드" })
    );
    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
  });

  it("targetKeyword가 없으면 차단하고 재생성을 안내한다", async () => {
    getSocialPostById.mockResolvedValue(
      makePost({ platformMetadata: { seoTitle: "제목", metaDescription: "설명", seoPluginProvider: "rank_math" } })
    );
    const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
    expect(result.success).toBe(false);
    expect(result.message).toContain("SEO Metadata 재생성");
    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
  });

  it("WordPress Draft가 없으면 차단한다", async () => {
    getSuccessfulWordPressDraft.mockResolvedValue(null);
    const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
    expect(result.success).toBe(false);
    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
  });

  it("quality_status가 ready가 아니면 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ qualityStatus: "needs_revision" }));
    const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
    expect(result.success).toBe(false);
    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
  });

  it("platform이 wordpress_blog가 아니면 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "naver_blog" }));
    const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
    expect(result.success).toBe(false);
    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
  });

  it("결과를 social_posts.platformMetadata.seoPluginWrite에 저장하고 article 컬럼(saveSeoPluginActualWriteResult 등)은 사용하지 않는다", async () => {
    await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
    const call = updateSocialPostContent.mock.calls.find((c) => c[1]?.platformMetadata?.seoPluginWrite);
    expect(call).toBeTruthy();
    expect(call![1].platformMetadata.seoPluginWrite.status).toBe("success");
  });

  it("logs에는 Authorization/App Password/full content가 저장되지 않는다", async () => {
    await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
    const serialized = JSON.stringify([...logEvent.mock.calls, ...savePublishLog.mock.calls]).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("본문입니다");
  });

  it("write 실패 시 실패로 저장하고 성공으로 표시하지 않는다", async () => {
    updateSeoPluginMetadata.mockResolvedValue({ success: false, errorMessage: "WordPress 인증 실패" });
    const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
    expect(result.success).toBe(false);
    expect(result.message).toBe("WordPress 인증 실패");
  });
});
