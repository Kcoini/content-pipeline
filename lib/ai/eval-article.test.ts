import { describe, expect, it } from "vitest";
import { evaluateArticleMock, evaluateArticleWithAi, loadEvalConfig, applyGateConditions } from "./eval-article";
import type { Article } from "@/lib/types/domain";
import type { SourceSummary } from "./source-summarizer";

const article: Pick<Article, "title" | "content"> = {
  title: "AI 에이전트 동향",
  content: "본문 내용입니다.".repeat(50),
};

const sourceSummaries: SourceSummary[] = [
  {
    sourceId: "source-1",
    title: "출처 A",
    url: "https://a.example.com",
    publisher: "A 매체",
    publishedAt: "2026-01-01",
    summary: "출처 A 요약",
    keyPoints: [],
    sourceAngle: "",
  },
];

describe("loadEvalConfig", () => {
  it("article-quality.v1.eval.yaml의 criteria/scoring을 로드한다", () => {
    const config = loadEvalConfig("article-quality.v1.eval.yaml");

    expect(config.name).toBe("article-quality.v1.eval");
    expect(config.criteria.length).toBeGreaterThan(0);
    expect(config.scoring.pass_threshold).toBeGreaterThan(0);
  });
});

describe("evaluateArticleMock", () => {
  it("criteria_scores, aggregate_score, passed, notes를 반환한다", () => {
    const result = evaluateArticleMock(article, sourceSummaries);

    expect(Object.keys(result.criteriaScores).length).toBeGreaterThan(0);
    expect(typeof result.aggregateScore).toBe("number");
    expect(typeof result.passed).toBe("boolean");
    expect(result.notes).toBeTruthy();
  });

  it("모든 기준이 pass_threshold 이상이면 passed=true를 반환한다", () => {
    const result = evaluateArticleMock(article, sourceSummaries);
    const config = loadEvalConfig("article-quality.v1.eval.yaml");

    expect(result.aggregateScore).toBeGreaterThanOrEqual(config.scoring.pass_threshold);
    expect(result.passed).toBe(true);
  });
});

describe("evaluateArticleMock — gate 조건", () => {
  it("mock 결과의 copy-risk는 1점이어야 한다 (gate 미트리거)", () => {
    const result = evaluateArticleMock(article, sourceSummaries);
    expect(result.criteriaScores["copy-risk"]?.score).toBe(1);
  });

  it("mock 결과의 synthesis는 5점이어야 한다 (gate 미트리거)", () => {
    const result = evaluateArticleMock(article, sourceSummaries);
    expect(result.criteriaScores["synthesis"]?.score).toBe(5);
  });
});

describe("applyGateConditions", () => {
  it("copy-risk >= 4이면 passed=false를 반환한다", () => {
    const config = loadEvalConfig("article-quality.v1.eval.yaml");
    const scores = { "copy-risk": { score: 4, reason: "복사 발견" }, "synthesis": { score: 3, reason: "" } };
    const aggregateScore = config.scoring.pass_threshold + 1;

    expect(applyGateConditions(config, scores, aggregateScore)).toBe(false);
  });

  it("synthesis < 2이면 passed=false를 반환한다", () => {
    const config = loadEvalConfig("article-quality.v1.eval.yaml");
    const scores = { "copy-risk": { score: 1, reason: "" }, "synthesis": { score: 1, reason: "나열" } };
    const aggregateScore = config.scoring.pass_threshold + 1;

    expect(applyGateConditions(config, scores, aggregateScore)).toBe(false);
  });

  it("aggregate_score < pass_threshold이면 passed=false를 반환한다", () => {
    const config = loadEvalConfig("article-quality.v1.eval.yaml");
    const scores = { "copy-risk": { score: 1, reason: "" }, "synthesis": { score: 5, reason: "" } };

    expect(applyGateConditions(config, scores, config.scoring.pass_threshold - 0.1)).toBe(false);
  });

  it("gate 조건 모두 통과 시 passed=true를 반환한다", () => {
    const config = loadEvalConfig("article-quality.v1.eval.yaml");
    const scores = { "copy-risk": { score: 1, reason: "" }, "synthesis": { score: 5, reason: "" } };
    const aggregateScore = config.scoring.pass_threshold + 1;

    expect(applyGateConditions(config, scores, aggregateScore)).toBe(true);
  });
});

describe("evaluateArticleWithAi", () => {
  it("ANTHROPIC_API_KEY가 없으면 예외 없이 passed=false 결과를 반환한다", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const result = await evaluateArticleWithAi(article, sourceSummaries);

    expect(result.passed).toBe(false);
    expect(result.aggregateScore).toBe(0);
    expect(result.criteriaScores).toEqual({});
    expect(result.notes).toContain("ANTHROPIC_API_KEY");

    if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  });
});
