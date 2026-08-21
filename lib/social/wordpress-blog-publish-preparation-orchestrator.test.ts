import { beforeEach, describe, expect, it, vi } from "vitest";

const getSocialPostById = vi.fn();
const updateSocialPostContent = vi.fn();
const getSuccessfulWordPressDraft = vi.fn();
const publishArticleToWordPressDraft = vi.fn();
const attachFeaturedMediaToDraft = vi.fn();
const runPlatformPublishingGuard = vi.fn();
const updateWordPressSeoMetadataFromBlogPost = vi.fn();
const getArticleById = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  updateSocialPostContent: (...args: unknown[]) => updateSocialPostContent(...args),
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  getSuccessfulWordPressDraft: (...args: unknown[]) => getSuccessfulWordPressDraft(...args),
}));
vi.mock("@/lib/publish/publish-service", () => ({
  publishArticleToWordPressDraft: (...args: unknown[]) => publishArticleToWordPressDraft(...args),
}));
vi.mock("@/lib/publish/wordpress-featured-media-service", () => ({
  attachFeaturedMediaToDraft: (...args: unknown[]) => attachFeaturedMediaToDraft(...args),
}));
vi.mock("./platform-publishing-guard-service", () => ({
  runPlatformPublishingGuard: (...args: unknown[]) => runPlatformPublishingGuard(...args),
}));
vi.mock("./wordpress-blog-seo-metadata-service", () => ({
  updateWordPressSeoMetadataFromBlogPost: (...args: unknown[]) => updateWordPressSeoMetadataFromBlogPost(...args),
}));
vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));

const { prepareWordPressBlogPostForPublishing } = await import("./wordpress-blog-publish-preparation-orchestrator");

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    platform: "wordpress_blog",
    qualityStatus: "ready",
    approvalStatus: "approved",
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostById.mockReset();
  updateSocialPostContent.mockReset();
  getSuccessfulWordPressDraft.mockReset();
  publishArticleToWordPressDraft.mockReset();
  attachFeaturedMediaToDraft.mockReset();
  runPlatformPublishingGuard.mockReset();
  updateWordPressSeoMetadataFromBlogPost.mockReset();
  getArticleById.mockReset();

  updateSocialPostContent.mockResolvedValue({});
  getSuccessfulWordPressDraft.mockResolvedValue(null);
  publishArticleToWordPressDraft.mockResolvedValue({ success: true, message: "draft 생성 완료" });
  updateWordPressSeoMetadataFromBlogPost.mockResolvedValue({ success: true, message: "SEO 업데이트 완료" });
  getArticleById.mockResolvedValue({ featuredImageWordpressMediaId: null });
  runPlatformPublishingGuard.mockResolvedValue({ success: true, message: "guard 통과" });
});

