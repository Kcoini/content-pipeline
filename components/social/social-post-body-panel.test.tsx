import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/articles/[id]/actions", () => ({
  logSocialPostInlineEditClientEventAction: vi.fn().mockResolvedValue(undefined),
}));

const { SocialPostBodyPanel } = await import("./social-post-body-panel");
const componentSource = readFileSync(path.join(__dirname, "social-post-body-panel.tsx"), "utf8");

const noopAction = async () => {};

describe("SocialPostBodyPanel 렌더링(기본 상태, 편집 모드 아님)", () => {
  it("게시용 본문 라벨과 본문 텍스트, 본문 복사 버튼을 보여준다", () => {
    const html = renderToStaticMarkup(
      <SocialPostBodyPanel
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        displayBody="짧은 본문입니다."
        editable
        saveAction={noopAction}
      />
    );
    expect(html).toContain("게시용 본문");
    expect(html).toContain("짧은 본문입니다.");
    expect(html).toContain("본문 복사");
  });

  it("editable=true면 [본문 수정] 버튼이 있다", () => {
    const html = renderToStaticMarkup(
      <SocialPostBodyPanel
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        displayBody="본문"
        editable
        saveAction={noopAction}
      />
    );
    expect(html).toContain("본문 수정");
  });

  it("hideBodyWhenNotEditing=true면 본문 텍스트(ExpandableText)를 표시하지 않고 [본문 수정]/[본문 복사]만 보여준다(다른 곳에서 이미 본문을 보여줄 때 중복 표시를 막기 위함)", () => {
    const html = renderToStaticMarkup(
      <SocialPostBodyPanel
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/blog"
        displayBody="중복 표시하면 안 되는 본문입니다."
        editable
        saveAction={noopAction}
        hideBodyWhenNotEditing
      />
    );
    expect(html).not.toContain("중복 표시하면 안 되는 본문입니다.");
    expect(html).toContain("본문 확인");
    expect(html).toContain("본문 수정");
    expect(html).toContain("본문 복사");
  });

  it("editable=false면(x처럼 threadItems 기반) [본문 수정] 버튼이 없다", () => {
    const html = renderToStaticMarkup(
      <SocialPostBodyPanel
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        displayBody="본문"
        editable={false}
        saveAction={noopAction}
      />
    );
    expect(html).not.toContain("본문 수정");
  });
});

describe("SocialPostBodyPanel platform prop(Phase 4-24: 플랫폼별 기본 viewMode)", () => {
  it("platform이 copy 기본 플랫폼(naver_cafe)이면 '복사용 텍스트' 라벨과 글자 수를 보여준다", () => {
    const html = renderToStaticMarkup(
      <SocialPostBodyPanel
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        displayBody="네이버 카페 본문"
        editable
        saveAction={noopAction}
        platform="naver_cafe"
      />
    );
    expect(html).toContain("복사용 텍스트");
    expect(html).toContain(`(${"네이버 카페 본문".length}자)`);
  });

  it("platform이 preview 기본 플랫폼(wordpress_blog)이면 '게시용 미리보기' 라벨을 보여주고 글자 수는 보여주지 않는다", () => {
    const html = renderToStaticMarkup(
      <SocialPostBodyPanel
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/blog"
        displayBody="블로그 본문"
        editable
        saveAction={noopAction}
        platform="wordpress_blog"
      />
    );
    expect(html).toContain("게시용 미리보기");
    expect(html).not.toContain("자)");
  });

  it("platform을 넘기지 않으면 기존과 동일하게 '게시용 본문' 라벨을 그대로 쓴다(하위 호환)", () => {
    const html = renderToStaticMarkup(
      <SocialPostBodyPanel
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        displayBody="본문"
        editable
        saveAction={noopAction}
      />
    );
    expect(html).toContain("게시용 본문");
  });

  it("hideBodyWhenNotEditing이면 platform과 무관하게 '본문 확인' 라벨을 쓴다", () => {
    const html = renderToStaticMarkup(
      <SocialPostBodyPanel
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/blog"
        displayBody="본문"
        editable
        saveAction={noopAction}
        platform="naver_cafe"
        hideBodyWhenNotEditing
      />
    );
    expect(html).toContain("본문 확인");
    expect(html).not.toContain("복사용 텍스트");
  });
});

describe("SocialPostBodyPanel 정적 소스 검사", () => {
  it('"use client" 컴포넌트이며 useState로 편집 모드를 관리한다', () => {
    expect(componentSource).toContain('"use client"');
    expect(componentSource).toContain("useState");
  });

  it("Phase UX-03A: 편집 모드 UI는 공통 InlinePostBodyEditor를 재사용한다(중복 구현 대신)", () => {
    expect(componentSource).toContain('from "./inline-post-body-editor"');
    expect(componentSource).toContain("<InlinePostBodyEditor");
    expect(componentSource).toContain("value={displayBody}");
    expect(componentSource).toContain("title={`${bodyLabel} 수정`}");
    expect(componentSource).toContain("saveAction={saveAction}");
    expect(componentSource).toContain("onCancel={cancelEditor}");
    // 편집 모드 UI 자체(textarea/저장 버튼 3종/취소)의 상세 검사는
    // inline-post-body-editor.test.tsx가 담당한다 — 여기서는 이
    // 컴포넌트가 그 공통 컴포넌트를 실제로 쓰는지만 확인한다.
  });

  it("취소를 누르면 편집 모드가 꺼지고, 열기/취소 이벤트를 로그로 남긴다(사용자 흐름을 막지 않는 fire-and-forget)", () => {
    expect(componentSource).toContain("setEditing(false)");
    expect(componentSource).toContain('event: "opened"');
    expect(componentSource).toContain('event: "cancelled"');
    expect(componentSource).toContain(".catch(() => {})");
  });

  it("ExpandableText/PostBodyActionRow(내부에서 CopyPostBodyButton 재사용)를 재사용한다(새 텍스트/버튼 렌더링 로직을 중복 작성하지 않는다)", () => {
    expect(componentSource).toContain('from "./expandable-text"');
    expect(componentSource).toContain('from "./post-body-action-row"');
  });
});

