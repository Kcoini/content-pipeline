import { beforeEach, describe, expect, it, vi } from "vitest";

const getSocialPostById = vi.fn();
const updateSocialPostContent = vi.fn();
const saveLocalImageUpload = vi.fn();
const uploadFeaturedImageToWordPress = vi.fn();
const getArticleById = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  updateSocialPostContent: (...args: unknown[]) => updateSocialPostContent(...args),
}));
vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));
vi.mock("@/lib/images/featured-image-source-service", () => ({
  saveLocalImageUpload: (...args: unknown[]) => saveLocalImageUpload(...args),
}));
vi.mock("@/lib/publish/wordpress-media-upload-service", () => ({
  uploadFeaturedImageToWordPress: (...args: unknown[]) => uploadFeaturedImageToWordPress(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { uploadWordPressFeaturedImageFromBlogPost } = await import("./wordpress-blog-local-image-upload-service");

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    platform: "wordpress_blog",
    platformMetadata: { seoTitle: "SEO 제목" },
    ...overrides,
  };
}

function makeFile(name: string, type: string, sizeBytes: number): File {
  const buffer = new Uint8Array(sizeBytes);
  return new File([buffer], name, { type });
}

beforeEach(() => {
  getSocialPostById.mockReset();
  updateSocialPostContent.mockReset();
  saveLocalImageUpload.mockReset();
  uploadFeaturedImageToWordPress.mockReset();
  getArticleById.mockReset();
  logEvent.mockReset();

  getSocialPostById.mockResolvedValue(makePost());
  saveLocalImageUpload.mockResolvedValue({ success: true, message: "저장됨" });
  uploadFeaturedImageToWordPress.mockResolvedValue({
    success: true,
    message: "완료",
    wordpressMediaId: 99,
    wordpressUrl: "https://example.com/uploaded.jpg",
  });
  updateSocialPostContent.mockResolvedValue({});
  getArticleById.mockResolvedValue({ themeId: "theme-1" });
});

describe("uploadWordPressFeaturedImageFromBlogPost", () => {
  it("파일이 없으면 차단한다", async () => {
    const result = await uploadWordPressFeaturedImageFromBlogPost("article-1", "post-1", null);

    expect(result.success).toBe(false);
    expect(result.message).toContain("파일을 먼저 선택하세요");
    expect(saveLocalImageUpload).not.toHaveBeenCalled();
  });

  it("이미지가 아닌 파일은 차단한다", async () => {
    const file = makeFile("doc.pdf", "application/pdf", 1024);

    const result = await uploadWordPressFeaturedImageFromBlogPost("article-1", "post-1", file);

    expect(result.success).toBe(false);
    expect(result.message).toContain("이미지 파일만 업로드할 수 있습니다");
    expect(saveLocalImageUpload).not.toHaveBeenCalled();
  });

  it("5MB를 초과하는 파일은 차단한다", async () => {
    const file = makeFile("big.jpg", "image/jpeg", 6 * 1024 * 1024);

    const result = await uploadWordPressFeaturedImageFromBlogPost("article-1", "post-1", file);

    expect(result.success).toBe(false);
    expect(result.message).toContain("5MB");
    expect(saveLocalImageUpload).not.toHaveBeenCalled();
  });

  it("jpeg/png/webp는 허용한다", async () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      const file = makeFile("photo", type, 1024);
      const result = await uploadWordPressFeaturedImageFromBlogPost("article-1", "post-1", file);
      expect(result.success).toBe(true);
    }
  });

  it("platform이 wordpress_blog가 아니면 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "naver_blog" }));
    const file = makeFile("photo.jpg", "image/jpeg", 1024);

    const result = await uploadWordPressFeaturedImageFromBlogPost("article-1", "post-1", file);

    expect(result.success).toBe(false);
    expect(saveLocalImageUpload).not.toHaveBeenCalled();
  });

  it("성공 시 media id/url을 반환하고 social_post의 platformMetadata에 반영한다", async () => {
    const file = makeFile("photo.jpg", "image/jpeg", 1024);

    const result = await uploadWordPressFeaturedImageFromBlogPost("article-1", "post-1", file);

    expect(result.success).toBe(true);
    expect(result.wordpressMediaId).toBe(99);
    expect(updateSocialPostContent).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({
        platformMetadata: expect.objectContaining({
          seoTitle: "SEO 제목",
          featuredImage: expect.objectContaining({ wordpressMediaId: 99, source: "local_upload" }),
        }),
      })
    );
  });

  it("업로드 성공 시 이전에 waive되어 있던 상태를 해제한다(waived=false)", async () => {
    getSocialPostById.mockResolvedValue(
      makePost({ platformMetadata: { featuredImage: { waived: true, waivedReasonCode: "text_focused" } } })
    );
    const file = makeFile("photo.jpg", "image/jpeg", 1024);

    await uploadWordPressFeaturedImageFromBlogPost("article-1", "post-1", file);

    const call = updateSocialPostContent.mock.calls[0][1];
    expect(call.platformMetadata.featuredImage.waived).toBe(false);
    expect(call.platformMetadata.featuredImage.waivedReasonCode).toBeNull();
  });

  it("Supabase Storage 저장이 실패하면 WordPress 업로드를 시도하지 않는다", async () => {
    saveLocalImageUpload.mockResolvedValue({ success: false, message: "저장 실패" });
    const file = makeFile("photo.jpg", "image/jpeg", 1024);

    const result = await uploadWordPressFeaturedImageFromBlogPost("article-1", "post-1", file);

    expect(result.success).toBe(false);
    expect(uploadFeaturedImageToWordPress).not.toHaveBeenCalled();
  });

  it("WordPress 업로드가 실패(또는 비활성화로 skip)하면 실패로 처리한다", async () => {
    uploadFeaturedImageToWordPress.mockResolvedValue({ success: false, message: "업로드가 비활성화되어 있습니다." });
    const file = makeFile("photo.jpg", "image/jpeg", 1024);

    const result = await uploadWordPressFeaturedImageFromBlogPost("article-1", "post-1", file);

    expect(result.success).toBe(false);
    expect(updateSocialPostContent).not.toHaveBeenCalled();
  });

  it("Authorization/Application Password/파일 binary를 로그에 남기지 않는다", async () => {
    const file = makeFile("photo.jpg", "image/jpeg", 1024);

    await uploadWordPressFeaturedImageFromBlogPost("article-1", "post-1", file);

    const call = logEvent.mock.calls[0][0];
    const serialized = JSON.stringify(call);
    expect(serialized).not.toMatch(/authorization|application[_-]?password|bearer/i);
    expect(serialized.length).toBeLessThan(2000);
  });
});
