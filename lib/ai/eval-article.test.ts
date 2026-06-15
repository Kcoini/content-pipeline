import { describe, expect, it } from "vitest";
import { evaluateArticleMock, evaluateArticleWithAi, loadEvalConfig } from "./eval-article";
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
