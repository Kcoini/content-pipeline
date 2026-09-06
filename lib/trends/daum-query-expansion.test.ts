import { describe, expect, it } from "vitest";
import { expandDaumQuery, expandDaumQueries } from "./daum-query-expansion";
import { SEED_QUERIES } from "./seed-queries";

describe("expandDaumQuery", () => {
  it("정의된 seed query는 자기 자신 + 확장어를 반환한다", () => {
    const result = expandDaumQuery("AI");
    expect(result).toContain("AI");
    expect(result.length).toBeGreaterThan(1);
  });

  it("정의되지 않은 seed query는 자기 자신만 반환한다", () => {
    expect(expandDaumQuery("존재하지 않는 키워드")).toEqual(["존재하지 않는 키워드"]);
  });

  it("seed query 하나당 확장어는 최대 2개로 제한된다(자기 자신 포함 최대 3개)", () => {
    for (const seed of SEED_QUERIES) {
      expect(expandDaumQuery(seed).length).toBeLessThanOrEqual(3);
    }
  });
});

describe("expandDaumQueries", () => {
  it("모든 SEED_QUERIES를 확장하고 중복을 제거한다", () => {
    const result = expandDaumQueries(SEED_QUERIES);
    expect(result.length).toBeGreaterThan(SEED_QUERIES.length);
    expect(new Set(result).size).toBe(result.length);
  });

  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(expandDaumQueries([])).toEqual([]);
  });
});
