// Phase 3-20: A/B Testing Draft Structure — social_ab_tests/
// social_ab_test_variants 데이터 접근. 이 repository의 어떤 함수도
// 실제 플랫폼에 게시하거나 자동으로 승자를 반영하지 않는다 — select/
// insert/update만 사용하며, variant는 여전히 기존 approval/export/
// handoff/manual posting 흐름을 그대로 거쳐야 한다.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapSocialPostRow } from "./social-posts-repository";
import type { SocialAbTestRow, SocialAbTestVariantRow } from "@/lib/supabase/database.types";
import type { SocialPost } from "@/lib/social/social-platform-types";
import type {
  SocialAbTest,
  SocialAbTestVariant,
  AbTestStatus,
  AbTestType,
  AbTestComparisonMethod,
  AbTestPrimaryMetric,
  AbTestVariantRole,
  AbTestVariantStatus,
} from "@/lib/social/social-ab-testing-types";

export function mapSocialAbTestRow(row: SocialAbTestRow): SocialAbTest {
  return {
    id: row.id,
    articleId: row.article_id,
    rootSocialPostId: row.root_social_post_id,
    platform: row.platform,
    testName: row.test_name,
    testDescription: row.test_description,
    hypothesis: row.hypothesis,
    testGoal: row.test_goal,
    primaryMetric: row.primary_metric as AbTestPrimaryMetric,
    secondaryMetrics: (row.secondary_metrics ?? []) as AbTestPrimaryMetric[],
    testStatus: row.test_status as AbTestStatus,
    testType: row.test_type as AbTestType,
    comparisonMethod: row.comparison_method as AbTestComparisonMethod,
    winnerSocialPostId: row.winner_social_post_id,
    winnerReason: row.winner_reason,
    resultSummary: row.result_summary,
    warnings: (row.warnings ?? []) as unknown as string[],
    createdBy: row.created_by,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSocialAbTestVariantRow(row: SocialAbTestVariantRow): SocialAbTestVariant {
  return {
    id: row.id,
    abTestId: row.ab_test_id,
    articleId: row.article_id,
    socialPostId: row.social_post_id,
    variantLabel: row.variant_label,
    variantRole: row.variant_role as AbTestVariantRole,
    variantDescription: row.variant_description,
    variantHypothesis: row.variant_hypothesis,
    platform: row.platform,
    toneStyle: row.tone_style,
    versionNumber: row.version_number,
    isControl: row.is_control,
    isRewriteVersion: row.is_rewrite_version,
    manualPostStatus: row.manual_post_status,
    postUrl: row.post_url,
    latestMetricsId: row.latest_metrics_id,
    latestPerformanceScore: row.latest_performance_score,
    latestMetricsRecordedAt: row.latest_metrics_recorded_at,
    variantStatus: row.variant_status as AbTestVariantStatus,
    resultRank: row.result_rank,
    resultNotes: row.result_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateAbTestRow {
  articleId: string;
  rootSocialPostId?: string | null;
  platform: SocialAbTestRow["platform"];
  testName: string;
  testDescription?: string | null;
  hypothesis?: string | null;
  testGoal?: string | null;
  primaryMetric?: AbTestPrimaryMetric;
  secondaryMetrics?: AbTestPrimaryMetric[];
  testType?: AbTestType;
  comparisonMethod?: AbTestComparisonMethod;
  createdBy?: string | null;
}

/** A/B test draft 한 건을 생성한다. 실제 게시나 metrics 수집은 수행하지 않는다. */
export async function createAbTest(input: CreateAbTestRow): Promise<SocialAbTest> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_ab_tests")
    .insert({
      article_id: input.articleId,
      root_social_post_id: input.rootSocialPostId ?? null,
      platform: input.platform,
      test_name: input.testName,
      test_description: input.testDescription ?? null,
      hypothesis: input.hypothesis ?? null,
      test_goal: input.testGoal ?? null,
      primary_metric: input.primaryMetric ?? "performance_score",
      secondary_metrics: input.secondaryMetrics ?? [],
      test_type: input.testType ?? "manual",
      comparison_method: input.comparisonMethod ?? "manual_metrics",
      created_by: input.createdBy ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`A/B test draft 생성에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialAbTestRow(data);
}

export async function getAbTestById(id: string): Promise<SocialAbTest | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.from("social_ab_tests").select().eq("id", id).maybeSingle();

  if (error) {
    throw new Error(`A/B test 조회에 실패했습니다: ${error.message}`);
  }

  return data ? mapSocialAbTestRow(data) : null;
}

export async function listAbTestsByArticle(articleId: string): Promise<SocialAbTest[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.from("social_ab_tests").select().eq("article_id", articleId).order("created_at", { ascending: false });

  if (error) {
    throw new Error(`article의 A/B test 목록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialAbTestRow);
}

/** 특정 social_post가 variant로 속한 A/B test 목록을 조회한다. */
export async function listAbTestsBySocialPost(socialPostId: string): Promise<SocialAbTest[]> {
  const supabase = createServerSupabaseClient();

  const { data: variantRows, error: variantError } = await supabase
    .from("social_ab_test_variants")
    .select("ab_test_id")
    .eq("social_post_id", socialPostId);

  if (variantError) {
    throw new Error(`social post의 A/B test variant 조회에 실패했습니다: ${variantError.message}`);
  }

  const abTestIds = Array.from(new Set((variantRows ?? []).map((row) => row.ab_test_id)));
  if (abTestIds.length === 0) return [];

  const { data, error } = await supabase.from("social_ab_tests").select().in("id", abTestIds).order("created_at", { ascending: false });

  if (error) {
    throw new Error(`social post의 A/B test 목록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialAbTestRow);
}

export interface UpdateAbTestPatch {
  testStatus?: AbTestStatus;
  winnerSocialPostId?: string | null;
  winnerReason?: string | null;
  resultSummary?: Record<string, unknown>;
  warnings?: string[];
  startedAt?: string | null;
  endedAt?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export async function updateAbTest(id: string, patch: UpdateAbTestPatch): Promise<SocialAbTest> {
  const supabase = createServerSupabaseClient();

  const update: Partial<SocialAbTestRow> = {};
  if (patch.testStatus !== undefined) update.test_status = patch.testStatus;
  if (patch.winnerSocialPostId !== undefined) update.winner_social_post_id = patch.winnerSocialPostId;
  if (patch.winnerReason !== undefined) update.winner_reason = patch.winnerReason;
  if (patch.resultSummary !== undefined) update.result_summary = patch.resultSummary;
  if (patch.warnings !== undefined) update.warnings = patch.warnings;
  if (patch.startedAt !== undefined) update.started_at = patch.startedAt;
  if (patch.endedAt !== undefined) update.ended_at = patch.endedAt;
  if (patch.reviewedBy !== undefined) update.reviewed_by = patch.reviewedBy;
  if (patch.reviewedAt !== undefined) update.reviewed_at = patch.reviewedAt;

  const { data, error } = await supabase.from("social_ab_tests").update(update).eq("id", id).select().single();

  if (error || !data) {
    throw new Error(`A/B test 갱신에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialAbTestRow(data);
}

export interface CreateAbTestVariantRow {
  abTestId: string;
  articleId: string;
  socialPostId: string;
  variantLabel: string;
  variantRole?: AbTestVariantRole;
  variantDescription?: string | null;
  variantHypothesis?: string | null;
  platform: SocialAbTestVariantRow["platform"];
  toneStyle?: SocialAbTestVariantRow["tone_style"] | null;
  versionNumber?: number | null;
  isControl?: boolean;
  isRewriteVersion?: boolean;
  manualPostStatus?: string | null;
  postUrl?: string | null;
  latestMetricsId?: string | null;
  latestPerformanceScore?: number | null;
  latestMetricsRecordedAt?: string | null;
}

export async function createAbTestVariant(input: CreateAbTestVariantRow): Promise<SocialAbTestVariant> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_ab_test_variants")
    .insert({
      ab_test_id: input.abTestId,
      article_id: input.articleId,
      social_post_id: input.socialPostId,
      variant_label: input.variantLabel,
      variant_role: input.variantRole ?? "candidate",
      variant_description: input.variantDescription ?? null,
      variant_hypothesis: input.variantHypothesis ?? null,
      platform: input.platform,
      tone_style: input.toneStyle ?? null,
      version_number: input.versionNumber ?? null,
      is_control: input.isControl ?? false,
      is_rewrite_version: input.isRewriteVersion ?? false,
      manual_post_status: input.manualPostStatus ?? null,
      post_url: input.postUrl ?? null,
      latest_metrics_id: input.latestMetricsId ?? null,
      latest_performance_score: input.latestPerformanceScore ?? null,
      latest_metrics_recorded_at: input.latestMetricsRecordedAt ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`A/B test variant 추가에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialAbTestVariantRow(data);
}

export async function listVariantsByAbTest(abTestId: string): Promise<SocialAbTestVariant[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.from("social_ab_test_variants").select().eq("ab_test_id", abTestId).order("created_at", { ascending: true });

  if (error) {
    throw new Error(`A/B test variant 목록 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialAbTestVariantRow);
}

export interface UpdateAbTestVariantPatch {
  variantStatus?: AbTestVariantStatus;
  manualPostStatus?: string | null;
  postUrl?: string | null;
  latestMetricsId?: string | null;
  latestPerformanceScore?: number | null;
  latestMetricsRecordedAt?: string | null;
  resultRank?: number | null;
  resultNotes?: string | null;
}

export async function updateAbTestVariant(id: string, patch: UpdateAbTestVariantPatch): Promise<SocialAbTestVariant> {
  const supabase = createServerSupabaseClient();

  const update: Partial<SocialAbTestVariantRow> = {};
  if (patch.variantStatus !== undefined) update.variant_status = patch.variantStatus;
  if (patch.manualPostStatus !== undefined) update.manual_post_status = patch.manualPostStatus;
  if (patch.postUrl !== undefined) update.post_url = patch.postUrl;
  if (patch.latestMetricsId !== undefined) update.latest_metrics_id = patch.latestMetricsId;
  if (patch.latestPerformanceScore !== undefined) update.latest_performance_score = patch.latestPerformanceScore;
  if (patch.latestMetricsRecordedAt !== undefined) update.latest_metrics_recorded_at = patch.latestMetricsRecordedAt;
  if (patch.resultRank !== undefined) update.result_rank = patch.resultRank;
  if (patch.resultNotes !== undefined) update.result_notes = patch.resultNotes;

  const { data, error } = await supabase.from("social_ab_test_variants").update(update).eq("id", id).select().single();

  if (error || !data) {
    throw new Error(`A/B test variant 갱신에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialAbTestVariantRow(data);
}

export interface UpdateSocialPostAbTestSummaryPatch {
  abTestStatus: SocialPost["abTestStatus"];
  latestAbTestId?: string | null;
  abTestVariantRole?: string | null;
  abTestVariantLabel?: string | null;
}

/** social_posts row에 "이 글이 속한 A/B test" 요약을 반영한다(테스트 목록/필터용 — 실제 게시와 무관). */
export async function updateSocialPostAbTestSummary(socialPostId: string, patch: UpdateSocialPostAbTestSummaryPatch): Promise<SocialPost> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .update({
      ab_test_status: patch.abTestStatus,
      latest_ab_test_id: patch.latestAbTestId ?? null,
      ab_test_variant_role: patch.abTestVariantRole ?? null,
      ab_test_variant_label: patch.abTestVariantLabel ?? null,
    })
    .eq("id", socialPostId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`social post의 A/B test 요약 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapSocialPostRow(data);
}
