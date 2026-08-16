import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("article ab-tests page (정적 소스 검사, Phase 3-20)", () => {
  it("ArticleWorkflowNavigation을 active=ab-tests로 사용한다", () => {
    expect(pageSource).toContain('active="ab-tests"');
  });

  it("A/B test draft 생성 폼과 원본 vs rewrite 생성 폼을 모두 렌더링한다", () => {
    expect(pageSource).toContain("CreateAbTestForm");
    expect(pageSource).toContain("OriginalVsRewriteTestForm");
  });

  it("A/B test 목록(AbTestList)을 렌더링한다", () => {
    expect(pageSource).toContain("AbTestList");
  });

  it("자동 게시 관련 문구가 없다 (자동 게시 버튼을 만들지 않는다)", () => {
    expect(pageSource).not.toContain("자동 게시");
  });

  it("수동 metrics 기반이라는 안내를 표시한다", () => {
    expect(pageSource).toContain("수동 입력된 metrics");
  });

  it("abTestId deep link 강조를 위한 DeepLinkNotice를 사용한다", () => {
    expect(pageSource).toContain("DeepLinkNotice");
  });
});
