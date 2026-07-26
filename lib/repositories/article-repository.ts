// articles / article_sources 테이블 ↔ Article 도메인 타입 매핑 및 데이터 접근.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ArticleRow } from "@/lib/supabase/database.types";
import type {
  Article,
  ArticleStatus,
  SeoPluginProvider,
  WordPressMediaSourceType,
  WordPressMediaUploadStatus,
  ImageGenerationProvider,
  GeneratedImageStatus,
  WordPressFeaturedMediaAttachStatus,
  SeoPluginActualWriteStatus,
  SeoPluginCustomEndpointStatus,
  WordPressFinalDraftReviewStatus,
  PublishQualityGateStatus,
  PublicPublishApprovalStatus,
} from "@/lib/types/domain";
import type { SeoPluginPayload } from "@/lib/seo/seo-plugin-types";
import type { FeaturedImageMetadata } from "@/lib/images/featured-image-types";
import type { WordPressMediaUploadPayload } from "@/lib/publish/wordpress-media-types";
import { assertApproved } from "@/lib/harness/approval-gate";
import { saveApprovalLog } from "@/lib/repositories/approval-repository";
import {
  DEFAULT_ARTICLE_MODE,
  resolveArticleMode,
  type AdSlotEntry,
  type ArticleMode,
  type InternalLinkSuggestion,
} from "@/lib/articles/article-modes";
import type { GeneratedArticle } from "@/lib/ai/article-writer";

export interface SaveDraftArticleInput {
  themeId: string;
  title: string;
  content: string;
  citedSourceIds: string[];
  /** Phase 2-1: 글쓰기 모드 (기본값 source_based_explainer) */
  articleMode?: ArticleMode;
  /** Phase 2-1: monetized_blog 등 모드별 부가 필드. 생략 시 저장하지 않는다. */
  modeFields?: Pick<
    GeneratedArticle,
    | "seoTitle"
    | "metaDescription"
    | "targetKeyword"
    | "secondaryKeywords"
    | "searchIntent"
    | "readerPersona"
    | "adSlots"
    | "internalLinkSuggestions"
    | "monetizationScore"
    | "policyRiskScore"
  >;
}

export interface UpdateDraftArticleInput {
  articleId: string;
  title: string;
  content: string;
}

export interface ApproveArticleInput {
  articleId: string;
  approvedBy: string;
}

/** 존재하지 않는 기사 id로 조회/수정/승인을 시도했을 때 발생한다. */
export class ArticleNotFoundError extends Error {
  constructor(articleId: string) {
    super(`기사를 찾을 수 없습니다: ${articleId}`);
    this.name = "ArticleNotFoundError";
  }
}

/** draft가 아닌 기사를 수정하려고 할 때 발생한다 (Phase 1-5: reviewed 기사는 수정 불가). */
export class ArticleNotEditableError extends Error {
  constructor(articleId: string, status: ArticleStatus) {
    super(`기사(${articleId})는 '${status}' 상태이므로 수정할 수 없습니다 (draft 상태만 수정 가능합니다).`);
    this.name = "ArticleNotEditableError";
  }
}

/** 본문이 비어 있는 기사를 승인하려고 할 때 발생한다. */
export class EmptyContentError extends Error {
  constructor(articleId: string) {
    super(`기사(${articleId})의 본문이 비어 있어 승인할 수 없습니다.`);
    this.name = "EmptyContentError";
  }
}

