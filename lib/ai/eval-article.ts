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
import { extractJson } from "./parse-json";
import { toAiErrorMessage } from "./ai-errors";
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
    /** copy-risk score 이 값 이상이면 passed=false 강제 */
    copy_risk_fail_threshold?: number;
    /** synthesis score 이 값 미만이면 passed=false 강제 */
    synthesis_fail_threshold?: number;
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

const MOCK_REASON = "Phase 1-3 mock 평가입니다 (실제 AI 평가는 아직 연결되지 않았습니다).";

const MOCK_SCORES: Record<string, number> = {
  "copy-risk": 1,    // gate: score >= 4 → fail. mock은 복사 위험 없음
  "synthesis": 5,    // gate: score < 2 → fail. mock은 완벽한 종합
};
const MOCK_DEFAULT_SCORE = 4;

/**
 * Phase 1-3: 실제 AI 호출 없이 모든 평가 기준에 고정 점수를 부여하는 mock 평가기.
 * gate 조건(copy-risk, synthesis)을 트리거하지 않는 점수를 사용한다.
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
    const score = MOCK_SCORES[criterion.id] ?? MOCK_DEFAULT_SCORE;
    criteriaScores[criterion.id] = { score, reason: MOCK_REASON };
  }

  const aggregateScore = calculateAggregateScore(evalConfig, criteriaScores);
  const passed = applyGateConditions(evalConfig, criteriaScores, aggregateScore);

  return { criteriaScores, aggregateScore, passed, notes: MOCK_REASON };
}

/**
 * aggregate_score와 gate 조건을 모두 적용해 최종 passed 여부를 판정한다.
 * - copy-risk score >= copy_risk_fail_threshold → false
 * - synthesis score < synthesis_fail_threshold → false
 */
export function applyGateConditions(
  evalConfig: EvalConfig,
  criteriaScores: Record<string, CriterionScore>,
  aggregateScore: number
): boolean {
  if (aggregateScore < evalConfig.scoring.pass_threshold) return false;

  const { copy_risk_fail_threshold, synthesis_fail_threshold } = evalConfig.scoring;

  if (copy_risk_fail_threshold !== undefined) {
    const copyRiskScore = criteriaScores["copy-risk"]?.score ?? 0;
    if (copyRiskScore >= copy_risk_fail_threshold) return false;
  }

  if (synthesis_fail_threshold !== undefined) {
    const synthesisScore = criteriaScores["synthesis"]?.score ?? 0;
    if (synthesisScore < synthesis_fail_threshold) return false;
  }

  return true;
}

const EVAL_SYSTEM_PROMPT = `당신은 콘텐츠 품질 평가자입니다.
아래 기사를 다음 10가지 평가 기준에 따라 1~5점으로 채점하세요.

【기존 기준】
1. factual-grounding: 기사의 주요 주장이 인용된 출처 요약으로 뒷받침되는가
   (출처에 없는 주장을 사실처럼 서술하면 낮은 점수)
2. fact-opinion-separation: 사실(fact)과 의견(opinion)이 명확히 구분되어 서술되는가
3. exaggeration-check: 클릭베이트성 과장 표현이나 근거 없는 단정적 표현이 없는가
4. unsourced-numbers-check: 출처에 없는 통계, 날짜, 고유명사가 새로 추가되지 않았는가
5. structure: 리드문→배경→핵심 쟁점→비교/시사점→전망 구조를 갖추고 있는가
   (출처별 요약 나열에 그치면 낮은 점수)
6. readability: 문장이 명확하고 가독성이 좋은가

【Phase 1-8 신규 기준】
7. originality: 기사 문장이 출처 요약과 독립적으로 작성되었는가
   (출처 요약을 거의 그대로 복사했으면 1점, 완전히 재구성했으면 5점)
8. synthesis: 여러 출처의 정보를 통합해 하나의 논지/흐름으로 재구성했는가
   (출처를 각각 나열하는 수준이면 1점, 유기적으로 통합했으면 5점)
9. source-integration: 본문에서 출처를 자연스럽게 언급하거나 인용했는가
   (단순 나열 금지, 기사 흐름 속에 녹아 있으면 높은 점수)
10. copy-risk: 출처 요약과 15단어 이상 연속으로 동일한 구문이 발견되는가
    (1=위험 없음, 5=심각한 복사 — 점수가 높을수록 위험)

규칙:
1. 각 기준에 대해 점수(score, 1~5 정수)와 근거(reason)를 작성하세요.
2. factual-grounding, unsourced-numbers-check 기준은 반드시 제공된 출처
   요약(sourceSummaries)과 대조하여 평가하세요.
3. originality, synthesis, copy-risk 기준은 기사 본문과 출처 요약을 직접 비교하여
   평가하세요. copy-risk 점수 산정 시 15단어 이상 연속 동일 구문이 있으면 4~5점을
   부여하세요.
4. 출력은 반드시 아래 JSON 형식만 반환하세요. 그 외 텍스트는 출력하지 마세요.

출력 형식:
{
  "criteria_scores": {
    "factual-grounding": { "score": 4, "reason": "..." },
    "fact-opinion-separation": { "score": 4, "reason": "..." },
    "exaggeration-check": { "score": 5, "reason": "..." },
    "unsourced-numbers-check": { "score": 4, "reason": "..." },
    "structure": { "score": 4, "reason": "..." },
    "readability": { "score": 4, "reason": "..." },
    "originality": { "score": 4, "reason": "..." },
    "synthesis": { "score": 4, "reason": "..." },
    "source-integration": { "score": 4, "reason": "..." },
    "copy-risk": { "score": 1, "reason": "..." }
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

    const parsed = JSON.parse(extractJson(textBlock.text)) as RawEvalResult;

    const criteriaScores: Record<string, CriterionScore> = {};
    for (const criterion of evalConfig.criteria) {
      const raw = parsed.criteria_scores?.[criterion.id];
      const score = typeof raw?.score === "number" ? raw.score : 0;
      const reason = typeof raw?.reason === "string" ? raw.reason : "";
      criteriaScores[criterion.id] = { score, reason };
    }

    const aggregateScore = calculateAggregateScore(evalConfig, criteriaScores);
    const passed = applyGateConditions(evalConfig, criteriaScores, aggregateScore);
    const notes = typeof parsed.notes === "string" ? parsed.notes : "";

    return { criteriaScores, aggregateScore, passed, notes };
  } catch (error) {
    return {
      criteriaScores: {},
      aggregateScore: 0,
      passed: false,
      notes: `AI 평가 응답을 처리하지 못했습니다: ${toAiErrorMessage(error)}`,
    };
  }
}
