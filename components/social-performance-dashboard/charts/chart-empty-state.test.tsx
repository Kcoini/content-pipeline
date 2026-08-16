import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChartEmptyState } from "./chart-empty-state";

describe("ChartEmptyState", () => {
  it("전달받은 메시지를 그대로 렌더링한다", () => {
    const html = renderToStaticMarkup(<ChartEmptyState message="아직 metrics가 입력되지 않았습니다." />);
    expect(html).toContain("아직 metrics가 입력되지 않았습니다.");
  });
});