describe("prepareWordPressBlogPostForPublishing", () => {
  it("모든 단계를 통과하면 success=true를 반환하고 실제 공개 게시는 수행하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makePost());

    const result = await prepareWordPressBlogPostForPublishing("article-1", "post-1");

    expect(result.success).toBe(true);
    expect(result.message).toContain("실제 공개 게시는 수행하지 않았습니다");
    expect(result.steps.map((s) => s.step)).toEqual(["quality", "approval", "draft", "seo_metadata", "featured_image", "publish_guard"]);
  });

  it("quality_status가 ready가 아니면 quality 단계에서 멈추고 이후 단계를 실행하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ qualityStatus: "needs_revision" }));

    const result = await prepareWordPressBlogPostForPublishing("article-1", "post-1");

    expect(result.success).toBe(false);
    expect(result.failedStep).toBe("quality");
    expect(publishArticleToWordPressDraft).not.toHaveBeenCalled();
  });

  it("approval_status가 approved가 아니면 approval 단계에서 멈춘다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ approvalStatus: "pending_review" }));

    const result = await prepareWordPressBlogPostForPublishing("article-1", "post-1");

    expect(result.success).toBe(false);
    expect(result.failedStep).toBe("approval");
    expect(publishArticleToWordPressDraft).not.toHaveBeenCalled();
  });

  it("draft 생성이 실패하면 draft 단계에서 멈추고 SEO metadata는 시도하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makePost());
    publishArticleToWordPressDraft.mockResolvedValue({ success: false, message: "draft 실패" });

    const result = await prepareWordPressBlogPostForPublishing("article-1", "post-1");

    expect(result.success).toBe(false);
    expect(result.failedStep).toBe("draft");
    expect(updateWordPressSeoMetadataFromBlogPost).not.toHaveBeenCalled();
  });

  it("이미 draft가 있으면 force:true로 재생성(업데이트)한다", async () => {
    getSocialPostById.mockResolvedValue(makePost());
    getSuccessfulWordPressDraft.mockResolvedValue({ externalPostId: "1", postUrl: null });

    await prepareWordPressBlogPostForPublishing("article-1", "post-1");

    expect(publishArticleToWordPressDraft).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ force: true })
    );
  });

  it("wordpress_blog 글 자체의 post_title/post_body를 contentOverride로 WordPress에 전달한다 (article 원문 아님)", async () => {
    getSocialPostById.mockResolvedValue(makePost({ postTitle: "블로그 글 제목", postBody: "블로그 글 본문" }));
    getSuccessfulWordPressDraft.mockResolvedValue(null);

    await prepareWordPressBlogPostForPublishing("article-1", "post-1");

    expect(publishArticleToWordPressDraft).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({
        contentOverride: expect.objectContaining({ title: "블로그 글 제목", content: "블로그 글 본문" }),
      })
    );
  });

  it("featured image media id가 없고 waived도 아니면 warning으로 표시하고 실패 처리하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makePost());
    getArticleById.mockResolvedValue({ featuredImageWordpressMediaId: null });

    const result = await prepareWordPressBlogPostForPublishing("article-1", "post-1");

    expect(result.success).toBe(true);
    expect(attachFeaturedMediaToDraft).not.toHaveBeenCalled();
    const featuredStep = result.steps.find((s) => s.step === "featured_image");
    expect(featuredStep?.status).toBe("warning");
  });

  it("featured image media id가 없지만 waived면 skipped로 표시하고 실패 처리하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(
      makePost({ platformMetadata: { featuredImage: { waived: true } } })
    );
    getArticleById.mockResolvedValue({ featuredImageWordpressMediaId: null });

    const result = await prepareWordPressBlogPostForPublishing("article-1", "post-1");

    expect(result.success).toBe(true);
    expect(attachFeaturedMediaToDraft).not.toHaveBeenCalled();
    const featuredStep = result.steps.find((s) => s.step === "featured_image");
    expect(featuredStep?.status).toBe("skipped");
  });

  it("featured image media id가 있으면 attachFeaturedMediaToDraft를 호출한다", async () => {
    getSocialPostById.mockResolvedValue(makePost());
    getArticleById.mockResolvedValue({ featuredImageWordpressMediaId: 42 });
    attachFeaturedMediaToDraft.mockResolvedValue({ success: true, message: "연결 완료" });

    const result = await prepareWordPressBlogPostForPublishing("article-1", "post-1");

    expect(attachFeaturedMediaToDraft).toHaveBeenCalledWith("article-1");
    const featuredStep = result.steps.find((s) => s.step === "featured_image");
    expect(featuredStep?.status).toBe("success");
  });

  it("publish guard가 실패하면 guard 단계에서 실패로 끝난다", async () => {
    getSocialPostById.mockResolvedValue(makePost());
    runPlatformPublishingGuard.mockResolvedValue({ success: false, message: "guard 실패" });

    const result = await prepareWordPressBlogPostForPublishing("article-1", "post-1");

    expect(result.success).toBe(false);
    expect(result.failedStep).toBe("publish_guard");
  });

  it("platform이 wordpress_blog가 아니면 즉시 차단하고 아무 단계도 실행하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "naver_blog" }));

    const result = await prepareWordPressBlogPostForPublishing("article-1", "post-1");

    expect(result.success).toBe(false);
    expect(result.steps).toEqual([]);
    expect(publishArticleToWordPressDraft).not.toHaveBeenCalled();
  });

  it("성공하면 결과를 platformMetadata.lastPublishPreparationRun에 저장한다 (DB schema 변경 없음)", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platformMetadata: { seoTitle: "기존 값" } }));

    await prepareWordPressBlogPostForPublishing("article-1", "post-1");

    expect(updateSocialPostContent).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({
        platformMetadata: expect.objectContaining({
          seoTitle: "기존 값",
          lastPublishPreparationRun: expect.objectContaining({
            success: true,
            failedStep: null,
            steps: expect.any(Array),
            ranAt: expect.any(String),
          }),
        }),
      })
    );
  });

  it("중간 단계에서 실패해도 결과를 lastPublishPreparationRun에 저장한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ qualityStatus: "needs_revision" }));

    await prepareWordPressBlogPostForPublishing("article-1", "post-1");

    expect(updateSocialPostContent).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({
        platformMetadata: expect.objectContaining({
          lastPublishPreparationRun: expect.objectContaining({ success: false, failedStep: "quality" }),
        }),
      })
    );
  });

  it("결과 저장(updateSocialPostContent)이 실패해도 게시 준비 결과 자체는 그대로 반환한다", async () => {
    getSocialPostById.mockResolvedValue(makePost());
    updateSocialPostContent.mockRejectedValue(new Error("저장 실패"));

    const result = await prepareWordPressBlogPostForPublishing("article-1", "post-1");

    expect(result.success).toBe(true);
  });
});

describe("getWordPressBlogPreparationStepLabel / getWordPressBlogPreparationStepStatusLabel", () => {
  it("단계 코드를 한국어 라벨로 변환한다", async () => {
    const { getWordPressBlogPreparationStepLabel } = await import("./wordpress-blog-publish-preparation-orchestrator");
    expect(getWordPressBlogPreparationStepLabel("quality")).toBe("품질검사");
    expect(getWordPressBlogPreparationStepLabel("approval")).toBe("승인");
    expect(getWordPressBlogPreparationStepLabel("draft")).toBe("WordPress Draft");
    expect(getWordPressBlogPreparationStepLabel("seo_metadata")).toBe("SEO Metadata");
    expect(getWordPressBlogPreparationStepLabel("featured_image")).toBe("대표 이미지");
    expect(getWordPressBlogPreparationStepLabel("publish_guard")).toBe("게시 가능 상태");
  });

  it("단계 실행 상태를 한국어 라벨로 변환한다", async () => {
    const { getWordPressBlogPreparationStepStatusLabel } = await import("./wordpress-blog-publish-preparation-orchestrator");
    expect(getWordPressBlogPreparationStepStatusLabel("success")).toBe("성공");
    expect(getWordPressBlogPreparationStepStatusLabel("skipped")).toBe("건너뜀");
    expect(getWordPressBlogPreparationStepStatusLabel("warning")).toBe("경고");
    expect(getWordPressBlogPreparationStepStatusLabel("failed")).toBe("실패");
  });
});
