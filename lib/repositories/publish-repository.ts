// publish_logs 테이블 ↔ PublishLogEntry 도메인 타입 매핑 및 데이터 접근.
// Phase 2-2: WordPress 등 외부 게시 대상에 대한 게시 결과를 기록/조회한다.
// Phase 2-8: 상세 정보는 details_json 컬럼에 저장한다 (pipeline_logs/contract_runs와
// 컬럼명을 맞춤). details_json에는 절대 본문 전체나 인증 정보를 저장하지 않는다.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PublishLogRow, PublishLogStatus } from "@/lib/supabase/database.types";
import type { Database } from "@/lib/supabase/database.types";

type PublishLogUpdate = Database["public"]["Tables"]["publish_logs"]["Update"];

export interface PublishLogEntry {
  id: string;
  articleId: string | null;
  target: string | null;
  status: PublishLogStatus;
  externalPostId: string | null;
  postUrl: string | null;
  errorMessage: string | null;
  details: Record<string, unknown>;
  publishedAt: string | null;
  createdAt: string;
}

export function mapPublishLogRow(row: PublishLogRow): PublishLogEntry {
  const hasDetailsJson = row.details_json && Object.keys(row.details_json).length > 0;

  return {
    id: row.id,
    articleId: row.article_id,
    target: row.target,
    status: row.status,
    externalPostId: row.external_post_id,
    postUrl: row.post_url,
    errorMessage: row.error_message,
    details: hasDetailsJson ? row.details_json : (row.details ?? {}),
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

export interface SavePublishLogInput {
  articleId: string;
  target: string;
  status: PublishLogStatus;
  externalPostId?: string | null;
  postUrl?: string | null;
  errorMessage?: string | null;
  details?: Record<string, unknown>;
  /** 생략하면 status='success'일 때만 현재 시각으로 채운다. */
  publishedAt?: string | null;
}

/** 게시 시도 결과(success/failed/dry_run)를 publish_logs에 기록한다. */
export async function savePublishLog(input: SavePublishLogInput): Promise<PublishLogEntry> {
  const supabase = createServerSupabaseClient();

  const publishedAt =
    input.publishedAt !== undefined
      ? input.publishedAt
      : input.status === "success"
        ? new Date().toISOString()
        : null;

  const { data, error } = await supabase
    .from("publish_logs")
    .insert({
      article_id: input.articleId,
      target: input.target,
      status: input.status,
      external_post_id: input.externalPostId ?? null,
      post_url: input.postUrl ?? null,
      error_message: input.errorMessage ?? null,
      details_json: input.details ?? {},
      published_at: publishedAt,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`게시 로그 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapPublishLogRow(data);
}

/**
 * 특정 기사의 게시 로그를 최신순으로 조회한다.
 * target을 지정하지 않으면 모든 target이 섞인 최신 로그를 조회하므로,
 * 다른 target(quality gate/human approval/public publish 등)의 로그가
 * 많이 쌓이면 특정 target(예: wordpress)의 오래된 성공 기록이 limit 밖으로
 * 밀려날 수 있다. 특정 target의 최신 기록이 필요하면 반드시 target을
 * 지정해서 호출한다.
 */
export async function getPublishLogsByArticleId(
  articleId: string,
  limit = 20,
  target?: string
): Promise<PublishLogEntry[]> {
  const supabase = createServerSupabaseClient();

  let query = supabase.from("publish_logs").select().eq("article_id", articleId);
  if (target !== undefined) {
    query = query.eq("target", target);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`게시 로그 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapPublishLogRow);
}

export interface SuccessfulWordPressDraft {
  externalPostId: string;
  postUrl: string | null;
}

/**
 * 이미 성공적으로 생성된 WordPress draft 기록이 있는지 확인한다 (중복 게시 방지, Phase 2-9).
 * target='wordpress', status='success', external_post_id가 있는 기록만 중복으로 취급한다
 * (external_post_id가 없는 과거 success 기록은 실제로 생성되지 않은 것으로 간주해 중복 판정에서 제외한다).
 */
export async function getSuccessfulWordPressDraft(
  articleId: string
): Promise<SuccessfulWordPressDraft | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("publish_logs")
    .select("external_post_id, post_url")
    .eq("article_id", articleId)
    .eq("target", "wordpress")
    .eq("status", "success")
    .not("external_post_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`게시 로그 조회에 실패했습니다: ${error.message}`);
  }

  if (!data || !data.external_post_id) return null;

  return { externalPostId: data.external_post_id, postUrl: data.post_url };
}

export interface UpdatePublishLogFields {
  externalPostId?: string | null;
  postUrl?: string | null;
  errorMessage?: string | null;
  details?: Record<string, unknown>;
  publishedAt?: string | null;
}

/** 기존 게시 로그의 상태/부가 정보를 갱신한다. */
export async function updatePublishLogStatus(
  id: string,
  status: PublishLogStatus,
  fields: UpdatePublishLogFields = {}
): Promise<PublishLogEntry> {
  const supabase = createServerSupabaseClient();

  const update: PublishLogUpdate = { status };
  if (fields.externalPostId !== undefined) update.external_post_id = fields.externalPostId;
  if (fields.postUrl !== undefined) update.post_url = fields.postUrl;
  if (fields.errorMessage !== undefined) update.error_message = fields.errorMessage;
  if (fields.details !== undefined) update.details_json = fields.details;
  if (fields.publishedAt !== undefined) update.published_at = fields.publishedAt;

  const { data, error } = await supabase
    .from("publish_logs")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`게시 로그 갱신에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapPublishLogRow(data);
}
