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
  type SocialPostExportStatus,
  type PlatformPublishGuardResult,
  type PlatformPublishDryRunStatus,
  type HandoffStatus,
  type ManualPostStatus,
  type ManualPostingChecklistItem,
  type RewriteReapprovalStatus,
  type RewriteReexportStatus,
  type RewriteRepublishWorkflowStatus,
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
    editedAt: row.edited_at,
    editedBy: row.edited_by,
    reviewNotes: row.review_notes,
    revisionCount: row.revision_count,
    lastQualityCheckedAt: row.last_quality_checked_at,
    approvalRequestedAt: row.approval_requested_at,
    rejectionReason: row.rejection_reason,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
    exportStatus: row.export_status as SocialPost["exportStatus"],
    exportedAt: row.exported_at,
    exportedBy: row.exported_by,
    exportError: row.export_error,
    exportCopyCount: row.export_copy_count,
    lastCopiedAt: row.last_copied_at,
    exportNotes: row.export_notes,
    platformPublishGuardStatus: row.platform_publish_guard_status as SocialPost["platformPublishGuardStatus"],
    platformPublishGuardScore: row.platform_publish_guard_score,
    platformPublishGuardSummary: row.platform_publish_guard_summary,
    platformPublishGuardError: row.platform_publish_guard_error,
    platformPublishGuardCheckedAt: row.platform_publish_guard_checked_at,
    platformPublishReady: row.platform_publish_ready,
    platformPublishBlockedReason: row.platform_publish_blocked_reason,
    platformPublishDryRunStatus: row.platform_publish_dry_run_status as SocialPost["platformPublishDryRunStatus"],
    platformPublishDryRunPayload: row.platform_publish_dry_run_payload,
    platformPublishDryRunError: row.platform_publish_dry_run_error,
    platformPublishDryRunCreatedAt: row.platform_publish_dry_run_created_at,
    platformPublishDryRunCreatedBy: row.platform_publish_dry_run_created_by,
    handoffStatus: row.handoff_status as SocialPost["handoffStatus"],
    handoffPayload: row.handoff_payload,
    handoffNotes: row.handoff_notes,
    handoffCompletedAt: row.handoff_completed_at,
    handoffCompletedBy: row.handoff_completed_by,
    handoffError: row.handoff_error,
    manualPostStatus: row.manual_post_status as SocialPost["manualPostStatus"],
    manualPostUrl: row.manual_post_url,
    manualPostedAt: row.manual_posted_at,
    manualPostedBy: row.manual_posted_by,
    manualPostResultNotes: row.manual_post_result_notes,
    manualPostError: row.manual_post_error,
    manualPostRecordedAt: row.manual_post_recorded_at,
    manualPostRecordedBy: row.manual_post_recorded_by,
    manualPostChecklist: row.manual_post_checklist ?? [],
    latestMetricsId: row.latest_metrics_id,
    latestMetricsRecordedAt: row.latest_metrics_recorded_at,
    latestViews: row.latest_views,
    latestImpressions: row.latest_impressions,
    latestLikes: row.latest_likes,
    latestComments: row.latest_comments,
    latestShares: row.latest_shares,
    latestSaves: row.latest_saves,
    latestClicks: row.latest_clicks,
    latestEngagementRate: row.latest_engagement_rate,
    latestClickThroughRate: row.latest_click_through_rate,
    latestPerformanceScore: row.latest_performance_score,
    performanceStatus: row.performance_status as SocialPost["performanceStatus"],
    performanceSummary: row.performance_summary,
    latestRewriteSuggestionId: row.latest_rewrite_suggestion_id,
    rewriteSuggestionStatus: row.rewrite_suggestion_status as SocialPost["rewriteSuggestionStatus"],
    rewriteSuggestionCount: row.rewrite_suggestion_count,
    latestRewriteSuggestedAt: row.latest_rewrite_suggested_at,
    parentSocialPostId: row.parent_social_post_id,
    rootSocialPostId: row.root_social_post_id,
    versionNumber: row.version_number,
    versionLabel: row.version_label,
    versionStatus: row.version_status as SocialPost["versionStatus"],
    rewriteSourceSuggestionId: row.rewrite_source_suggestion_id,
    rewriteAppliedFromSocialPostId: row.rewrite_applied_from_social_post_id,
    rewriteAppliedAt: row.rewrite_applied_at,
    rewriteAppliedBy: row.rewrite_applied_by,
    rewriteApplicationNotes: row.rewrite_application_notes,
    isRewriteVersion: row.is_rewrite_version,
    latestVersionComparisonId: row.latest_version_comparison_id,
    versionComparisonStatus: row.version_comparison_status as SocialPost["versionComparisonStatus"],
    versionComparisonScore: row.version_comparison_score,
    recommendedForRepost: row.recommended_for_repost,
    versionComparisonCheckedAt: row.version_comparison_checked_at,
    rewriteReapprovalStatus: row.rewrite_reapproval_status as SocialPost["rewriteReapprovalStatus"],
    rewriteReapprovalRequestedAt: row.rewrite_reapproval_requested_at,
    rewriteReapprovalRequestedBy: row.rewrite_reapproval_requested_by,
    rewriteReapprovedAt: row.rewrite_reapproved_at,
    rewriteReapprovedBy: row.rewrite_reapproved_by,
    rewriteReapprovalNotes: row.rewrite_reapproval_notes,
    rewriteReapprovalError: row.rewrite_reapproval_error,
    rewriteReexportStatus: row.rewrite_reexport_status as SocialPost["rewriteReexportStatus"],
    rewriteReexportedAt: row.rewrite_reexported_at,
    rewriteReexportedBy: row.rewrite_reexported_by,
    rewriteReexportError: row.rewrite_reexport_error,
    rewriteRepublishWorkflowStatus: row.rewrite_republish_workflow_status as SocialPost["rewriteRepublishWorkflowStatus"],
    rewriteRepublishWorkflowSummary: row.rewrite_republish_workflow_summary,
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

