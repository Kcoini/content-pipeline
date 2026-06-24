import { describe, expect, it } from "vitest";
import { generateAiArticleDraft, generateMockArticleDraft } from "./article-writer";
import { runContractForCollection } from "@/lib/harness/contract-runner";
import { loadContract } from "@/lib/harness/load-contract";
import type { Source, Theme } from "@/lib/types/domain";

const theme: Theme = {
  id: "theme-1",
  title: "AI 에이전트 동향",
  description: "2026년 AI 에이전트 관련 최신 동향을 정리한다.",
  keywords: ["AI", "에이전트"],
  language: "ko",
  createdAt: new Date().toISOString(),
};

const baseSourceFields = {
  fetchStatus: "pending" as const,
  fetchError: null,
  rawContent: null,
  summaryStatus: "pending" as const,
  summaryError: null,
  summarizedAt: null,
  keyPoints: [],
};

const sources: Source[] = [
  {
    id: "source-1",
    themeId: theme.id,
    url: "https://a.example.com",
    title: "출처 A",
    publisher: "A 매체",
    publishedAt: "2026-01-01",
    summary: "출처 A 요약",
    createdAt: new Date().toISOString(),
    ...baseSourceFields,
  },
  {
    id: "source-2",
    themeId: theme.id,
    url: "https://b.example.com",
    title: "출처 B",
    publisher: "B 매체",
    publishedAt: "2026-02-01",
    summary: "출처 B 요약",
    createdAt: new Date().toISOString(),
    ...baseSourceFields,
  },
  {
    id: "source-3",
    themeId: theme.id,
    url: "https://c.example.com",
    title: "출처 C",
    publisher: "C 매체",
    publishedAt: "2026-03-01",
    summary: "출처 C 요약",
    createdAt: new Date().toISOString(),
    ...baseSourceFields,
  },
];

describe("generateMockArticleDraft", () => {
  it("본문은 500자 이상이고, 등록된 모든 출처를 인용한다", () => {
    const result = generateMockArticleDraft(theme, sources);

    expect(result.content.length).toBeGreaterThanOrEqual(500);
    expect(result.citedSourceIds).toEqual(sources.map((source) => source.id));
  });

  it("status=draft으로 구성된 기사 객체는 article.contract.yaml을 통과한다", () => {
    const generated = generateMockArticleDraft(theme, sources);
    const articleContract = loadContract("article.contract.yaml");

    const articleItem: Record<string, unknown> = {
      title: generated.title,
      content: generated.content,
      topicId: theme.id,
      status: "draft",
    };

    const result = runContractForCollection(articleContract, [articleItem], {
      collections: {
        article_sources: sources as unknown as Record<string, unknown>[],
      },
      operation: "create",
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("status가 draft가 아니면 article.contract.yaml(initial-status-draft)에 위반된다", () => {
    const generated = generateMockArticleDraft(theme, sources);
    const articleContract = loadContract("article.contract.yaml");

    const articleItem: Record<string, unknown> = {
      title: generated.title,
      content: generated.content,
      topicId: theme.id,
      status: "reviewed",
    };

    const result = runContractForCollection(articleContract, [articleItem], {
      collections: {
        article_sources: sources as unknown as Record<string, unknown>[],
      },
      operation: "create",
    });

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.ruleId === "initial-status-draft")).toBe(true);
  });

  it("출처가 3개 미만이면 source.contract.yaml(min-source-count)을 통과하지 못해 기사 생성이 막힌다", () => {
    const fewSources = sources.slice(0, 2);
    const sourceContract = loadContract("source.contract.yaml");

    const result = runContractForCollection(
      sourceContract,
      fewSources as unknown as Record<string, unknown>[],
      { collections: { topic_sources: fewSources as unknown as Record<string, unknown>[] } }
    );

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.ruleId === "min-source-count")).toBe(true);
  });
});

describe("generateAiArticleDraft", () => {
  it("ANTHROPIC_API_KEY가 없으면 명확한 오류를 던진다", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    await expect(generateAiArticleDraft(theme, [])).rejects.toThrow(/ANTHROPIC_API_KEY/);

    if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  });
});
