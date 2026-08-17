// AI Evals: evals/article-quality.v1.eval.yaml 기준으로 기사 초안 품질을 평가한다.
// tool_use 방식으로 JSON 출력을 강제해 파싱 실패를 방지한다.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { getAnthropicClient, ANTHROPIC_MODEL } from "./anthropic-client";
import { toAiErrorMessage } from "./ai-errors";
import type { Article } from "@/lib/types/domain";
import type { SourceSummary } from "./source-summarizer";
import { getArticleModeConfig, type ArticleMode } from "@/lib/articles/article-modes";

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
    copy_risk_fail_threshold?: number;
    synthesis_fail_threshold?: number;
    /** Phase 2-1: monetized-blog.eval.yaml의 adsense-policy-risk gate */
    policy_risk_fail_threshold?: number;
    /** source_based_explainer 개선: 특정 출처의 문단 구조를 그대로 따라간 경우를 잡는 gate */
    source_structure_copy_risk_fail_threshold?: number;
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

export function loadEvalConfig(fileName: string): EvalConfig {
  const cached = evalConfigCache.get(fileName);
  if (cached) return cached;

  const filePath = join(EVALS_DIR, fileName);
  const raw = readFileSync(filePath, "utf-8");
  const config = load(raw) as EvalConfig;

  evalConfigCache.set(fileName, config);
  return config;
}

export function calculateAggregateScore(
  evalConfig: EvalConfig,
  criteriaScores: Record<string, CriterionScore>
): number {
  const totalWeight = evalConfig.criteria.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = evalConfig.criteria.reduce((sum, c) => {
    const score = criteriaScores[c.id]?.score ?? 0;
    return sum + score * c.weight;
  }, 0);

  return weightedSum / totalWeight;
}

const MOCK_REASON = "Phase 1-3 mock 평가입니다 (실제 AI 평가는 아직 연결되지 않았습니다).";

const MOCK_SCORES: Record<string, number> = {
  "copy-risk": 1,
  "synthesis": 5,
  "source-structure-copy-risk": 1,
};
const MOCK_DEFAULT_SCORE = 4;

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

  const { policy_risk_fail_threshold } = evalConfig.scoring;
  if (policy_risk_fail_threshold !== undefined) {
    const policyRiskScore = criteriaScores["adsense-policy-risk"]?.score ?? 0;
    if (policyRiskScore >= policy_risk_fail_threshold) return false;
  }

  const { source_structure_copy_risk_fail_threshold } = evalConfig.scoring;
  if (source_structure_copy_risk_fail_threshold !== undefined) {
    const sourceStructureCopyRiskScore = criteriaScores["source-structure-copy-risk"]?.score ?? 0;
    if (sourceStructureCopyRiskScore >= source_structure_copy_risk_fail_threshold) return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────
// AI 평가 (tool_use 방식)
// ─────────────────────────────────────────────────────────────

const EVAL_SYSTEM_PROMPT = `당신은 콘텐츠 품질 평가자입니다.
제공된 기사와 출처 요약을 바탕으로 아래 11가지 기준을 1~5점 정수로 채점하고,
score_article 도구를 반드시 호출해 결과를 저장하세요.

【평가 기준】
1. factual-grounding: 주요 주장이 출처 요약으로 뒷받침되는가 (출처에 없는 주장=낮은 점수)
2. fact-opinion-separation: 사실과 의견이 명확히 구분되어 서술되는가
3. exaggeration-check: 클릭베이트성 과장 표현이나 근거 없는 단정이 없는가 (제목의 "충격", "대박" 등 포함)
4. unsourced-numbers-check: 출처에 없는 통계·날짜·고유명사가 추가되지 않았는가
5. structure: 리드문→배경→핵심쟁점→비교→전망 구조를 갖추었는가 (출처 나열=낮은 점수)
6. readability: 문장이 명확하고 가독성이 좋은가
7. originality: 기사가 출처 요약과 독립적으로 작성되었는가 (복사=1점, 완전 재구성=5점)
8. synthesis: 여러 출처를 통합해 하나의 논지/흐름으로 재구성했는가 (단순 나열=1점, 유기적 통합=5점)
9. source-integration: 출처가 기사 흐름에 자연스럽게 녹아 있는가 (단순 나열 금지)
10. copy-risk: 출처 요약과 15단어 이상 연속 동일 구문이 있는가 (1=없음, 5=심각한 복사)
11. source-structure-copy-risk: 특정 출처 하나의 문단 순서·논리 전개를 그대로 따라갔는가, 또는
    "A 출처에 따르면... B 출처에 따르면..." 패턴이 반복되는가 (1=완전히 재구성됨, 5=특정 출처
    구조를 그대로 복제함). 문장을 복사하지 않아도 "구조"만 그대로 따라간 경우도 높은 점수를 준다.

【채점 규칙】
- factual-grounding, unsourced-numbers-check: 출처 요약과 직접 대조해 평가
- originality, synthesis, copy-risk, source-structure-copy-risk: 기사 본문과 출처 요약을 직접 비교해 평가
- copy-risk: 15단어 이상 동일 구문 발견 시 4~5점 부여
- 출처별 나열 구조("A 출처에 따르면... B 출처에 따르면...")는 synthesis=1~2점, structure=1~2점,
  source-structure-copy-risk=4~5점
- 각 기준에 score(정수 1~5)와 reason(한국어 근거 1~2문장)을 반드시 작성`;

const EVAL_TOOL = {
  name: "score_article",
  description: "기사 품질 평가 결과를 저장한다. 11개 기준 모두에 score(1-5 정수)와 reason을 반드시 포함해야 한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      criteria_scores: {
        type: "object",
        description:
          "각 기준 ID를 키, {score: 1~5 정수, reason: 한국어 근거}를 값으로 가진 객체. " +
          "필수 키: factual-grounding, fact-opinion-separation, exaggeration-check, " +
          "unsourced-numbers-check, structure, readability, originality, synthesis, " +
          "source-integration, copy-risk, source-structure-copy-risk",
      },
      notes: {
        type: "string",
        description: "전반적인 평가 요약 (한국어, 3~5문장). 가장 중요한 강점과 약점을 명시.",
      },
    },
    required: ["criteria_scores", "notes"],
  },
};

