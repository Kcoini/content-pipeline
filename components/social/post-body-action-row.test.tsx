import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PostBodyActionRow } from "./post-body-action-row";

vi.mock("@/app/articles/[id]/actions", () => ({
  logSocialPostInlineEditClientEventAction: vi.fn().mockResolvedValue(undefined),
}));

const noop = () => {};

describe("PostBodyActionRow", () => {
  it("[본문 복사] [전체 보기] [본문 수정] 순서로 한 줄에 렌더링한다", () => {
    const html = renderToStaticMarkup(
      <PostBodyActionRow
        articleId="a1"
        socialPostId="p1"
        copyText="본문"
        showExpandToggle
        expanded={false}
        onToggleExpand={noop}
        editable
        onEdit={noop}
      />
    );
    const copyIdx = html.indexOf("본문 복사");
    const expandIdx = html.indexOf("전체 보기");
    const editIdx = html.indexOf(">본문 수정<");
    expect(copyIdx).toBeGreaterThan(-1);
    expect(copyIdx).toBeLessThan(expandIdx);
    expect(expandIdx).toBeLessThan(editIdx);
  });

  it("showExpandToggle=false면 [전체 보기]/[본문 접기] 버튼을 렌더링하지 않는다(비활성화가 아니라 미표시)", () => {
    const html = renderToStaticMarkup(
      <PostBodyActionRow
        articleId="a1"
        socialPostId="p1"
        copyText="본문"
        showExpandToggle={false}
        expanded={false}
        onToggleExpand={noop}
        editable
        onEdit={noop}
      />
    );
    expect(html).not.toContain("전체 보기");
    expect(html).not.toContain("본문 접기");
    expect(html).not.toContain("disabled");
  });

  it("expanded=true면 [본문 접기]로 라벨이 바뀐다", () => {
    const html = renderToStaticMarkup(
      <PostBodyActionRow
        articleId="a1"
        socialPostId="p1"
        copyText="본문"
        showExpandToggle
        expanded
        onToggleExpand={noop}
        editable
        onEdit={noop}
      />
    );
    expect(html).toContain("본문 접기");
    expect(html).not.toContain("전체 보기");
  });

  it("editable=false면 [본문 수정] 버튼이 없다", () => {
    const html = renderToStaticMarkup(
      <PostBodyActionRow
        articleId="a1"
        socialPostId="p1"
        copyText="본문"
        showExpandToggle={false}
        expanded={false}
        onToggleExpand={noop}
        editable={false}
        onEdit={noop}
      />
    );
    expect(html).not.toContain("본문 수정");
  });

  it("[본문 복사] 버튼은 항상 렌더링된다(showExpandToggle/editable과 무관)", () => {
    const html = renderToStaticMarkup(
      <PostBodyActionRow
        articleId="a1"
        socialPostId="p1"
        copyText="본문"
        showExpandToggle={false}
        expanded={false}
        onToggleExpand={noop}
        editable={false}
        onEdit={noop}
      />
    );
    expect(html).toContain("본문 복사");
  });

  it("데스크톱 한 줄 + 모바일 자연 줄바꿈을 위해 flex-wrap을 쓴다", () => {
    const html = renderToStaticMarkup(
      <PostBodyActionRow
        articleId="a1"
        socialPostId="p1"
        copyText="본문"
        showExpandToggle
        expanded={false}
        onToggleExpand={noop}
        editable
        onEdit={noop}
      />
    );
    expect(html).toContain("flex-wrap");
  });
});
