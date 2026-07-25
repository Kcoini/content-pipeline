import { describe, expect, it } from "vitest";
import { slugify, articleIdSlugFallback } from "./slugify";

describe("slugify", () => {
  it("영문 제목의 공백을 hyphen으로 변환한다", () => {
    expect(slugify("Long Term Care Facility Guide")).toBe("long-term-care-facility-guide");
  });

  it("특수문자를 제거한다", () => {
    expect(slugify("What's New? (2026 Update!)")).toBe("whats-new-2026-update");
  });

  it("한글 제목은 한글 음절을 유지하며 공백을 hyphen으로 변환한다", () => {
    expect(slugify("요양원과 요양병원 차이")).toBe("요양원과-요양병원-차이");
  });

  it("allowKorean=false이면 한글을 제거한다", () => {
    const result = slugify("요양원과 요양병원 차이", { allowKorean: false, fallback: "care-guide" });
    expect(result).toBe("care-guide");
  });

  it("최대 길이를 넘으면 잘라내고 끝의 hyphen을 제거한다", () => {
    const long = "a".repeat(50) + " " + "b".repeat(50);
    const result = slugify(long, { maxLength: 60 });
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result.endsWith("-")).toBe(false);
  });

  it("빈 문자열이면 fallback을 사용한다", () => {
    expect(slugify("", { fallback: "article-fallback" })).toBe("article-fallback");
  });

  it("특수문자만 있어서 결과가 비면 fallback을 사용한다", () => {
    expect(slugify("!!!???...", { fallback: "no-content" })).toBe("no-content");
  });

  it("연속된 hyphen을 하나로 합친다", () => {
    expect(slugify("a   b---c")).toBe("a-b-c");
  });
});

describe("articleIdSlugFallback", () => {
  it("article id 앞 8자를 기반으로 fallback slug를 만든다", () => {
    const result = articleIdSlugFallback("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    expect(result).toBe("article-a1b2c3d4");
  });

  it("결과는 항상 안전한 slug 형태다 (hyphen과 영숫자만)", () => {
    const result = articleIdSlugFallback("00000000-0000-0000-0000-000000000000");
    expect(result).toMatch(/^article-[a-z0-9]+$/);
  });
});
