import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("article performance page (정적 소스 검사, Phase 3-17)", () => {
  it("metricsTargetId/socialPostId/comparisonId/section/returnTo searchParam을 읽는다", () => {
    expect(pageSource).toContain("metricsTargetId?: string");
    expect(pageSource).toContain("socialPostId?: string");
    expect(pageSource).toContain("comparisonId?: string");
    expect(pageSource).toContain("section?: string");
    expect(pageSource).toContain("returnTo?: string");
  });

  it("찾을 수 없는 target에 대한 안내(DeepLinkNotice)를 사용한다", () => {
    expect(pageSource).toContain("DeepLinkNotice");
  });

  it("성과 비교 실행 폼에 returnTo hidden input을 포함한다", () => {
    expect(pageSource).toContain('name="returnTo"');
  });

  it("ArticleWorkflowNavigation에 returnTo를 전달한다", () => {
    expect(pageSource).toMatch(/ArticleWorkflowNavigation[^>]*returnTo=\{returnTo\}/);
  });
});

describe("article performance page pagination (정적 소스 검사, Phase 3-18)", () => {
  it("page/perPage searchParam을 읽고 parsePagination을 사용한다", () => {
    expect(pageSource).toContain("page?: string");
    expect(pageSource).toContain("perPage?: string");
    expect(pageSource).toContain("parsePagination(");
  });

  it("recentMetrics에 PaginationControls를 렌더링한다", () => {
    expect(pageSource).toContain("PaginationControls");
    expect(pageSource).toContain("recentMetricsPagination");
  });

  it("target social post가 현재 page에 없으면 이동 링크를 보여준다", () => {
    expect(pageSource).toContain("postTargetOnDifferentPage");
    expect(pageSource).toContain("metricsTargetPage");
  });
});
