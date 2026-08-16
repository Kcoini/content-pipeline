// Phase 3-22: Automation Safety Review — read-only 조회 repository.
// 이 파일의 어떤 함수도 데이터를 변경하지 않는다(select만 사용). 여러
// article에 걸친 social_posts/pipeline_logs를 감사(audit) 목적으로
// 조회할 뿐이다.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapSocialPostRow } from "./social-posts-repository";
import type { PipelineLogEntry } from "./log-repository";
import type { SocialPost } from "@/lib/social/social-platform-types";

const DEFAULT_LOG_LIMIT = 50;
const DEFAULT_SOCIAL_POST_LIMIT = 100;

/** 최근 pipeline_logs를 감사용으로 조회한다 (getLogs와 동일한 매핑, 감사 전용 별칭). */
export async function listRecentPipelineLogsForAudit(limit: number = DEFAULT_LOG_LIMIT): Promise<PipelineLogEntry[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.from("pipeline_logs").select().order("created_at", { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`감사용 pipeline_logs 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.event_name as PipelineLogEntry["type"],
    status: row.status as PipelineLogEntry["status"],
    message: row.message ?? "",
    details: (row.details_json ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  }));
}

/** article 구분 없이 전체 social_posts를 최근 수정 순으로 조회한다 (publish workflow 안전 점검용). */
export async function listSocialPostsForPublishSafetyAudit(limit: number = DEFAULT_SOCIAL_POST_LIMIT): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.from("social_posts").select().order("updated_at", { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`publish safety 감사용 social_posts 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}

/** API 게시 실제 실행이 가능하다고 표시된(있어서는 안 되는) social_posts를 조회한다. */
export async function listApiPublishPreparationRiskItems(limit: number = DEFAULT_SOCIAL_POST_LIMIT): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("api_publish_eligible_for_actual_publish", true)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`API publish 위험 항목 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}

/** 재승인 없이 재export된 rewrite version 등 rewrite workflow 위험 항목을 조회한다. */
export async function listRewriteWorkflowRiskItems(limit: number = DEFAULT_SOCIAL_POST_LIMIT): Promise<SocialPost[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("social_posts")
    .select()
    .eq("is_rewrite_version", true)
    .eq("rewrite_reexport_status", "exported")
    .neq("rewrite_reapproval_status", "approved")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`rewrite workflow 위험 항목 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapSocialPostRow);
}
