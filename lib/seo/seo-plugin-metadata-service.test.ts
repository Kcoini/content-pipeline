import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/types/domain";

const getArticleById = vi.fn();
const saveSeoPluginMetadata = vi.fn();
const markSeoPluginMetadataReviewed = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  saveSeoPluginMetadata: (...args: unknown[]) => saveSeoPluginMetadata(...args),
  markSeoPluginMetadataReviewed: (...args: unknown[]) => markSeoPluginMetadataReviewed(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { generateSeoPluginPayload, reviewSeoPluginMetadata } = await import("./seo-plugin-metadata-service");

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    themeId: "theme-1",
    title: "요양원과 요양병원 차이",
    content: "본문 내용입니다.".repeat(50),
    status: "reviewed",
    citedSourceIds: ["source-1", "source-2", "source-3"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    reviewedAt: "2026-01-02T00:00:00.000Z",
    reviewedBy: "local-user",
    articleMode: "monetized_blog",
    seoTitle: "요양원 vs 요양병원 완벽 비교",
    metaDescription: "요양원과 요양병원의 차이를 정리했습니다.",
    slug: "care-facility-guide",
    targetKeyword: "요양원 요양병원 차이",
    secondaryKeywords: ["장기요양보험", "부모님 돌봄"],
    searchIntent: null,
    readerPersona: null,
    adSlots: [],
    internalLinkSuggestions: [],
    monetizationScore: null,
    policyRiskScore: null,
    formatMetadata: {},
    wpCategoryNames: ["복지"],
    wpTagNames: ["장기요양보험", "요양원"],
    wpCategoryIds: [],
    wpTagIds: [],
    wpMetadataStatus: "generated",
    wpMetadataGeneratedAt: "2026-01-01T00:00:00.000Z",
    seoPluginProvider: "none",
    seoPluginPayload: {},
    seoPluginMetadataStatus: "not_ready",
    seoPluginMetadataGeneratedAt: null,
    seoPluginWriteStatus: "not_attempted",
    seoPluginWriteError: null,
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  saveSeoPluginMetadata.mockReset();
  markSeoPluginMetadataReviewed.mockReset();
  logEvent.mockReset();

  saveSeoPluginMetadata.mockResolvedValue({});
  markSeoPluginMetadataReviewed.mockResolvedValue({});
  logEvent.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateSeoPluginPayload", () => {
  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await generateSeoPluginPayload("missing");

    expect(result.success).toBe(false);
    expect(saveSeoPluginMetadata).not.toHaveBeenCalled();
  });

  it("providerOverride가 없으면 SEO_PLUGIN_PROVIDER 환경변수를 사용한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");

    const result = await generateSeoPluginPayload("article-1");

    expect(result.provider).toBe("rank_math");
    expect(result.payload?.rawPluginMeta).toHaveProperty("rank_math_title");
  });

  it("providerOverride가 있으면 환경변수보다 우선한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "rank_math");

    const result = await generateSeoPluginPayload("article-1", "aioseo");

    expect(result.provider).toBe("aioseo");
  });

  it("환경변수가 없으면 기본값 none을 사용한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    vi.stubEnv("SEO_PLUGIN_PROVIDER", "");

    const result = await generateSeoPluginPayload("article-1");

    expect(result.provider).toBe("none");
  });

  it("생성된 payload와 provider를 articles에 저장한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());

    await generateSeoPluginPayload("article-1", "yoast");

    expect(saveSeoPluginMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ articleId: "article-1", provider: "yoast", status: "generated" })
    );
  });

  it("실패 시 failed 상태로 저장을 시도하고 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(makeArticle());
    saveSeoPluginMetadata.mockRejectedValueOnce(new Error("DB 오류")).mockResolvedValueOnce({});

    const result = await generateSeoPluginPayload("article-1", "yoast");

    expect(result.success).toBe(false);
    expect(result.message).toContain("DB 오류");
    expect(saveSeoPluginMetadata).toHaveBeenCalledTimes(2);
  });
});

describe("reviewSeoPluginMetadata", () => {
  it("존재하지 않는 기사면 실패를 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await reviewSeoPluginMetadata("missing");

    expect(result.success).toBe(false);
    expect(markSeoPluginMetadataReviewed).not.toHaveBeenCalled();
  });

  it("검토 완료를 표시한다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ seoPluginMetadataStatus: "generated" }));

    const result = await reviewSeoPluginMetadata("article-1");

    expect(result.success).toBe(true);
    expect(markSeoPluginMetadataReviewed).toHaveBeenCalledWith("article-1");
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "seo_plugin_metadata_reviewed" }));
  });
});
