// eval_runs 테이블 데이터 접근.
// lib/ai/eval-article.ts의 평가 결과를 영속화한다 (AI Evals, FR-8).

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ArticleEvalResult } from "@/lib/ai/eval-article";
import type { EvalRunRow } from "@/lib/supabase/database.types";

export interface EvalRun {
  id: string;
  articleId: string;
  evalName: string;
  criteriaScores: ArticleEvalResult["criteriaScores"];
  aggregateScore: number | null;
  passed: boolean;
  notes: string;
  createdAt: string;
}

export function mapEvalRunRow(row: EvalRunRow): EvalRun {
  return {
    id: row.id,
    articleId: row.article_id,
    evalName: row.eval_name,
    criteriaScores: row.criteria_scores as ArticleEvalResult["criteriaScores"],
    aggregateScore: row.aggregate_score,
    passed: row.passed,
    notes: row.notes ?? "",
    createdAt: row.created_at,
  };
}

export interface SaveEvalRunInput {
  articleId: string;
  evalName: string;
  result: ArticleEvalResult;
}

/**
 * AI 평가 결과를 eval_runs에 저장한다 (통과/미통과와 무관하게 항상 저장).
 *
 * eval_runs의 평가 점수는 aggregate_score 기준이다. 일부 환경의 eval_runs
 * 테이블에는 과거 schema의 score not null 컬럼이 남아 있을 수 있으므로,
 * score에도 aggregate_score와 동일한 값을 함께 저장해 호환성을 유지한다
 * (db/migrations/003_eval_runs_score_column.sql 참고).
 */
export async function saveEvalRun(input: SaveEvalRunInput): Promise<EvalRun> {
  const supabase = createServerSupabaseClient();

  const aggregateScore = input.result.aggregateScore ?? 0;

  const { data, error } = await supabase
    .from("eval_runs")
    .insert({
      article_id: input.articleId,
      eval_name: input.evalName,
      criteria_scores: input.result.criteriaScores,
      aggregate_score: aggregateScore,
      score: aggregateScore,
      passed: input.result.passed,
      notes: input.result.notes,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`평가 결과 저장에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }

  return mapEvalRunRow(data);
}

/** 특정 기사의 최신 평가 결과를 조회한다. */
export async function getLatestEvalRun(articleId: string): Promise<EvalRun | undefined> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("eval_runs")
    .select()
    .eq("article_id", articleId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`평가 결과 조회에 실패했습니다: ${error.message}`);
  }

  return data ? mapEvalRunRow(data) : undefined;
}
