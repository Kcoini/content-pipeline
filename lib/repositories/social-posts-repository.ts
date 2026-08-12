// Phase 3-1: social_posts / social_post_quality_runs / social_post_approvals
// 테이블 ↔ 도메인 타입 매핑 및 데이터 접근.
// article 본문 전체를 로그에 남기지 않으며, platform/tone_style 유효성은
// 이 repository 레벨에서 반드시 검증한다 (invalid 값은 DB에 도달하기 전에 거부).

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  SocialPostRow,
  SocialPostQualityRunRow,
  SocialPostApprovalRow,
} from "@/lib/supabase/database.types";
import {
  isSocialPlatform,
  isToneStyle,
  type SocialPlatform,
  type ToneStyle,
  type SocialPost,
  type SocialPostDraftInput,
  type SocialPostQualityResult,
  type SocialPostApprovalStatus,
  type SocialPostPublishStatus,
  type ThreadItem,
  type CardItem,
} from "@/lib/social/social-platform-types";

/** 지원하지 않는 platform 값으로 social post를 만들거나 조회하려 할 때 발생한다. */
export class InvalidSocialPlatformError extends Error {
  constructor(platform: unknown) {
    super(`지원하지 않는 platform입니다: ${String(platform)}`);
    this.name = "InvalidSocialPlatformError";
  }
}

/** 지원하지 않는 tone_style 값으로 social post를 만들려 할 때 발생한다. */
export class InvalidToneStyleError extends Error {
  constructor(toneStyle: unknown) {
    super(`지원하지 않는 tone_style입니다: ${String(toneStyle)}`);
    this.name = "InvalidToneStyleError";
  }
}

/** 존재하지 않는 social post id로 조회/수정을 시도했을 때 발생한다. */
export class SocialPostNotFoundError extends Error {
  constructor(id: string) {
    super(`social post를 찾을 수 없습니다: ${id}`);
    this.name = "SocialPostNotFoundError";
  }
}

function assertValidPlatform(platform: unknown): asserts platform is SocialPlatform {
  if (!isSocialPlatform(platform)) {
    throw new InvalidSocialPlatformError(platform);
  }
}

function assertValidToneStyle(toneStyle: unknown): asserts toneStyle is ToneStyle {
  if (!isToneStyle(toneStyle)) {
    throw new InvalidToneStyleError(toneStyle);
  }
}

