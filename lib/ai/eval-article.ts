// AI Evals: evals/article-quality.v1.eval.yaml 기준으로 기사 초안 품질을 평가한다.
// prompts/article-eval.v1.md의 출력 형식(criteria_scores, aggregate_score, passed,
// notes)을 따른다.
//
// mock 구현(evaluateArticleMock)과 실제 AI 연동을 위한 인터페이스
// (evaluateArticleWithAi)를 분리한다. evaluateArticleWithAi는 Phase 1-3 이후
// prompts/article-eval.v1.md 기준으로 실제 LLM 호출로 구현한다.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import type { Article } from "@/lib/types/domain";
import type { SourceSummary } from "./source-summarizer";

export interface EvalCriterion {
  id: string;
  description: string;
  weight: number;
  scale: string;
  pass_threshold: number;
}

export interface EvalConfig {
  name: string;
  version: number;
  target: string;
  description?: string;
  criteria: EvalCriterion[];
  scoring: {
    aggregate: string;
    pass_threshold: number;
  };
}

export interface CriterionScore {
  score: number;
  reason: string;
}

export interface ArticleEvalResult {
  criteriaScores: Record<string, CriterionScore>;
  aggregateScore: number;
  passed: boolean;
  notes: string;
}

const EVALS_DIR = join(process.cwd(), "evals");
const evalConfigCache = new Map<string, EvalConfig>();

/**
 * evals/ 디렉터리의 YAML 평가 기준 파일을 로드한다. 결과는 캐시된다.
 */
export function loadEvalConfig(fileName: string): EvalConfig {
  const cached = evalConfigCache.get(fileName);
  if (cached) return cached;

  const filePath = join(EVALS_DIR, fileName);
  const raw = readFileSync(filePath, "utf-8");
  const config = load(raw) as EvalConfig;

  evalConfigCache.set(fileName, config);
  return config;
}

/** evalConfig.criteria의 weight를 이용해 가중 평균 점수를 계산한다. */
export function calculateAggregateScore(
  evalConfig: EvalConfig,
  criteriaScores: Record<string, CriterionScore>
): number {
  const totalWeight = evalConfig.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = evalConfig.criteria.reduce((sum, criterion) => {
    const score = criteriaScores[criterion.id]?.score ?? 0;
    return sum + score * criterion.weight;
  }, 0);

  return weightedSum / totalWeight;
}

const MOCK_SCORE = 4;
const MOCK_REASON = "Phase 1-3 mock 평가입니다 (실제 AI 평가는 아직 연결되지 않았습니다).";

/**
 * Phase 1-3: 실제 AI 호출 없이 모든 평가 기준에 고정 점수를 부여하는 mock 평가기.
 */
export function evaluateArticleMock(
  article: Pick<Article, "title" | "content">,
  sourceSummaries: SourceSummary[],
  evalConfig: EvalConfig = loadEvalConfig("article-quality.v1.eval.yaml")
): ArticleEvalResult {
  void article;
  void sourceSummaries;

  const criteriaScores: Record<string, CriterionScore> = {};
  for (const criterion of evalConfig.criteria) {
    criteriaScores[criterion.id] = { score: MOCK_SCORE, reason: MOCK_REASON };
  }

  const aggregateScore = calculateAggregateScore(evalConfig, criteriaScores);
  const passed = aggregateScore >= evalConfig.scoring.pass_threshold;

  return { criteriaScores, aggregateScore, passed, notes: MOCK_REASON };
}

/**
 * Phase 1-3 TODO: prompts/article-eval.v1.md 기준으로 실제 LLM 평가를 호출한다.
 * 아직 구현되지 않았으며, 호출 시 에러를 던진다.
 */
export async function evaluateArticleWithAi(
  article: Pick<Article, "title" | "content">,
  sourceSummaries: SourceSummary[]
): Promise<ArticleEvalResult> {
  void article;
  void sourceSummaries;
  throw new Error(
    "evaluateArticleWithAi은 아직 구현되지 않았습니다 " +
      "(Phase 1-3 TODO: prompts/article-eval.v1.md 기준 LLM 연동 필요)"
  );
}
