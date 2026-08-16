import { describe, expect, it } from "vitest";
import { isHighlighted, getHighlightClassName, buildAnchorId, resolveHighlightWarning, HIGHLIGHT_CLASS_NAME } from "./highlight-target";

describe("isHighlighted / getHighlightClassName", () => {
  it("itemId와 targetId가 같으면 true를 반환한다", () => {
    expect(isHighlighted("p1", "p1")).toBe(true);
  });

  it("itemId와 targetId가 다르면 false를 반환한다", () => {
    expect(isHighlighted("p1", "p2")).toBe(false);
  });

  it("targetId가 없으면 false를 반환한다", () => {
    expect(isHighlighted("p1", undefined)).toBe(false);
    expect(isHighlighted("p1", null)).toBe(false);
  });

  it("강조 대상이면 HIGHLIGHT_CLASS_NAME을 반환한다", () => {
    expect(getHighlightClassName("p1", "p1")).toBe(HIGHLIGHT_CLASS_NAME);
  });

  it("강조 대상이 아니면 빈 문자열을 반환한다", () => {
    expect(getHighlightClassName("p1", "p2")).toBe("");
    expect(getHighlightClassName("p1", undefined)).toBe("");
  });
});

describe("buildAnchorId", () => {
  it("prefix-itemId 형태의 anchor id를 만든다", () => {
    expect(buildAnchorId("social-post", "p1")).toBe("social-post-p1");
    expect(buildAnchorId("rewrite-suggestion", "s1")).toBe("rewrite-suggestion-s1");
  });
});

describe("resolveHighlightWarning", () => {
  it("targetId가 없으면 경고하지 않는다", () => {
    expect(resolveHighlightWarning(undefined, ["p1", "p2"])).toBe(false);
  });

  it("targetId가 목록에 있으면 경고하지 않는다", () => {
    expect(resolveHighlightWarning("p1", ["p1", "p2"])).toBe(false);
  });

  it("targetId가 목록에 없으면 경고한다", () => {
    expect(resolveHighlightWarning("missing", ["p1", "p2"])).toBe(true);
  });
});
