import { beforeEach, describe, expect, it, vi } from "vitest";

const getSocialPostById = vi.fn();
const updateSocialPostContent = vi.fn();
const getArticleById = vi.fn();
const saveFeaturedImageUploadResult = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  updateSocialPostContent: (...args: unknown[]) => updateSocialPostContent(...args),
}));
vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  saveFeaturedImageUploadResult: (...args: unknown[]) => saveFeaturedImageUploadResult(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { waiveWordPressFeaturedImageForBlogPost } = await import("./wordpress-blog-featured-image-waiver-service");

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
  getArticleById.mockReset();
  saveFeaturedImageUploadResult.mockReset();
  logEvent.mockReset();

  getSocialPostById.mockResolvedValue(makePost());
  updateSocialPostContent.mockResolvedValue({});
  getArticleById.mockResolvedValue({ themeId: "theme-1" });
  saveFeaturedImageUploadResult.mockResolvedValue({});
});

describe("waiveWordPressFeaturedImageForBlogPost", () => {
  it("사유 없이 호출하면 차단한다", async () => {
    const result = await waiveWordPressFeaturedImageForBlogPost("article-1", "post-1", undefined);

    expect(result.success).toBe(false);
    expect(updateSocialPostContent).not.toHaveBeenCalled();
  });

  it("허용되지 않은 사유 코드는 차단한다", async () => {
    const result = await waiveWordPressFeaturedImageForBlogPost("article-1", "post-1", "invalid_reason");

    expect(result.success).toBe(false);
    expect(updateSocialPostContent).not.toHaveBeenCalled();
  });

  it("platform이 wordpress_blog가 아니면 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "naver_blog" }));

    const result = await waiveWordPressFeaturedImageForBlogPost("article-1", "post-1", "text_focused");

    expect(result.success).toBe(false);
    expect(updateSocialPostContent).not.toHaveBeenCalled();
  });

  it("유효한 사유면 platformMetadata.featuredImage.waived=true로 저장한다", async () => {
    const result = await waiveWordPressFeaturedImageForBlogPost("article-1", "post-1", "no_suitable_image");

    expect(result.success).toBe(true);
    expect(updateSocialPostContent).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({
        platformMetadata: expect.objectContaining({
          seoTitle: "SEO 제목",
          featuredImage: expect.objectContaining({
            waived: true,
            waivedReasonCode: "no_suitable_image",
            wordpressMediaId: null,
            wordpressUrl: null,
          }),
        }),
      })
    );
  });

  it("사유가 'other'가 아니면 memo를 저장하지 않는다", async () => {
    await waiveWordPressFeaturedImageForBlogPost("article-1", "post-1", "text_focused", "이 메모는 저장되면 안 됨");

    const call = updateSocialPostContent.mock.calls[0][1];
    expect(call.platformMetadata.featuredImage.waivedMemo).toBeNull();
  });

  it("사유가 'other'이면 memo를 저장한다", async () => {
    await waiveWordPressFeaturedImageForBlogPost("article-1", "post-1", "other", "자세한 이유입니다");

    const call = updateSocialPostContent.mock.calls[0][1];
    expect(call.platformMetadata.featuredImage.waivedMemo).toBe("자세한 이유입니다");
  });

  it("article의 media id/url도 함께 비워 상태를 일치시킨다 (허용된 status 값만 사용)", async () => {
    await waiveWordPressFeaturedImageForBlogPost("article-1", "post-1", "manual_later");

    expect(saveFeaturedImageUploadResult).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ status: "skipped", wordpressMediaId: null, wordpressUrl: null })
    );
  });

  it("로그에는 reasonCode/hasMemo/status만 남기고 memo 원문은 남기지 않는다", async () => {
    await waiveWordPressFeaturedImageForBlogPost("article-1", "post-1", "other", "민감할 수 있는 상세 메모");

    const call = logEvent.mock.calls[0][0];
    const serialized = JSON.stringify(call.details);
    expect(serialized).not.toContain("민감할 수 있는 상세 메모");
    expect(call.details.hasMemo).toBe(true);
    expect(call.details.reasonCode).toBe("other");
  });
});
