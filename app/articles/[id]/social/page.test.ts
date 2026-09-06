import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("article social page (정적 소스 검사, Phase 3-17)", () => {
  it("socialPostId/section/returnTo searchParam을 읽는다", () => {
    expect(pageSource).toContain("socialPostId?: string");
    expect(pageSource).toContain("section?: string");
    expect(pageSource).toContain("returnTo?: string");
  });

  it("강조 표시(getHighlightClassName)와 anchor id(buildAnchorId)를 사용한다", () => {
    expect(pageSource).toContain("getHighlightClassName");
    expect(pageSource).toContain("buildAnchorId");
  });

  it("찾을 수 없는 target에 대한 안내(DeepLinkNotice)를 사용한다", () => {
    expect(pageSource).toContain("DeepLinkNotice");
  });

  it("각 action form에 returnTo hidden input을 포함한다", () => {
    expect(pageSource).toContain('name="returnTo"');
  });

  it("ArticleWorkflowNavigation에 returnTo를 전달한다", () => {
    expect(pageSource).toMatch(/ArticleWorkflowNavigation[^>]*returnTo=\{returnTo\}/);
  });
});

describe("article social page pagination (정적 소스 검사, Phase 3-18)", () => {
  it("page/perPage searchParam을 읽고 parsePagination을 사용한다", () => {
    expect(pageSource).toContain("page?: string");
    expect(pageSource).toContain("perPage?: string");
    expect(pageSource).toContain("parsePagination(");
  });

  it("PaginationControls를 렌더링한다", () => {
    expect(pageSource).toContain("PaginationControls");
  });

  it("상세 페이지(buildSocialPostDetailUrl)로 가는 링크를 포함한다", () => {
    expect(pageSource).toContain("buildSocialPostDetailUrl");
  });

  it("SNS/커뮤니티 글 목록의 각 항목에 삭제 버튼(archiveSocialPostAction)과 확인 모달이 있다", () => {
    expect(pageSource).toContain("archiveSocialPostAction");
    expect(pageSource).toContain("이 글을 삭제하시겠습니까?");
    expect(pageSource).toContain("ConfirmSubmitButton");
  });
});

describe("naver_cafe 등 본문형 플랫폼 미리보기 (정적 소스 검사, Phase 3-19)", () => {
  it("목록 카드 본문 미리보기는 getSocialPostDisplayBody를 사용한다(caption만 보지 않는다)", () => {
    expect(pageSource).toContain("getSocialPostDisplayBody");
    expect(pageSource).toContain('from "@/lib/social/social-post-display"');
  });

  it("caption만 확인하고 postBody를 무시하는 예전 방식으로 되돌아가지 않는다", () => {
    expect(pageSource).not.toMatch(
      /\(post\.caption \|\| post\.threadItems\.map\(\(t\) => t\.text\)\.join\(" "\) \|\| post\.cardItems/
    );
  });
});
