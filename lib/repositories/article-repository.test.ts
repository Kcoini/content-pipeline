import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleRow } from "@/lib/supabase/database.types";

const createServerSupabaseClient = vi.fn();
const getSuccessfulWordPressDraft = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: (...args: unknown[]) => createServerSupabaseClient(...args),
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  getSuccessfulWordPressDraft: (...args: unknown[]) => getSuccessfulWordPressDraft(...args),
}));

const {
  ArticleNotEditableError,
  EmptyContentError,
  assertArticleApprovable,
  assertArticleEditable,
  mapArticleRowToArticle,
  getArticles,
  archiveArticle,
  getArticleRelatedCounts,
  saveArticleMasterManuscript,
  readArticleMasterManuscript,
} = await import("./article-repository");

function makeChain(result: { data: unknown; error: unknown; count?: number | null }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.update = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.in = vi.fn(self);
  chain.is = vi.fn(self);
  chain.order = vi.fn(self);
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

beforeEach(() => {
  createServerSupabaseClient.mockReset();
  getSuccessfulWordPressDraft.mockReset();
});

function makeArticleRow(overrides: Partial<ArticleRow> = {}): ArticleRow {
  return {
    id: "article-1",
    theme_id: "theme-1",
    title: "AI 에이전트 동향",
    content: "본문".repeat(300),
    status: "draft",
    version: 1,
    reviewed_at: null,
    reviewed_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    article_mode: "source_based_explainer",
    seo_title: null,
    meta_description: null,
    slug: null,
    target_keyword: null,
    secondary_keywords: [],
    search_intent: null,
    reader_persona: null,
    ad_slots: [],
    internal_link_suggestions: [],
    monetization_score: null,
    policy_risk_score: null,
    format_metadata: {},
    wp_category_names: [],
    wp_tag_names: [],
    wp_category_ids: [],
    wp_tag_ids: [],
    wp_metadata_status: "not_ready",
    wp_metadata_generated_at: null,
    seo_plugin_provider: "none",
    seo_plugin_payload: {},
    seo_plugin_metadata_status: "not_ready",
    seo_plugin_metadata_generated_at: null,
    seo_plugin_write_status: "not_attempted",
    seo_plugin_write_error: null,
    featured_image_status: "not_ready",
    featured_image_prompt: null,
    featured_image_alt_text: null,
    featured_image_caption: null,
    featured_image_style: null,
    featured_image_aspect_ratio: "16:9",
    featured_image_metadata: {},
    featured_image_generated_at: null,
    featured_image_reviewed_at: null,
    featured_image_wordpress_media_id: null,
    featured_image_wordpress_url: null,
    featured_image_error: null,
    featured_image_source_type: "none",
    featured_image_source_url: null,
    featured_image_local_path: null,
    featured_image_filename: null,
    featured_image_mime_type: null,
    featured_image_upload_status: "not_ready",
    featured_image_upload_payload: {},
    featured_image_upload_error: null,
    featured_image_upload_attempted_at: null,
    featured_image_source_status: "none",
    featured_image_source_error: null,
    featured_image_manual_source_saved_at: null,
    generated_image_status: "not_generated",
    generated_image_provider: "mock",
    generated_image_model: null,
    generated_image_prompt: null,
    generated_image_negative_prompt: null,
    generated_image_url: null,
    generated_image_local_path: null,
    generated_image_width: null,
    generated_image_height: null,
    generated_image_format: null,
    generated_image_metadata: {},
    generated_image_error: null,
    generated_image_requested_at: null,
    generated_image_completed_at: null,
    generated_image_reviewed_at: null,
    wordpress_featured_media_attach_status: "not_attached",
    wordpress_featured_media_attached_at: null,
    wordpress_featured_media_attach_error: null,
    seo_plugin_actual_write_status: "not_attempted",
    seo_plugin_actual_write_provider: null,
    seo_plugin_actual_write_post_id: null,
    seo_plugin_actual_write_error: null,
    seo_plugin_actual_write_attempted_at: null,
    seo_plugin_actual_write_verified: false,
    seo_plugin_actual_write_warning: null,
    seo_plugin_custom_endpoint_status: "not_attempted",
    seo_plugin_custom_endpoint_verified: false,
    seo_plugin_custom_endpoint_error: null,
    seo_plugin_custom_endpoint_attempted_at: null,
    wordpress_final_draft_review_status: "not_reviewed",
    wordpress_final_draft_review_score: null,
    wordpress_final_draft_review_summary: {},
    wordpress_final_draft_review_error: null,
    wordpress_final_draft_reviewed_at: null,
    publish_quality_gate_status: "not_checked",
    publish_quality_gate_score: null,
    publish_quality_gate_summary: {},
    publish_quality_gate_error: null,
    publish_quality_gate_checked_at: null,
    publish_ready: false,
    publish_blocked_reason: null,
    public_publish_approval_status: "not_requested",
    public_publish_approved: false,
    public_publish_approved_at: null,
    public_publish_approved_by: null,
    public_publish_approval_error: null,
    public_publish_approval_notes: null,
    public_publish_status: "not_published",
    public_published: false,
    public_published_at: null,
    public_publish_post_id: null,
    public_publish_url: null,
    public_publish_error: null,
    public_publish_attempted_at: null,
    ...overrides,
  };
}

describe("mapArticleRowToArticle", () => {
  it("articles row와 인용 출처 id 목록을 Article로 변환한다", () => {
    const row = makeArticleRow();
    const article = mapArticleRowToArticle(row, ["source-1", "source-2", "source-3"]);

    expect(article).toEqual({
      id: "article-1",
      themeId: "theme-1",
      title: "AI 에이전트 동향",
      content: row.content,
      status: "draft",
      citedSourceIds: ["source-1", "source-2", "source-3"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      archivedAt: null,
      reviewedAt: null,
      reviewedBy: null,
      articleMode: "source_based_explainer",
      seoTitle: null,
      metaDescription: null,
      slug: null,
      targetKeyword: null,
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
      featuredImageStatus: "not_ready",
      featuredImagePrompt: null,
      featuredImageAltText: null,
      featuredImageCaption: null,
      featuredImageStyle: null,
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
      featuredImageSourceStatus: "none",
      featuredImageSourceError: null,
      featuredImageManualSourceSavedAt: null,
      generatedImageStatus: "not_generated",
      generatedImageProvider: "mock",
      generatedImageModel: null,
      generatedImagePrompt: null,
      generatedImageNegativePrompt: null,
      generatedImageUrl: null,
      generatedImageLocalPath: null,
      generatedImageWidth: null,
      generatedImageHeight: null,
      generatedImageFormat: null,
      generatedImageMetadata: {},
      generatedImageError: null,
      generatedImageRequestedAt: null,
      generatedImageCompletedAt: null,
      generatedImageReviewedAt: null,
      wordpressFeaturedMediaAttachStatus: "not_attached",
      wordpressFeaturedMediaAttachedAt: null,
      wordpressFeaturedMediaAttachError: null,
      seoPluginActualWriteStatus: "not_attempted",
      seoPluginActualWriteProvider: null,
      seoPluginActualWritePostId: null,
      seoPluginActualWriteError: null,
      seoPluginActualWriteAttemptedAt: null,
      seoPluginActualWriteVerified: false,
      seoPluginActualWriteWarning: null,
      seoPluginCustomEndpointStatus: "not_attempted",
      seoPluginCustomEndpointVerified: false,
      seoPluginCustomEndpointError: null,
      seoPluginCustomEndpointAttemptedAt: null,
      wordpressFinalDraftReviewStatus: "not_reviewed",
      wordpressFinalDraftReviewScore: null,
      wordpressFinalDraftReviewSummary: {},
      wordpressFinalDraftReviewError: null,
      wordpressFinalDraftReviewedAt: null,
      publishQualityGateStatus: "not_checked",
      publishQualityGateScore: null,
      publishQualityGateSummary: {},
      publishQualityGateError: null,
      publishQualityGateCheckedAt: null,
      publishReady: false,
      publishBlockedReason: null,
      publicPublishApprovalStatus: "not_requested",
      publicPublishApproved: false,
      publicPublishApprovedAt: null,
      publicPublishApprovedBy: null,
      publicPublishApprovalError: null,
      publicPublishApprovalNotes: null,
      publicPublishStatus: "not_published",
      publicPublished: false,
      publicPublishedAt: null,
      publicPublishPostId: null,
      publicPublishUrl: null,
      publicPublishError: null,
      publicPublishAttemptedAt: null,
    });
  });

  it("reviewed 기사는 reviewedAt/reviewedBy를 포함한다", () => {
    const row = makeArticleRow({
      status: "reviewed",
      reviewed_at: "2026-01-02T00:00:00.000Z",
      reviewed_by: "local-user",
    });
    const article = mapArticleRowToArticle(row, []);

    expect(article.status).toBe("reviewed");
    expect(article.reviewedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(article.reviewedBy).toBe("local-user");
  });
});

describe("assertArticleEditable", () => {
  it("draft 상태인 기사는 수정 가능하다 (예외를 던지지 않는다)", () => {
    expect(() => assertArticleEditable({ id: "article-1", status: "draft" })).not.toThrow();
  });

  it("reviewed 상태인 기사는 수정할 수 없다", () => {
    expect(() => assertArticleEditable({ id: "article-1", status: "reviewed" })).toThrow(
      ArticleNotEditableError
    );
  });

  it("published 상태인 기사는 수정할 수 없다", () => {
    expect(() => assertArticleEditable({ id: "article-1", status: "published" })).toThrow(
      ArticleNotEditableError
    );
  });
});

describe("assertArticleApprovable", () => {
  it("본문이 있으면 승인 가능하다 (예외를 던지지 않는다)", () => {
    expect(() =>
      assertArticleApprovable({ id: "article-1", content: "본문 내용".repeat(100) })
    ).not.toThrow();
  });

  it("본문이 비어 있으면 승인할 수 없다", () => {
    expect(() => assertArticleApprovable({ id: "article-1", content: "" })).toThrow(
      EmptyContentError
    );
  });

  it("본문이 공백뿐이면 승인할 수 없다", () => {
    expect(() => assertArticleApprovable({ id: "article-1", content: "   \n  " })).toThrow(
      EmptyContentError
    );
  });
});

function makeSupabaseFrom(articlesChain: Record<string, unknown>) {
  const articleSourcesChain = {
    select: vi.fn(() => articleSourcesChain),
    in: vi.fn(() => Promise.resolve({ data: [], error: null })),
  };
  return vi.fn((table: string) => (table === "articles" ? articlesChain : articleSourcesChain));
}

describe("getArticles", () => {
  it("기본적으로 archived_at is null 조건을 사용한다(보관된 기사 제외)", async () => {
    const chain = makeChain({ data: [makeArticleRow()], error: null });
    createServerSupabaseClient.mockReturnValue({ from: makeSupabaseFrom(chain) });

    await getArticles();

    expect(chain.is).toHaveBeenCalledWith("archived_at", null);
  });

  it("includeArchived: true면 archived_at 필터를 사용하지 않는다", async () => {
    const chain = makeChain({ data: [makeArticleRow()], error: null });
    createServerSupabaseClient.mockReturnValue({ from: makeSupabaseFrom(chain) });

    await getArticles({ includeArchived: true });

    expect(chain.is).not.toHaveBeenCalled();
  });
});

describe("archiveArticle", () => {
  it("archived_at을 현재 시각으로 설정한다(hard delete가 아니다)", async () => {
    const chain = makeChain({ data: makeArticleRow({ archived_at: "2026-02-01T00:00:00.000Z" }), error: null });
    const from = makeSupabaseFrom(chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await archiveArticle("article-1");

    expect(from).toHaveBeenCalledWith("articles");
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ archived_at: expect.any(String) }));
    expect(chain.eq).toHaveBeenCalledWith("id", "article-1");
    expect(result.archivedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("존재하지 않는 기사면 에러를 던진다", async () => {
    const chain = makeChain({ data: null, error: null });
    createServerSupabaseClient.mockReturnValue({ from: makeSupabaseFrom(chain) });

    await expect(archiveArticle("missing-article")).rejects.toThrow("기사를 찾을 수 없습니다");
  });
});

describe("getArticleRelatedCounts", () => {
  it("연결된 social post 개수와 WordPress post 존재 여부를 반환한다", async () => {
    const socialPostsChain = makeChain({ data: null, error: null, count: 3 });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => socialPostsChain) });
    getSuccessfulWordPressDraft.mockResolvedValue({ externalPostId: "42", postUrl: "https://example.com" });

    const counts = await getArticleRelatedCounts("article-1");

    expect(counts).toEqual({ socialPostCount: 3, hasWordPressPost: true });
  });

  it("WordPress draft가 없으면 hasWordPressPost=false다", async () => {
    const socialPostsChain = makeChain({ data: null, error: null, count: 0 });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => socialPostsChain) });
    getSuccessfulWordPressDraft.mockResolvedValue(null);

    const counts = await getArticleRelatedCounts("article-1");

    expect(counts).toEqual({ socialPostCount: 0, hasWordPressPost: false });
  });
});

