import { describe, expect, it } from "vitest";
import { isSafeInternalReturnTo, getSafeReturnTo, buildReturnTo, appendReturnTo } from "./return-to";

describe("isSafeInternalReturnTo / getSafeReturnTo", () => {
  it("article 하위 5개 페이지 내부 경로를 허용한다", () => {
    expect(isSafeInternalReturnTo("/articles/123")).toBe(true);
    expect(isSafeInternalReturnTo("/articles/123/blog")).toBe(true);
    expect(isSafeInternalReturnTo("/articles/123/social")).toBe(true);
    expect(isSafeInternalReturnTo("/articles/123/rewrite")).toBe(true);
    expect(isSafeInternalReturnTo("/articles/123/performance")).toBe(true);
  });

  it("query/hash가 포함된 내부 경로도 허용한다", () => {
    expect(isSafeInternalReturnTo("/articles/123/blog?socialPostId=abc")).toBe(true);
    expect(isSafeInternalReturnTo("/articles/123/rewrite?rewriteSuggestionId=def&highlight=def")).toBe(true);
    expect(isSafeInternalReturnTo("/articles/123/performance#social-post-abc")).toBe(true);
  });

  it("http:// 외부 URL을 차단한다", () => {
    expect(isSafeInternalReturnTo("http://evil.com")).toBe(false);
  });

  it("https:// 외부 URL을 차단한다", () => {
    expect(isSafeInternalReturnTo("https://evil.com")).toBe(false);
  });

  it("protocol-relative(//) URL을 차단한다", () => {
    expect(isSafeInternalReturnTo("//evil.com")).toBe(false);
  });

  it("javascript: 스킴을 차단한다", () => {
    expect(isSafeInternalReturnTo("javascript:alert(1)")).toBe(false);
  });

  it("data: 스킴을 차단한다", () => {
    expect(isSafeInternalReturnTo("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("허용 목록에 없는 내부 경로도 차단한다", () => {
    expect(isSafeInternalReturnTo("/dashboard")).toBe(false);
    expect(isSafeInternalReturnTo("/articles/123/unknown")).toBe(false);
  });

  it("빈 값이면 false를 반환한다", () => {
    expect(isSafeInternalReturnTo("")).toBe(false);
    expect(isSafeInternalReturnTo(null)).toBe(false);
    expect(isSafeInternalReturnTo(undefined)).toBe(false);
  });

  it("getSafeReturnTo: 안전한 값이면 그대로 반환한다", () => {
    expect(getSafeReturnTo("/articles/123/blog?socialPostId=abc", "/articles/123")).toBe("/articles/123/blog?socialPostId=abc");
  });

  it("getSafeReturnTo: 외부 URL이면 fallback을 반환한다", () => {
    expect(getSafeReturnTo("https://evil.com", "/articles/123")).toBe("/articles/123");
  });

  it("getSafeReturnTo: 빈 값이면 fallback을 반환한다", () => {
    expect(getSafeReturnTo("", "/articles/123")).toBe("/articles/123");
    expect(getSafeReturnTo(null, "/articles/123")).toBe("/articles/123");
  });

  it("getSafeReturnTo: 잘못된 값(스킴 우회 시도 포함)이면 fallback을 반환한다", () => {
    expect(getSafeReturnTo("/articles/123/blog?x=javascript:alert(1)", "/articles/123")).toBe("/articles/123");
    expect(getSafeReturnTo("\\\\evil.com", "/articles/123")).toBe("/articles/123");
  });
});

describe("buildReturnTo", () => {
  it("searchParams가 없으면 pathname만 반환한다", () => {
    expect(buildReturnTo("/articles/123/blog")).toBe("/articles/123/blog");
  });

  it("URLSearchParams를 pathname에 붙인다", () => {
    const params = new URLSearchParams({ socialPostId: "abc" });
    expect(buildReturnTo("/articles/123/blog", params)).toBe("/articles/123/blog?socialPostId=abc");
  });

  it("plain object 형태의 searchParams도 처리한다", () => {
    expect(buildReturnTo("/articles/123/rewrite", { rewriteSuggestionId: "def", section: undefined })).toBe(
      "/articles/123/rewrite?rewriteSuggestionId=def"
    );
  });
});

describe("appendReturnTo", () => {
  it("안전한 returnTo를 url에 query로 붙인다", () => {
    expect(appendReturnTo("/articles/123/performance", "/articles/123/blog")).toBe(
      "/articles/123/performance?returnTo=%2Farticles%2F123%2Fblog"
    );
  });

  it("이미 query가 있는 url에도 안전하게 붙인다", () => {
    expect(appendReturnTo("/articles/123/performance?socialPostId=abc", "/articles/123/blog")).toBe(
      "/articles/123/performance?socialPostId=abc&returnTo=%2Farticles%2F123%2Fblog"
    );
  });

  it("안전하지 않은 returnTo는 무시하고 url을 그대로 반환한다", () => {
    expect(appendReturnTo("/articles/123/performance", "https://evil.com")).toBe("/articles/123/performance");
  });
});
