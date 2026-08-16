import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MetricsMissingChart } from "./metrics-missing-chart";

describe("MetricsMissingChart", () => {
  it("측정/미입력이 모두 0이면 empty state를 렌더링한다", () => {
    const html = renderToStaticMarkup(<MetricsMissingChart data={{ measured: 0, missing: 0 }} />);
    expect(html).toContain("아직 metrics가 입력되지 않았습니다");
  });

  it("측정/미입력 비율을 렌더링한다", () => {
    const html = renderToStaticMarkup(<MetricsMissingChart data={{ measured: 3, missing: 1 }} />);
    expect(html).toContain("측정됨");
    expect(html).toContain("미입력");
    expect(html).toContain("75.0%");
  });
});
