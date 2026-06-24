import { describe, expect, it } from "vitest";
import { clusterTrendItems, candidateToThemeCluster } from "./theme-clusterer";
import { getMockTrendItems } from "./mock-trend-provider";

describe("clusterTrendItems", () => {
  it("mock 트렌드 아이템에서 클러스터를 생성한다", () => {
    const items = getMockTrendItems();
    const clusters = clusterTrendItems(items);

    expect(clusters.length).toBeGreaterThan(0);
  });

  it("score 내림차순으로 정렬된다", () => {
    const items = getMockTrendItems();
    const clusters = clusterTrendItems(items);

    for (let i = 1; i < clusters.length; i++) {
      expect(clusters[i - 1].score).toBeGreaterThanOrEqual(clusters[i].score);
    }
  });

  it("양쪽 플랫폼에 등장하면 crossBonus(3)가 부여된다", () => {
    const items = getMockTrendItems();
    const clusters = clusterTrendItems(items);

    const crossPlatform = clusters.filter(
      (c) => c.naverCount > 0 && c.daumCount > 0
    );
    crossPlatform.forEach((c) => {
      expect(c.score).toBe(c.naverCount + c.daumCount + 3);
    });
  });

  it("한 플랫폼에만 있으면 crossBonus가 없다", () => {
    const naverOnly = [
      {
        platform: "naver" as const,
        keyword: "AI 에이전트",
        title: "AI 에이전트",
        snippet: "AI",
        url: "",
        rankPosition: 1,
      },
    ];
    const clusters = clusterTrendItems(naverOnly);
    const aiCluster = clusters.find((c) => c.group.id === "ai");
    if (aiCluster) {
      expect(aiCluster.daumCount).toBe(0);
      expect(aiCluster.score).toBe(aiCluster.naverCount);
    }
  });

  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(clusterTrendItems([])).toEqual([]);
  });

  it("AI, 반도체, 전기차 그룹이 mock 데이터에서 감지된다", () => {
    const items = getMockTrendItems();
    const clusters = clusterTrendItems(items);
    const groupIds = clusters.map((c) => c.group.id);

    expect(groupIds).toContain("ai");
    expect(groupIds).toContain("semiconductor");
    expect(groupIds).toContain("ev");
  });
});

describe("candidateToThemeCluster", () => {
  it("ThemeCluster 형태로 변환된다", () => {
    const items = getMockTrendItems();
    const [first] = clusterTrendItems(items);
    const now = "2026-06-24T00:00:00.000Z";

    const cluster = candidateToThemeCluster(first, now);

    expect(cluster.title).toBe(first.group.title);
    expect(cluster.description).toBe(first.group.description);
    expect(cluster.keywords.length).toBeGreaterThan(0);
    expect(cluster.keywords.length).toBeLessThanOrEqual(5);
    expect(cluster.naverCount).toBe(first.naverCount);
    expect(cluster.daumCount).toBe(first.daumCount);
    expect(cluster.score).toBe(first.score);
    expect(cluster.status).toBe("candidate");
    expect(cluster.createdAt).toBe(now);
  });
});
