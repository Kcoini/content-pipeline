import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("article rewrite page (정적 소스 검사, Phase 3-17)", () => {
  it("rewriteSuggestionId/rewriteVersionId/comparisonId/section/returnTo searchParam을 읽는다", () => {
    expect(pageSource).toContain("rewriteSuggestionId?: string");
    expect(pageSource).toContain("rewriteVersionId?: string");
    expect(pageSource).toContain("comparisonId?: string");
    expect(pageSource).toContain("section?: string");
    expect(pageSource).toContain("returnTo?: string");
  });

  it("suggestion/version 카드 모두 강조 표시(getHighlightClassName)를 사용한다", () => {
    expect(pageSource).toContain("getHighlightClassName");
  });

  it("찾을 수 없는 target에 대한 안내(DeepLinkNotice)를 두 종류(suggestion/version) 모두에 사용한다", () => {
    const matches = pageSource.match(/DeepLinkNotice/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("각 action form에 returnTo hidden input을 포함한다", () => {
    expect(pageSource).toContain('name="returnTo"');
  });

  it("ArticleWorkflowNavigation에 returnTo를 전달한다", () => {
    expect(pageSource).toMatch(/ArticleWorkflowNavigation[^>]*returnTo=\{returnTo\}/);
  });
});