export function mapArticleRowToArticle(row: ArticleRow, citedSourceIds: string[]): Article {
  return {
    id: row.id,
    themeId: row.theme_id,
    title: row.title,
    content: row.content,
    status: row.status,
    citedSourceIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    articleMode: resolveArticleMode(row.article_mode),
    seoTitle: row.seo_title,
    metaDescription: row.meta_description,
    slug: row.slug,
    targetKeyword: row.target_keyword,
    secondaryKeywords: row.secondary_keywords ?? [],
    searchIntent: row.search_intent,
    readerPersona: row.reader_persona,
    adSlots: (row.ad_slots ?? []) as unknown as AdSlotEntry[],
    internalLinkSuggestions: (row.internal_link_suggestions ?? []) as unknown as InternalLinkSuggestion[],
    monetizationScore: row.monetization_score,
    policyRiskScore: row.policy_risk_score,
    formatMetadata: row.format_metadata ?? {},
    wpCategoryNames: row.wp_category_names ?? [],
    wpTagNames: row.wp_tag_names ?? [],
    wpCategoryIds: row.wp_category_ids ?? [],
    wpTagIds: row.wp_tag_ids ?? [],
    wpMetadataStatus: row.wp_metadata_status ?? "not_ready",
    wpMetadataGeneratedAt: row.wp_metadata_generated_at,
    seoPluginProvider: row.seo_plugin_provider ?? "none",
    seoPluginPayload: row.seo_plugin_payload ?? {},
    seoPluginMetadataStatus: row.seo_plugin_metadata_status ?? "not_ready",
    seoPluginMetadataGeneratedAt: row.seo_plugin_metadata_generated_at,
    seoPluginWriteStatus: row.seo_plugin_write_status ?? "not_attempted",
    seoPluginWriteError: row.seo_plugin_write_error,
    featuredImageStatus: row.featured_image_status ?? "not_ready",
    featuredImagePrompt: row.featured_image_prompt,
    featuredImageAltText: row.featured_image_alt_text,
    featuredImageCaption: row.featured_image_caption,
    featuredImageStyle: row.featured_image_style,
    featuredImageAspectRatio: row.featured_image_aspect_ratio ?? "16:9",
    featuredImageMetadata: row.featured_image_metadata ?? {},
    featuredImageGeneratedAt: row.featured_image_generated_at,
    featuredImageReviewedAt: row.featured_image_reviewed_at,
    featuredImageWordpressMediaId: row.featured_image_wordpress_media_id,
    featuredImageWordpressUrl: row.featured_image_wordpress_url,
    featuredImageError: row.featured_image_error,
    featuredImageSourceType: row.featured_image_source_type ?? "none",
    featuredImageSourceUrl: row.featured_image_source_url,
    featuredImageLocalPath: row.featured_image_local_path,
    featuredImageFilename: row.featured_image_filename,
    featuredImageMimeType: row.featured_image_mime_type,
    featuredImageUploadStatus: row.featured_image_upload_status ?? "not_ready",
    featuredImageUploadPayload: row.featured_image_upload_payload ?? {},
    featuredImageUploadError: row.featured_image_upload_error,
    featuredImageUploadAttemptedAt: row.featured_image_upload_attempted_at,
    generatedImageStatus: row.generated_image_status ?? "not_generated",
    generatedImageProvider: row.generated_image_provider ?? "mock",
    generatedImageModel: row.generated_image_model,
    generatedImagePrompt: row.generated_image_prompt,
    generatedImageNegativePrompt: row.generated_image_negative_prompt,
    generatedImageUrl: row.generated_image_url,
    generatedImageLocalPath: row.generated_image_local_path,
    generatedImageWidth: row.generated_image_width,
    generatedImageHeight: row.generated_image_height,
    generatedImageFormat: row.generated_image_format,
    generatedImageMetadata: row.generated_image_metadata ?? {},
    generatedImageError: row.generated_image_error,
    generatedImageRequestedAt: row.generated_image_requested_at,
    generatedImageCompletedAt: row.generated_image_completed_at,
    generatedImageReviewedAt: row.generated_image_reviewed_at,
    wordpressFeaturedMediaAttachStatus: row.wordpress_featured_media_attach_status ?? "not_attached",
    wordpressFeaturedMediaAttachedAt: row.wordpress_featured_media_attached_at,
    wordpressFeaturedMediaAttachError: row.wordpress_featured_media_attach_error,
    seoPluginActualWriteStatus: row.seo_plugin_actual_write_status ?? "not_attempted",
    seoPluginActualWriteProvider: row.seo_plugin_actual_write_provider,
    seoPluginActualWritePostId: row.seo_plugin_actual_write_post_id,
    seoPluginActualWriteError: row.seo_plugin_actual_write_error,
    seoPluginActualWriteAttemptedAt: row.seo_plugin_actual_write_attempted_at,
    seoPluginActualWriteVerified: row.seo_plugin_actual_write_verified ?? false,
    seoPluginActualWriteWarning: row.seo_plugin_actual_write_warning,
    seoPluginCustomEndpointStatus: row.seo_plugin_custom_endpoint_status ?? "not_attempted",
    seoPluginCustomEndpointVerified: row.seo_plugin_custom_endpoint_verified ?? false,
    seoPluginCustomEndpointError: row.seo_plugin_custom_endpoint_error,
    seoPluginCustomEndpointAttemptedAt: row.seo_plugin_custom_endpoint_attempted_at,
    wordpressFinalDraftReviewStatus: row.wordpress_final_draft_review_status ?? "not_reviewed",
    wordpressFinalDraftReviewScore: row.wordpress_final_draft_review_score,
    wordpressFinalDraftReviewSummary: row.wordpress_final_draft_review_summary ?? {},
    wordpressFinalDraftReviewError: row.wordpress_final_draft_review_error,
    wordpressFinalDraftReviewedAt: row.wordpress_final_draft_reviewed_at,
    publishQualityGateStatus: row.publish_quality_gate_status ?? "not_checked",
    publishQualityGateScore: row.publish_quality_gate_score,
    publishQualityGateSummary: row.publish_quality_gate_summary ?? {},
    publishQualityGateError: row.publish_quality_gate_error,
    publishQualityGateCheckedAt: row.publish_quality_gate_checked_at,
    publishReady: row.publish_ready ?? false,
    publishBlockedReason: row.publish_blocked_reason,
    publicPublishApprovalStatus: row.public_publish_approval_status ?? "not_requested",
    publicPublishApproved: row.public_publish_approved ?? false,
    publicPublishApprovedAt: row.public_publish_approved_at,
    publicPublishApprovedBy: row.public_publish_approved_by,
    publicPublishApprovalError: row.public_publish_approval_error,
    publicPublishApprovalNotes: row.public_publish_approval_notes,
  };
}

/** draft 상태의 기사만 수정할 수 있다 (Phase 1-5 정책: reviewed 기사는 수정 불가). */
export function assertArticleEditable(article: Pick<Article, "id" | "status">): void {
  if (article.status !== "draft") {
    throw new ArticleNotEditableError(article.id, article.status);
  }
}

