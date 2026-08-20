import { beforeEach, describe, expect, it, vi } from "vitest";

const getArticleById = vi.fn();
const getSocialPostById = vi.fn();
const updateSocialPostContent = vi.fn();
const getImageGenerationProvider = vi.fn();
const isImageGenerationEnabled = vi.fn();
const getDefaultImageModel = vi.fn();
const getDefaultDimensions = vi.fn();
const generateImage = vi.fn();
const getImageProviderClient = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));
vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  updateSocialPostContent: (...args: unknown[]) => updateSocialPostContent(...args),
}));
vi.mock("@/lib/images/image-generation-config", () => ({
  getImageGenerationProvider: (...args: unknown[]) => getImageGenerationProvider(...args),
  isImageGenerationEnabled: (...args: unknown[]) => isImageGenerationEnabled(...args),
  getDefaultImageModel: (...args: unknown[]) => getDefaultImageModel(...args),
  getDefaultDimensions: (...args: unknown[]) => getDefaultDimensions(...args),
}));
vi.mock("@/lib/images/providers", () => ({
  getImageProviderClient: (...args: unknown[]) => getImageProviderClient(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { generateWordPressBlogFeaturedImagePrompt, generateWordPressBlogFeaturedImage, readWordPressBlogImageGenerationState } =
  await import("./wordpress-blog-image-generation-service");

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    platform: "wordpress_blog",
    postTitle: "장기요양보험 신청 방법",
    postBody: "본문입니다.",
    platformMetadata: { targetKeyword: "장기요양보험", answerSummary: "핵심 요약" },
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  getSocialPostById.mockReset();
  updateSocialPostContent.mockReset();
  getImageGenerationProvider.mockReset();
  isImageGenerationEnabled.mockReset();
  getDefaultImageModel.mockReset();
  getDefaultDimensions.mockReset();
  generateImage.mockReset();
  getImageProviderClient.mockReset();
  logEvent.mockReset();

  getSocialPostById.mockResolvedValue(makePost());
  getArticleById.mockResolvedValue({ themeId: "theme-1", articleMode: "monetized_blog" });
  updateSocialPostContent.mockResolvedValue({});
  getImageGenerationProvider.mockReturnValue("mock");
  isImageGenerationEnabled.mockReturnValue(false);
  getDefaultImageModel.mockReturnValue(undefined);
  getDefaultDimensions.mockReturnValue({ width: 1536, height: 864 });
  getImageProviderClient.mockReturnValue({ generateImage });
  generateImage.mockResolvedValue({
    status: "generated",
    provider: "mock",
    imageUrl: "https://example.com/mock-image.png",
    metadata: {},
  });
});

describe("generateWordPressBlogFeaturedImagePrompt", () => {
  it("wordpress_blog title/targetKeyword/answerSummary로 prompt를 만들어 platformMetadata에 저장한다", async () => {
    const result = await generateWordPressBlogFeaturedImagePrompt("article-1", "post-1");

    expect(result.success).toBe(true);
    const call = updateSocialPostContent.mock.calls[0][1];
    expect(call.platformMetadata.imageGeneration.status).toBe("prepared");
    expect(call.platformMetadata.imageGeneration.prompt).toContain("장기요양보험 신청 방법");
    expect(call.platformMetadata.imageGeneration.prompt).toContain("장기요양보험");
  });

  it("article title/content를 사용하지 않는다", async () => {
    await generateWordPressBlogFeaturedImagePrompt("article-1", "post-1");
    expect(getArticleById).not.toHaveBeenCalled();
  });

  it("platform이 wordpress_blog가 아니면 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "naver_blog" }));
    const result = await generateWordPressBlogFeaturedImagePrompt("article-1", "post-1");
    expect(result.success).toBe(false);
    expect(updateSocialPostContent).not.toHaveBeenCalled();
  });

  it("post_title이 비어 있으면 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ postTitle: "" }));
    const result = await generateWordPressBlogFeaturedImagePrompt("article-1", "post-1");
    expect(result.success).toBe(false);
  });
});

