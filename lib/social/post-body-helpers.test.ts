import { describe, expect, it } from "vitest";
import { getPostDisplayBody, getPostEditableBody, getPostCopyText, getPostPreviewHtml } from "./post-body-helpers";
import { getSocialPostDisplayBody } from "./social-post-display";
import type { SocialPost } from "./social-platform-types";

function makePost(overrides: Partial<SocialPost>): Pick<SocialPost, "platform" | "postBody" | "caption" | "threadItems" | "cardItems"> {
  return {
    platform: "naver_cafe",
    postBody: null,
    caption: null,
    threadItems: [],
    cardItems: [],
    ...overrides,
  };
}

describe("getPostDisplayBody / getPostEditableBody / getPostCopyText", () => {
  it("셋 다 getSocialPostDisplayBody와 같은 값을 반환한다(플랫폼별 우선순위 위임)", () => {
    const post = makePost({ platform: "naver_cafe", postBody: "카페 본문" });
    const expected = getSocialPostDisplayBody(post);
    expect(getPostDisplayBody(post)).toBe(expected);
    expect(getPostEditableBody(post)).toBe(expected);
    expect(getPostCopyText(post)).toBe(expected);
  });

  it("instagram은 caption을 우선 반환한다", () => {
    const post = makePost({ platform: "instagram", caption: "인스타 캡션", postBody: "본문(안 씀)" });
    expect(getPostDisplayBody(post)).toBe("인스타 캡션");
  });
});

describe("getPostPreviewHtml", () => {
  it("wordpress_blog는 markdown을 HTML로 변환한 결과를 반환한다(raw markdown이 그대로 보이지 않는다)", () => {
    const post = makePost({ platform: "wordpress_blog", postBody: "## 제목\n\n**강조**" });
    const html = getPostPreviewHtml(post);
    expect(html).not.toBeNull();
    expect(html).not.toContain("## 제목");
    expect(html).not.toContain("**강조**");
    expect(html).toContain("<h2");
  });

  it("wordpress_blog가 아니면 null을 반환한다(원문과 렌더링 결과가 같으므로 plain text를 그대로 쓰면 된다)", () => {
    expect(getPostPreviewHtml(makePost({ platform: "naver_blog", postBody: "본문" }))).toBeNull();
    expect(getPostPreviewHtml(makePost({ platform: "naver_cafe", postBody: "본문" }))).toBeNull();
    expect(getPostPreviewHtml(makePost({ platform: "x" }))).toBeNull();
  });

  it("본문이 비어 있으면 wordpress_blog여도 null을 반환한다", () => {
    expect(getPostPreviewHtml(makePost({ platform: "wordpress_blog", postBody: "" }))).toBeNull();
    expect(getPostPreviewHtml(makePost({ platform: "wordpress_blog", postBody: null }))).toBeNull();
  });
});
