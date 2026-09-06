import { beforeEach, describe, expect, it, vi } from "vitest";

const getSocialPostById = vi.fn();
const updateSocialPostContent = vi.fn();
const getArticleById = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  updateSocialPostContent: (...args: unknown[]) => updateSocialPostContent(...args),
}));
vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { regenerateWordPressBlogMetadata } = await import("./wordpress-blog-metadata-regeneration-service");

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    platform: "wordpress_blog",
    postTitle: "장기요양보험 신청 방법",
    postBody: "장기요양보험 신청은 공단에서 접수합니다.",
    excerpt: "장기요양보험 신청 절차 요약",
    platformMetadata: {},
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostById.mockReset();
  updateSocialPostContent.mockReset();
  getArticleById.mockReset();
  logEvent.mockReset();

  getSocialPostById.mockResolvedValue(makePost());
  updateSocialPostContent.mockResolvedValue({});
  getArticleById.mockResolvedValue({
    themeId: "theme-1",
    citedSourceIds: ["source-1"],
    seoTitle: null,
    metaDescription: null,
    targetKeyword: null,
    secondaryKeywords: [],
    searchIntent: null,
    readerPersona: null,
    adSlots: [],
    monetizationScore: null,
    policyRiskScore: null,
  });
});

describe("regenerateWordPressBlogMetadata", () => {
  it("post_title/post_body는 그대로 두고 metadata만 재생성해 platformMetadata에 병합한다", async () => {
    const result = await regenerateWordPressBlogMetadata("article-1", "post-1");

    expect(result.success).toBe(true);
    const call = updateSocialPostContent.mock.calls[0][1];
    expect(call.platformMetadata.seoTitle).toEqual(expect.any(String));
    expect(call.platformMetadata.metaDescription).toEqual(expect.any(String));
    expect(call.platformMetadata.targetKeyword).toEqual(expect.any(String));
    expect(updateSocialPostContent.mock.calls[0][1]).not.toHaveProperty("postTitle");
    expect(updateSocialPostContent.mock.calls[0][1]).not.toHaveProperty("postBody");
  });

  it("기존 platformMetadata의 다른 값(waived 등)은 보존한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platformMetadata: { waived: true } }));

    await regenerateWordPressBlogMetadata("article-1", "post-1");

    const call = updateSocialPostContent.mock.calls[0][1];
    expect(call.platformMetadata.waived).toBe(true);
  });

  it("platform이 wordpress_blog가 아니면 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "naver_blog" }));

    const result = await regenerateWordPressBlogMetadata("article-1", "post-1");

    expect(result.success).toBe(false);
    expect(updateSocialPostContent).not.toHaveBeenCalled();
  });

  it("post_title/post_body가 비어 있으면 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ postTitle: "", postBody: "" }));

    const result = await regenerateWordPressBlogMetadata("article-1", "post-1");

    expect(result.success).toBe(false);
    expect(updateSocialPostContent).not.toHaveBeenCalled();
  });

  it("article에 이미 seoTitle이 있으면(monetized_blog) 참고용으로 재사용한다", async () => {
    getArticleById.mockResolvedValue({
      themeId: "theme-1",
      citedSourceIds: [],
      seoTitle: "article SEO 제목",
      metaDescription: null,
      targetKeyword: null,
      secondaryKeywords: [],
      searchIntent: null,
      readerPersona: null,
      adSlots: [],
      monetizationScore: null,
      policyRiskScore: null,
    });

    await regenerateWordPressBlogMetadata("article-1", "post-1");

    const call = updateSocialPostContent.mock.calls[0][1];
    expect(call.platformMetadata.seoTitle).toBe("article SEO 제목");
  });

  it("logs에는 필드 존재 여부/점수만 남기고 full content/prompt는 남기지 않는다", async () => {
    await regenerateWordPressBlogMetadata("article-1", "post-1");

    const call = logEvent.mock.calls[0][0];
    const serialized = JSON.stringify(call.details);
    expect(serialized).not.toContain("장기요양보험 신청은 공단에서 접수합니다");
    expect(call.details.hasSeoTitle).toBe(true);
    expect(call.details).not.toHaveProperty("body");
    expect(call.details).not.toHaveProperty("postBody");
  });
});
