import { describe, expect, it } from "vitest";
import { sanitizePlainTextMarkupResidue } from "./plain-text-markup-residue-sanitizer";

describe("sanitizePlainTextMarkupResidue (Phase UX-05A: x/threads/instagram markdown/HTML 잔여물 정리)", () => {
  it("escape된 heading(\\##)을 제거한다(마커+백슬래시 모두 삭제, 텍스트는 남긴다)", () => {
    const result = sanitizePlainTextMarkupResidue("\\## 오늘의 스레드");
    expect(result).toBe("오늘의 스레드");
    expect(result).not.toContain("##");
  });

  it("escape되지 않은 순수 heading(##)도 마커를 제거한다", () => {
    expect(sanitizePlainTextMarkupResidue("## 소제목입니다")).toBe("소제목입니다");
  });

  it("인라인 해시태그(#AI처럼 공백 없이 이어지는 것)는 건드리지 않는다", () => {
    expect(sanitizePlainTextMarkupResidue("오늘의 주제는 #AI #머신러닝 입니다")).toBe("오늘의 주제는 #AI #머신러닝 입니다");
  });

  it("escape된 bold(\\*\\*)를 제거한다", () => {
    const result = sanitizePlainTextMarkupResidue("\\*\\*중요한 발표\\*\\*가 있었습니다.");
    expect(result).toBe("중요한 발표가 있었습니다.");
  });

  it("escape되지 않은 순수 bold(**)도 제거한다(텍스트는 남긴다)", () => {
    expect(sanitizePlainTextMarkupResidue("**중요합니다**")).toBe("중요합니다");
  });

  it("흔한 HTML 태그(div/p/span/br 등)를 제거하되 안의 텍스트는 남긴다", () => {
    expect(sanitizePlainTextMarkupResidue("<p>안녕하세요</p>")).toBe("안녕하세요");
    expect(sanitizePlainTextMarkupResidue("첫 줄<br>둘째 줄")).toBe("첫 줄둘째 줄");
    expect(sanitizePlainTextMarkupResidue("<div class=\"box\">내용</div>")).toBe("내용");
  });

  it("HTML entity(&#x20; 등)를 실제 문자로 되돌린다", () => {
    expect(sanitizePlainTextMarkupResidue("문장 하나&#x20;문장 둘")).toBe("문장 하나 문장 둘");
    expect(sanitizePlainTextMarkupResidue("A&amp;B")).toBe("A&B");
  });

  it("연속 공백/개행을 정리한다", () => {
    expect(sanitizePlainTextMarkupResidue("문장   하나")).toBe("문장 하나");
    expect(sanitizePlainTextMarkupResidue("하나\n\n\n\n둘")).toBe("하나\n\n둘");
  });

  it("빈 값/공백만 있으면 빈 문자열을 반환한다", () => {
    expect(sanitizePlainTextMarkupResidue(null)).toBe("");
    expect(sanitizePlainTextMarkupResidue(undefined)).toBe("");
    expect(sanitizePlainTextMarkupResidue("   ")).toBe("");
  });

  it("이미 깨끗한 plain text에는 아무 부작용이 없다(idempotent)", () => {
    const clean = "오늘 발표된 내용 정리해봤어요. 다들 어떻게 생각하시나요?";
    expect(sanitizePlainTextMarkupResidue(clean)).toBe(clean);
    expect(sanitizePlainTextMarkupResidue(sanitizePlainTextMarkupResidue(clean))).toBe(clean);
  });

  it("실제 URL(http://...)은 훼손하지 않는다", () => {
    const input = "자세한 내용은 https://example.com/notice 참고하세요.";
    expect(sanitizePlainTextMarkupResidue(input)).toBe(input);
  });

  it("markdown/HTML 잔여물이 섞인 실제 예시를 한 번에 정리한다", () => {
    const input = ["\\## 오늘의 발표", "", "<p>\\*\\*핵심 요약\\*\\*</p>", "", "&#x20;", "", "#AI #자동화"].join("\n");
    const result = sanitizePlainTextMarkupResidue(input);
    expect(result).not.toMatch(/\\#|\\\*|&#x20;|<p>|<\/p>/);
    expect(result).toContain("오늘의 발표");
    expect(result).toContain("핵심 요약");
    expect(result).toContain("#AI #자동화");
  });
});
