import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("article ab-tests page (정적 소스 검사, Phase 3-20)", () => {
  it("ArticleWorkflowNavigation을 active=ab-tests로 사용한다", () => {
    expect(pageSource).toContain('active="ab-tests"');
  });

  it("비교 실험 생성 폼과 원본 vs 재작성 글 비교 생성 폼을 모두 렌더링한다", () => {
    expect(pageSource).toContain("CreateAbTestForm");
    expect(pageSource).toContain("OriginalVsRewriteTestForm");
  });

  it("비교 실험 목록(AbTestList)을 렌더링한다", () => {
    expect(pageSource).toContain("AbTestList");
  });

  it("자동 게시 관련 문구가 없다 (자동 게시 버튼을 만들지 않는다)", () => {
    expect(pageSource).not.toContain("자동 게시");
  });

  it("수동으로 입력한 지표 기반이라는 안내를 표시한다", () => {
    expect(pageSource).toContain("수동으로 입력한 조회수/클릭/반응 기반");
  });

  it("abTestId deep link 강조를 위한 DeepLinkNotice를 사용한다", () => {
    expect(pageSource).toContain("DeepLinkNotice");
  });
});

describe("article ab-tests page 사용자 친화적 한국어 용어 (정적 소스 검사, Phase 3-24)", () => {
  it("영어 용어(A/B Test/Variant/Winner)가 한국어로 바뀐다", () => {
    expect(pageSource).not.toContain("A/B test draft 관리 페이지입니다");
    expect(pageSource).not.toContain("A/B test draft 생성");
    expect(pageSource).not.toContain("원본 vs Rewrite test 생성");
    expect(pageSource).not.toContain("A/B test 목록 (");
    expect(pageSource).toContain("글 반응 비교 관리 페이지입니다");
    expect(pageSource).toContain("비교 실험 만들기");
    expect(pageSource).toContain("비교 실험 목록 (");
  });

  it("이 화면이 무엇을 하는 곳인지 설명하는 안내 문구를 포함한다", () => {
    expect(pageSource).toContain("같은 주제의 글을 서로 비교해 어떤 문체와 플랫폼이 더 반응이 좋은지");
  });
});
