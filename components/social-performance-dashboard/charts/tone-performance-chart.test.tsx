import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TonePerformanceChart } from "./tone-performance-chart";

describe("TonePerformanceChart", () => {
  it("데이터가 없으면 empty state를 렌더링한다", () => {
    const html = renderToStaticMarkup(<TonePerformanceChart data={[]} />);
    expect(html).toContain("아직 metrics가 입력되지 않았습니다");
  });

  it("tone_style별 bar와 평균 점수를 렌더링한다", () => {
    const html = renderToStaticMarkup(
      <TonePerformanceChart
        data={[{ toneStyle: "informational", averagePerformanceScore: 55.5, totalViews: 10, totalClicks: 1, measuredCount: 4 }]}
      />
    );
    expect(html).toContain("informational");
    expect(html).toContain("55.5");
    expect(html).toContain("measured 4");
  });
});
