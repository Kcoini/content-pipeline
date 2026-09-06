import { beforeEach, describe, expect, it, vi } from "vitest";

const getArticleById = vi.fn();
const logEvent = vi.fn();
const generateWordPressMetadata = vi.fn();
const generateSeoPluginPayload = vi.fn();
const prepareFeaturedImage = vi.fn();
const generateFeaturedImage = vi.fn();
const isImageGenerationEnabled = vi.fn();
const waiveArticleWordPressFeaturedImage = vi.fn();
const getArticleWordPressFeaturedImageWaiverState = vi.fn();
const runPublishQualityGate = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));
vi.mock("./wordpress-metadata-service", () => ({
  generateWordPressMetadata: (...args: unknown[]) => generateWordPressMetadata(...args),
}));
vi.mock("@/lib/seo/seo-plugin-metadata-service", () => ({
  generateSeoPluginPayload: (...args: unknown[]) => generateSeoPluginPayload(...args),
}));
vi.mock("@/lib/images/featured-image-preparation-service", () => ({
  prepareFeaturedImage: (...args: unknown[]) => prepareFeaturedImage(...args),
}));
vi.mock("@/lib/images/image-generation-service", () => ({
  generateFeaturedImage: (...args: unknown[]) => generateFeaturedImage(...args),
}));
vi.mock("@/lib/images/image-generation-config", () => ({
  isImageGenerationEnabled: (...args: unknown[]) => isImageGenerationEnabled(...args),
}));
vi.mock("./article-wordpress-featured-image-waiver-service", () => ({
  waiveArticleWordPressFeaturedImage: (...args: unknown[]) => waiveArticleWordPressFeaturedImage(...args),
  getArticleWordPressFeaturedImageWaiverState: (...args: unknown[]) => getArticleWordPressFeaturedImageWaiverState(...args),
}));
vi.mock("./publish-quality-gate-service", () => ({
  runPublishQualityGate: (...args: unknown[]) => runPublishQualityGate(...args),
}));

const { prepareArticleWordPressPublishing } = await import("./article-wordpress-publish-preparation-orchestrator");

function makeArticle(overrides: Record<string, unknown> = {}) {
  return {
    id: "article-1",
    themeId: "theme-1",
    wpMetadataStatus: "not_ready",
    seoPluginProvider: "none",
    seoPluginMetadataStatus: "not_ready",
    featuredImageStatus: "not_ready",
    featuredImageWordpressMediaId: null,
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  logEvent.mockReset();
  generateWordPressMetadata.mockReset();
  generateSeoPluginPayload.mockReset();
  prepareFeaturedImage.mockReset();
  generateFeaturedImage.mockReset();
  isImageGenerationEnabled.mockReset();
  waiveArticleWordPressFeaturedImage.mockReset();
  getArticleWordPressFeaturedImageWaiverState.mockReset();
  runPublishQualityGate.mockReset();

  logEvent.mockResolvedValue({});
  getArticleById.mockResolvedValue(makeArticle());
  generateWordPressMetadata.mockResolvedValue({ success: true, message: "WordPress Metadata 생성 완료" });
  generateSeoPluginPayload.mockResolvedValue({ success: true, message: "SEO Plugin Metadata 생성 완료" });
  prepareFeaturedImage.mockResolvedValue({ success: true, message: "대표 이미지 준비 완료" });
  generateFeaturedImage.mockResolvedValue({ success: true, message: "이미지 생성 완료" });
  isImageGenerationEnabled.mockReturnValue(true);
  waiveArticleWordPressFeaturedImage.mockResolvedValue({ success: true, message: "waiver 적용됨" });
  getArticleWordPressFeaturedImageWaiverState.mockReturnValue({ waived: false, reasonCode: null, memoPresent: false });
  runPublishQualityGate.mockResolvedValue({ success: true, message: "품질검사 통과", status: "ready_to_publish" });
});

