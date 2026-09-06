import { describe, expect, it } from "vitest";
import { getSocialPostDisplayBody } from "./social-post-display";
import type { SocialPost } from "./social-platform-types";

type DisplayBodyInput = Pick<SocialPost, "platform" | "postBody" | "caption" | "threadItems" | "cardItems">;

function makePost(overrides: Partial<DisplayBodyInput> & Pick<DisplayBodyInput, "platform">): DisplayBodyInput {
  return {
    postBody: null,
    caption: null,
    threadItems: [],
    cardItems: [],
    ...overrides,
  };
}

describe("getSocialPostDisplayBody (Phase 3-19: naver_cafe 본문 없음 표시 버그 수정)", () => {
  it("naver_cafe: postBody가 있고 caption이 비어 있어도 postBody를 반환한다", () => {
    const post = makePost({ platform: "naver_cafe", postBody: "카페 본문 내용입니다.", caption: null });
    expect(getSocialPostDisplayBody(post)).toBe("카페 본문 내용입니다.");
  });

  it("naver_cafe: postBody가 공백만 있으면 caption으로 대체한다", () => {
    const post = makePost({ platform: "naver_cafe", postBody: "   ", caption: "짧은 캡션" });
    expect(getSocialPostDisplayBody(post)).toBe("짧은 캡션");
  });

  it("naver_cafe: postBody/caption이 모두 없으면 빈 문자열을 반환한다(호출부에서 '(본문 없음)'으로 대체)", () => {
    const post = makePost({ platform: "naver_cafe", postBody: null, caption: null });
    expect(getSocialPostDisplayBody(post)).toBe("");
  });

  it("threads: postBody를 우선 표시한다(caption이 아니라 body 기반 플랫폼)", () => {
    const post = makePost({ platform: "threads", postBody: "threads 본문입니다.", caption: "이 값은 무시된다" });
    expect(getSocialPostDisplayBody(post)).toBe("threads 본문입니다.");
  });

  it("wordpress_blog: postBody를 우선 표시한다", () => {
    const post = makePost({ platform: "wordpress_blog", postBody: "블로그 본문입니다.", caption: null });
    expect(getSocialPostDisplayBody(post)).toBe("블로그 본문입니다.");
  });

  it("naver_blog: postBody를 우선 표시한다", () => {
    const post = makePost({ platform: "naver_blog", postBody: "네이버 블로그 본문입니다.", caption: null });
    expect(getSocialPostDisplayBody(post)).toBe("네이버 블로그 본문입니다.");
  });

  it("instagram: caption을 우선 표시한다(caption 기반 플랫폼, postBody 미지원)", () => {
    const post = makePost({ platform: "instagram", postBody: null, caption: "인스타 caption입니다." });
    expect(getSocialPostDisplayBody(post)).toBe("인스타 caption입니다.");
  });

  it("x: threadItems를 이어붙여 표시한다(caption/postBody 어느 것도 지원하지 않음)", () => {
    const post = makePost({
      platform: "x",
      threadItems: [
        { order: 1, text: "첫 번째 트윗" },
        { order: 2, text: "두 번째 트윗" },
      ],
    });
    expect(getSocialPostDisplayBody(post)).toBe("첫 번째 트윗 두 번째 트윗");
  });
});
