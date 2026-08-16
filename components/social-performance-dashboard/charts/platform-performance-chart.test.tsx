import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformPerformanceChart } from "./platform-performance-chart";

describe("PlatformPerformanceChart", () => {
  it("데이터가 없으면 empty state를 렌더링한다", () => {
    const html = renderToStaticMarkup(<PlatformPerformanceChart data={[]} />);
    expect(html).toContain("아직 metrics가 입력되지 않았습니다");
  });

  it("platform별 bar와 평균 점수를 렌더링한다", () => {
    const html = renderToStaticMarkup(
      <PlatformPerformanceChart
        data={[
          { platform: "wordpress_blog", averagePerformanceScore: 72.3, totalViews: 100, totalClicks: 10, totalEngagement: 20, measuredCount: 3 },
          { platform: "x", averagePerformanceScore: 40, totalViews: 50, totalClicks: 5, totalEngagement: 8, measuredCount: 2 },
        ]}
      />
    );
    expect(html).toContain("WordPress");
    expect(html).toContain("72.3");
    expect(html).toContain("measured 3");
  });
});
