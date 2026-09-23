import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { PRICING_TABLE, lookupModelPrice, calculateRequestCost, type ModelPricingEntry } from "./model-pricing";

const TEST_ENTRY_V1: ModelPricingEntry = {
  provider: "anthropic",
  modelId: "test-model",
  inputPricePerMillionTokens: 3,
  outputPricePerMillionTokens: 15,
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  sourceNote: "test fixture v1",
};
const TEST_ENTRY_V2: ModelPricingEntry = {
  provider: "anthropic",
  modelId: "test-model",
  inputPricePerMillionTokens: 4,
  outputPricePerMillionTokens: 20,
  effectiveFrom: "2026-06-01T00:00:00.000Z",
  sourceNote: "test fixture v2 (price increase)",
};

describe("model-pricing", () => {
  const originalTable = [...PRICING_TABLE];

  beforeEach(() => {
    PRICING_TABLE.length = 0;
  });
  afterEach(() => {
    PRICING_TABLE.length = 0;
    PRICING_TABLE.push(...originalTable);
  });

  it("PRICING_TABLE의 기본값은 비어 있다(근거 없는 가격을 미리 채워 넣지 않는다)", () => {
    expect(originalTable).toEqual([]);
  });

  it("known model은 가격 entry를 반환한다", () => {
    PRICING_TABLE.push(TEST_ENTRY_V1);
    const result = lookupModelPrice("test-model", "2026-03-01T00:00:00.000Z");
    expect("entry" in result).toBe(true);
    if ("entry" in result) expect(result.entry.inputPricePerMillionTokens).toBe(3);
  });

  it("unknown model은 절대 0이 아니라 costUnavailable을 반환한다", () => {
    const result = lookupModelPrice("never-seen-model", "2026-03-01T00:00:00.000Z");
    expect("costUnavailable" in result).toBe(true);
    if ("costUnavailable" in result) expect(result.reason).toContain("never-seen-model");
  });

  it("model이 없으면(undefined) costUnavailable을 반환한다", () => {
    const result = lookupModelPrice(undefined, "2026-03-01T00:00:00.000Z");
    expect("costUnavailable" in result).toBe(true);
  });

  it("effectiveFrom이 여러 개면 사용 시점에 적용 가능한 가장 최근 entry를 고른다", () => {
    PRICING_TABLE.push(TEST_ENTRY_V1, TEST_ENTRY_V2);

    const beforeV2 = lookupModelPrice("test-model", "2026-03-01T00:00:00.000Z");
    expect("entry" in beforeV2 && beforeV2.entry.sourceNote).toBe("test fixture v1");

    const afterV2 = lookupModelPrice("test-model", "2026-07-01T00:00:00.000Z");
    expect("entry" in afterV2 && afterV2.entry.sourceNote).toBe("test fixture v2 (price increase)");
  });

  it("사용 시점이 모든 effectiveFrom보다 이르면 costUnavailable이다(그 시점엔 가격이 없었으므로)", () => {
    PRICING_TABLE.push(TEST_ENTRY_V1);
    const result = lookupModelPrice("test-model", "2025-01-01T00:00:00.000Z");
    expect("costUnavailable" in result).toBe(true);
  });

  it("calculateRequestCost: token usage가 없으면 costUnavailable(0으로 계산하지 않음)", () => {
    PRICING_TABLE.push(TEST_ENTRY_V1);
    const result = calculateRequestCost("test-model", undefined, undefined, "2026-03-01T00:00:00.000Z");
    expect("costUnavailable" in result).toBe(true);
  });

  it("calculateRequestCost: input/output token과 가격으로 정확히 계산한다", () => {
    PRICING_TABLE.push(TEST_ENTRY_V1);
    const result = calculateRequestCost("test-model", 1_000_000, 1_000_000, "2026-03-01T00:00:00.000Z");
    expect("usd" in result && result.usd).toBe(18); // 3(input) + 15(output)
  });
});
