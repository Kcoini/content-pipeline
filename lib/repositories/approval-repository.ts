// approval_logs 테이블 ↔ ApprovalLogEntry 도메인 타입 매핑 및 데이터 접근.
// 사용자 승인(Human Approval) 이벤트를 기록/조회한다 (FR-9).

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ApprovalLogRow, ApprovalLogStatus } from "@/lib/supabase/database.types";

export interface ApprovalLogEntry {
  id: string;
  articleId: string | null;
  themeId: string | null;
  action: string;
  status: ApprovalLogStatus;
  approvedBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface SaveApprovalLogInput {
  articleId: string;
  themeId: string;
  action: string;
  status: ApprovalLogStatus;
  approvedBy?: string;
  notes?: string;
}

export function mapApprovalLogRow(row: ApprovalLogRow): ApprovalLogEntry {
  return {
    id: row.id,
    articleId: row.article_id,
    themeId: row.theme_id,
    action: row.action,
    status: row.status,
    approvedBy: row.approved_by,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/** 승인/거부 이벤트를 approval_logs에 기록한다 (FR-9). */
export async function saveApprovalLog(input: SaveApprovalLogInput): Promise<ApprovalLogEntry> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("approval_logs")
    .insert({
      theme_id: input.themeId,
      article_id: input.articleId,
      action: input.action,
      approved_by: input.approvedBy ?? null,
      status: input.status,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`승인 로그 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapApprovalLogRow(data);
}

/** 특정 기사의 승인 로그 목록을 최신순으로 조회한다. */
export async function getApprovalLogsByArticleId(
  articleId: string,
  limit = 10
): Promise<ApprovalLogEntry[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("approval_logs")
    .select()
    .eq("article_id", articleId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`승인 로그 조회에 실패했습니다: ${error.message}`);
  }

  return (data ?? []).map(mapApprovalLogRow);
}
