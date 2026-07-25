// publish_logs 테이블 ↔ PublishLogEntry 도메인 타입 매핑 및 데이터 접근.
// Phase 2-2: WordPress 등 외부 게시 대상에 대한 게시 결과를 기록/조회한다.

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
  return {
    id: row.id,
    articleId: row.article_id,
    target: row.target,
    status: row.status,
    externalPostId: row.external_post_id,
    postUrl: row.post_url,
    errorMessage: row.error_message,
    details: row.details ?? {},
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
      details: input.details ?? {},
      published_at: publishedAt,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`게시 로그 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapPublishLogRow(data);
}

/** 특정 기사의 게시 로그를 최신순으로 조회한다. */
export async function getPublishLogsByArticleId(
  articleId: string,
  limit = 20
): Promise<PublishLogEntry[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("publish_logs")
    .select()
    .eq("article_id", articleId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`게시 로그 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapPublishLogRow);
}

/** 특정 대상(target)에 대해 이미 success 상태의 게시 로그가 있는지 확인한다 (중복 게시 방지). */
export async function hasSuccessfulPublishLog(
  articleId: string,
  target: string
): Promise<boolean> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("publish_logs")
    .select("id")
    .eq("article_id", articleId)
    .eq("target", target)
    .eq("status", "success")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`게시 로그 조회에 실패했습니다: ${error.message}`);
  }

  return data !== null;
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
  if (fields.details !== undefined) update.details = fields.details;
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
