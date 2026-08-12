// Phase 3-10: social_post_rewrite_suggestions 데이터 접근.
// 제안은 사람이 확인/승인하기 전까지 social_posts 본문에 영향을 주지
// 않는다 — 이 repository는 별도 테이블에만 읽고 쓴다.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SocialPostRewriteSuggestionRow } from "@/lib/supabase/database.types";
import { mapSocialPostRow } from "./social-posts-repository";
import type { SocialPost } from "@/lib/social/social-platform-types";
import type {
  CreateRewriteSuggestionInput,
  RewriteApplicationStatus,
  RewriteSuggestionStatus,
  SocialPostRewriteSuggestion,
} from "@/lib/social/social-rewrite-types";

export function mapSocialPostRewriteSuggestionRow(row: SocialPostRewriteSuggestionRow): SocialPostRewriteSuggestion {
  return {
    id: row.id,
    socialPostId: row.social_post_id,
    articleId: row.article_id,
    platform: row.platform,
    toneStyle: row.tone_style,
    originalPerformanceStatus: row.original_performance_status,
    originalPerformanceScore: row.original_performance_score,
    suggestionStatus: row.suggestion_status as RewriteSuggestionStatus,
    diagnosis: row.diagnosis,
    suggestedChanges: row.suggested_changes,
    suggestedTitle: row.suggested_title,
    suggestedHook: row.suggested_hook,
    suggestedBodyOutline: row.suggested_body_outline as unknown as SocialPostRewriteSuggestion["suggestedBodyOutline"],
    suggestedCta: row.suggested_cta,
    suggestedHashtags: row.suggested_hashtags ?? [],
    suggestedThreadItems: row.suggested_thread_items as unknown as SocialPostRewriteSuggestion["suggestedThreadItems"],
    suggestedCardItems: row.suggested_card_items as unknown as SocialPostRewriteSuggestion["suggestedCardItems"],
    suggestedToneStyle: (row.suggested_tone_style as SocialPostRewriteSuggestion["suggestedToneStyle"]) ?? null,
    riskNotes: (row.risk_notes as unknown as string[]) ?? [],
    qualityNotes: (row.quality_notes as unknown as string[]) ?? [],
    expectedImprovementReason: row.expected_improvement_reason,
    generatedBy: row.generated_by,
    generatedAt: row.generated_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    appliedAt: row.applied_at,
    rejectedReason: row.rejected_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    appliedSocialPostId: row.applied_social_post_id,
    applicationStatus: row.application_status as RewriteApplicationStatus,
    applicationError: row.application_error,
    applicationNotes: row.application_notes,
  };
}

/** 새 rewrite suggestion을 저장한다 (기존 social_posts 본문은 건드리지 않음). */
export async function createRewriteSuggestion(input: CreateRewriteSuggestionInput): Promise<SocialPostRewriteSuggestion> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_rewrite_suggestions")
    .insert({
      social_post_id: input.socialPostId,
      article_id: input.articleId,
      platform: input.platform,
      tone_style: input.toneStyle,
      original_performance_status: input.originalPerformanceStatus ?? null,
      original_performance_score: input.originalPerformanceScore ?? null,
      suggestion_status: input.suggestionStatus,
      diagnosis: input.diagnosis,
      suggested_changes: input.suggestedChanges,
      suggested_title: input.suggestedTitle ?? null,
      suggested_hook: input.suggestedHook ?? null,
      suggested_body_outline: (input.suggestedBodyOutline ?? []) as unknown as Record<string, unknown>[],
      suggested_cta: input.suggestedCta ?? null,
      suggested_hashtags: input.suggestedHashtags ?? [],
      suggested_thread_items: (input.suggestedThreadItems ?? []) as unknown as Record<string, unknown>[],
      suggested_card_items: (input.suggestedCardItems ?? []) as unknown as Record<string, unknown>[],
      suggested_tone_style: input.suggestedToneStyle ?? null,
      risk_notes: (input.riskNotes ?? []) as unknown as Record<string, unknown>[],
      quality_notes: (input.qualityNotes ?? []) as unknown as Record<string, unknown>[],
      expected_improvement_reason: input.expectedImprovementReason ?? null,
      generated_by: input.generatedBy ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`rewrite suggestion 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRewriteSuggestionRow(data);
}

/** id로 rewrite suggestion 하나를 조회한다. 없으면 null. */
export async function getRewriteSuggestionById(id: string): Promise<SocialPostRewriteSuggestion | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.from("social_post_rewrite_suggestions").select().eq("id", id).maybeSingle();

  if (error) {
    throw new Error(`rewrite suggestion 조회에 실패했습니다: ${error.message}`);
  }

  return data ? mapSocialPostRewriteSuggestionRow(data) : null;
}

/** 특정 social post의 rewrite suggestion 이력을 최신순으로 조회한다. */
export async function listRewriteSuggestionsBySocialPost(socialPostId: string): Promise<SocialPostRewriteSuggestion[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_rewrite_suggestions")
    .select()
    .eq("social_post_id", socialPostId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`rewrite suggestion 목록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRewriteSuggestionRow);
}

