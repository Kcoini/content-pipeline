import { beforeEach, describe, expect, it, vi } from "vitest";

const getArticleById = vi.fn();
const saveWordPressMetadata = vi.fn();
const getSocialPostById = vi.fn();
const generateWordPressMetadata = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  saveWordPressMetadata: (...args: unknown[]) => saveWordPressMetadata(...args),
}));
vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
}));
vi.mock("@/lib/publish/wordpress-metadata-service", () => ({
  generateWordPressMetadata: (...args: unknown[]) => generateWordPressMetadata(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { updateWordPressSeoMetadataFromBlogPost } = await import("./wordpress-blog-seo-metadata-service");

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    platform: "wordpress_blog",
    qualityStatus: "ready",
    approvalStatus: "approved",
    postTitle: "블로그 글 제목",
    postBody: "본문입니다. 충분히 긴 본문입니다.",
    platformMetadata: {
      seoTitle: "블로그 SEO 제목",
      metaDescription: "블로그 메타 설명",
      targetKeyword: "블로그 키워드",
    },
    ...overrides,
  };
}

const baseMetadata = {
  seoTitle: "기본 추천 SEO 제목",
  metaDescription: "기본 추천 메타 설명",
  slug: "slug",
  targetKeyword: "기본 추천 키워드",
  targetKeywordSource: "theme",
  secondaryKeywords: ["기본 추천 보조 키워드"],
  internalLinkSuggestions: [],
  categoryNames: ["카테고리"],
  tagNames: ["태그"],
  categoryIds: [],
  tagIds: [],
};

beforeEach(() => {
  getArticleById.mockReset();
  saveWordPressMetadata.mockReset();
  getSocialPostById.mockReset();
  generateWordPressMetadata.mockReset();
  logEvent.mockReset();

  getArticleById.mockResolvedValue({ id: "article-1", themeId: "theme-1", targetKeyword: "키워드" });
  generateWordPressMetadata.mockResolvedValue({ success: true, metadata: baseMetadata });
  saveWordPressMetadata.mockResolvedValue({});
});

describe("updateWordPressSeoMetadataFromBlogPost", () => {
  it("wordpress_blog 글의 platformMetadata.seoTitle/metaDescription/targetKeyword를 사용한다", async () => {
    getSocialPostById.mockResolvedValue(makePost());

    const result = await updateWordPressSeoMetadataFromBlogPost("article-1", "post-1");

    expect(result.success).toBe(true);
    expect(saveWordPressMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        seoTitle: "블로그 SEO 제목",
        metaDescription: "블로그 메타 설명",
        targetKeyword: "블로그 키워드",
        targetKeywordSource: "wordpress_blog_post",
      })
    );
  });

  it("platformMetadata.seoTitle이 없지만 post_title은 있으면 post_title을 사용한다(article title 대신)", async () => {
    getSocialPostById.mockResolvedValue(
      makePost({ platformMetadata: { metaDescription: "블로그 메타 설명", targetKeyword: "블로그 키워드" }, postTitle: "블로그 글 자체 제목" })
    );

    const result = await updateWordPressSeoMetadataFromBlogPost("article-1", "post-1");

    expect(result.success).toBe(true);
    expect(saveWordPressMetadata).toHaveBeenCalledWith(expect.objectContaining({ seoTitle: "블로그 글 자체 제목" }));
  });

  it("platform이 wordpress_blog가 아니면 차단하고 저장하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "naver_blog" }));

    const result = await updateWordPressSeoMetadataFromBlogPost("article-1", "post-1");

    expect(result.success).toBe(false);
    expect(saveWordPressMetadata).not.toHaveBeenCalled();
  });

  it("quality_status가 ready가 아니면 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ qualityStatus: "needs_revision" }));

    const result = await updateWordPressSeoMetadataFromBlogPost("article-1", "post-1");

    expect(result.success).toBe(false);
    expect(saveWordPressMetadata).not.toHaveBeenCalled();
  });

  it("approval_status가 approved가 아니면 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ approvalStatus: "pending_review" }));

    const result = await updateWordPressSeoMetadataFromBlogPost("article-1", "post-1");

    expect(result.success).toBe(false);
    expect(saveWordPressMetadata).not.toHaveBeenCalled();
  });

  it("article 원문의 title/content 관련 필드를 사용하지 않는다 (post 기준 값만 saveWordPressMetadata에 전달)", async () => {
    getSocialPostById.mockResolvedValue(makePost());

    await updateWordPressSeoMetadataFromBlogPost("article-1", "post-1");

    const call = saveWordPressMetadata.mock.calls[0][0];
    expect(call.seoTitle).not.toBe(undefined);
    expect(call.seoTitle).toBe("블로그 SEO 제목");
  });

  it("wordpress_blog 글에 metaDescription/targetKeyword가 없으면 차단하고, article 추천값으로 대신하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platformMetadata: {} }));

    const result = await updateWordPressSeoMetadataFromBlogPost("article-1", "post-1");

    expect(result.success).toBe(false);
    expect(result.message).toContain("SEO Metadata 재생성");
    expect(saveWordPressMetadata).not.toHaveBeenCalled();
    // article 추천값(baseMetadata)이 절대 saveWordPressMetadata에 전달되지 않아야 한다
    expect(generateWordPressMetadata).not.toHaveBeenCalled();
  });

  it("targetKeyword만 없어도 차단한다(metadata 부분 누락도 허용하지 않음)", async () => {
    getSocialPostById.mockResolvedValue(
      makePost({ platformMetadata: { seoTitle: "블로그 SEO 제목", metaDescription: "블로그 메타 설명" } })
    );

    const result = await updateWordPressSeoMetadataFromBlogPost("article-1", "post-1");

    expect(result.success).toBe(false);
    expect(saveWordPressMetadata).not.toHaveBeenCalled();
  });

  it("wordpress_blog 글의 platformMetadata.secondaryKeywords를 사용한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platformMetadata: { ...makePost().platformMetadata, secondaryKeywords: ["보조1", "보조2"] } }));

    await updateWordPressSeoMetadataFromBlogPost("article-1", "post-1");

    expect(saveWordPressMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ secondaryKeywords: ["보조1", "보조2"] })
    );
  });

  it("secondaryKeywords가 없으면 빈 배열을 사용한다(article 추천 보조 키워드로 대신하지 않음)", async () => {
    getSocialPostById.mockResolvedValue(makePost());

    await updateWordPressSeoMetadataFromBlogPost("article-1", "post-1");

    expect(saveWordPressMetadata).toHaveBeenCalledWith(expect.objectContaining({ secondaryKeywords: [] }));
  });

  it("slug/category/tag는 article 기준 추천 로직(generateWordPressMetadata)을 그대로 재사용한다", async () => {
    getSocialPostById.mockResolvedValue(makePost());

    await updateWordPressSeoMetadataFromBlogPost("article-1", "post-1");

    expect(generateWordPressMetadata).toHaveBeenCalledWith("article-1");
    expect(saveWordPressMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "slug", categoryNames: ["카테고리"], tagNames: ["태그"] })
    );
  });
});