export function mapSocialPostRow(row: SocialPostRow): SocialPost {
  return {
    id: row.id,
    articleId: row.article_id,
    platform: row.platform,
    toneStyle: row.tone_style,
    postTitle: row.post_title,
    postBody: row.post_body,
    caption: row.caption,
    excerpt: row.excerpt,
    hashtags: row.hashtags ?? [],
    threadItems: (row.thread_items ?? []) as unknown as ThreadItem[],
    cardItems: (row.card_items ?? []) as unknown as CardItem[],
    mediaRequirements: row.media_requirements ?? {},
    platformMetadata: row.platform_metadata ?? {},
    generationContext: row.generation_context ?? {},
    qualityStatus: row.quality_status,
    qualityScore: row.quality_score,
    qualitySummary: row.quality_summary ?? {},
    approvalStatus: row.approval_status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    publishStatus: row.publish_status,
    externalPostId: row.external_post_id,
    postUrl: row.post_url,
    exportFormat: row.export_format,
    exportPayload: row.export_payload ?? {},
    errorMessage: row.error_message,
    generatedAt: row.generated_at,
    reviewedAt: row.reviewed_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * social post 초안을 생성한다. platform/tone_style이 허용된 값이 아니면
 * DB에 저장을 시도하지 않고 즉시 거부한다. article 본문 전체는 이 함수를
 * 통해 저장되지 않는다 (social_posts는 article과 별도의 짧은 텍스트만 다룸).
 */
export async function createSocialPostDraft(input: SocialPostDraftInput): Promise<SocialPost> {
  assertValidPlatform(input.platform);
  assertValidToneStyle(input.toneStyle);

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .insert({
      article_id: input.articleId,
      platform: input.platform,
      tone_style: input.toneStyle,
      post_title: input.postTitle ?? null,
      post_body: input.postBody ?? null,
      caption: input.caption ?? null,
      excerpt: input.excerpt ?? null,
      hashtags: input.hashtags ?? [],
      thread_items: (input.threadItems ?? []) as unknown as Record<string, unknown>[],
      card_items: (input.cardItems ?? []) as unknown as Record<string, unknown>[],
      media_requirements: input.mediaRequirements ?? {},
      platform_metadata: input.platformMetadata ?? {},
      generation_context: input.generationContext ?? {},
      generated_at: input.generatedAt ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`social post 생성에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

/** 특정 기사에 대해 생성된 모든 social post를 최신순으로 조회한다. */
export async function listSocialPostsByArticle(articleId: string): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("article_id", articleId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`social post 목록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}

/** social post 하나를 id로 조회한다. 없으면 null을 반환한다 (throw하지 않음). */
export async function getSocialPostById(id: string): Promise<SocialPost | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.from("social_posts").select().eq("id", id).maybeSingle();

  if (error) {
    throw new Error(`social post 조회에 실패했습니다: ${error.message}`);
  }

  return data ? mapSocialPostRow(data) : null;
}

export interface UpdateSocialPostContentPatch {
  postTitle?: string | null;
  postBody?: string | null;
  caption?: string | null;
  excerpt?: string | null;
  hashtags?: string[];
  threadItems?: ThreadItem[];
  cardItems?: CardItem[];
  mediaRequirements?: Record<string, unknown>;
  platformMetadata?: Record<string, unknown>;
  generationContext?: Record<string, unknown>;
  generatedAt?: string | null;
}

/** social post의 콘텐츠 필드를 갱신한다 (재생성/수동 편집 시 사용). */
export async function updateSocialPostContent(
  id: string,
  patch: UpdateSocialPostContentPatch
): Promise<SocialPost> {
  const existing = await getSocialPostById(id);
  if (!existing) {
    throw new SocialPostNotFoundError(id);
  }

  const supabase = createServerSupabaseClient();

  const update: Partial<SocialPostRow> = {};
  if (patch.postTitle !== undefined) update.post_title = patch.postTitle;
  if (patch.postBody !== undefined) update.post_body = patch.postBody;
  if (patch.caption !== undefined) update.caption = patch.caption;
  if (patch.excerpt !== undefined) update.excerpt = patch.excerpt;
  if (patch.hashtags !== undefined) update.hashtags = patch.hashtags;
  if (patch.threadItems !== undefined) update.thread_items = patch.threadItems as unknown as Record<string, unknown>[];
  if (patch.cardItems !== undefined) update.card_items = patch.cardItems as unknown as Record<string, unknown>[];
  if (patch.mediaRequirements !== undefined) update.media_requirements = patch.mediaRequirements;
  if (patch.platformMetadata !== undefined) update.platform_metadata = patch.platformMetadata;
  if (patch.generationContext !== undefined) update.generation_context = patch.generationContext;
  if (patch.generatedAt !== undefined) update.generated_at = patch.generatedAt;

  const { data, error } = await supabase.from("social_posts").update(update).eq("id", id).select().single();

  if (error || !data) {
    throw new Error(`social post 콘텐츠 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

/**
 * quality gate 실행 결과를 social_posts에 반영하고, 동시에
 * social_post_quality_runs에 실행 이력을 남긴다 (한 번의 호출로 둘 다 처리).
 */
export async function updateSocialPostQuality(
  id: string,
  result: SocialPostQualityResult
): Promise<SocialPost> {
  const existing = await getSocialPostById(id);
  if (!existing) {
    throw new SocialPostNotFoundError(id);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .update({
      quality_status: result.status,
      quality_score: result.score,
      quality_summary: {
        checklist: result.checklist,
        warnings: result.warnings,
        failures: result.failures,
        blockedReasons: result.blockedReasons,
      },
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`social post quality 결과 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  const { error: runError } = await supabase.from("social_post_quality_runs").insert({
    social_post_id: id,
    article_id: existing.articleId,
    platform: existing.platform,
    tone_style: existing.toneStyle,
    status: result.status,
    score: result.score,
    checklist: result.checklist as unknown as Record<string, unknown>[],
    warnings: result.warnings as unknown as Record<string, unknown>[],
    failures: result.failures as unknown as Record<string, unknown>[],
    blocked_reasons: result.blockedReasons as unknown as Record<string, unknown>[],
    details_json: { status: result.status, score: result.score },
  });

  if (runError) {
    throw new Error(`social post quality 실행 이력 저장에 실패했습니다: ${runError.message}`);
  }

  return mapSocialPostRow(data);
}

export interface UpdateSocialPostApprovalInput {
  status: SocialPostApprovalStatus;
  approvedBy?: string | null;
  notes?: string | null;
}

/**
 * social post 승인 상태를 갱신하고, 동시에 social_post_approvals에 이력을
 * 남긴다. approvedAt은 status='approved'일 때만 현재 시각으로 채운다.
 */
export async function updateSocialPostApproval(
  id: string,
  approval: UpdateSocialPostApprovalInput
): Promise<SocialPost> {
  const existing = await getSocialPostById(id);
  if (!existing) {
    throw new SocialPostNotFoundError(id);
  }

  const supabase = createServerSupabaseClient();

  const update: Partial<SocialPostRow> = {
    approval_status: approval.status,
    approved_by: approval.approvedBy ?? null,
  };
  if (approval.status === "approved") {
    update.approved_at = new Date().toISOString();
  }

  const { data, error } = await supabase.from("social_posts").update(update).eq("id", id).select().single();

  if (error || !data) {
    throw new Error(`social post 승인 상태 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  const { error: approvalError } = await supabase.from("social_post_approvals").insert({
    social_post_id: id,
    article_id: existing.articleId,
    platform: existing.platform,
    approval_status: approval.status,
    approved_by: approval.approvedBy ?? null,
    approval_notes: approval.notes ?? null,
  });

  if (approvalError) {
    throw new Error(`social post 승인 이력 저장에 실패했습니다: ${approvalError.message}`);
  }

  return mapSocialPostRow(data);
}

export interface UpdateSocialPostPublishStatusPatch {
  status: SocialPostPublishStatus;
  externalPostId?: string | null;
  postUrl?: string | null;
  exportFormat?: string | null;
  exportPayload?: Record<string, unknown>;
  errorMessage?: string | null;
}

/** social post의 게시/export 상태를 갱신한다 (실제 외부 게시 API 호출은 하지 않음). */
export async function updateSocialPostPublishStatus(
  id: string,
  patch: UpdateSocialPostPublishStatusPatch
): Promise<SocialPost> {
  const existing = await getSocialPostById(id);
  if (!existing) {
    throw new SocialPostNotFoundError(id);
  }

  const supabase = createServerSupabaseClient();

  const update: Partial<SocialPostRow> = {
    publish_status: patch.status,
  };
  if (patch.externalPostId !== undefined) update.external_post_id = patch.externalPostId;
  if (patch.postUrl !== undefined) update.post_url = patch.postUrl;
  if (patch.exportFormat !== undefined) update.export_format = patch.exportFormat;
  if (patch.exportPayload !== undefined) update.export_payload = patch.exportPayload;
  if (patch.errorMessage !== undefined) update.error_message = patch.errorMessage;
  if (patch.status === "published") {
    update.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase.from("social_posts").update(update).eq("id", id).select().single();

  if (error || !data) {
    throw new Error(`social post 게시 상태 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

/** social post를 삭제한다 (quality_runs/approvals는 FK cascade로 함께 삭제됨). */
export async function deleteSocialPost(id: string): Promise<void> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.from("social_posts").delete().eq("id", id);

  if (error) {
    throw new Error(`social post 삭제에 실패했습니다: ${error.message}`);
  }
}

export function mapSocialPostQualityRunRow(row: SocialPostQualityRunRow) {
  return {
    id: row.id,
    socialPostId: row.social_post_id,
    articleId: row.article_id,
    platform: row.platform,
    toneStyle: row.tone_style,
    status: row.status,
    score: row.score,
    checklist: row.checklist,
    warnings: row.warnings,
    failures: row.failures,
    blockedReasons: row.blocked_reasons,
    details: row.details_json,
    createdAt: row.created_at,
  };
}

export function mapSocialPostApprovalRow(row: SocialPostApprovalRow) {
  return {
    id: row.id,
    socialPostId: row.social_post_id,
    articleId: row.article_id,
    platform: row.platform,
    approvalStatus: row.approval_status,
    approvedBy: row.approved_by,
    approvalNotes: row.approval_notes,
    createdAt: row.created_at,
  };
}
