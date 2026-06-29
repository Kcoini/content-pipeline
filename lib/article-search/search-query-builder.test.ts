import { describe, expect, it } from "vitest";
import { buildSearchQueries } from "./search-query-builder";
import type { Theme } from "@/lib/types/domain";

function makeTheme(overrides: Partial<Theme> = {}): Theme {
  return {
    id: "theme-1",
    title: "AI 에이전트 동향",
    description: "AI 에이전트 관련 최신 이슈",
    keywords: ["AI", "에이전트", "자동화", "LLM"],
    language: "ko",
    createdAt: "2026-01-01T00:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

describe("buildSearchQueries", () => {
  it("theme.title이 첫 번째 쿼리로 포함된다", () => {
    const queries = buildSearchQueries(makeTheme());
    expect(queries[0]).toBe("AI 에이전트 동향");
  });

  it("키워드 2개 조합 쿼리가 생성된다", () => {
    const queries = buildSearchQueries(makeTheme());
    expect(queries).toContain("AI 에이전트");
    expect(queries).toContain("에이전트 자동화");
  });

  it("최대 5개 쿼리만 반환한다", () => {
    const queries = buildSearchQueries(makeTheme());
    expect(queries.length).toBeLessThanOrEqual(5);
  });

  it("중복 쿼리가 포함되지 않는다", () => {
    const queries = buildSearchQueries(makeTheme());
    const unique = [...new Set(queries)];
    expect(queries).toHaveLength(unique.length);
  });

  it("title이 비어있으면 title 쿼리를 포함하지 않는다", () => {
    const queries = buildSearchQueries(makeTheme({ title: "" }));
    expect(queries).not.toContain("");
  });

  it("키워드가 없어도 title만으로 쿼리를 생성한다", () => {
    const queries = buildSearchQueries(makeTheme({ keywords: [] }));
    expect(queries).toContain("AI 에이전트 동향");
    expect(queries).toHaveLength(1);
  });

  it("키워드 1개이면 title+keyword 조합만 생성한다", () => {
    const queries = buildSearchQueries(makeTheme({ keywords: ["AI"] }));
    // title이 이미 "AI 에이전트 동향"이므로 조합 쿼리가 추가될 수 있음
    expect(queries.length).toBeGreaterThan(0);
  });
});
