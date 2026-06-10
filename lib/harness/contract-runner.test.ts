import { describe, expect, it } from "vitest";
import { runContractForCollection } from "./contract-runner";
import { loadContract } from "./load-contract";

const sourceContract = loadContract("source.contract.yaml");

function makeSource(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: "s1",
    url: "https://example.com/a",
    title: "Example A",
    ...overrides,
  };
}

describe("source.contract.yaml", () => {
  it("출처가 3개 미만이면 계약 검사에 실패한다 (min-source-count)", () => {
    const sources = [
      makeSource({ id: "1", url: "https://a.com" }),
      makeSource({ id: "2", url: "https://b.com" }),
    ];

    const result = runContractForCollection(sourceContract, sources, {
      collections: { topic_sources: sources },
    });

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.ruleId === "min-source-count")).toBe(true);
  });

  it("URL이 없는 출처가 있으면 계약 검사에 실패한다 (required-fields)", () => {
    const sources = [
      makeSource({ id: "1", url: "https://a.com" }),
      makeSource({ id: "2", url: "" }),
      makeSource({ id: "3", url: "https://c.com" }),
    ];

    const result = runContractForCollection(sourceContract, sources, {
      collections: { topic_sources: sources },
    });

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.ruleId === "required-fields")).toBe(true);
  });

  it("동일한 URL이 중복 등록되면 계약 검사에 실패한다 (unique-url-per-topic)", () => {
    const sources = [
      makeSource({ id: "1", url: "https://a.com" }),
      makeSource({ id: "2", url: "https://a.com" }),
      makeSource({ id: "3", url: "https://c.com" }),
    ];

    const result = runContractForCollection(sourceContract, sources, {
      collections: { topic_sources: sources },
    });

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.ruleId === "unique-url-per-topic")).toBe(true);
  });

  it("출처가 3개 이상이고 모두 유효하면 계약 검사를 통과한다", () => {
    const sources = [
      makeSource({ id: "1", url: "https://a.com" }),
      makeSource({ id: "2", url: "https://b.com" }),
      makeSource({ id: "3", url: "https://c.com" }),
    ];

    const result = runContractForCollection(sourceContract, sources, {
      collections: { topic_sources: sources },
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
