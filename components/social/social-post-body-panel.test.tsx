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

describe("SocialPostBodyPanel 정적 소스 검사", () => {
  it('"use client" 컴포넌트이며 useState로 편집 모드를 관리한다', () => {
    expect(componentSource).toContain('"use client"');
    expect(componentSource).toContain("useState");
  });

  it("편집 모드에서는 textarea와 저장 후 승인/저장 후 자동 검토/저장만 하기/취소 버튼을 보여준다", () => {
    expect(componentSource).toContain("<textarea");
    expect(componentSource).toContain("저장 후 승인");
    expect(componentSource).toContain("저장 후 자동 검토");
    expect(componentSource).toContain("저장만 하기");
    expect(componentSource).toContain("취소");
  });

  it("저장 버튼들은 하나의 form과 saveAction을 공유하고, saveMode만 버튼별로 다르다(name=saveMode)", () => {
    expect(componentSource).toContain('<form action={saveAction}>');
    expect((componentSource.match(/name="saveMode"/g) ?? []).length).toBe(3);
    expect(componentSource).toContain('value="save_review_and_approve"');
    expect(componentSource).toContain('value="save_and_review"');
    expect(componentSource).toContain('value="save_only"');
  });

  it("textarea 초기값은 displayBody 전체다(줄바꿈 유지 스타일 포함)", () => {
    expect(componentSource).toContain("defaultValue={displayBody}");
    expect(componentSource).toContain("whiteSpace: \"pre-wrap\"");
  });

  it("취소를 누르면 편집 모드가 꺼지고, 열기/취소 이벤트를 로그로 남긴다(사용자 흐름을 막지 않는 fire-and-forget)", () => {
    expect(componentSource).toContain("setEditing(false)");
    expect(componentSource).toContain('event: "opened"');
    expect(componentSource).toContain('event: "cancelled"');
    expect(componentSource).toContain(".catch(() => {})");
  });

  it("ExpandableText/CopyPostBodyButton을 재사용한다(새 텍스트 렌더링 로직을 중복 작성하지 않는다)", () => {
    expect(componentSource).toContain('from "./expandable-text"');
    expect(componentSource).toContain('from "./copy-post-body-button"');
  });
});