export interface SaveSocialPostRevisionPatch {
  postTitle?: string | null;
  postBody?: string | null;
  caption?: string | null;
  excerpt?: string | null;
  hashtags?: string[];
  threadItems?: ThreadItem[];
  cardItems?: CardItem[];
  mediaRequirements?: Record<string, unknown>;
  platformMetadata?: Record<string, unknown>;
  exportPayload?: Record<string, unknown>;
  exportFormat?: string | null;
  reviewNotes?: string | null;
  toneStyle?: ToneStyle;
  editedBy?: string;
}

/**
 * social post를 사람이 직접 편집해 저장한다 (Phase 3-4). platform은 이
 * 함수를 통해 변경할 수 없다. 편집 시 revision_count를 1 증가시키고,
 * quality_status/approval_status를 각각 'not_checked'/'not_requested'로
 * 되돌려 재검수·재승인을 강제한다. 기존에 승인/거부/취소 상태였더라도
 * approved_at/approved_by/rejection_reason은 모두 null로 초기화한다.
 * publish_status가 'published'인 post는 편집을 허용하지 않는다.
 */
export async function saveSocialPostRevision(id: string, patch: SaveSocialPostRevisionPatch): Promise<SocialPost> {
  const existing = await getSocialPostById(id);
  if (!existing) {
    throw new SocialPostNotFoundError(id);
  }
  if (existing.publishStatus === "published") {
    throw new Error("이미 게시된 social post는 수정할 수 없습니다.");
  }
  if (patch.toneStyle !== undefined) {
    assertValidToneStyle(patch.toneStyle);
  }

  const supabase = createServerSupabaseClient();

  const update: Partial<SocialPostRow> = {
    edited_at: new Date().toISOString(),
    edited_by: patch.editedBy ?? existing.editedBy ?? null,
    revision_count: existing.revisionCount + 1,
    quality_status: "not_checked",
    quality_score: null,
    quality_summary: {},
    approval_status: "not_requested",
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    // 이미 게시된(published) social post는 위에서 걸러졌으므로 항상 not_published로 되돌린다.
    publish_status: "not_published",
  };
  if (patch.postTitle !== undefined) update.post_title = patch.postTitle;
  if (patch.postBody !== undefined) update.post_body = patch.postBody;
  if (patch.caption !== undefined) update.caption = patch.caption;
  if (patch.excerpt !== undefined) update.excerpt = patch.excerpt;
  if (patch.hashtags !== undefined) update.hashtags = patch.hashtags;
  if (patch.threadItems !== undefined) update.thread_items = patch.threadItems as unknown as Record<string, unknown>[];
  if (patch.cardItems !== undefined) update.card_items = patch.cardItems as unknown as Record<string, unknown>[];
  if (patch.mediaRequirements !== undefined) update.media_requirements = patch.mediaRequirements;
  if (patch.platformMetadata !== undefined) update.platform_metadata = patch.platformMetadata;
  if (patch.exportPayload !== undefined) update.export_payload = patch.exportPayload;
  if (patch.exportFormat !== undefined) update.export_format = patch.exportFormat;
  if (patch.reviewNotes !== undefined) update.review_notes = patch.reviewNotes;
  if (patch.toneStyle !== undefined) update.tone_style = patch.toneStyle;

  const { data, error } = await supabase.from("social_posts").update(update).eq("id", id).select().single();

  if (error || !data) {
    throw new Error(`social post 수정 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

/** social post의 승인을 요청한다 (approval_status='pending_review'). */
export async function requestSocialPostApproval(id: string, notes?: string | null): Promise<SocialPost> {
  const existing = await getSocialPostById(id);
  if (!existing) {
    throw new SocialPostNotFoundError(id);
  }

  const supabase = createServerSupabaseClient();

  const update: Partial<SocialPostRow> = {
    approval_status: "pending_review",
    approval_requested_at: new Date().toISOString(),
  };
  if (notes !== undefined) update.review_notes = notes;

  const { data, error } = await supabase.from("social_posts").update(update).eq("id", id).select().single();

  if (error || !data) {
    throw new Error(`social post 승인 요청 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

/** social post를 승인한다. social_post_approvals에도 'approved' 이력을 남긴다. */
export async function approveSocialPost(id: string, approvedBy: string, notes?: string | null): Promise<SocialPost> {
  const existing = await getSocialPostById(id);
  if (!existing) {
    throw new SocialPostNotFoundError(id);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .update({
      approval_status: "approved",
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`social post 승인 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  const { error: approvalError } = await supabase.from("social_post_approvals").insert({
    social_post_id: id,
    article_id: existing.articleId,
    platform: existing.platform,
    approval_status: "approved",
    approved_by: approvedBy,
    approval_notes: notes ?? null,
  });
  if (approvalError) {
    throw new Error(`social post 승인 이력 저장에 실패했습니다: ${approvalError.message}`);
  }

  return mapSocialPostRow(data);
}

/** social post를 반려한다. social_post_approvals에도 'rejected' 이력을 남긴다. */
export async function rejectSocialPost(id: string, rejectedBy: string, reason: string): Promise<SocialPost> {
  const existing = await getSocialPostById(id);
  if (!existing) {
    throw new SocialPostNotFoundError(id);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .update({
      approval_status: "rejected",
      rejection_reason: reason,
      approved_by: null,
      approved_at: null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`social post 반려 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  const { error: approvalError } = await supabase.from("social_post_approvals").insert({
    social_post_id: id,
    article_id: existing.articleId,
    platform: existing.platform,
    approval_status: "rejected",
    approved_by: rejectedBy,
    approval_notes: reason,
  });
  if (approvalError) {
    throw new Error(`social post 반려 이력 저장에 실패했습니다: ${approvalError.message}`);
  }

  return mapSocialPostRow(data);
}

/** social post의 승인을 취소한다. social_post_approvals에도 'revoked' 이력을 남긴다. */
export async function revokeSocialPostApproval(id: string, revokedBy: string, reason: string): Promise<SocialPost> {
  const existing = await getSocialPostById(id);
  if (!existing) {
    throw new SocialPostNotFoundError(id);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .update({
      approval_status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_reason: reason,
      approved_by: null,
      approved_at: null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`social post 승인 취소 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  const { error: approvalError } = await supabase.from("social_post_approvals").insert({
    social_post_id: id,
    article_id: existing.articleId,
    platform: existing.platform,
    approval_status: "revoked",
    approved_by: revokedBy,
    approval_notes: reason,
  });
  if (approvalError) {
    throw new Error(`social post 승인 취소 이력 저장에 실패했습니다: ${approvalError.message}`);
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
      last_quality_checked_at: new Date().toISOString(),
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

export interface UpdateSocialPostExportPatch {
  exportStatus: SocialPostExportStatus;
  exportFormat?: string | null;
  exportPayload?: Record<string, unknown>;
  exportedBy?: string | null;
  exportError?: string | null;
  exportNotes?: string | null;
  /** 'exported'일 때만 publish_status를 함께 'exported'로 바꾼다 (published로는 절대 바꾸지 않음). */
  markPublishStatusExported?: boolean;
}

/**
 * social post의 manual export 상태를 갱신한다 (Phase 3-5). 실제 외부
 * 플랫폼 게시는 하지 않으며, publish_status를 'published'로 바꾸는 경로는
 * 이 함수에 없다.
 */
export async function updateSocialPostExport(id: string, patch: UpdateSocialPostExportPatch): Promise<SocialPost> {
  const existing = await getSocialPostById(id);
  if (!existing) {
    throw new SocialPostNotFoundError(id);
  }

  const supabase = createServerSupabaseClient();

  const update: Partial<SocialPostRow> = {
    export_status: patch.exportStatus,
  };
  if (patch.exportFormat !== undefined) update.export_format = patch.exportFormat;
  if (patch.exportPayload !== undefined) update.export_payload = patch.exportPayload;
  if (patch.exportError !== undefined) update.export_error = patch.exportError;
  if (patch.exportNotes !== undefined) update.export_notes = patch.exportNotes;
  if (patch.exportStatus === "exported") {
    update.exported_at = new Date().toISOString();
    update.exported_by = patch.exportedBy ?? null;
    if (patch.markPublishStatusExported) {
      update.publish_status = "exported";
    }
  }

  const { data, error } = await supabase.from("social_posts").update(update).eq("id", id).select().single();

  if (error || !data) {
    throw new Error(`social post export 상태 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

/** social post가 복사되었음을 기록한다 (export_copy_count 증가, last_copied_at 갱신). */
export async function incrementExportCopyCount(id: string): Promise<SocialPost> {
  const existing = await getSocialPostById(id);
  if (!existing) {
    throw new SocialPostNotFoundError(id);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .update({
      export_copy_count: existing.exportCopyCount + 1,
      last_copied_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`social post 복사 기록 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

/** 특정 기사에서 export 가능한(export_status가 ready 또는 exported인) social post만 조회한다. */
export async function listExportReadySocialPostsByArticle(articleId: string): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("article_id", articleId)
    .in("export_status", ["ready", "exported"])
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`export 가능한 social post 목록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}

/** social post의 export_payload/export_format만 조회한다 (본문 전체를 다루지 않는 소비처용). */
export async function getSocialPostExportPayload(
  id: string
): Promise<{ exportFormat: string | null; exportPayload: Record<string, unknown> } | null> {
  const post = await getSocialPostById(id);
  if (!post) return null;
  return { exportFormat: post.exportFormat, exportPayload: post.exportPayload };
}

/**
 * platform publishing guard 실행 결과를 social_posts에 저장한다 (Phase 3-6).
 * 실제 게시는 하지 않으며, publish_status를 바꾸지 않는다.
 */
export async function updatePlatformPublishGuardResult(
  id: string,
  result: PlatformPublishGuardResult
): Promise<SocialPost> {
  const existing = await getSocialPostById(id);
  if (!existing) {
    throw new SocialPostNotFoundError(id);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .update({
      platform_publish_guard_status: result.status,
      platform_publish_guard_score: result.score,
      platform_publish_guard_summary: {
        checklist: result.checklist,
        warnings: result.warnings,
        failures: result.failures,
        blockedReasons: result.blockedReasons,
      },
      platform_publish_guard_error: null,
      platform_publish_guard_checked_at: new Date().toISOString(),
      platform_publish_ready: result.ready,
      platform_publish_blocked_reason: result.blockedReason ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`platform publishing guard 결과 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

/** platform publishing guard가 실행 중 예외로 실패했을 때 상태만 기록한다. */
export async function markPlatformPublishGuardFailed(id: string, errorMessage: string): Promise<SocialPost> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .update({
      platform_publish_guard_status: "failed",
      platform_publish_guard_error: errorMessage,
      platform_publish_guard_checked_at: new Date().toISOString(),
      platform_publish_ready: false,
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`platform publishing guard 실패 상태 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

/** publishing guard 실행에 필요한 social post 하나를 조회한다 (getSocialPostById와 동일하나 의도를 명확히 한다). */
export async function getSocialPostForPublishingGuard(id: string): Promise<SocialPost | null> {
  return getSocialPostById(id);
}

/** 특정 기사에서 platform_publish_ready=true인 social post만 조회한다. */
export async function listPublishingReadySocialPostsByArticle(articleId: string): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("article_id", articleId)
    .eq("platform_publish_ready", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`게시 가능한 social post 목록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}

export interface UpdatePlatformPublishDryRunResultPatch {
  status: PlatformPublishDryRunStatus;
  dryRunPayload?: Record<string, unknown>;
  handoffPayload?: Record<string, unknown>;
  error?: string | null;
  createdBy?: string | null;
  handoffStatus?: HandoffStatus;
}

/**
 * platform publish dry-run 결과를 social_posts에 저장한다 (Phase 3-7).
 * 실제 게시는 하지 않으며, publish_status를 바꾸지 않는다.
 */
export async function updatePlatformPublishDryRunResult(
  id: string,
  patch: UpdatePlatformPublishDryRunResultPatch
): Promise<SocialPost> {
  const supabase = createServerSupabaseClient();

  const update: Partial<SocialPostRow> = {
    platform_publish_dry_run_status: patch.status,
    platform_publish_dry_run_error: patch.error ?? null,
  };
  if (patch.dryRunPayload !== undefined) update.platform_publish_dry_run_payload = patch.dryRunPayload;
  if (patch.handoffPayload !== undefined) update.handoff_payload = patch.handoffPayload;
  if (patch.handoffStatus !== undefined) update.handoff_status = patch.handoffStatus;
  if (patch.status === "ready") {
    update.platform_publish_dry_run_created_at = new Date().toISOString();
    update.platform_publish_dry_run_created_by = patch.createdBy ?? null;
  }

  const { data, error } = await supabase.from("social_posts").update(update).eq("id", id).select().single();

  if (error || !data) {
    throw new Error(`platform publish dry-run 결과 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

export interface UpdatePlatformHandoffResultPatch {
  status: HandoffStatus;
  notes?: string | null;
  completedBy?: string | null;
  error?: string | null;
}

/**
 * export handoff 결과를 social_posts에 저장한다 (Phase 3-7). handoff
 * completed는 사람이 게시할 준비를 마쳤다는 뜻이며, publish_status를
 * 'published'로 바꾸지 않는다.
 */
export async function updatePlatformHandoffResult(id: string, patch: UpdatePlatformHandoffResultPatch): Promise<SocialPost> {
  const supabase = createServerSupabaseClient();

  const update: Partial<SocialPostRow> = {
    handoff_status: patch.status,
    handoff_error: patch.error ?? null,
  };
  if (patch.notes !== undefined) update.handoff_notes = patch.notes;
  if (patch.status === "completed") {
    update.handoff_completed_at = new Date().toISOString();
    update.handoff_completed_by = patch.completedBy ?? null;
  }

  const { data, error } = await supabase.from("social_posts").update(update).eq("id", id).select().single();

  if (error || !data) {
    throw new Error(`export handoff 결과 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

/** dry-run 실행에 필요한 social post 하나를 조회한다 (getSocialPostById와 동일하나 의도를 명확히 한다). */
export async function getSocialPostForDryRun(id: string): Promise<SocialPost | null> {
  return getSocialPostById(id);
}

/** 특정 기사에서 platform_publish_dry_run_status='ready'인 social post만 조회한다. */
export async function listDryRunReadySocialPostsByArticle(articleId: string): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("article_id", articleId)
    .eq("platform_publish_dry_run_status", "ready")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`dry-run 준비된 social post 목록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}

/** 특정 기사에서 handoff_status='ready'인 social post만 조회한다. */
export async function listHandoffReadySocialPostsByArticle(articleId: string): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("article_id", articleId)
    .eq("handoff_status", "ready")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`handoff 준비된 social post 목록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}

/** manual posting checklist를 준비 상태로 저장한다 (Phase 3-8). */
export async function updateManualPostingChecklist(id: string, checklist: ManualPostingChecklistItem[]): Promise<SocialPost> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .update({
      manual_post_status: "ready_to_record",
      manual_post_checklist: checklist as unknown as Record<string, unknown>[],
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`manual posting checklist 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

export interface UpdateManualPostingResultPatch {
  status: ManualPostStatus;
  manualPostUrl?: string | null;
  manualPostedAt?: string | null;
  manualPostedBy?: string | null;
  notes?: string | null;
  error?: string | null;
  recordedBy?: string | null;
  /** status='posted'일 때만 publish_status/post_url/published_at을 함께 갱신한다. */
  markPublished?: boolean;
}

/**
 * 수동 게시 결과를 social_posts에 저장한다 (Phase 3-8). status='posted'
 * 이고 markPublished=true인 경우에만 publish_status='published'로
 * 전환한다 — 이는 API 자동 게시가 아니라 사람이 직접 게시했다는 기록
 * 이라는 사실을 manual_post_result_notes/manual_post_status로 함께
 * 남긴다.
 */
export async function updateManualPostingResult(id: string, patch: UpdateManualPostingResultPatch): Promise<SocialPost> {
  const supabase = createServerSupabaseClient();

  const update: Partial<SocialPostRow> = {
    manual_post_status: patch.status,
    manual_post_error: patch.error ?? null,
    manual_post_recorded_at: new Date().toISOString(),
    manual_post_recorded_by: patch.recordedBy ?? null,
  };
  if (patch.manualPostUrl !== undefined) update.manual_post_url = patch.manualPostUrl;
  if (patch.manualPostedAt !== undefined) update.manual_posted_at = patch.manualPostedAt;
  if (patch.manualPostedBy !== undefined) update.manual_posted_by = patch.manualPostedBy;
  if (patch.notes !== undefined) update.manual_post_result_notes = patch.notes;

  if (patch.status === "posted" && patch.markPublished) {
    update.publish_status = "published";
    update.published_at = patch.manualPostedAt ?? new Date().toISOString();
    if (patch.manualPostUrl) update.post_url = patch.manualPostUrl;
  }

  const { data, error } = await supabase.from("social_posts").update(update).eq("id", id).select().single();

  if (error || !data) {
    throw new Error(`수동 게시 결과 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

/** manual posting 처리에 필요한 social post 하나를 조회한다 (getSocialPostById와 동일하나 의도를 명확히 한다). */
export async function getSocialPostForManualPosting(id: string): Promise<SocialPost | null> {
  return getSocialPostById(id);
}

/** 특정 기사에서 manual_post_status='ready_to_record'인 social post만 조회한다. */
export async function listManualPostingReadySocialPostsByArticle(articleId: string): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("article_id", articleId)
    .eq("manual_post_status", "ready_to_record")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`manual posting 준비된 social post 목록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}

/** 특정 기사에서 manual_post_status='posted'인 social post만 조회한다. */
export async function listManualPostedSocialPostsByArticle(articleId: string): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("article_id", articleId)
    .eq("manual_post_status", "posted")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`수동 게시 완료된 social post 목록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}

export interface CreateRewriteVersionInput {
  articleId: string;
  platform: SocialPlatform;
  toneStyle: ToneStyle;
  postTitle?: string | null;
  postBody?: string | null;
  caption?: string | null;
  excerpt?: string | null;
  hashtags?: string[];
  threadItems?: ThreadItem[];
  cardItems?: CardItem[];
  mediaRequirements?: Record<string, unknown>;
  platformMetadata?: Record<string, unknown>;
  parentSocialPostId: string;
  rootSocialPostId: string;
  versionNumber: number;
  versionLabel?: string | null;
  rewriteSourceSuggestionId?: string | null;
  rewriteAppliedFromSocialPostId?: string | null;
  rewriteAppliedBy?: string | null;
  rewriteApplicationNotes?: string | null;
}

/**
 * rewrite suggestion 적용 결과로 새 social_posts row(버전)를 생성한다
 * (Phase 3-11). 기존 row는 절대 수정/삭제하지 않는다. quality/approval/
 * export/guard/dry-run/handoff/manual_post/performance 관련 상태는 모두
 * 초기값으로 시작한다(호출하는 쪽에서 별도로 초기화할 필요 없음).
 */
export async function createRewriteVersion(input: CreateRewriteVersionInput): Promise<SocialPost> {
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
      generated_at: new Date().toISOString(),
      parent_social_post_id: input.parentSocialPostId,
      root_social_post_id: input.rootSocialPostId,
      version_number: input.versionNumber,
      version_label: input.versionLabel ?? `Rewrite v${input.versionNumber}`,
      version_status: "current",
      is_rewrite_version: true,
      rewrite_source_suggestion_id: input.rewriteSourceSuggestionId ?? null,
      rewrite_applied_from_social_post_id: input.rewriteAppliedFromSocialPostId ?? null,
      rewrite_applied_at: new Date().toISOString(),
      rewrite_applied_by: input.rewriteAppliedBy ?? null,
      rewrite_application_notes: input.rewriteApplicationNotes ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`rewrite version 생성에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

/** social post 하나의 버전 정보를 조회한다 (getSocialPostById와 동일하나 의도를 명확히 한다). */
export async function getSocialPostVersionInfo(id: string): Promise<SocialPost | null> {
  return getSocialPostById(id);
}

/** social post의 version_status만 갱신한다 (예: 새 버전이 생기면 이전 버전을 'superseded'로). */
export async function updateSocialPostVersionStatus(id: string, status: SocialPost["versionStatus"]): Promise<SocialPost> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .update({ version_status: status })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`social post version_status 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

/** 특정 기사에서 rewrite로 생성된 버전(is_rewrite_version=true)만 조회한다. */
export async function listRewriteVersionsByArticle(articleId: string): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("article_id", articleId)
    .eq("is_rewrite_version", true)
    .order("version_number", { ascending: true });

  if (error) {
    throw new Error(`기사별 rewrite version 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}

/** 특정 root social post의 전체 버전 계보(원본 포함)를 버전 순으로 조회한다. */
export async function listRewriteVersionsByRoot(rootSocialPostId: string): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("root_social_post_id", rootSocialPostId)
    .order("version_number", { ascending: true });

  if (error) {
    throw new Error(`root social post 기준 버전 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}

/** 버전 비교에 필요한 social post 하나를 조회한다 (getSocialPostById와 동일하나 의도를 명확히 한다). */
export async function getSocialPostForVersionComparison(id: string): Promise<SocialPost | null> {
  return getSocialPostById(id);
}

export interface UpdateVersionComparisonSummaryPatch {
  latestVersionComparisonId: string;
  versionComparisonStatus: SocialPost["versionComparisonStatus"];
  versionComparisonScore?: number | null;
  recommendedForRepost?: boolean;
}

/** social_posts의 버전 비교 요약 컬럼을 갱신한다 (Phase 3-12). */
export async function updateVersionComparisonSummary(id: string, patch: UpdateVersionComparisonSummaryPatch): Promise<SocialPost> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .update({
      latest_version_comparison_id: patch.latestVersionComparisonId,
      version_comparison_status: patch.versionComparisonStatus,
      version_comparison_score: patch.versionComparisonScore ?? null,
      recommended_for_repost: patch.recommendedForRepost ?? false,
      version_comparison_checked_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`social post 버전 비교 요약 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

/** 특정 기사에서 아직 비교하지 않은(version_comparison_status='not_compared') rewrite version만 조회한다. */
export async function listRewriteVersionsNeedingComparison(articleId: string): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("article_id", articleId)
    .eq("is_rewrite_version", true)
    .eq("version_comparison_status", "not_compared")
    .order("version_number", { ascending: true });

  if (error) {
    throw new Error(`비교 필요한 rewrite version 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}

/** 특정 기사에서 재게시 후보(recommended_for_repost=true)로 표시된 social post만 조회한다. */
export async function listRecommendedRewriteVersions(articleId: string): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("article_id", articleId)
    .eq("recommended_for_repost", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`재게시 후보 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}

export interface UpdateRewriteReapprovalStatusPatch {
  rewriteReapprovalStatus: RewriteReapprovalStatus;
  requestedAt?: string | null;
  requestedBy?: string | null;
  reapprovedAt?: string | null;
  reapprovedBy?: string | null;
  notes?: string | null;
  error?: string | null;
  approvalStatus?: SocialPost["approvalStatus"];
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
}

/** rewrite version의 재승인(reapproval) 상태를 갱신한다 (Phase 3-13). 필요 시 approval_status도 함께 맞춘다. */
export async function updateRewriteReapprovalStatus(id: string, patch: UpdateRewriteReapprovalStatusPatch): Promise<SocialPost> {
  const supabase = createServerSupabaseClient();

  const update: Partial<SocialPostRow> = {
    rewrite_reapproval_status: patch.rewriteReapprovalStatus,
    rewrite_reapproval_error: patch.error ?? null,
  };
  if (patch.requestedAt !== undefined) update.rewrite_reapproval_requested_at = patch.requestedAt;
  if (patch.requestedBy !== undefined) update.rewrite_reapproval_requested_by = patch.requestedBy;
  if (patch.reapprovedAt !== undefined) update.rewrite_reapproved_at = patch.reapprovedAt;
  if (patch.reapprovedBy !== undefined) update.rewrite_reapproved_by = patch.reapprovedBy;
  if (patch.notes !== undefined) update.rewrite_reapproval_notes = patch.notes;
  if (patch.approvalStatus !== undefined) update.approval_status = patch.approvalStatus;
  if (patch.approvedBy !== undefined) update.approved_by = patch.approvedBy;
  if (patch.approvedAt !== undefined) update.approved_at = patch.approvedAt;
  if (patch.rejectionReason !== undefined) update.rejection_reason = patch.rejectionReason;

  const { data, error } = await supabase.from("social_posts").update(update).eq("id", id).select().single();

  if (error || !data) {
    throw new Error(`rewrite 재승인 상태 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

export interface UpdateRewriteReexportStatusPatch {
  rewriteReexportStatus: RewriteReexportStatus;
  reexportedAt?: string | null;
  reexportedBy?: string | null;
  error?: string | null;
  exportStatus?: SocialPost["exportStatus"];
  exportPayload?: Record<string, unknown>;
  exportFormat?: string | null;
  exportedAt?: string | null;
  exportedBy?: string | null;
}

/** rewrite version의 재export(reexport) 상태를 갱신한다 (Phase 3-13). 원본의 export_payload는 건드리지 않는다. */
export async function updateRewriteReexportStatus(id: string, patch: UpdateRewriteReexportStatusPatch): Promise<SocialPost> {
  const supabase = createServerSupabaseClient();

  const update: Partial<SocialPostRow> = {
    rewrite_reexport_status: patch.rewriteReexportStatus,
    rewrite_reexport_error: patch.error ?? null,
  };
  if (patch.reexportedAt !== undefined) update.rewrite_reexported_at = patch.reexportedAt;
  if (patch.reexportedBy !== undefined) update.rewrite_reexported_by = patch.reexportedBy;
  if (patch.exportStatus !== undefined) update.export_status = patch.exportStatus;
  if (patch.exportPayload !== undefined) update.export_payload = patch.exportPayload;
  if (patch.exportFormat !== undefined) update.export_format = patch.exportFormat;
  if (patch.exportedAt !== undefined) update.exported_at = patch.exportedAt;
  if (patch.exportedBy !== undefined) update.exported_by = patch.exportedBy;

  const { data, error } = await supabase.from("social_posts").update(update).eq("id", id).select().single();

  if (error || !data) {
    throw new Error(`rewrite 재export 상태 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

export interface UpdateRewriteRepublishWorkflowStatusPatch {
  status: RewriteRepublishWorkflowStatus;
  summary?: Record<string, unknown>;
}

/** rewrite version의 재게시 준비 workflow 상태 요약을 갱신한다 (Phase 3-13). */
export async function updateRewriteRepublishWorkflowStatus(
  id: string,
  patch: UpdateRewriteRepublishWorkflowStatusPatch
): Promise<SocialPost> {
  const supabase = createServerSupabaseClient();

  const update: Partial<SocialPostRow> = {
    rewrite_republish_workflow_status: patch.status,
  };
  if (patch.summary !== undefined) update.rewrite_republish_workflow_summary = patch.summary;

  const { data, error } = await supabase.from("social_posts").update(update).eq("id", id).select().single();

  if (error || !data) {
    throw new Error(`rewrite republish workflow 상태 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

/** 재승인 처리에 필요한 rewrite version social post 하나를 조회한다 (getSocialPostById와 동일하나 의도를 명확히 한다). */
export async function getRewriteVersionForReapproval(id: string): Promise<SocialPost | null> {
  return getSocialPostById(id);
}

/** 특정 기사에서 재승인 요청 대상(추천된, 아직 요청 전인) rewrite version만 조회한다. */
export async function listRewriteVersionsReadyForReapproval(articleId: string): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("article_id", articleId)
    .eq("is_rewrite_version", true)
    .eq("recommended_for_repost", true)
    .eq("rewrite_reapproval_status", "not_requested")
    .order("version_number", { ascending: true });

  if (error) {
    throw new Error(`재승인 대상 rewrite version 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}

/** 특정 기사에서 재export 가능한(재승인 완료, 아직 export 전인) rewrite version만 조회한다. */
export async function listRewriteVersionsReadyForReexport(articleId: string): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("article_id", articleId)
    .eq("is_rewrite_version", true)
    .eq("rewrite_reapproval_status", "approved")
    .neq("rewrite_reexport_status", "exported")
    .order("version_number", { ascending: true });

  if (error) {
    throw new Error(`재export 대상 rewrite version 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}

/** 특정 기사에 속한 모든 rewrite version의 재게시 workflow 상태를 조회한다. */
export async function listRewriteRepublishWorkflowByArticle(articleId: string): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("article_id", articleId)
    .eq("is_rewrite_version", true)
    .order("version_number", { ascending: true });

  if (error) {
    throw new Error(`기사별 rewrite republish workflow 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
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
