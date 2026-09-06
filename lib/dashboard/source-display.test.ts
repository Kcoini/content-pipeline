import { describe, expect, it } from "vitest";
import { extractDomain, summarizeSourceStatus, resolveNextActionState } from "./source-display";

describe("extractDomain", () => {
  it("URL에서 도메인만 추출한다", () => {
    expect(extractDomain("https://www.example.com/article/123?query=1")).toBe("example.com");
  });

  it("www. 접두사를 제거한다", () => {
    expect(extractDomain("https://www.naver.com")).toBe("naver.com");
  });

  it("URL이 없으면 안내 문구를 반환한다", () => {
    expect(extractDomain(null)).toBe("(URL 없음)");
    expect(extractDomain("")).toBe("(URL 없음)");
  });

  it("파싱할 수 없는 문자열이면 원본을 그대로 반환한다", () => {
    expect(extractDomain("not-a-valid-url")).toBe("not-a-valid-url");
  });
});

describe("summarizeSourceStatus", () => {
  it("등록 개수/조건 충족 여부/수집·요약 현황을 계산한다", () => {
    const sources = [
      { fetchStatus: "success", summaryStatus: "success" },
      { fetchStatus: "success", summaryStatus: "failed" },
      { fetchStatus: "failed", summaryStatus: "skipped" },
    ];

    const summary = summarizeSourceStatus(sources, 3);

    expect(summary).toEqual({
      total: 3,
      minRequired: 3,
      isReady: true,
      fetchSuccessCount: 2,
      summarySuccessCount: 1,
      fetchFailedCount: 1,
      summaryFailedCount: 1,
    });
  });

  it("등록된 출처가 최소 개수 미만이면 isReady가 false다", () => {
    const summary = summarizeSourceStatus([{ fetchStatus: "success", summaryStatus: "success" }], 3);
    expect(summary.isReady).toBe(false);
  });

  it("출처가 없으면 모든 카운트가 0이다", () => {
    const summary = summarizeSourceStatus([], 3);
    expect(summary.total).toBe(0);
    expect(summary.isReady).toBe(false);
  });
});

describe("resolveNextActionState", () => {
  it("기사가 이미 있으면 article_exists를 반환한다(출처 부족 여부와 무관)", () => {
    expect(resolveNextActionState(0, 3, true)).toBe("article_exists");
    expect(resolveNextActionState(5, 3, true)).toBe("article_exists");
  });

  it("기사가 없고 출처가 최소 개수 이상이면 ready_to_generate를 반환한다", () => {
    expect(resolveNextActionState(3, 3, false)).toBe("ready_to_generate");
    expect(resolveNextActionState(5, 3, false)).toBe("ready_to_generate");
  });

  it("기사가 없고 출처가 최소 개수 미만이면 needs_source를 반환한다", () => {
    expect(resolveNextActionState(0, 3, false)).toBe("needs_source");
    expect(resolveNextActionState(2, 3, false)).toBe("needs_source");
  });
});
