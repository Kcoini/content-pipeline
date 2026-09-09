import { describe, expect, it } from "vitest";
import {
  getPlatformPreviewMode,
  getPlatformBodyLabel,
  getPlatformBodyWarnings,
  hasDisplayableBody,
} from "./social-post-platform-preview";
import type { SocialPost } from "./social-platform-types";

function makePost(overrides: Partial<Pick<SocialPost, "platform" | "postBody" | "caption" | "threadItems" | "cardItems">>) {
  return {
    platform: "naver_cafe" as const,
    postBody: null,
    caption: null,
    threadItems: [],
    cardItems: [],
    ...overrides,
  };
}

describe("getPlatformPreviewMode (Phase 3-26)", () => {
  it("플랫폼마다 올바른 미리보기 모드를 반환한다", () => {
    expect(getPlatformPreviewMode("wordpress_blog")).toBe("wordpress_html");
    expect(getPlatformPreviewMode("naver_blog")).toBe("mobile_blog");
    expect(getPlatformPreviewMode("naver_cafe")).toBe("plain_text");
    expect(getPlatformPreviewMode("x")).toBe("short_text");
    expect(getPlatformPreviewMode("threads")).toBe("short_text");
    expect(getPlatformPreviewMode("instagram")).toBe("caption_stack");
  });
});

describe("getPlatformBodyLabel (Phase 3-26)", () => {
  it("본문형 플랫폼은 '본문', instagram은 '캡션'을 반환한다", () => {
    expect(getPlatformBodyLabel("wordpress_blog")).toBe("본문");
    expect(getPlatformBodyLabel("naver_cafe")).toBe("본문");
    expect(getPlatformBodyLabel("instagram")).toBe("캡션");
  });
});

describe("getPlatformBodyWarnings (Phase 3-26)", () => {
  it("naver_blog에서 문단이 너무 길면 경고한다", () => {
    const longParagraph = "가".repeat(250);
    const warnings = getPlatformBodyWarnings(makePost({ platform: "naver_blog", postBody: longParagraph }));
    expect(warnings.some((w) => w.includes("문단이 다소 깁니다"))).toBe(true);
  });

  it("naver_blog에서 문단이 짧으면 경고하지 않는다", () => {
    const warnings = getPlatformBodyWarnings(makePost({ platform: "naver_blog", postBody: "짧은 문단입니다." }));
    expect(warnings).toEqual([]);
  });

  it("x에서 글자 수가 280자를 넘으면 경고한다", () => {
    const longText = "가".repeat(300);
    const warnings = getPlatformBodyWarnings(
      makePost({ platform: "x", threadItems: [{ order: 1, text: longText }] })
    );
    expect(warnings.some((w) => w.includes("권장 길이"))).toBe(true);
  });

  it("naver_cafe에 질문형 문장이 없으면 댓글 유도 질문 추가를 권장한다", () => {
    const warnings = getPlatformBodyWarnings(makePost({ platform: "naver_cafe", postBody: "그냥 정보 전달용 글입니다." }));
    expect(warnings.some((w) => w.includes("질문형 문장"))).toBe(true);
  });

  it("naver_cafe에 질문형 문장이 있으면 경고하지 않는다", () => {
    const warnings = getPlatformBodyWarnings(makePost({ platform: "naver_cafe", postBody: "여러분은 어떻게 생각하세요?" }));
    expect(warnings).toEqual([]);
  });
});

describe("hasDisplayableBody (Phase 3-26)", () => {
  it("본문/캡션/스레드가 모두 비어 있으면 false다", () => {
    expect(hasDisplayableBody(makePost({}))).toBe(false);
  });

  it("본문이 있으면 true다", () => {
    expect(hasDisplayableBody(makePost({ platform: "naver_blog", postBody: "내용" }))).toBe(true);
  });
});
