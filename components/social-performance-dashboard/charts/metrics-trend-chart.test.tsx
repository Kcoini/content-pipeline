import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MetricsTrendChart } from "./metrics-trend-chart";

describe("MetricsTrendChart", () => {
  it("포인트가 없으면 empty state를 렌더링한다", () => {
    const html = renderToStaticMarkup(<MetricsTrendChart data={{ granularity: "month", points: [] }} />);
    expect(html).toContain("아직 metrics가 입력되지 않았습니다");
  });

  it("월별 추세를 표 형태로 렌더링한다", () => {
    const html = renderToStaticMarkup(
      <MetricsTrendChart
        data={{
          granularity: "month",
          points: [{ period: "2026-01", views: 100, impressions: 200, likes: 10, comments: 2, shares: 1, clicks: 5, averagePerformanceScore: 61.2 }],
        }}
      />
    );
    expect(html).toContain("2026년 1월");
    expect(html).toContain("61.2");
    expect(html).toContain("실시간 분석이 아닙니다");
  });
});