describe("generateWordPressBlogFeaturedImage", () => {
  it("prompt가 준비돼 있으면 provider client를 호출해 이미지를 생성하고 platformMetadata에 저장한다", async () => {
    getSocialPostById.mockResolvedValue(
      makePost({ platformMetadata: { ...makePost().platformMetadata, imageGeneration: { status: "prepared", prompt: "테스트 prompt" } } })
    );

    const result = await generateWordPressBlogFeaturedImage("article-1", "post-1");

    expect(result.success).toBe(true);
    expect(generateImage).toHaveBeenCalledWith(expect.objectContaining({ prompt: "테스트 prompt", dryRun: true }));
    const call = updateSocialPostContent.mock.calls[0][1];
    expect(call.platformMetadata.imageGeneration.status).toBe("generated");
    expect(call.platformMetadata.imageGeneration.imageUrl).toBe("https://example.com/mock-image.png");
  });

  it("prompt가 없으면 차단하고 prompt 생성을 안내한다", async () => {
    const result = await generateWordPressBlogFeaturedImage("article-1", "post-1");
    expect(result.success).toBe(false);
    expect(result.message).toContain("이미지 prompt 생성");
    expect(generateImage).not.toHaveBeenCalled();
  });

  it("article 결과 컬럼에 저장하지 않는다 (social_posts.platformMetadata에만 저장)", async () => {
    getSocialPostById.mockResolvedValue(
      makePost({ platformMetadata: { ...makePost().platformMetadata, imageGeneration: { status: "prepared", prompt: "p" } } })
    );
    await generateWordPressBlogFeaturedImage("article-1", "post-1");
    // updateSocialPostContent만 호출되고, article 저장 함수는 import조차 되지 않음(모듈 자체에 없음)을
    // article.articleMode 읽기(getArticleById)만 호출됐는지로 간접 확인한다.
    expect(getArticleById).toHaveBeenCalledWith("article-1");
    expect(updateSocialPostContent).toHaveBeenCalled();
  });

  it("IMAGE_GENERATION_ENABLED=false이면 dryRun:true로 호출한다(mock 처리, 실제 API 호출 없음)", async () => {
    getSocialPostById.mockResolvedValue(
      makePost({ platformMetadata: { ...makePost().platformMetadata, imageGeneration: { status: "prepared", prompt: "p" } } })
    );
    isImageGenerationEnabled.mockReturnValue(false);

    const result = await generateWordPressBlogFeaturedImage("article-1", "post-1");

    expect(generateImage).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
    expect(result.message).toContain("IMAGE_GENERATION_ENABLED=false");
  });

  it("plaform이 wordpress_blog가 아니면 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "naver_blog" }));
    const result = await generateWordPressBlogFeaturedImage("article-1", "post-1");
    expect(result.success).toBe(false);
    expect(generateImage).not.toHaveBeenCalled();
  });

  it("생성 실패 시 실패로 저장하고 실패 메시지를 반환한다", async () => {
    getSocialPostById.mockResolvedValue(
      makePost({ platformMetadata: { ...makePost().platformMetadata, imageGeneration: { status: "prepared", prompt: "p" } } })
    );
    generateImage.mockResolvedValue({ status: "failed", provider: "mock", error: "provider timeout", metadata: {} });

    const result = await generateWordPressBlogFeaturedImage("article-1", "post-1");

    expect(result.success).toBe(false);
    expect(result.message).toBe("provider timeout");
  });

  it("logs에 이미지 binary/full provider 응답을 저장하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(
      makePost({ platformMetadata: { ...makePost().platformMetadata, imageGeneration: { status: "prepared", prompt: "민감한 프롬프트 원문" } } })
    );
    generateImage.mockResolvedValue({
      status: "generated",
      provider: "mock",
      imageUrl: "https://example.com/x.png",
      metadata: { rawResponse: "매우 긴 원본 응답" },
    });

    await generateWordPressBlogFeaturedImage("article-1", "post-1");

    const serialized = JSON.stringify(logEvent.mock.calls);
    expect(serialized).not.toContain("매우 긴 원본 응답");
    expect(serialized).not.toContain("민감한 프롬프트 원문");
  });
});

describe("readWordPressBlogImageGenerationState", () => {
  it("platformMetadata에 값이 없으면 기본값을 반환한다", () => {
    const state = readWordPressBlogImageGenerationState({});
    expect(state.status).toBe("not_generated");
    expect(state.prompt).toBeNull();
  });
});