describe("readArticleMasterManuscript (Phase 4-2, 순수 함수)", () => {
  it("format_metadata.master_manuscript가 없으면 null을 반환한다", () => {
    expect(readArticleMasterManuscript({ formatMetadata: {} })).toBeNull();
  });

  it("format_metadata.master_manuscript가 있으면 그대로 반환한다", () => {
    const master = { mainMessage: "핵심 메시지" };
    expect(readArticleMasterManuscript({ formatMetadata: { master_manuscript: master } })).toEqual(master);
  });
});

describe("saveArticleMasterManuscript (Phase 4-2)", () => {
  it("format_metadata.master_manuscript 네임스페이스로 저장한다(기존 format_metadata 유지)", async () => {
    const master = { mainMessage: "핵심 메시지" } as unknown as import("@/lib/articles/master-manuscript-types").MasterManuscript;
    const updatedRow = makeArticleRow({
      format_metadata: { wordpress: { slug: "test" }, master_manuscript: master },
    });
    const chain = makeChain({ data: updatedRow, error: null });
    // getArticleById(select)와 최종 update(select) 둘 다 같은 chain을 쓴다 — archiveArticle 테스트와 동일한 패턴.
    createServerSupabaseClient.mockReturnValue({ from: makeSupabaseFrom(chain) });

    const result = await saveArticleMasterManuscript("article-1", master);

    expect(chain.update).toHaveBeenCalledWith({
      format_metadata: { wordpress: { slug: "test" }, master_manuscript: master },
    });
    expect(result.formatMetadata).toEqual({ wordpress: { slug: "test" }, master_manuscript: master });
  });

  it("존재하지 않는 기사면 에러를 던진다", async () => {
    const chain = makeChain({ data: null, error: null });
    createServerSupabaseClient.mockReturnValue({ from: makeSupabaseFrom(chain) });

    await expect(
      saveArticleMasterManuscript("missing-article", {} as unknown as import("@/lib/articles/master-manuscript-types").MasterManuscript)
    ).rejects.toThrow("기사를 찾을 수 없습니다");
  });
});
