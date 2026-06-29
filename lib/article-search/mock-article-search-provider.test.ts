import { describe, expect, it } from "vitest";
import { generateMockArticleCandidates } from "./mock-article-search-provider";

const BASE_INPUT = {
  themeId: "theme-abc",
  themeTitle: "AI 에이전트 동향",
  keywords: ["AI", "에이전트"],
  query: "AI 에이전트",
  platform: "naver" as const,
  count: 5,
  baseRank: 0,
};

describe("generateMockArticleCandidates", () => {
  it("요청한 count만큼 후보를 반환한다", () => {
    const results = generateMockArticleCandidates(BASE_INPUT, "2026-06-27T00:00:00.000Z");
    expect(results).toHaveLength(5);
  });

  it("각 후보에 필수 필드가 있다", () => {
    const results = generateMockArticleCandidates(BASE_INPUT, "2026-06-27T00:00:00.000Z");
    results.forEach((c) => {
      expect(c.themeId).toBe("theme-abc");
      expect(c.platform).toBe("naver");
      expect(c.url).toBeTruthy();
      expect(c.title).toBeTruthy();
      expect(c.status).toBe("candidate");
    });
  });

  it("각 후보의 URL이 서로 다르다", () => {
    const results = generateMockArticleCandidates(BASE_INPUT, "2026-06-27T00:00:00.000Z");
    const urls = results.map((c) => c.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("theme title이나 keyword가 제목/snippet에 반영된다", () => {
    const results = generateMockArticleCandidates(BASE_INPUT, "2026-06-27T00:00:00.000Z");
    const titleMatches = results.filter(
      (c) => c.title?.includes("AI") || c.title?.includes("에이전트") || c.title?.includes("AI 에이전트 동향")
    );
    expect(titleMatches.length).toBeGreaterThan(0);
  });

  it("daum 플랫폼으로도 후보를 생성할 수 있다", () => {
    const results = generateMockArticleCandidates(
      { ...BASE_INPUT, platform: "daum" },
      "2026-06-27T00:00:00.000Z"
    );
    results.forEach((c) => expect(c.platform).toBe("daum"));
  });

  it("rank_position이 baseRank 이후로 증가한다", () => {
    const results = generateMockArticleCandidates(
      { ...BASE_INPUT, baseRank: 10 },
      "2026-06-27T00:00:00.000Z"
    );
    expect(results[0].rankPosition).toBeGreaterThanOrEqual(11);
  });
});
