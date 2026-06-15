// articles / article_sources 테이블 ↔ Article 도메인 타입 매핑 및 데이터 접근.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ArticleRow } from "@/lib/supabase/database.types";
import type { Article, ArticleStatus } from "@/lib/types/domain";
import { assertApproved } from "@/lib/harness/approval-gate";
import { saveApprovalLog } from "@/lib/repositories/approval-repository";

export interface SaveDraftArticleInput {
  themeId: string;
  title: string;
  content: string;
  citedSourceIds: string[];
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

  const { data: articleRow, error: insertError } = await supabase
    .from("articles")
    .insert({
      theme_id: input.themeId,
      title: input.title,
      content: input.content,
      status: "draft",
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
    action: "approve_article",
    status: "approved",
    approvedBy: input.approvedBy,
  });

  return mapArticleRowToArticle(data, existing.citedSourceIds);
}
