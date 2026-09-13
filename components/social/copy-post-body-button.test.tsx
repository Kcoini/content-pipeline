import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/articles/[id]/actions", () => ({
  logSocialPostInlineEditClientEventAction: vi.fn().mockResolvedValue(undefined),
}));

const { CopyPostBodyButton } = await import("./copy-post-body-button");
const componentSource = readFileSync(path.join(__dirname, "copy-post-body-button.tsx"), "utf8");

describe("CopyPostBodyButton 렌더링", () => {
  it("기본 라벨은 '본문 복사'다", () => {
    const html = renderToStaticMarkup(
      <CopyPostBodyButton articleId="article-1" socialPostId="post-1" text="본문 내용" />
    );
    expect(html).toContain("본문 복사");
  });

  it("label prop으로 라벨을 바꿀 수 있다", () => {
    const html = renderToStaticMarkup(
      <CopyPostBodyButton articleId="article-1" socialPostId="post-1" text="본문" label="제목+본문 복사" />
    );
    expect(html).toContain("제목+본문 복사");
  });
});

describe("CopyPostBodyButton 정적 소스 검사", () => {
  it('"use client" 컴포넌트이며 navigator.clipboard.writeText를 사용한다', () => {
    expect(componentSource).toContain('"use client"');
    expect(componentSource).toContain("navigator.clipboard");
    expect(componentSource).toContain("writeText");
  });

  it("clipboard API를 사용할 수 없을 때 execCommand fallback을 제공한다", () => {
    expect(componentSource).toContain("execCommand");
  });

  it("복사 성공/실패 메시지 문구를 포함한다", () => {
    expect(componentSource).toContain("본문을 복사했습니다.");
    expect(componentSource).toContain("복사하지 못했습니다. 본문을 직접 선택해 복사해 주세요.");
  });

  it("복사 결과를 서버 action(logSocialPostInlineEditClientEventAction)으로 기록하되, 로그 실패가 사용자 흐름을 막지 않는다", () => {
    expect(componentSource).toContain("logSocialPostInlineEditClientEventAction");
    expect(componentSource).toContain(".catch(() => {})");
  });

  it("props로 전달된 text 전체를 복사 대상으로 쓴다(표시 중인 축약문이 아니라 원본 text)", () => {
    expect(componentSource).toContain("writeText(text)");
    expect(componentSource).toContain("copyWithFallback(text)");
  });
});