/** 본문이 비어 있는 기사는 승인할 수 없다. */
export function assertArticleApprovable(article: Pick<Article, "id" | "content">): void {
  if (article.content.trim().length === 0) {
    throw new EmptyContentError(article.id);
  }
}

/** 여러 기사 id에 대해 인용된 출처 id 목록을 한 번에 조회한다. */
async function getCitedSourceIdsMap(articleIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (articleIds.length === 0) return map;

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("article_sources")
    .select()
    .in("article_id", articleIds);

  if (error) {
    throw new Error(`기사-출처 연결 조회에 실패했습니다: ${error.message}`);
  }

  for (const row of data ?? []) {
    const list = map.get(row.article_id) ?? [];
    list.push(row.source_id);
    map.set(row.article_id, list);
  }

  return map;
}

export async function getArticleByThemeId(themeId: string): Promise<Article | undefined> {
  const supabase = createServerSupabaseClient();

  const { data: articleRow, error: articleError } = await supabase
    .from("articles")
    .select()
    .eq("theme_id", themeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (articleError) {
    throw new Error(`기사 조회에 실패했습니다: ${articleError.message}`);
  }
  if (!articleRow) return undefined;

  const sourceMap = await getCitedSourceIdsMap([articleRow.id]);

  return mapArticleRowToArticle(articleRow, sourceMap.get(articleRow.id) ?? []);
}

/** 전체 기사 목록을 최신 생성순으로 조회한다 (/articles 목록 페이지). */
export async function getArticles(): Promise<Article[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("articles")
    .select()
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`기사 목록 조회에 실패했습니다: ${error.message}`);
  }

  const rows = data ?? [];
  const sourceMap = await getCitedSourceIdsMap(rows.map((row) => row.id));

  return rows.map((row) => mapArticleRowToArticle(row, sourceMap.get(row.id) ?? []));
}

/** 기사 id로 단건 조회한다 (/articles/[id] 상세 페이지). */
export async function getArticleById(articleId: string): Promise<Article | undefined> {
  const supabase = createServerSupabaseClient();

  const { data: articleRow, error } = await supabase
    .from("articles")
    .select()
    .eq("id", articleId)
    .maybeSingle();

  if (error) {
    throw new Error(`기사 조회에 실패했습니다: ${error.message}`);
  }
  if (!articleRow) return undefined;

  const sourceMap = await getCitedSourceIdsMap([articleRow.id]);

  return mapArticleRowToArticle(articleRow, sourceMap.get(articleRow.id) ?? []);
}

/**
 * 계약 검사를 통과한 기사 초안을 status='draft'로 저장한다 (FR-4, FR-5, FR-7).
 * 기존 초안이 있으면 새 초안으로 교체한다.
 */
export async function saveDraftArticle(input: SaveDraftArticleInput): Promise<Article> {
  const supabase = createServerSupabaseClient();

  const { error: deleteError } = await supabase
    .from("articles")
    .delete()
    .eq("theme_id", input.themeId)
    .eq("status", "draft");

  if (deleteError) {
    throw new Error(`기존 기사 초안 삭제에 실패했습니다: ${deleteError.message}`);
  }

  const mode = input.articleMode ?? DEFAULT_ARTICLE_MODE;
  const modeFields = input.modeFields;

  const { data: articleRow, error: insertError } = await supabase
    .from("articles")
    .insert({
      theme_id: input.themeId,
      title: input.title,
      content: input.content,
      status: "draft",
      article_mode: mode,
      seo_title: modeFields?.seoTitle ?? null,
      meta_description: modeFields?.metaDescription ?? null,
      target_keyword: modeFields?.targetKeyword ?? null,
      secondary_keywords: modeFields?.secondaryKeywords ?? [],
      search_intent: modeFields?.searchIntent ?? null,
      reader_persona: modeFields?.readerPersona ?? null,
      ad_slots: (modeFields?.adSlots ?? []) as unknown as Record<string, unknown>[],
      internal_link_suggestions: (modeFields?.internalLinkSuggestions ?? []) as unknown as Record<string, unknown>[],
      monetization_score: modeFields?.monetizationScore ?? null,
      policy_risk_score: modeFields?.policyRiskScore ?? null,
    })
    .select()
    .single();

  if (insertError || !articleRow) {
    throw new Error(`기사 초안 저장에 실패했습니다: ${insertError?.message ?? "unknown error"}`);
  }

  if (input.citedSourceIds.length > 0) {
    const { error: linkError } = await supabase.from("article_sources").insert(
      input.citedSourceIds.map((sourceId) => ({
        article_id: articleRow.id,
        source_id: sourceId,
      }))
    );

    if (linkError) {
      throw new Error(`기사-출처 연결 저장에 실패했습니다: ${linkError.message}`);
    }
  }

  return mapArticleRowToArticle(articleRow, input.citedSourceIds);
}

/**
 * draft 상태인 기사의 title/content를 수정한다 (Phase 1-5).
 * reviewed/published 상태인 기사는 ArticleNotEditableError를 던진다.
 * updated_at은 trg_articles_updated_at 트리거가 자동으로 갱신한다.
 */
