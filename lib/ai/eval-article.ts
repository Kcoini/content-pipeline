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
import { getAnthropicClient, ANTHROPIC_MODEL } from "./anthropic-client";
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

const EVAL_SYSTEM_PROMPT = `당신은 콘텐츠 품질 평가자입니다.
아래 기사를 다음 6가지 평가 기준에 따라 1~5점으로 채점하세요.

1. factual-grounding: 기사의 주요 주장이 인용된 출처 요약으로 뒷받침되는가
2. fact-opinion-separation: 사실(fact)과 의견(opinion)이 명확히 구분되어 서술되는가
3. exaggeration-check: 클릭베이트성 과장 표현이나 근거 없는 단정적 표현이 없는가
4. unsourced-numbers-check: 출처에 없는 통계, 날짜, 고유명사가 새로 추가되지 않았는가
5. structure: 기사가 도입-본문-결론 구조를 갖추고 있는가
6. readability: 문장이 명확하고 가독성이 좋은가

규칙:
1. 각 기준에 대해 점수(score, 1~5 정수)와 근거(reason)를 작성하세요.
2. factual-grounding, unsourced-numbers-check 기준은 반드시 제공된 출처
   요약(sourceSummaries)과 대조하여 평가하세요.
3. 출력은 반드시 아래 JSON 형식만 반환하세요. 그 외 텍스트는 출력하지 마세요.

출력 형식:
{
  "criteria_scores": {
    "factual-grounding": { "score": 4, "reason": "..." },
    "fact-opinion-separation": { "score": 4, "reason": "..." },
    "exaggeration-check": { "score": 5, "reason": "..." },
    "unsourced-numbers-check": { "score": 4, "reason": "..." },
    "structure": { "score": 4, "reason": "..." },
    "readability": { "score": 4, "reason": "..." }
  },
  "notes": "전반적인 평가 요약"
}`;

function buildEvalUserPrompt(
  article: Pick<Article, "title" | "content">,
  sourceSummaries: SourceSummary[]
): string {
  const summaryLines = sourceSummaries
    .map((summary) =>
      [
        `- sourceId: ${summary.sourceId}`,
        `  title: ${summary.title}`,
        `  url: ${summary.url}`,
        `  summary: ${summary.summary}`,
      ].join("\n")
    )
    .join("\n");

  return [
    `기사 제목: ${article.title}`,
    "기사 본문:",
    article.content,
    "",
    "인용된 출처 요약:",
    summaryLines,
  ].join("\n");
}

interface RawCriterionScore {
  score?: unknown;
  reason?: unknown;
}

interface RawEvalResult {
  criteria_scores?: Record<string, RawCriterionScore>;
  notes?: unknown;
}

/**
 * Phase 1-4: prompts/article-eval.v1.md 기준으로 Anthropic API를 호출해 기사
 * 품질을 평가한다. aggregate_score와 passed는 모델 응답값을 신뢰하지 않고
 * evalConfig 기준으로 코드에서 재계산한다.
 *
 * JSON parse에 실패하거나 응답 형식이 올바르지 않으면 예외를 던지지 않고
 * score=0, passed=false, notes에 실패 이유를 담아 반환한다.
 */
export async function evaluateArticleWithAi(
  article: Pick<Article, "title" | "content">,
  sourceSummaries: SourceSummary[],
  evalConfig: EvalConfig = loadEvalConfig("article-quality.v1.eval.yaml")
): Promise<ArticleEvalResult> {
  try {
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      system: EVAL_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildEvalUserPrompt(article, sourceSummaries) }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("AI 응답에서 텍스트를 찾을 수 없습니다.");
    }

    const parsed = JSON.parse(textBlock.text) as RawEvalResult;

    const criteriaScores: Record<string, CriterionScore> = {};
    for (const criterion of evalConfig.criteria) {
      const raw = parsed.criteria_scores?.[criterion.id];
      const score = typeof raw?.score === "number" ? raw.score : 0;
      const reason = typeof raw?.reason === "string" ? raw.reason : "";
      criteriaScores[criterion.id] = { score, reason };
    }

    const aggregateScore = calculateAggregateScore(evalConfig, criteriaScores);
    const passed = aggregateScore >= evalConfig.scoring.pass_threshold;
    const notes = typeof parsed.notes === "string" ? parsed.notes : "";

    return { criteriaScores, aggregateScore, passed, notes };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      criteriaScores: {},
      aggregateScore: 0,
      passed: false,
      notes: `AI 평가 응답을 처리하지 못했습니다: ${reason}`,
    };
  }
}
