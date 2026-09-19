import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { InlinePostBodyEditor } from "./inline-post-body-editor";

const componentSource = readFileSync(path.join(__dirname, "inline-post-body-editor.tsx"), "utf8");

const noopAction = async () => {};

describe("InlinePostBodyEditor 렌더링", () => {
  it("제목과 현재 본문(textarea 초기값)을 보여준다", () => {
    const html = renderToStaticMarkup(
      <InlinePostBodyEditor
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        value="편집 중인 본문입니다."
        title="게시용 본문 수정"
        saveAction={noopAction}
        onCancel={() => {}}
      />
    );
    expect(html).toContain("게시용 본문 수정");
    expect(html).toContain("편집 중인 본문입니다.");
    expect(html).toContain("<textarea");
  });

  it("저장 후 승인/저장 후 자동 검토/저장만 하기/취소 버튼을 모두 보여준다", () => {
    const html = renderToStaticMarkup(
      <InlinePostBodyEditor
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        value="본문"
        title="본문 수정"
        saveAction={noopAction}
        onCancel={() => {}}
      />
    );
    expect(html).toContain("저장 후 승인");
    expect(html).toContain("저장 후 자동 검토");
    expect(html).toContain("저장만 하기");
    expect(html).toContain("취소");
  });

  it("articleId/socialPostId/returnTo를 hidden input으로 전달한다(server action에 필요)", () => {
    const html = renderToStaticMarkup(
      <InlinePostBodyEditor
        articleId="article-42"
        socialPostId="post-42"
        returnTo="/articles/article-42/blog"
        value="본문"
        title="본문 수정"
        saveAction={noopAction}
        onCancel={() => {}}
      />
    );
    expect(html).toContain('value="article-42"');
    expect(html).toContain('value="post-42"');
    expect(html).toContain('value="/articles/article-42/blog"');
  });

  it("취소 버튼 클릭 시 onCancel을 호출한다(server action을 거치지 않는다)", () => {
    const onCancel = vi.fn();
    const html = renderToStaticMarkup(
      <InlinePostBodyEditor
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        value="본문"
        title="본문 수정"
        saveAction={noopAction}
        onCancel={onCancel}
      />
    );
    // renderToStaticMarkup은 이벤트를 실행하지 않으므로, 취소 버튼이
    // type="button"(제출 아님)이고 onClick 핸들러가 연결되어 있는지만
    // 정적 소스로 확인한다 — 실제 클릭 동작은 SocialPostBodyPanel
    // 통합 테스트가 검증한다.
    expect(html).toContain(">취소<");
    expect(componentSource).toContain("onClick={onCancel}");
    expect(componentSource).toContain('type="button"');
  });
});

describe("InlinePostBodyEditor 정적 소스 검사", () => {
  it("client-side value/onChange 콜백이 아니라 server action form을 그대로 쓴다(SocialPostBodyPanel의 기존 저장 방식과 호환)", () => {
    expect(componentSource).toContain("<form action={saveAction}>");
    expect(componentSource).not.toContain("onChange=");
  });

  it("저장 방식(saveMode) 3종은 하나의 form 안 버튼 value로 구분한다", () => {
    expect((componentSource.match(/name="saveMode"/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(componentSource).toContain('value="save_review_and_approve"');
    expect(componentSource).toContain('value="save_and_review"');
    expect(componentSource).toContain('value="save_only"');
  });

  it("textarea 초기값은 value 전체이며 줄바꿈을 유지한다", () => {
    expect(componentSource).toContain("defaultValue={props.value}");
    expect(componentSource).toContain('whiteSpace: "pre-wrap"');
  });

  it("빈 본문 검증을 이 컴포넌트가 새로 추가하지 않는다(기존 서버 검증과 중복시키지 않는다)", () => {
    expect(componentSource).not.toContain("required");
    expect(componentSource).not.toMatch(/if\s*\(.*trim/);
  });
});

describe("InlinePostBodyEditor mode='thread' (Phase UX-03B2: X 등 배열 기반 콘텐츠)", () => {
  it("item마다 별도 textarea를 순서대로 보여준다(하나로 합치지 않는다)", () => {
    const html = renderToStaticMarkup(
      <InlinePostBodyEditor
        mode="thread"
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        items={[{ text: "첫 번째 트윗" }, { text: "두 번째 트윗" }, { text: "세 번째 트윗" }]}
        title="본문 수정"
        saveAction={noopAction}
        onCancel={() => {}}
      />
    );
    expect(html.match(/<textarea/g)?.length).toBe(3);
    expect(html).toContain("첫 번째 트윗");
    expect(html).toContain("두 번째 트윗");
    expect(html).toContain("세 번째 트윗");
    const firstIdx = html.indexOf("첫 번째 트윗");
    const secondIdx = html.indexOf("두 번째 트윗");
    const thirdIdx = html.indexOf("세 번째 트윗");
    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
  });

  it("모든 textarea가 같은 name(threadItemText)을 써서 FormData.getAll로 순서대로 받을 수 있다", () => {
    const html = renderToStaticMarkup(
      <InlinePostBodyEditor
        mode="thread"
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        items={[{ text: "A" }, { text: "B" }]}
        title="본문 수정"
        saveAction={noopAction}
        onCancel={() => {}}
      />
    );
    expect(html.match(/name="threadItemText"/g)?.length).toBe(2);
  });

  it("maxLengthPerItem이 있으면 항목별 글자 수를 보여준다", () => {
    const html = renderToStaticMarkup(
      <InlinePostBodyEditor
        mode="thread"
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        items={[{ text: "12345" }]}
        maxLengthPerItem={280}
        title="본문 수정"
        saveAction={noopAction}
        onCancel={() => {}}
      />
    );
    expect(html).toContain("(5/280자)");
  });

  it("mode='thread'도 저장 후 승인/저장 후 자동 검토/저장만 하기/취소 버튼을 동일하게 제공한다", () => {
    const html = renderToStaticMarkup(
      <InlinePostBodyEditor
        mode="thread"
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        items={[{ text: "A" }]}
        title="본문 수정"
        saveAction={noopAction}
        onCancel={() => {}}
      />
    );
    expect(html).toContain("저장 후 승인");
    expect(html).toContain("저장 후 자동 검토");
    expect(html).toContain("저장만 하기");
    expect(html).toContain("취소");
  });

  it("mode를 생략하면 기존과 동일한 single 모드(하나의 textarea, name=body)로 동작한다", () => {
    const html = renderToStaticMarkup(
      <InlinePostBodyEditor
        articleId="article-1"
        socialPostId="post-1"
        returnTo="/articles/article-1/social"
        value="본문"
        title="본문 수정"
        saveAction={noopAction}
        onCancel={() => {}}
      />
    );
    expect(html.match(/<textarea/g)?.length).toBe(1);
    expect(html).toContain('name="body"');
  });
});
