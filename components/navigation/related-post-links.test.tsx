import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RelatedPostLinks } from "./related-post-links";

describe("RelatedPostLinks 렌더링", () => {
  it("링크가 없으면 아무것도 렌더링하지 않는다", () => {
    const html = renderToStaticMarkup(<RelatedPostLinks links={[]} />);
    expect(html).toBe("");
  });

  it("기본은 접힘 상태이고, '관련 화면 보기' summary를 보여준다", () => {
    const html = renderToStaticMarkup(
      <RelatedPostLinks links={[{ label: "글 상세 보기", href: "/detail" }]} />
    );
    expect(html).toContain("관련 화면 보기");
    expect(html).not.toContain(" open=");
  });

  it("각 링크 라벨에는 화살표(→)를 붙이지 않는다", () => {
    const html = renderToStaticMarkup(
      <RelatedPostLinks
        links={[
          { label: "글 상세 보기", href: "/detail" },
          { label: "성과 확인", href: "/metrics" },
          { label: "원본 기사 개요", href: "/overview" },
        ]}
      />
    );
    expect(html).toContain("글 상세 보기");
    expect(html).toContain("성과 확인");
    expect(html).toContain("원본 기사 개요");
    expect(html).not.toContain("→");
  });

  it("defaultOpen이 true면 펼쳐진 상태로 렌더링된다", () => {
    const html = renderToStaticMarkup(
      <RelatedPostLinks links={[{ label: "글 상세 보기", href: "/detail" }]} defaultOpen />
    );
    expect(html).toContain("<details");
    expect(html).toMatch(/<details[^>]*open/);
  });
});
