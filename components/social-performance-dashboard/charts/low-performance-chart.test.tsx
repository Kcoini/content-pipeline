import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LowPerformanceChart } from "./low-performance-chart";

describe("LowPerformanceChart", () => {
  it("모든 값이 0이면 empty state를 렌더링한다", () => {
    const html = renderToStaticMarkup(
      <LowPerformanceChart data={{ low: 0, needsReview: 0, notMeasured: 0, average: 0, good: 0, excellent: 0 }} />
    );
    expect(html).toContain("아직 metrics가 입력되지 않았습니다");
  });

  it("performance_status 분포를 렌더링한다", () => {
    const html = renderToStaticMarkup(
      <LowPerformanceChart data={{ low: 2, needsReview: 1, notMeasured: 3, average: 4, good: 5, excellent: 1 }} />
    );
    expect(html).toContain("excellent");
    expect(html).toContain("needs_review");
    expect(html).toContain("총 16개");
  });
});
