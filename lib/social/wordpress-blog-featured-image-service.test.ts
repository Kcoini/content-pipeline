import { beforeEach, describe, expect, it, vi } from "vitest";

const getSocialPostById = vi.fn();
const updateSocialPostContent = vi.fn();
const saveExistingWordPressMedia = vi.fn();
const logEvent = vi.fn();
const getArticleById = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  updateSocialPostContent: (...args: unknown[]) => updateSocialPostContent(...args),
}));
vi.mock("@/lib/images/featured-image-source-service", () => ({
  saveExistingWordPressMedia: (...args: unknown[]) => saveExistingWordPressMedia(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));
vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));

const { saveWordPressFeaturedImageMediaForBlogPost } = await import("./wordpress-blog-featured-image-service");

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    platform: "wordpress_blog",
    platformMetadata: { seoTitle: "SEO 제목" },
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostById.mockReset();
  updateSocialPostContent.mockReset();
  saveExistingWordPressMedia.mockReset();
  logEvent.mockReset();
  getArticleById.mockReset();

  getSocialPostById.mockResolvedValue(makePost());
  saveExistingWordPressMedia.mockResolvedValue({ success: true, message: "저장됨" });
  updateSocialPostContent.mockResolvedValue({});
  getArticleById.mockResolvedValue({ themeId: "theme-1" });
});

describe("saveWordPressFeaturedImageMediaForBlogPost", () => {
  it("유효한 mediaId면 article과 social_post 양쪽에 저장한다", async () => {
    const result = await saveWordPressFeaturedImageMediaForBlogPost("article-1", "post-1", 42, "https://example.com/image.jpg");

    expect(result.success).toBe(true);
    expect(saveExistingWordPressMedia).toHaveBeenCalledWith("article-1", { mediaId: 42, mediaUrl: "https://example.com/image.jpg" });
    expect(updateSocialPostContent).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({
        platformMetadata: expect.objectContaining({
          seoTitle: "SEO 제목",
          featuredImage: expect.objectContaining({ wordpressMediaId: 42 }),
        }),
      })
    );
  });

  it("media ID를 저장하면 이전에 waive되어 있던 상태를 해제한다(waived=false)", async () => {
    getSocialPostById.mockResolvedValue(
      makePost({ platformMetadata: { featuredImage: { waived: true, waivedReasonCode: "text_focused" } } })
    );

    await saveWordPressFeaturedImageMediaForBlogPost("article-1", "post-1", 42);

    const call = updateSocialPostContent.mock.calls[0][1];
    expect(call.platformMetadata.featuredImage.waived).toBe(false);
    expect(call.platformMetadata.featuredImage.waivedReasonCode).toBeNull();
  });

  it("platform이 wordpress_blog가 아니면 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "naver_blog" }));

    const result = await saveWordPressFeaturedImageMediaForBlogPost("article-1", "post-1", 42);

    expect(result.success).toBe(false);
    expect(saveExistingWordPressMedia).not.toHaveBeenCalled();
  });

  it("mediaId가 정수가 아니면 차단한다", async () => {
    const result = await saveWordPressFeaturedImageMediaForBlogPost("article-1", "post-1", 3.5);

    expect(result.success).toBe(false);
    expect(saveExistingWordPressMedia).not.toHaveBeenCalled();
  });

  it("mediaId가 0 이하이면 차단한다", async () => {
    const result = await saveWordPressFeaturedImageMediaForBlogPost("article-1", "post-1", 0);

    expect(result.success).toBe(false);
    expect(saveExistingWordPressMedia).not.toHaveBeenCalled();
  });

  it("mediaUrl 형식이 올바르지 않으면 차단한다", async () => {
    const result = await saveWordPressFeaturedImageMediaForBlogPost("article-1", "post-1", 42, "not-a-url");

    expect(result.success).toBe(false);
    expect(saveExistingWordPressMedia).not.toHaveBeenCalled();
  });

  it("mediaUrl 없이도 저장할 수 있다", async () => {
    const result = await saveWordPressFeaturedImageMediaForBlogPost("article-1", "post-1", 42);

    expect(result.success).toBe(true);
    expect(saveExistingWordPressMedia).toHaveBeenCalledWith("article-1", { mediaId: 42, mediaUrl: undefined });
  });

  it("article 저장(saveExistingWordPressMedia)이 실패하면 social_post는 갱신하지 않는다", async () => {
    saveExistingWordPressMedia.mockResolvedValue({ success: false, message: "실패" });

    const result = await saveWordPressFeaturedImageMediaForBlogPost("article-1", "post-1", 42);

    expect(result.success).toBe(false);
    expect(updateSocialPostContent).not.toHaveBeenCalled();
  });

  it("full URL을 로그에 그대로 남기지 않는다 (hasUrl boolean만)", async () => {
    await saveWordPressFeaturedImageMediaForBlogPost("article-1", "post-1", 42, "https://example.com/secret-image.jpg");

    const call = logEvent.mock.calls[0][0];
    expect(JSON.stringify(call.details)).not.toContain("secret-image.jpg");
    expect(call.details.hasUrl).toBe(true);
  });
});
