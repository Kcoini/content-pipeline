import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { aggregateAiUsage, aggregateAiUsageByArticle, type AiUsageRecord } from "./ai-cost-aggregator";
import { PRICING_TABLE, type ModelPricingEntry } from "./model-pricing";

const KNOWN_MODEL: ModelPricingEntry = {
  provider: "anthropic",
  modelId: "known-model",
  inputPricePerMillionTokens: 2,
  outputPricePerMillionTokens: 10,
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  sourceNote: "test fixture",
};

describe("aggregateAiUsage", () => {
  const originalTable = [...PRICING_TABLE];

  beforeEach(() => {
    PRICING_TABLE.length = 0;
    PRICING_TABLE.push(KNOWN_MODEL);
  });
  afterEach(() => {
    PRICING_TABLE.length = 0;
    PRICING_TABLE.push(...originalTable);
  });

  it("여러 요청의 token/request count를 합산한다", () => {
    const records: AiUsageRecord[] = [
      { modelId: "known-model", inputTokens: 1000, outputTokens: 500, timestamp: "2026-02-01T00:00:00.000Z" },
      { modelId: "known-model", inputTokens: 2000, outputTokens: 1000, timestamp: "2026-02-02T00:00:00.000Z" },
    ];

    const result = aggregateAiUsage(records);
    expect(result.totalRequests).toBe(2);
    expect(result.totalInputTokens).toBe(3000);
    expect(result.totalOutputTokens).toBe(1500);
  });

  it("가격을 알 수 없는 요청(unknown model)은 0원으로 합쳐지지 않고 requestsWithUnknownCost로 분리된다", () => {
    const records: AiUsageRecord[] = [
      { modelId: "known-model", inputTokens: 1_000_000, outputTokens: 1_000_000, timestamp: "2026-02-01T00:00:00.000Z" },
      { modelId: "unknown-model", inputTokens: 1_000_000, outputTokens: 1_000_000, timestamp: "2026-02-01T00:00:00.000Z" },
    ];

    const result = aggregateAiUsage(records);
    expect(result.requestsWithKnownCost).toBe(1);
    expect(result.requestsWithUnknownCost).toBe(1);
    expect(result.knownCostUsd).toBe(12); // 2 + 10 (known-model 1건만)
  });

  it("token 메타데이터가 누락된 요청도 unknown cost로 분리된다(0원 아님)", () => {
    const records: AiUsageRecord[] = [
      { modelId: "known-model", inputTokens: undefined, outputTokens: undefined, timestamp: "2026-02-01T00:00:00.000Z" },
    ];

    const result = aggregateAiUsage(records);
    expect(result.requestsWithUnknownCost).toBe(1);
    expect(result.knownCostUsd).toBe(0);
    expect(result.totalInputTokens).toBe(0);
  });

  it("빈 목록은 전부 0이다(에러 아님)", () => {
    const result = aggregateAiUsage([]);
    expect(result.totalRequests).toBe(0);
    expect(result.knownCostUsd).toBe(0);
    expect(result.requestsWithUnknownCost).toBe(0);
  });
});

describe("aggregateAiUsageByArticle", () => {
  it("articleId별로 나눠 집계한다", () => {
    const records: AiUsageRecord[] = [
      { modelId: "known-model", inputTokens: 100, outputTokens: 50, timestamp: "2026-02-01T00:00:00.000Z", articleId: "article-1" },
      { modelId: "known-model", inputTokens: 200, outputTokens: 100, timestamp: "2026-02-01T00:00:00.000Z", articleId: "article-1" },
      { modelId: "known-model", inputTokens: 300, outputTokens: 150, timestamp: "2026-02-01T00:00:00.000Z", articleId: "article-2" },
    ];

    const result = aggregateAiUsageByArticle(records);
    expect(result["article-1"].totalRequests).toBe(2);
    expect(result["article-1"].totalInputTokens).toBe(300);
    expect(result["article-2"].totalRequests).toBe(1);
  });

  it("articleId가 없는 레코드는 (no-article) 키로 묶인다", () => {
    const records: AiUsageRecord[] = [{ modelId: "known-model", inputTokens: 100, outputTokens: 50, timestamp: "2026-02-01T00:00:00.000Z" }];
    const result = aggregateAiUsageByArticle(records);
    expect(result["(no-article)"].totalRequests).toBe(1);
  });
});