export async function updateDraftArticle(input: UpdateDraftArticleInput): Promise<Article> {
  const existing = await getArticleById(input.articleId);
  if (!existing) {
    throw new ArticleNotFoundError(input.articleId);
  }

  assertArticleEditable(existing);

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("articles")
    .update({ title: input.title, content: input.content })
    .eq("id", input.articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`기사 수정에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

/**
 * 사용자의 명시적 승인을 받아 기사를 status='reviewed'로 전환한다 (FR-9, Phase 1-5).
 *
 * - 존재하지 않는 기사 id → ArticleNotFoundError
 * - 본문이 비어 있는 기사 → EmptyContentError
 * - 이미 reviewed 상태인 기사 → 기존 기사를 그대로 반환한다 (중복 승인/중복 로그 방지)
 * - lib/harness/approval-gate.ts의 assertApproved()를 통과해야만 status를 갱신한다
 * - 승인 성공 시 approval_logs에 action='approve_article' 기록을 남긴다
 */
export async function approveArticle(input: ApproveArticleInput): Promise<Article> {
  const existing = await getArticleById(input.articleId);
  if (!existing) {
    throw new ArticleNotFoundError(input.articleId);
  }

  assertArticleApprovable(existing);

  if (existing.status === "reviewed") {
    return existing;
  }

  assertApproved({
    entityType: "article",
    entityId: existing.id,
    fromStatus: existing.status,
    toStatus: "reviewed",
    approved: true,
    approvedBy: input.approvedBy,
  });

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("articles")
    .update({
      status: "reviewed",
      reviewed_at: new Date().toISOString(),
      reviewed_by: input.approvedBy,
    })
    .eq("id", input.articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`기사 승인 처리에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  await saveApprovalLog({
    articleId: existing.id,
    themeId: existing.themeId,
    targetType: "article",
    targetId: existing.id,
    action: "approve_article",
    status: "approved",
    approvedBy: input.approvedBy,
    notes: "Article approved from review screen",
  });

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

export interface SaveWordPressMetadataInput {
  articleId: string;
  seoTitle: string;
  metaDescription: string;
  slug: string;
  targetKeyword?: string;
  /** target_keyword를 어떻게 결정했는지(explicit/theme/title_fallback/none). warning 판단에 사용한다. */
  targetKeywordSource?: string;
  secondaryKeywords?: string[];
  internalLinkSuggestions?: InternalLinkSuggestion[];
  categoryNames: string[];
  tagNames: string[];
  categoryIds?: number[];
  tagIds?: number[];
  /** 'generated' 또는 'failed' — 'reviewed'는 markWordPressMetadataReviewed로만 전환한다. */
  status: "generated" | "failed";
}

/**
 * WordPress 게시 준비용 metadata(SEO 제목/설명/slug/카테고리/태그 등)를 저장한다 (Phase 2-3).
 * seo_title/meta_description/slug/target_keyword/secondary_keywords/internal_link_suggestions는
 * Phase 2-1에서 추가된 컬럼을 재사용하고, wp_category_names 등은 Phase 2-3 신규 컬럼에 저장한다.
 * format_metadata.wordpress에도 동일한 정보를 요약해 저장한다.
 */
export async function saveWordPressMetadata(input: SaveWordPressMetadataInput): Promise<Article> {
  const existing = await getArticleById(input.articleId);
  if (!existing) {
    throw new ArticleNotFoundError(input.articleId);
  }

  const supabase = createServerSupabaseClient();

  const wordpressFormatMetadata = {
    category_names: input.categoryNames,
    tag_names: input.tagNames,
    slug: input.slug,
    seo_title: input.seoTitle,
    meta_description: input.metaDescription,
    internal_links: input.internalLinkSuggestions ?? existing.internalLinkSuggestions,
    ad_slots: existing.adSlots,
    target_keyword_source: input.targetKeywordSource ?? null,
  };

  const formatMetadata = {
    ...existing.formatMetadata,
    wordpress: wordpressFormatMetadata,
  };

  const { data, error } = await supabase
    .from("articles")
    .update({
      seo_title: input.seoTitle,
      meta_description: input.metaDescription,
      slug: input.slug,
      target_keyword: input.targetKeyword ?? existing.targetKeyword,
      secondary_keywords: input.secondaryKeywords ?? existing.secondaryKeywords,
      internal_link_suggestions: (input.internalLinkSuggestions ??
        existing.internalLinkSuggestions) as unknown as Record<string, unknown>[],
      wp_category_names: input.categoryNames,
      wp_tag_names: input.tagNames,
      wp_category_ids: input.categoryIds ?? [],
      wp_tag_ids: input.tagIds ?? [],
      wp_metadata_status: input.status,
      wp_metadata_generated_at: new Date().toISOString(),
      format_metadata: formatMetadata,
    })
    .eq("id", input.articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`WordPress metadata 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

/** WordPress metadata를 사람이 검토 완료했음을 표시한다 (wp_metadata_status='reviewed'). */
export async function markWordPressMetadataReviewed(articleId: string): Promise<Article> {
  const existing = await getArticleById(articleId);
  if (!existing) {
    throw new ArticleNotFoundError(articleId);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("articles")
    .update({ wp_metadata_status: "reviewed" })
    .eq("id", articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`WordPress metadata 검토 처리에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

export interface SaveSeoPluginMetadataInput {
  articleId: string;
  provider: SeoPluginProvider;
  payload: SeoPluginPayload;
  /** 'generated' 또는 'failed' — 'reviewed'는 markSeoPluginMetadataReviewed로만 전환한다. */
  status: "generated" | "failed";
  /** target_keyword가 비어 있어 fallback으로 새로 계산된 경우에만 전달한다 (articles.target_keyword에도 반영). */
  targetKeyword?: string;
  /** target_keyword 결정 방식(explicit/theme/title_fallback/none) — format_metadata.wordpress에 함께 저장한다. */
  targetKeywordSource?: string;
}

/**
 * SEO plugin(Yoast/Rank Math/AIOSEO 등) metadata mapping 결과를 저장한다 (Phase 2-4).
 * 실제 plugin write는 하지 않으며, payload 저장/상태 갱신만 수행한다. target_keyword가
 * 비어 있어 fallback으로 새로 계산된 경우 articles.target_keyword도 함께 채워
 * 다음 단계(실제 write)에서 다시 비어 보이지 않게 한다.
 */
export async function saveSeoPluginMetadata(input: SaveSeoPluginMetadataInput): Promise<Article> {
  const existing = await getArticleById(input.articleId);
  if (!existing) {
    throw new ArticleNotFoundError(input.articleId);
  }

  const supabase = createServerSupabaseClient();

  const update: Partial<ArticleRow> = {
    seo_plugin_provider: input.provider,
    seo_plugin_payload: input.payload as unknown as Record<string, unknown>,
    seo_plugin_metadata_status: input.status,
    seo_plugin_metadata_generated_at: new Date().toISOString(),
  };
  if (input.targetKeyword !== undefined) {
    update.target_keyword = input.targetKeyword;
  }
  if (input.targetKeywordSource !== undefined) {
    update.format_metadata = {
      ...existing.formatMetadata,
      wordpress: {
        ...((existing.formatMetadata as { wordpress?: Record<string, unknown> })?.wordpress ?? {}),
        target_keyword_source: input.targetKeywordSource,
      },
    };
  }

  const { data, error } = await supabase
    .from("articles")
    .update(update)
    .eq("id", input.articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`SEO plugin metadata 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

/** SEO plugin metadata를 사람이 검토 완료했음을 표시한다 (seo_plugin_metadata_status='reviewed'). */
export async function markSeoPluginMetadataReviewed(articleId: string): Promise<Article> {
  const existing = await getArticleById(articleId);
  if (!existing) {
    throw new ArticleNotFoundError(articleId);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("articles")
    .update({ seo_plugin_metadata_status: "reviewed" })
    .eq("id", articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`SEO plugin metadata 검토 처리에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

/**
 * SEO plugin 실제 write 시도 결과를 저장한다 (Phase 2-4, safe stub 결과 반영).
 * lib/seo/seo-plugin-writer.ts의 applySeoPluginMetadata 결과를 기록할 때 사용한다.
 */
export async function updateSeoPluginWriteStatus(
  articleId: string,
  status: Article["seoPluginWriteStatus"],
  errorMessage?: string | null
): Promise<Article> {
  const existing = await getArticleById(articleId);
  if (!existing) {
    throw new ArticleNotFoundError(articleId);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("articles")
    .update({
      seo_plugin_write_status: status,
      seo_plugin_write_error: errorMessage ?? null,
    })
    .eq("id", articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`SEO plugin write 상태 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

export interface SaveFeaturedImageMetadataInput {
  articleId: string;
  metadata: FeaturedImageMetadata;
  /** 'prepared' 또는 'failed' — 'reviewed'는 markFeaturedImageReviewed로만 전환한다. */
  status: "prepared" | "failed";
  error?: string;
}

/**
 * 대표 이미지(featured image) 준비 정보를 저장한다 (Phase 2-5).
 * 실제 이미지 생성/업로드는 하지 않으며, prompt/alt text/caption/style 등의
 * "준비 정보"만 저장한다. format_metadata.featured_image에도 요약을 저장한다.
 */
export async function saveFeaturedImageMetadata(input: SaveFeaturedImageMetadataInput): Promise<Article> {
  const existing = await getArticleById(input.articleId);
  if (!existing) {
    throw new ArticleNotFoundError(input.articleId);
  }

  const supabase = createServerSupabaseClient();

  const formatMetadata = {
    ...existing.formatMetadata,
    featured_image: {
      prompt: input.metadata.prompt,
      alt_text: input.metadata.altText,
      caption: input.metadata.caption,
      style: input.metadata.style,
      aspect_ratio: input.metadata.aspectRatio,
    },
  };

  const { data, error } = await supabase
    .from("articles")
    .update({
      featured_image_status: input.status,
      featured_image_prompt: input.metadata.prompt || null,
      featured_image_alt_text: input.metadata.altText || null,
      featured_image_caption: input.metadata.caption || null,
      featured_image_style: input.metadata.style || null,
      featured_image_aspect_ratio: input.metadata.aspectRatio,
      featured_image_metadata: input.metadata as unknown as Record<string, unknown>,
      featured_image_generated_at: new Date().toISOString(),
      featured_image_error: input.error ?? null,
      format_metadata: formatMetadata,
    })
    .eq("id", input.articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`대표 이미지 준비 정보 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

/** 대표 이미지 준비 정보를 사람이 검토 완료했음을 표시한다 (featured_image_status='reviewed'). */
export async function markFeaturedImageReviewed(articleId: string): Promise<Article> {
  const existing = await getArticleById(articleId);
  if (!existing) {
    throw new ArticleNotFoundError(articleId);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("articles")
    .update({
      featured_image_status: "reviewed",
      featured_image_reviewed_at: new Date().toISOString(),
    })
    .eq("id", articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`대표 이미지 검토 처리에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

export interface SaveWordPressMediaUploadPayloadInput {
  articleId: string;
  sourceType: WordPressMediaSourceType;
  /** Phase 2-7: generated image URL/local path로부터 source가 갱신된 경우에만 전달한다. */
  sourceUrl?: string;
  localPath?: string;
  filename: string;
  mimeType: string;
  payload: WordPressMediaUploadPayload;
  /** 'prepared' 또는 'failed' — 'dry_run'/'skipped'/'uploaded'는 updateWordPressMediaUploadStatus로만 전환한다. */
  status: "prepared" | "failed";
  error?: string;
}

/**
 * WordPress media upload 준비 정보(payload)를 저장한다 (Phase 2-6).
 * 실제 이미지 생성/업로드는 하지 않으며, WordPress media endpoint에 전달할
 * "준비된 payload"만 저장한다. Phase 2-7: generated image의 URL/local path로
 * source가 갱신된 경우 sourceUrl/localPath도 함께 저장한다.
 */
export async function saveWordPressMediaUploadPayload(
  input: SaveWordPressMediaUploadPayloadInput
): Promise<Article> {
  const existing = await getArticleById(input.articleId);
  if (!existing) {
    throw new ArticleNotFoundError(input.articleId);
  }

  const supabase = createServerSupabaseClient();

  const update: Partial<ArticleRow> = {
    featured_image_source_type: input.sourceType,
    featured_image_filename: input.filename,
    featured_image_mime_type: input.mimeType,
    featured_image_upload_status: input.status,
    featured_image_upload_payload: input.payload as unknown as Record<string, unknown>,
    featured_image_upload_error: input.error ?? null,
    featured_image_upload_attempted_at: new Date().toISOString(),
  };
  if (input.sourceUrl !== undefined) update.featured_image_source_url = input.sourceUrl;
  if (input.localPath !== undefined) update.featured_image_local_path = input.localPath;

  const { data, error } = await supabase
    .from("articles")
    .update(update)
    .eq("id", input.articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`WordPress media upload 준비 정보 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

/** WordPress media upload 시도 상태(dry_run/skipped/uploaded/failed)를 갱신한다. */
export async function updateWordPressMediaUploadStatus(
  articleId: string,
  status: WordPressMediaUploadStatus,
  errorMessage?: string | null
): Promise<Article> {
  const existing = await getArticleById(articleId);
  if (!existing) {
    throw new ArticleNotFoundError(articleId);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("articles")
    .update({
      featured_image_upload_status: status,
      featured_image_upload_error: errorMessage ?? null,
      featured_image_upload_attempted_at: new Date().toISOString(),
    })
    .eq("id", articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`WordPress media upload 상태 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

export interface MarkGeneratedImageGeneratingInput {
  articleId: string;
  provider: ImageGenerationProvider;
  model: string | null;
  prompt: string;
  negativePrompt: string | null;
}

/**
 * 이미지 생성을 시작하기 전 상태를 'generating'으로 저장한다 (Phase 2-7).
 * requested_at을 이 시점에 기록한다.
 */
export async function markGeneratedImageGenerating(input: MarkGeneratedImageGeneratingInput): Promise<Article> {
  const existing = await getArticleById(input.articleId);
  if (!existing) {
    throw new ArticleNotFoundError(input.articleId);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("articles")
    .update({
      generated_image_status: "generating",
      generated_image_provider: input.provider,
      generated_image_model: input.model,
      generated_image_prompt: input.prompt,
      generated_image_negative_prompt: input.negativePrompt,
      generated_image_requested_at: new Date().toISOString(),
    })
    .eq("id", input.articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`이미지 생성 상태 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

export interface SaveGeneratedImageResultInput {
  articleId: string;
  status: GeneratedImageStatus;
  provider: ImageGenerationProvider;
  model?: string | null;
  imageUrl?: string | null;
  localPath?: string | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  metadata: Record<string, unknown>;
  error?: string | null;
}

/** 이미지 생성 결과(성공/실패)를 저장한다. format_metadata.generated_image에도 요약을 저장한다. */
export async function saveGeneratedImageResult(input: SaveGeneratedImageResultInput): Promise<Article> {
  const existing = await getArticleById(input.articleId);
  if (!existing) {
    throw new ArticleNotFoundError(input.articleId);
  }

  const supabase = createServerSupabaseClient();

  const formatMetadata = {
    ...existing.formatMetadata,
    generated_image: {
      status: input.status,
      provider: input.provider,
      model: input.model ?? null,
      image_url: input.imageUrl ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      format: input.format ?? null,
    },
  };

  const { data, error } = await supabase
    .from("articles")
    .update({
      generated_image_status: input.status,
      generated_image_provider: input.provider,
      generated_image_model: input.model ?? null,
      generated_image_url: input.imageUrl ?? null,
      generated_image_local_path: input.localPath ?? null,
      generated_image_width: input.width ?? null,
      generated_image_height: input.height ?? null,
      generated_image_format: input.format ?? null,
      generated_image_metadata: input.metadata,
      generated_image_error: input.error ?? null,
      generated_image_completed_at: new Date().toISOString(),
      format_metadata: formatMetadata,
    })
    .eq("id", input.articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`이미지 생성 결과 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

/** 생성된 이미지를 사람이 검토 완료했음을 표시한다 (generated_image_status='reviewed'). */
export async function markGeneratedImageReviewed(articleId: string): Promise<Article> {
  const existing = await getArticleById(articleId);
  if (!existing) {
    throw new ArticleNotFoundError(articleId);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("articles")
    .update({
      generated_image_status: "reviewed",
      generated_image_reviewed_at: new Date().toISOString(),
    })
    .eq("id", articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`생성된 이미지 검토 처리에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

export interface SaveFeaturedImageUploadResultInput {
  status: WordPressMediaUploadStatus;
  wordpressMediaId?: number | null;
  wordpressUrl?: string | null;
  errorMessage?: string | null;
  /** 업로드 성공 시 'uploaded'로 갱신한다 (Phase 2-10). */
  sourceType?: WordPressMediaSourceType;
}

/** 실제(또는 시도된) featured image 업로드 결과를 저장한다 (Phase 2-8, Phase 2-10에서 sourceType 추가). */
export async function saveFeaturedImageUploadResult(
  articleId: string,
  input: SaveFeaturedImageUploadResultInput
): Promise<Article> {
  const existing = await getArticleById(articleId);
  if (!existing) {
    throw new ArticleNotFoundError(articleId);
  }

  const supabase = createServerSupabaseClient();

  const update: Partial<ArticleRow> = {
    featured_image_upload_status: input.status,
    featured_image_upload_attempted_at: new Date().toISOString(),
  };
  if (input.wordpressMediaId !== undefined) update.featured_image_wordpress_media_id = input.wordpressMediaId;
  if (input.wordpressUrl !== undefined) update.featured_image_wordpress_url = input.wordpressUrl;
  if (input.errorMessage !== undefined) update.featured_image_upload_error = input.errorMessage;
  if (input.sourceType !== undefined) update.featured_image_source_type = input.sourceType;

  const { data, error } = await supabase
    .from("articles")
    .update(update)
    .eq("id", articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`대표 이미지 업로드 결과 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

export interface SaveWordPressFeaturedMediaAttachResultInput {
  status: WordPressFeaturedMediaAttachStatus;
  errorMessage?: string | null;
}

/** WordPress draft post에 featured_media를 연결한 시도 결과를 저장한다 (Phase 2-11). */
export async function saveWordPressFeaturedMediaAttachResult(
  articleId: string,
  input: SaveWordPressFeaturedMediaAttachResultInput
): Promise<Article> {
  const existing = await getArticleById(articleId);
  if (!existing) {
    throw new ArticleNotFoundError(articleId);
  }

  const supabase = createServerSupabaseClient();

  const update: Partial<ArticleRow> = {
    wordpress_featured_media_attach_status: input.status,
    wordpress_featured_media_attached_at: new Date().toISOString(),
  };
  if (input.errorMessage !== undefined) update.wordpress_featured_media_attach_error = input.errorMessage;

  const { data, error } = await supabase
    .from("articles")
    .update(update)
    .eq("id", articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`WordPress featured_media 연결 결과 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

export interface SaveSeoPluginActualWriteResultInput {
  status: SeoPluginActualWriteStatus;
  provider?: string | null;
  postId?: number | null;
  errorMessage?: string | null;
  verified?: boolean;
  warning?: string | null;
}

/** SEO plugin 실제 metadata write 시도 결과를 저장한다 (Phase 2-12). */
export async function saveSeoPluginActualWriteResult(
  articleId: string,
  input: SaveSeoPluginActualWriteResultInput
): Promise<Article> {
  const existing = await getArticleById(articleId);
  if (!existing) {
    throw new ArticleNotFoundError(articleId);
  }

  const supabase = createServerSupabaseClient();

  const update: Partial<ArticleRow> = {
    seo_plugin_actual_write_status: input.status,
    seo_plugin_actual_write_attempted_at: new Date().toISOString(),
  };
  if (input.provider !== undefined) update.seo_plugin_actual_write_provider = input.provider;
  if (input.postId !== undefined) update.seo_plugin_actual_write_post_id = input.postId;
  if (input.errorMessage !== undefined) update.seo_plugin_actual_write_error = input.errorMessage;
  if (input.verified !== undefined) update.seo_plugin_actual_write_verified = input.verified;
  if (input.warning !== undefined) update.seo_plugin_actual_write_warning = input.warning;

  const { data, error } = await supabase
    .from("articles")
    .update(update)
    .eq("id", articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`SEO plugin 실제 write 결과 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

export interface SaveSeoPluginCustomEndpointResultInput {
  status: SeoPluginCustomEndpointStatus;
  verified?: boolean;
  errorMessage?: string | null;
}

/** WordPress custom SEO endpoint(Rank Math 전용) write 시도 결과를 저장한다 (Phase 2-13). */
export async function saveSeoPluginCustomEndpointResult(
  articleId: string,
  input: SaveSeoPluginCustomEndpointResultInput
): Promise<Article> {
  const existing = await getArticleById(articleId);
  if (!existing) {
    throw new ArticleNotFoundError(articleId);
  }

  const supabase = createServerSupabaseClient();

  const update: Partial<ArticleRow> = {
    seo_plugin_custom_endpoint_status: input.status,
    seo_plugin_custom_endpoint_attempted_at: new Date().toISOString(),
  };
  if (input.verified !== undefined) update.seo_plugin_custom_endpoint_verified = input.verified;
  if (input.errorMessage !== undefined) update.seo_plugin_custom_endpoint_error = input.errorMessage;

  const { data, error } = await supabase
    .from("articles")
    .update(update)
    .eq("id", articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`WordPress custom SEO endpoint 결과 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

export interface SaveWordPressFinalDraftReviewResultInput {
  status: WordPressFinalDraftReviewStatus;
  score?: number | null;
  summary?: Record<string, unknown>;
  errorMessage?: string | null;
}

/** WordPress final draft payload review 결과를 저장한다 (Phase 2-14). */
export async function saveWordPressFinalDraftReviewResult(
  articleId: string,
  input: SaveWordPressFinalDraftReviewResultInput
): Promise<Article> {
  const existing = await getArticleById(articleId);
  if (!existing) {
    throw new ArticleNotFoundError(articleId);
  }

  const supabase = createServerSupabaseClient();

  const update: Partial<ArticleRow> = {
    wordpress_final_draft_review_status: input.status,
    wordpress_final_draft_reviewed_at: new Date().toISOString(),
  };
  if (input.score !== undefined) update.wordpress_final_draft_review_score = input.score;
  if (input.summary !== undefined) update.wordpress_final_draft_review_summary = input.summary;
  if (input.errorMessage !== undefined) update.wordpress_final_draft_review_error = input.errorMessage;

  const { data, error } = await supabase
    .from("articles")
    .update(update)
    .eq("id", articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`WordPress final draft review 결과 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

export interface SavePublishQualityGateResultInput {
  status: PublishQualityGateStatus;
  score?: number | null;
  summary?: Record<string, unknown>;
  errorMessage?: string | null;
  publishReady?: boolean;
  blockedReason?: string | null;
}

/** Publish Quality Gate 실행 결과를 저장한다 (Phase 2-15). */
export async function savePublishQualityGateResult(
  articleId: string,
  input: SavePublishQualityGateResultInput
): Promise<Article> {
  const existing = await getArticleById(articleId);
  if (!existing) {
    throw new ArticleNotFoundError(articleId);
  }

  const supabase = createServerSupabaseClient();

  const update: Partial<ArticleRow> = {
    publish_quality_gate_status: input.status,
    publish_quality_gate_checked_at: new Date().toISOString(),
  };
  if (input.score !== undefined) update.publish_quality_gate_score = input.score;
  if (input.summary !== undefined) update.publish_quality_gate_summary = input.summary;
  if (input.errorMessage !== undefined) update.publish_quality_gate_error = input.errorMessage;
  if (input.publishReady !== undefined) update.publish_ready = input.publishReady;
  if (input.blockedReason !== undefined) update.publish_blocked_reason = input.blockedReason;

  const { data, error } = await supabase
    .from("articles")
    .update(update)
    .eq("id", articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Publish Quality Gate 결과 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

export interface SavePublicPublishApprovalResultInput {
  status: PublicPublishApprovalStatus;
  approved?: boolean;
  /** 승인 시각. 전달하지 않으면 approved=true로 새로 승인될 때만 현재 시각으로 채운다. */
  approvedAt?: string | null;
  approvedBy?: string | null;
  errorMessage?: string | null;
  notes?: string | null;
}

/**
 * Human Approval Before Public Publish 결과를 저장한다 (Phase 2-16).
 * 실제 WordPress 공개(publish)는 이 함수에서 수행하지 않는다.
 */
export async function savePublicPublishApprovalResult(
  articleId: string,
  input: SavePublicPublishApprovalResultInput
): Promise<Article> {
  const existing = await getArticleById(articleId);
  if (!existing) {
    throw new ArticleNotFoundError(articleId);
  }

  const supabase = createServerSupabaseClient();

  const update: Partial<ArticleRow> = {
    public_publish_approval_status: input.status,
  };
  if (input.approved !== undefined) update.public_publish_approved = input.approved;
  if (input.approvedAt !== undefined) update.public_publish_approved_at = input.approvedAt;
  if (input.approvedBy !== undefined) update.public_publish_approved_by = input.approvedBy;
  if (input.errorMessage !== undefined) update.public_publish_approval_error = input.errorMessage;
  if (input.notes !== undefined) update.public_publish_approval_notes = input.notes;

  const { data, error } = await supabase
    .from("articles")
    .update(update)
    .eq("id", articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`공개 게시 승인 결과 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}

/**
 * 실제 WordPress API로 동기화된 카테고리/태그 id를 저장한다 (Phase 2-8).
 * 다음 게시부터는 이름 검색 없이 이 id를 바로 사용할 수 있다.
 */
export async function saveWordPressCategoryTagIds(
  articleId: string,
  categoryIds: number[],
  tagIds: number[]
): Promise<Article> {
  const existing = await getArticleById(articleId);
  if (!existing) {
    throw new ArticleNotFoundError(articleId);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("articles")
    .update({
      wp_category_ids: categoryIds,
      wp_tag_ids: tagIds,
    })
    .eq("id", articleId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`WordPress 카테고리/태그 id 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}
