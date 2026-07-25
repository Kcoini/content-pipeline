import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/types/domain";

const getArticleById = vi.fn();
const saveWordPressMediaUploadPayload = vi.fn();
const updateWordPressMediaUploadStatus = vi.fn();
const uploadMediaToWordPress = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  saveWordPressMediaUploadPayload: (...args: unknown[]) => saveWordPressMediaUploadPayload(...args),
  updateWordPressMediaUploadStatus: (...args: unknown[]) => updateWordPressMediaUploadStatus(...args),
}));
vi.mock("./wordpress-client", () => ({
  uploadMediaToWordPress: (...args: unknown[]) => uploadMediaToWordPress(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { prepareWordPressMediaUpload, confirmWordPressMediaUploadDryRun } = await import(
  "./wordpress-media-preparation-service"
);

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    themeId: "theme-1",
    title: "요양원과 요양병원 차이",
    content: "본문 내용입니다.".repeat(50),
    status: "draft",
    citedSourceIds: ["source-1", "source-2", "source-3"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    reviewedAt: null,
    reviewedBy: null,
    articleMode: "monetized_blog",
    seoTitle: "요양원 vs 요양병원 완벽 비교",
    metaDescription: "요양원과 요양병원의 차이를 정리했습니다.",
    slug: "care-facility-guide",
    targetKeyword: "요양원 요양병원 차이",
    secondaryKeywords: [],
    searchIntent: null,
    readerPersona: null,
    adSlots: [],
    internalLinkSuggestions: [],
    monetizationScore: null,
    policyRiskScore: null,
    formatMetadata: {},
    wpCategoryNames: [],
    wpTagNames: [],
    wpCategoryIds: [],
    wpTagIds: [],
    wpMetadataStatus: "not_ready",
    wpMetadataGeneratedAt: null,
    seoPluginProvider: "none",
    seoPluginPayload: {},
    seoPluginMetadataStatus: "not_ready",
    seoPluginMetadataGeneratedAt: null,
    seoPluginWriteStatus: "not_attempted",
    seoPluginWriteError: null,
    featuredImageStatus: "reviewed",
    featuredImagePrompt: "A clean editorial illustration...",
    featuredImageAltText: "요양원 요양병원 선택 기준을 비교하는 일러스트",
    featuredImageCaption: "요양시설 선택 전 확인할 기준을 정리했습니다.",
    featuredImageStyle: "clickable but trustworthy blog thumbnail",
    featuredImageAspectRatio: "16:9",
    featuredImageMetadata: {},
    featuredImageGeneratedAt: null,
    featuredImageReviewedAt: null,
    featuredImageWordpressMediaId: null,
    featuredImageWordpressUrl: null,
    featuredImageError: null,
    featuredImageSourceType: "none",
    featuredImageSourceUrl: null,
    featuredImageLocalPath: null,
    featuredImageFilename: null,
    featuredImageMimeType: null,
    featuredImageUploadStatus: "not_ready",
    featuredImageUploadPayload: {},
    featuredImageUploadError: null,
    featuredImageUploadAttemptedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  saveWordPressMediaUploadPayload.mockReset();
  updateWordPressMediaUploadStatus.mockReset();
  uploadMediaToWordPress.mockReset();
  logEvent.mockReset();

  saveWordPressMediaUploadPayload.mockResolvedValue({});
  updateWordPressMediaUploadStatus.mockResolvedValue({});
  logEvent.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("prepareWordPressMediaUpload", () => {
  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await prepareWordPressMediaUpload("missing");

    expect(result.success).toBe(false);
    expect(saveWordPressMediaUploadPayload).not.toHaveBeenCalled();
  });

  it("article에서 WordPress media upload payload를 준비할 수 있다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    const result = await prepareWordPressMediaUpload("article-1");

    expect(result.success).toBe(true);
    expect(result.payload).toBeDefined();
    expect(saveWordPressMediaUploadPayload).toHaveBeenCalledWith(
      expect.objectContaining({ articleId: "article-1", status: "prepared" })
    );
  });

  it("featured_image_alt_text와 caption이 payload에 포함된다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    const result = await prepareWordPressMediaUpload("article-1");

    expect(result.payload!.altText).toBe("요양원 요양병원 선택 기준을 비교하는 일러스트");
    expect(result.payload!.caption).toBe("요양시설 선택 전 확인할 기준을 정리했습니다.");
  });

  it("filename이 slug 기반으로 생성된다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ slug: "care-facility-guide" }));

    const result = await prepareWordPressMediaUpload("article-1");

    expect(result.payload!.filename).toBe("care-facility-guide-featured.webp");
  });

  it("slug가 없으면 article id 기반 fallback filename이 생성된다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", slug: null })
    );

    const result = await prepareWordPressMediaUpload("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    expect(result.payload!.filename).toBe("article-a1b2c3d4-featured.webp");
  });

  it("실패 시 failed 상태로 저장을 시도하고 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    saveWordPressMediaUploadPayload
      .mockRejectedValueOnce(new Error("DB 오류"))
      .mockResolvedValueOnce({});

    const result = await prepareWordPressMediaUpload("article-1");

    expect(result.success).toBe(false);
    expect(result.message).toContain("DB 오류");
    expect(saveWordPressMediaUploadPayload).toHaveBeenCalledTimes(2);
    expect(saveWordPressMediaUploadPayload).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "failed" })
    );
  });
});

describe("confirmWordPressMediaUploadDryRun", () => {
  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await confirmWordPressMediaUploadDryRun("missing");

    expect(result.success).toBe(false);
    expect(uploadMediaToWordPress).not.toHaveBeenCalled();
  });

  it("payload가 준비되지 않았으면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ featuredImageUploadPayload: {} }));

    const result = await confirmWordPressMediaUploadDryRun("article-1");

    expect(result.success).toBe(false);
    expect(uploadMediaToWordPress).not.toHaveBeenCalled();
  });

  it("WORDPRESS_MEDIA_UPLOAD_ENABLED=false이면 실제 upload를 호출하지 않는다 (client가 skipped 반환)", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ featuredImageUploadPayload: { filename: "x-featured.webp", mimeType: "image/webp" } })
    );
    uploadMediaToWordPress.mockResolvedValue({ status: "skipped" });

    const result = await confirmWordPressMediaUploadDryRun("article-1");

    expect(result.success).toBe(true);
    expect(updateWordPressMediaUploadStatus).toHaveBeenCalledWith("article-1", "skipped");
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wordpress_media_upload_skipped_disabled" })
    );
  });

  it("WORDPRESS_PUBLISH_ENABLED=false이면 실제 upload를 호출하지 않는다 (client가 dry_run 반환)", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ featuredImageUploadPayload: { filename: "x-featured.webp", mimeType: "image/webp" } })
    );
    uploadMediaToWordPress.mockResolvedValue({ status: "dry_run" });

    const result = await confirmWordPressMediaUploadDryRun("article-1");

    expect(result.success).toBe(true);
    expect(updateWordPressMediaUploadStatus).toHaveBeenCalledWith("article-1", "dry_run");
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpress_media_upload_dry_run" }));
  });

  it("업로드 실패 시 failed 상태로 저장한다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({ featuredImageUploadPayload: { filename: "x-featured.webp", mimeType: "image/webp" } })
    );
    uploadMediaToWordPress.mockResolvedValue({ status: "failed", error: "업로드 실패" });

    const result = await confirmWordPressMediaUploadDryRun("article-1");

    expect(result.success).toBe(false);
    expect(updateWordPressMediaUploadStatus).toHaveBeenCalledWith("article-1", "failed", "업로드 실패");
  });
});
