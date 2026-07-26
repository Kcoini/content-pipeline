import { describe, expect, it } from "vitest";
import {
  ArticleNotEditableError,
  EmptyContentError,
  assertArticleApprovable,
  assertArticleEditable,
  mapArticleRowToArticle,
} from "./article-repository";
import type { ArticleRow } from "@/lib/supabase/database.types";

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
