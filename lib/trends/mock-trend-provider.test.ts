import { describe, expect, it } from "vitest";
import { getMockTrendItems, rawItemToCandidate } from "./mock-trend-provider";

describe("getMockTrendItems", () => {
  it("네이버 10건 + 다음 10건, 총 20건을 반환한다", () => {
    const items = getMockTrendItems();
    expect(items).toHaveLength(20);
  });

  it("각 아이템에 platform, keyword, title, snippet이 있다", () => {
    const items = getMockTrendItems();
    items.forEach((item) => {
      expect(item.platform).toMatch(/^(naver|daum|mock)$/);
      expect(item.keyword).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.snippet).toBeTruthy();
    });
  });

  it("naver 아이템이 10건이다", () => {
    const items = getMockTrendItems();
    expect(items.filter((i) => i.platform === "naver")).toHaveLength(10);
  });

  it("daum 아이템이 10건이다", () => {
    const items = getMockTrendItems();
    expect(items.filter((i) => i.platform === "daum")).toHaveLength(10);
  });
});

describe("rawItemToCandidate", () => {
  it("TrendCandidate 형태로 변환된다", () => {
    const [item] = getMockTrendItems();
    const now = "2026-06-24T00:00:00.000Z";
    const candidate = rawItemToCandidate(item, now);

    expect(candidate.id).toBeTruthy();
    expect(candidate.platform).toBe(item.platform);
    expect(candidate.keyword).toBe(item.keyword);
    expect(candidate.title).toBe(item.title);
    expect(candidate.snippet).toBe(item.snippet);
    expect(candidate.url).toBe(item.url);
    expect(candidate.rankPosition).toBe(item.rankPosition);
    expect(candidate.collectedAt).toBe(now);
  });
});
