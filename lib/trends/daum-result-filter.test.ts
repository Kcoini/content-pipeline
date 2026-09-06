import { describe, expect, it } from "vitest";
import { filterUsableDaumResults } from "./daum-result-filter";
import type { InsertTrendCandidateInput } from "@/lib/repositories/trend-repository";

function makeInput(overrides: Partial<InsertTrendCandidateInput> = {}): InsertTrendCandidateInput {
  return {
    platform: "daum",
    keyword: "AI",
    title: "제목",
    snippet: "요약",
    url: "https://news.daum.net/1",
    rankPosition: 1,
    collectedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("filterUsableDaumResults", () => {
  it("url/title이 모두 있으면 유지한다", () => {
    const { kept, filteredOutCount } = filterUsableDaumResults([makeInput()]);
    expect(kept).toHaveLength(1);
    expect(filteredOutCount).toBe(0);
  });

  it("publisher(발행처) 필드가 없어도 전부 제외되지 않는다 — publisher를 필수로 요구하지 않는다", () => {
    // InsertTrendCandidateInput에는 애초에 publisher 필드가 없다(Daum 웹 검색 결과 특성) —
    // 이 필드가 없다는 이유로 걸러지지 않는지 확인한다.
    const { kept } = filterUsableDaumResults([makeInput(), makeInput({ url: "https://news.daum.net/2" })]);
    expect(kept).toHaveLength(2);
  });

  it("snippet이 짧거나 없어도 title/url이 있으면 유지한다", () => {
    const { kept } = filterUsableDaumResults([makeInput({ snippet: "" })]);
    expect(kept).toHaveLength(1);
  });

  it("url이 없으면 제외하고 사유를 기록한다", () => {
    const { kept, filteredOutCount, skippedReasonsSummary } = filterUsableDaumResults([makeInput({ url: "" })]);
    expect(kept).toHaveLength(0);
    expect(filteredOutCount).toBe(1);
    expect(skippedReasonsSummary.missing_url).toBe(1);
  });

  it("url과 title이 모두 없으면 제외하고 사유를 기록한다", () => {
    const { kept, skippedReasonsSummary } = filterUsableDaumResults([makeInput({ url: "", title: "" })]);
    expect(kept).toHaveLength(0);
    expect(skippedReasonsSummary.missing_url_and_title).toBe(1);
  });

  it("빈 배열이면 빈 결과를 반환한다", () => {
    const result = filterUsableDaumResults([]);
    expect(result.kept).toEqual([]);
    expect(result.filteredOutCount).toBe(0);
    expect(result.skippedReasonsSummary).toEqual({});
  });
});