/** 특정 기사에 속한 모든 rewrite suggestion을 최신순으로 조회한다. */
export async function listRewriteSuggestionsByArticle(articleId: string): Promise<SocialPostRewriteSuggestion[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_rewrite_suggestions")
    .select()
    .eq("article_id", articleId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`기사별 rewrite suggestion 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRewriteSuggestionRow);
}

export interface UpdateRewriteSuggestionStatusPatch {
  reviewedBy?: string | null;
  rejectedReason?: string | null;
}

/**
 * rewrite suggestion의 상태를 갱신한다 (승인/반려 등). status='approved'/
 * 'rejected'이면 reviewed_at을 함께 채운다. 이 함수는 social_posts 본문을
 * 절대 수정하지 않는다 — suggestion_status만 바뀐다.
 */
export async function updateRewriteSuggestionStatus(
  id: string,
  status: RewriteSuggestionStatus,
  patch: UpdateRewriteSuggestionStatusPatch = {}
): Promise<SocialPostRewriteSuggestion> {
  const supabase = createServerSupabaseClient();

  const update: Partial<SocialPostRewriteSuggestionRow> = {
    suggestion_status: status,
  };
  if (patch.reviewedBy !== undefined) update.reviewed_by = patch.reviewedBy;
  if (patch.rejectedReason !== undefined) update.rejected_reason = patch.rejectedReason;
  if (status === "approved" || status === "rejected") {
    update.reviewed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("social_post_rewrite_suggestions")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`rewrite suggestion 상태 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRewriteSuggestionRow(data);
}

/** social_posts의 rewrite suggestion 요약 컬럼을 갱신한다 (rewrite_suggestion_count는 +1). */
export async function updateSocialPostRewriteSuggestionSummary(
  socialPostId: string,
  suggestion: SocialPostRewriteSuggestion
): Promise<SocialPost> {
  const supabase = createServerSupabaseClient();

  const { data: currentRow, error: fetchError } = await supabase
    .from("social_posts")
    .select("rewrite_suggestion_count")
    .eq("id", socialPostId)
    .single();

  if (fetchError || !currentRow) {
    throw new Error(`social post 조회에 실패했습니다: ${fetchError?.message ?? "unknown error"}`);
  }

  const currentCount = (currentRow as { rewrite_suggestion_count: number }).rewrite_suggestion_count ?? 0;

  const { data, error } = await supabase
    .from("social_posts")
    .update({
      latest_rewrite_suggestion_id: suggestion.id,
      rewrite_suggestion_status: suggestion.suggestionStatus === "blocked" ? "blocked" : "suggested",
      rewrite_suggestion_count: currentCount + 1,
      latest_rewrite_suggested_at: suggestion.generatedAt,
    })
    .eq("id", socialPostId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`social post rewrite suggestion 요약 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}

export interface UpdateRewriteSuggestionApplicationStatusPatch {
  applicationStatus: RewriteApplicationStatus;
  appliedSocialPostId?: string | null;
  applicationError?: string | null;
  applicationNotes?: string | null;
}

/** rewrite suggestion의 적용(application) 상태만 갱신한다 (Phase 3-11). */
export async function updateRewriteSuggestionApplicationStatus(
  id: string,
  patch: UpdateRewriteSuggestionApplicationStatusPatch
): Promise<SocialPostRewriteSuggestion> {
  const supabase = createServerSupabaseClient();

  const update: Partial<SocialPostRewriteSuggestionRow> = {
    application_status: patch.applicationStatus,
  };
  if (patch.appliedSocialPostId !== undefined) update.applied_social_post_id = patch.appliedSocialPostId;
  if (patch.applicationError !== undefined) update.application_error = patch.applicationError;
  if (patch.applicationNotes !== undefined) update.application_notes = patch.applicationNotes;

  const { data, error } = await supabase
    .from("social_post_rewrite_suggestions")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`rewrite suggestion 적용 상태 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRewriteSuggestionRow(data);
}

/**
 * rewrite suggestion을 "적용 완료"로 표시한다: suggestion_status와
 * application_status를 함께 'applied'로 바꾸고, 새로 생성된
 * social_post의 id를 연결한다.
 */
export async function markRewriteSuggestionApplied(
  id: string,
  appliedSocialPostId: string,
  notes?: string | null
): Promise<SocialPostRewriteSuggestion> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_rewrite_suggestions")
    .update({
      suggestion_status: "applied",
      application_status: "applied",
      applied_social_post_id: appliedSocialPostId,
      applied_at: new Date().toISOString(),
      application_notes: notes ?? null,
      application_error: null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`rewrite suggestion 적용 완료 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRewriteSuggestionRow(data);
}

/** 특정 social post에 대해 적용 가능한(approved && not_applied) rewrite suggestion만 조회한다. */
export async function listApplicableRewriteSuggestionsBySocialPost(socialPostId: string): Promise<SocialPostRewriteSuggestion[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_post_rewrite_suggestions")
    .select()
    .eq("social_post_id", socialPostId)
    .eq("suggestion_status", "approved")
    .eq("application_status", "not_applied")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`적용 가능한 rewrite suggestion 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRewriteSuggestionRow);
}
