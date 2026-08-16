import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RewriteComparisonChart } from "./rewrite-comparison-chart";

describe("RewriteComparisonChart", () => {
  it("모든 count가 0이면 empty state(성과 비교 안내)를 렌더링한다", () => {
    const html = renderToStaticMarkup(
      <RewriteComparisonChart data={{ rewriteWonCount: 0, originalWonCount: 0, similarCount: 0, needsMoreDataCount: 0 }} />
    );
    expect(html).toContain("rewrite comparison 데이터가 없습니다");
  });

  it("분포와 총 개수, A/B 테스트가 아니라는 안내를 렌더링한다", () => {
    const html = renderToStaticMarkup(
      <RewriteComparisonChart data={{ rewriteWonCount: 3, originalWonCount: 1, similarCount: 2, needsMoreDataCount: 1 }} />
    );
    expect(html).toContain("rewrite 승리");
    expect(html).toContain("총 7건");
    expect(html).toContain("A/B 테스트가 아니므로");
  });
});