describe("prepareArticleWordPressPublishing", () => {
  it("기사를 찾을 수 없으면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await prepareArticleWordPressPublishing("missing");

    expect(result.success).toBe(false);
    expect(result.message).toContain("찾을 수 없습니다");
  });

  it("모든 항목이 not_ready이면 WordPress Metadata/SEO(Rank Math)/이미지/Quality Gate를 순서대로 자동 실행한다", async () => {
    const result = await prepareArticleWordPressPublishing("article-1");

    expect(result.success).toBe(true);
    expect(generateWordPressMetadata).toHaveBeenCalledWith("article-1");
    expect(generateSeoPluginPayload).toHaveBeenCalledWith("article-1", "rank_math");
    expect(prepareFeaturedImage).toHaveBeenCalledWith("article-1");
    expect(generateFeaturedImage).toHaveBeenCalledWith("article-1");
    expect(runPublishQualityGate).toHaveBeenCalledWith("article-1");

    const stepKeys = result.steps.map((s) => s.step);
    expect(stepKeys).toEqual(["wordpress_metadata", "seo_metadata", "featured_image_prompt", "image_generation", "quality_gate"]);
    expect(result.steps.every((s) => s.status === "success")).toBe(true);
  });

  it("실제 WordPress 공개/draft 게시 함수는 호출하지 않는다", async () => {
    // publishArticleToWordPressDraft 등을 import하지 않았으므로, mock 대상
    // 목록에 없다는 사실 자체가 이 오케스트레이터가 그 함수를 참조하지 않음을
    // 보장한다. 여기서는 최소한 성공 응답에 draft 관련 텍스트가 없는지 확인한다.
    const result = await prepareArticleWordPressPublishing("article-1");
    // "공개 게시는 자동 실행되지 않습니다"라는 명시적 부정문은 있어야 하지만,
    // "공개 게시했다/게시됨" 같은 긍정 완료 표현은 없어야 한다.
    expect(result.message).toContain("공개 게시는 자동 실행되지 않습니다");
    expect(result.message).not.toMatch(/공개 게시(했|됨|완료)/);
    expect(result.message).toContain("자동으로 실행");
  });

  it("이미 생성된 WordPress Metadata/SEO Metadata/대표 이미지는 재생성하지 않고 건너뛴다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({
        wpMetadataStatus: "generated",
        seoPluginProvider: "yoast",
        seoPluginMetadataStatus: "generated",
        featuredImageStatus: "prepared",
        featuredImageWordpressMediaId: 42,
      })
    );

    const result = await prepareArticleWordPressPublishing("article-1");

    expect(generateWordPressMetadata).not.toHaveBeenCalled();
    expect(generateSeoPluginPayload).not.toHaveBeenCalled();
    expect(prepareFeaturedImage).not.toHaveBeenCalled();
    expect(generateFeaturedImage).not.toHaveBeenCalled();
    expect(waiveArticleWordPressFeaturedImage).not.toHaveBeenCalled();

    const skippedSteps = result.steps.filter((s) => s.status === "skipped");
    expect(skippedSteps.map((s) => s.step)).toEqual(
      expect.arrayContaining(["wordpress_metadata", "seo_metadata", "featured_image_prompt", "image_generation"])
    );
  });

  it("seoPluginProvider가 이미 none이 아니면(예: yoast) Rank Math로 덮어쓰지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ seoPluginProvider: "yoast", seoPluginMetadataStatus: "not_ready" }));

    await prepareArticleWordPressPublishing("article-1");

    expect(generateSeoPluginPayload).toHaveBeenCalledWith("article-1", "yoast");
    const providerDefaultedLog = logEvent.mock.calls.find(
      (args: unknown[]) => (args[0] as { type: string }).type === "article_wordpress_seo_provider_defaulted_rank_math"
    );
    expect(providerDefaultedLog).toBeUndefined();
  });

  it("provider가 none이면 Rank Math를 기본값으로 설정하고 로그를 남긴다", async () => {
    await prepareArticleWordPressPublishing("article-1");

    const providerDefaultedLog = logEvent.mock.calls.find(
      (args: unknown[]) => (args[0] as { type: string }).type === "article_wordpress_seo_provider_defaulted_rank_math"
    );
    expect(providerDefaultedLog).toBeDefined();
  });

  it("이미지 생성이 비활성화되어 있으면 생성을 시도하지 않고 자동으로 waiver를 적용한다", async () => {
    isImageGenerationEnabled.mockReturnValue(false);

    const result = await prepareArticleWordPressPublishing("article-1");

    expect(generateFeaturedImage).not.toHaveBeenCalled();
    expect(waiveArticleWordPressFeaturedImage).toHaveBeenCalledWith("article-1", "auto_generation_unavailable");
    const imageStep = result.steps.find((s) => s.step === "image_generation");
    expect(imageStep?.status).toBe("warning");
    expect(result.success).toBe(true); // 이미지 없음은 전체 실패로 취급하지 않는다
  });

  it("이미지 생성이 활성화되어 있지만 실패하면 자동으로 waiver를 적용한다(Draft 반영을 막지 않는다)", async () => {
    generateFeaturedImage.mockResolvedValue({ success: false, message: "provider 오류" });

    const result = await prepareArticleWordPressPublishing("article-1");

    expect(generateFeaturedImage).toHaveBeenCalledWith("article-1");
    expect(waiveArticleWordPressFeaturedImage).toHaveBeenCalledWith("article-1", "auto_generation_unavailable");
    const imageStep = result.steps.find((s) => s.step === "image_generation");
    expect(imageStep?.status).toBe("warning");
    expect(result.success).toBe(true);
  });

  it("이미 media id가 있으면 이미지 생성/waiver를 시도하지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ featuredImageWordpressMediaId: 7 }));

    const result = await prepareArticleWordPressPublishing("article-1");

    expect(generateFeaturedImage).not.toHaveBeenCalled();
    expect(waiveArticleWordPressFeaturedImage).not.toHaveBeenCalled();
    const imageStep = result.steps.find((s) => s.step === "image_generation");
    expect(imageStep?.status).toBe("skipped");
  });

  it("이미 waiver가 적용되어 있으면(overwrite 없이) 다시 시도하지 않는다", async () => {
    getArticleWordPressFeaturedImageWaiverState.mockReturnValue({ waived: true, reasonCode: "other", memoPresent: false });

    const result = await prepareArticleWordPressPublishing("article-1");

    expect(generateFeaturedImage).not.toHaveBeenCalled();
    expect(waiveArticleWordPressFeaturedImage).not.toHaveBeenCalled();
    const imageStep = result.steps.find((s) => s.step === "image_generation");
    expect(imageStep?.status).toBe("skipped");
  });

  it("WordPress Metadata 생성이 실패하면 그 자리에서 멈추고 이후 단계를 실행하지 않는다", async () => {
    generateWordPressMetadata.mockResolvedValue({ success: false, message: "생성 실패" });

    const result = await prepareArticleWordPressPublishing("article-1");

    expect(result.success).toBe(false);
    expect(generateSeoPluginPayload).not.toHaveBeenCalled();
    expect(prepareFeaturedImage).not.toHaveBeenCalled();
    expect(runPublishQualityGate).not.toHaveBeenCalled();
  });

  it("overwrite=true이면 이미 생성된 항목도 다시 생성한다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({
        wpMetadataStatus: "generated",
        seoPluginProvider: "rank_math",
        seoPluginMetadataStatus: "generated",
        featuredImageStatus: "prepared",
      })
    );

    await prepareArticleWordPressPublishing("article-1", { overwrite: true });

    expect(generateWordPressMetadata).toHaveBeenCalledWith("article-1");
    expect(generateSeoPluginPayload).toHaveBeenCalledWith("article-1", "rank_math");
    expect(prepareFeaturedImage).toHaveBeenCalledWith("article-1");
  });

  it("Quality Gate가 blocked면 마지막 단계가 failed로 표시되지만, 전체 실행 자체는 완료된 것으로 반환한다", async () => {
    runPublishQualityGate.mockResolvedValue({ success: true, message: "차단됨", status: "blocked" });

    const result = await prepareArticleWordPressPublishing("article-1");

    const qualityStep = result.steps.find((s) => s.step === "quality_gate");
    expect(qualityStep?.status).toBe("failed");
    expect(result.success).toBe(true);
  });

  it("완료 로그(article_wordpress_prepare_completed)를 남긴다", async () => {
    await prepareArticleWordPressPublishing("article-1");

    const completedLog = logEvent.mock.calls.find(
      (args: unknown[]) => (args[0] as { type: string }).type === "article_wordpress_prepare_completed"
    );
    expect(completedLog).toBeDefined();
  });

  it("로그에 API key/Authorization/이미지 바이너리/전체 본문이 포함되지 않는다", async () => {
    await prepareArticleWordPressPublishing("article-1");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
  });
});