describe("Phase 4-27: 본문 관련 버튼([본문 복사]/[전체 보기]·[본문 접기]/[본문 수정])을 한 줄로 모은다", () => {
  it("PostBodyActionRow 하나로 세 버튼을 렌더링한다(각자 다른 위치에 흩어놓지 않는다)", () => {
    expect(componentSource).toContain("<PostBodyActionRow");
    expect(componentSource).toContain("showExpandToggle={showExpandToggle}");
    expect(componentSource).toContain("onToggleExpand={() => setExpanded((prev) => !prev)}");
    expect(componentSource).toContain("onEdit={openEditor}");
  });

  it("ExpandableText는 controlled(expanded)로 쓰고 자기 자신의 토글 버튼은 숨긴다(PostBodyActionRow와 중복되지 않도록)", () => {
    expect(componentSource).toContain("expanded={expanded}");
    expect(componentSource).toContain("hideToggleButton");
  });

  it("본문이 짧으면(needsExpandableCollapse=false) [전체 보기]를 PostBodyActionRow에 아예 렌더링하지 않는다", () => {
    const html = renderToStaticMarkup(
      <SocialPostBodyPanel
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        displayBody="짧은 본문"
        editable
        saveAction={noopAction}
      />
    );
    expect(html).not.toContain("전체 보기");
    expect(html).not.toContain("본문 접기");
  });

  it("본문이 길면(1,200자 초과) [전체 보기] 버튼을 보여주고, [본문 복사] [전체 보기] [본문 수정] 순서로 나온다", () => {
    const longBody = "가".repeat(1500);
    const html = renderToStaticMarkup(
      <SocialPostBodyPanel
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        displayBody={longBody}
        editable
        saveAction={noopAction}
      />
    );
    expect(html).toContain("전체 보기");
    const copyIdx = html.indexOf("본문 복사");
    const expandIdx = html.indexOf("전체 보기");
    const editIdx = html.indexOf(">본문 수정<");
    expect(copyIdx).toBeGreaterThan(-1);
    expect(copyIdx).toBeLessThan(expandIdx);
    expect(expandIdx).toBeLessThan(editIdx);
  });
});

describe("SocialPostBodyPanel thread 모드 (Phase UX-03B2: X 등 배열 기반 콘텐츠)", () => {
  const threadItems = [
    { order: 1, text: "첫 번째 트윗" },
    { order: 2, text: "두 번째 트윗" },
  ];

  it("threadItems+saveThreadAction이 있으면 editable=false여도 [본문 수정] 버튼이 보인다(X도 다른 플랫폼과 동일하게 inline 편집 가능)", () => {
    const html = renderToStaticMarkup(
      <SocialPostBodyPanel
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        displayBody="첫 번째 트윗 두 번째 트윗"
        editable={false}
        saveAction={noopAction}
        threadItems={threadItems}
        saveThreadAction={noopAction}
      />
    );
    expect(html).toContain("본문 수정");
  });

  it("threadItems/saveThreadAction 중 하나만 있으면 thread 모드로 취급하지 않는다(둘 다 있어야 함)", () => {
    const html = renderToStaticMarkup(
      <SocialPostBodyPanel
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        displayBody="본문"
        editable={false}
        saveAction={noopAction}
        threadItems={threadItems}
      />
    );
    expect(html).not.toContain("본문 수정");
  });

  it("정적 소스 검사: isThreadMode/copyText/effectiveEditable 계산 로직이 있다", () => {
    expect(componentSource).toContain(
      "const isThreadMode = threadItems !== undefined && saveThreadAction !== undefined;"
    );
    expect(componentSource).toContain("const effectiveEditable = isThreadMode ? true : editable;");
    expect(componentSource).toContain("formatThreadItemsForCopy(threadItems)");
    expect(componentSource).toContain('from "@/lib/social/thread-item-formatter"');
  });

  it("정적 소스 검사: 편집 모드에서 thread면 InlinePostBodyEditor를 mode=\"thread\"로, order 순서대로 정렬해서 연다", () => {
    const start = componentSource.indexOf("if (editing && isThreadMode");
    const end = componentSource.indexOf("if (editing) {", start);
    const block = componentSource.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(block).toContain('mode="thread"');
    expect(block).toContain("saveAction={saveThreadAction}");
    expect(block).toContain(".sort((a, b) => a.order - b.order)");
  });
});