function buildEvalUserPrompt(
  article: Pick<Article, "title" | "content">,
  sourceSummaries: SourceSummary[]
): string {
  const sourceLines = sourceSummaries
    .map((s) => {
      const lines = [
        `[출처 ${s.sourceId}]`,
        `제목: ${s.title}`,
        `요약: ${s.summary}`,
      ];
      if (s.keyPoints.length > 0) {
        lines.push("핵심 포인트:");
        s.keyPoints.forEach((kp) => lines.push(`  • ${kp}`));
      }
      return lines.join("\n");
    })
    .join("\n\n");

  return [
    `기사 제목: ${article.title}`,
    "",
    "기사 본문:",
    article.content,
    "",
    "──── 평가에 사용할 출처 요약 ────",
    sourceLines,
  ].join("\n");
}

interface RawCriterionScore {
  score?: unknown;
  reason?: unknown;
}

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
      tools: [EVAL_TOOL],
      tool_choice: { type: "tool", name: "score_article" },
      messages: [{ role: "user", content: buildEvalUserPrompt(article, sourceSummaries) }],
    });

    const toolUseBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      throw new Error("AI가 도구를 호출하지 않았습니다.");
    }

    const input = toolUseBlock.input as {
      criteria_scores?: Record<string, RawCriterionScore>;
      notes?: unknown;
    };

    const criteriaScores: Record<string, CriterionScore> = {};
    for (const criterion of evalConfig.criteria) {
      const raw = input.criteria_scores?.[criterion.id];
      const score = typeof raw?.score === "number" ? Math.round(raw.score) : 0;
      const reason = typeof raw?.reason === "string" ? raw.reason : "";
      criteriaScores[criterion.id] = { score, reason };
    }

    const aggregateScore = calculateAggregateScore(evalConfig, criteriaScores);
    const passed = applyGateConditions(evalConfig, criteriaScores, aggregateScore);
    const notes = typeof input.notes === "string" ? input.notes : "";

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

// ─────────────────────────────────────────────────────────────
// Phase 2-1: mode별 평가 (general_news / monetized_blog)
//
// article-quality.v1.eval.yaml(기존 source_based_explainer 경로)은 위의
// evaluateArticleMock/evaluateArticleWithAi를 그대로 사용해 동작을 바꾸지 않는다.
// general_news/monetized_blog는 evalConfig.criteria로부터 system prompt와
// tool schema를 동적으로 구성하는 generic evaluator를 사용한다.
// ─────────────────────────────────────────────────────────────

const GENERIC_MOCK_REASON = "Phase 2-1 mock 평가입니다 (실제 AI 평가는 아직 연결되지 않았습니다).";
const GENERIC_MOCK_SCORE = 4;

/** evalConfig.criteria 기준으로 mock 평가 결과를 생성한다 (모든 기준 4점 고정). */
export function evaluateArticleModeMock(
  article: Pick<Article, "title" | "content">,
  sourceSummaries: SourceSummary[],
  evalConfig: EvalConfig
): ArticleEvalResult {
  void article;
  void sourceSummaries;

  const criteriaScores: Record<string, CriterionScore> = {};
  for (const criterion of evalConfig.criteria) {
    criteriaScores[criterion.id] = { score: GENERIC_MOCK_SCORE, reason: GENERIC_MOCK_REASON };
  }

  const aggregateScore = calculateAggregateScore(evalConfig, criteriaScores);
  const passed = applyGateConditions(evalConfig, criteriaScores, aggregateScore);

  return { criteriaScores, aggregateScore, passed, notes: GENERIC_MOCK_REASON };
}

