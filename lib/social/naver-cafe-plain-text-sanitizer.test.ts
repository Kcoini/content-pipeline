import { describe, expect, it } from "vitest";
import { sanitizeNaverCafePlainText } from "./naver-cafe-plain-text-sanitizer";

describe("sanitizeNaverCafePlainText (Phase 3-20: naver_cafe markdown escape 노출 문제 수정)", () => {
  it("escape된 heading(\\##)을 제거한다(마커+백슬래시 모두 삭제, 텍스트는 남긴다)", () => {
    const result = sanitizeNaverCafePlainText("\\## 왜 지금 금리를 올리는 걸까요?");
    expect(result).toBe("왜 지금 금리를 올리는 걸까요?");
    expect(result).not.toContain("\\##");
    expect(result).not.toContain("##");
  });

  it("escape되지 않은 순수 heading(##)도 마커를 제거한다", () => {
    const result = sanitizeNaverCafePlainText("## 소제목입니다");
    expect(result).toBe("소제목입니다");
  });

  it("escape된 bold(\\*\\*)를 제거한다(마커+백슬래시 모두 삭제, 텍스트는 남긴다)", () => {
    const result = sanitizeNaverCafePlainText("\\*\\*1. 물가가 예상보다 많이 올랐어요\\*\\*");
    expect(result).toBe("1. 물가가 예상보다 많이 올랐어요");
    expect(result).not.toContain("**");
  });

  it("&#x20;를 제거한다(공백으로 치환 후 공백 정리)", () => {
    const result = sanitizeNaverCafePlainText("문장 하나&#x20;문장 둘");
    expect(result).not.toContain("&#x20;");
    expect(result).toBe("문장 하나 문장 둘");
  });

  it("escape된 list bullet(\\-)은 백슬래시만 제거하고 '-'는 그대로 남긴다(자연스러운 목록 표시)", () => {
    const result = sanitizeNaverCafePlainText("\\- 변동금리 대출 쓰시는 분 계신가요?");
    expect(result).toBe("- 변동금리 대출 쓰시는 분 계신가요?");
  });

  it("markdown link를 자연스러운 plain text로 풀어 쓴다", () => {
    const result = sanitizeNaverCafePlainText("[한국은행 발표](https://example.com/notice)를 참고하세요.");
    expect(result).toBe("한국은행 발표 (https://example.com/notice)를 참고하세요.");
  });

  it("markdown table을 슬래시로 구분한 한 줄 목록으로 바꾼다(표 구분행은 제거)", () => {
    const result = sanitizeNaverCafePlainText(["| 항목 | 설명 |", "|---|---|", "| A | B |"].join("\n"));
    expect(result).not.toContain("|");
    expect(result).toContain("항목 / 설명");
    expect(result).toContain("A / B");
  });

  it("연속 공백을 한 칸으로 정리한다", () => {
    const result = sanitizeNaverCafePlainText("문장   하나입니다");
    expect(result).toBe("문장 하나입니다");
  });

  it("3줄 이상 연속 개행을 2줄로 줄인다", () => {
    const result = sanitizeNaverCafePlainText("문단 하나\n\n\n\n문단 둘");
    expect(result).toBe("문단 하나\n\n문단 둘");
  });

  it("본문 앞뒤 공백/개행을 trim한다", () => {
    const result = sanitizeNaverCafePlainText("\n\n  내용입니다  \n\n");
    expect(result).toBe("내용입니다");
  });

  it("빈 값/공백만 있으면 빈 문자열을 반환한다", () => {
    expect(sanitizeNaverCafePlainText(null)).toBe("");
    expect(sanitizeNaverCafePlainText(undefined)).toBe("");
    expect(sanitizeNaverCafePlainText("   ")).toBe("");
  });

  it("이미 깨끗한 plain text에는 아무 부작용이 없다(idempotent)", () => {
    const clean = "다들 이런 경험 있으신가요? 저도 비슷한 고민이 있어서 여쭤봅니다.";
    expect(sanitizeNaverCafePlainText(clean)).toBe(clean);
    expect(sanitizeNaverCafePlainText(sanitizeNaverCafePlainText(clean))).toBe(clean);
  });

  it("사용자가 보고한 실제 예시를 정확히 정리한다", () => {
    const input = [
      "\\## 왜 지금 금리를 올리는 걸까요?",
      "",
      "\\*\\*1. 물가가 예상보다 많이 올랐어요\\*\\*",
      "",
      "&#x20;",
      "",
      "\\- 변동금리 대출 쓰시는 분 계신가요?",
    ].join("\n");

    const result = sanitizeNaverCafePlainText(input);

    expect(result).not.toMatch(/\\#|\\\*|&#x20;/);
    expect(result).toContain("왜 지금 금리를 올리는 걸까요?");
    expect(result).toContain("1. 물가가 예상보다 많이 올랐어요");
    expect(result).toContain("- 변동금리 대출 쓰시는 분 계신가요?");
  });
});
