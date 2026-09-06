import { beforeEach, describe, expect, it, vi } from "vitest";

const getArticleById = vi.fn();
const saveWordPressMetadata = vi.fn();
const getSocialPostById = vi.fn();
const updateSocialPostContent = vi.fn();
const generateWordPressMetadata = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  saveWordPressMetadata: (...args: unknown[]) => saveWordPressMetadata(...args),
}));
vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  updateSocialPostContent: (...args: unknown[]) => updateSocialPostContent(...args),
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
  updateSocialPostContent.mockReset();
  generateWordPressMetadata.mockReset();
  logEvent.mockReset();

  getArticleById.mockResolvedValue({ id: "article-1", themeId: "theme-1", targetKeyword: "키워드" });
  generateWordPressMetadata.mockResolvedValue({ success: true, metadata: baseMetadata });
  saveWordPressMetadata.mockResolvedValue({});
});

describe("updateWordPressSeoMetadataFromBlogPost — SEO metadata만 업데이트하고 본문 content는 건드리지 않는다", () => {
  it("post_body를 HTML로 변환하거나 WordPress Draft content를 갱신하는 코드를 호출하지 않는다(소스 검사)", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(new URL("./wordpress-blog-seo-metadata-service.ts", import.meta.url), "utf-8");
    expect(source).not.toContain("convertMarkdownToWordPressHtml");
    expect(source).not.toContain("publishArticleToWordPressDraft");
  });
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

  describe("개인정보 false positive override", () => {
    it("개인정보 의심만 유일한 차단 사유이고 confirmed_false_positive 기록이 없으면 여전히 차단한다", async () => {
      getSocialPostById.mockResolvedValue(
        makePost({ postBody: "문의처: 제주도청 주택토지과 064-710-4252로 연락하세요. 본문입니다." })
      );

      const result = await updateWordPressSeoMetadataFromBlogPost("article-1", "post-1");

      expect(result.success).toBe(false);
      expect(saveWordPressMetadata).not.toHaveBeenCalled();
    });

    it("confirmed_false_positive 기록이 있고 다른 차단 사유가 없으면 override로 진행된다", async () => {
      // confirmWordPressBlogPersonalInfoFalsePositive도 같은 getSocialPostById/
      // updateSocialPostContent mock을 사용하므로, 실제 서비스 함수를 통해
      // override 레코드를 만든다.
      const { confirmWordPressBlogPersonalInfoFalsePositive } = await import("./wordpress-blog-personal-info-review");

      const postBeforeConfirm = makePost({
        postBody: "문의처: 제주도청 주택토지과 064-710-4252로 연락하세요. 본문입니다.",
      });
      getSocialPostById.mockResolvedValue(postBeforeConfirm);
      updateSocialPostContent.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
        ...postBeforeConfirm,
        ...patch,
      }));

      const confirmResult = await confirmWordPressBlogPersonalInfoFalsePositive("post-1", {
        reason: "제주도청 공식 대표번호입니다.",
        confirmedBy: "tester",
      });
      expect(confirmResult.success).toBe(true);

      const savedPatch = updateSocialPostContent.mock.calls.at(-1)?.[1] as { platformMetadata: Record<string, unknown> };
      getSocialPostById.mockResolvedValue({ ...postBeforeConfirm, platformMetadata: savedPatch.platformMetadata });

      const result = await updateWordPressSeoMetadataFromBlogPost("article-1", "post-1");

      expect(result.success).toBe(true);
      expect(saveWordPressMetadata).toHaveBeenCalled();
    });
  });
});