function buildGenericEvalSystemPrompt(evalConfig: EvalConfig): string {
  const criteriaLines = evalConfig.criteria
    .map((c, index) => `${index + 1}. ${c.id}: ${c.description}`)
    .join("\n");

  return [
    "당신은 콘텐츠 품질 평가자입니다.",
    `제공된 기사와 출처 요약을 바탕으로 아래 ${evalConfig.criteria.length}가지 기준을 1~5점 정수로 채점하고,`,
    "score_article 도구를 반드시 호출해 결과를 저장하세요.",
    "",
    "【평가 기준】",
    criteriaLines,
    "",
    "【채점 규칙】",
    "- 각 기준에 score(정수 1~5)와 reason(한국어 근거 1~2문장)을 반드시 작성하세요.",
    "- 위험도/가능성을 나타내는 기준(예: risk, exaggeration 관련)은 설명에 명시된 방향(점수가 높을수록",
    "  위험/과장이 심함 또는 없음)을 그대로 따르세요.",
  ].join("\n");
}

function buildGenericEvalTool(evalConfig: EvalConfig) {
  const criterionIds = evalConfig.criteria.map((c) => c.id);
  return {
    name: "score_article",
    description: `기사 품질 평가 결과를 저장한다. ${criterionIds.length}개 기준 모두에 score(1-5 정수)와 reason을 반드시 포함해야 한다.`,
    input_schema: {
      type: "object" as const,
      properties: {
        criteria_scores: {
          type: "object",
          description: `각 기준 ID를 키, {score: 1~5 정수, reason: 한국어 근거}를 값으로 가진 객체. 필수 키: ${criterionIds.join(", ")}`,
        },
        notes: {
          type: "string",
          description: "전반적인 평가 요약 (한국어, 3~5문장). 가장 중요한 강점과 약점을 명시.",
        },
      },
      required: ["criteria_scores", "notes"],
    },
  };
}

/** evalConfig.criteria로부터 동적으로 구성한 prompt/tool schema로 AI 평가를 수행한다. */
export async function evaluateArticleModeWithAi(
  article: Pick<Article, "title" | "content">,
  sourceSummaries: SourceSummary[],
  evalConfig: EvalConfig
): Promise<ArticleEvalResult> {
  try {
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      system: buildGenericEvalSystemPrompt(evalConfig),
      tools: [buildGenericEvalTool(evalConfig)],
      tool_choice: { type: "tool", name: "score_article" },
      messages: [{ role: "user", content: buildEvalUserPrompt(article, sourceSummaries) }],
    });

    const toolUseBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      throw new Error("AI가 도구를 호출하지 않았습니다.");
    }

    const input = toolUseBlock.input as {
      criteria_scores?: Record<string, RawCriterionScore>;
      notes?: unknown;
    };

    const criteriaScores: Record<string, CriterionScore> = {};
    for (const criterion of evalConfig.criteria) {
      const raw = input.criteria_scores?.[criterion.id];
      const score = typeof raw?.score === "number" ? Math.round(raw.score) : 0;
      const reason = typeof raw?.reason === "string" ? raw.reason : "";
      criteriaScores[criterion.id] = { score, reason };
    }

    const aggregateScore = calculateAggregateScore(evalConfig, criteriaScores);
    const passed = applyGateConditions(evalConfig, criteriaScores, aggregateScore);
    const notes = typeof input.notes === "string" ? input.notes : "";

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

/**
 * article_mode에 따라 적절한 평가 기준/함수를 선택해 평가를 수행한다.
 * source_based_explainer(기본값)는 기존 evaluateArticleMock/evaluateArticleWithAi를
 * 그대로 사용해 기존 동작을 바꾸지 않는다.
 */
export async function evaluateArticleForMode(
  mode: ArticleMode,
  article: Pick<Article, "title" | "content">,
  sourceSummaries: SourceSummary[],
  useAi: boolean
): Promise<ArticleEvalResult> {
  if (mode === "source_based_explainer") {
    return useAi
      ? evaluateArticleWithAi(article, sourceSummaries)
      : evaluateArticleMock(article, sourceSummaries);
  }

  const modeConfig = getArticleModeConfig(mode);
  const evalConfig = loadEvalConfig(modeConfig.evalFileName);

  return useAi
    ? evaluateArticleModeWithAi(article, sourceSummaries, evalConfig)
    : evaluateArticleModeMock(article, sourceSummaries, evalConfig);
}
