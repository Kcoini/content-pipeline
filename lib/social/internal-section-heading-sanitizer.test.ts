import { describe, expect, it } from "vitest";
import { detectInternalSectionHeadings, sanitizeInternalSectionHeadings } from "./internal-section-heading-sanitizer";

describe("sanitizeInternalSectionHeadings", () => {
  it("null/undefined는 그대로 반환한다", () => {
    expect(sanitizeInternalSectionHeadings(null)).toEqual({ body: null, changed: false, affectedKeys: [] });
    expect(sanitizeInternalSectionHeadings(undefined)).toEqual({ body: null, changed: false, affectedKeys: [] });
  });

  it("변경할 내부 소제목이 없으면 changed=false, 원문 그대로 반환한다", () => {
    const body = "# 제목\n\n일반 문단입니다.\n\n## 왜 지금 중요한가\n\n내용";
    const result = sanitizeInternalSectionHeadings(body);
    expect(result.changed).toBe(false);
    expect(result.body).toBe(body);
    expect(result.affectedKeys).toEqual([]);
  });

  it("'## 리드문'을 제거한다(소제목 줄만 삭제, 문단은 남긴다)", () => {
    const result = sanitizeInternalSectionHeadings("# 제목\n\n## 리드문\n\n리드 문단 내용입니다.");
    expect(result.changed).toBe(true);
    expect(result.affectedKeys).toContain("lead");
    expect(result.body).not.toContain("리드문");
    expect(result.body).toContain("리드 문단 내용입니다.");
  });

  it("'**리드문**'(bold 형태)도 제거한다", () => {
    const result = sanitizeInternalSectionHeadings("**리드문**\n\n리드 문단.");
    expect(result.changed).toBe(true);
    expect(result.body).not.toContain("리드문");
  });

  it("'## 본문'을 내용형 소제목으로 바꾼다", () => {
    const result = sanitizeInternalSectionHeadings("## 본문\n\n내용");
    expect(result.affectedKeys).toContain("body");
    expect(result.body).toContain("## 핵심 내용");
    expect(result.body).not.toContain("## 본문");
  });

  it("'**배경 설명**'을 내용형 소제목으로 바꾼다", () => {
    const result = sanitizeInternalSectionHeadings("**배경 설명**\n\n내용");
    expect(result.affectedKeys).toContain("background");
    expect(result.body).toContain("**왜 이런 상황인가**");
  });

  it("'## 쟁점'을 내용형 소제목으로 바꾼다", () => {
    const result = sanitizeInternalSectionHeadings("## 쟁점\n\n내용");
    expect(result.affectedKeys).toContain("issues");
    expect(result.body).toContain("## 쟁점: 기회와 우려");
  });

  it("'## 향후 확인할 점'을 '앞으로 확인해야 할 변수'로 바꾼다", () => {
    const result = sanitizeInternalSectionHeadings("## 향후 확인할 점\n\n내용");
    expect(result.affectedKeys).toContain("future_checks");
    expect(result.body).toContain("## 앞으로 확인해야 할 변수");
  });

  it("'## 출처'를 '참고한 자료'로 바꾼다", () => {
    const result = sanitizeInternalSectionHeadings("## 출처\n\n내용");
    expect(result.affectedKeys).toContain("sources");
    expect(result.body).toContain("## 참고한 자료");
  });

  it("문장 중간에 '본문'이라는 단어가 있어도(소제목 형태가 아니면) 건드리지 않는다", () => {
    const body = "이 글의 본문에서 확인했듯이, 배경 설명이 필요합니다.";
    const result = sanitizeInternalSectionHeadings(body);
    expect(result.changed).toBe(false);
    expect(result.body).toBe(body);
  });

  it("여러 내부 소제목이 섞인 전체 예시를 한 번에 정리한다", () => {
    const input = [
      "# 반도체 수출 급증",
      "",
      "**리드문**",
      "",
      "한국의 연간 수출액이...",
      "",
      "**본문**",
      "",
      "핵심 내용입니다.",
      "",
      "**배경 설명**",
      "",
      "이런 배경이 있습니다.",
      "",
      "**쟁점**",
      "",
      "우려도 있습니다.",
      "",
      "**향후 확인할 점**",
      "",
      "확인할 변수입니다.",
      "",
      "**출처**",
      "",
      "- 기관A",
    ].join("\n");

    const result = sanitizeInternalSectionHeadings(input);
    expect(result.changed).toBe(true);
    expect(result.affectedKeys).toEqual(["lead", "body", "background", "issues", "future_checks", "sources"]);
    expect(result.body).not.toContain("리드문");
    expect(result.body).not.toContain("**본문**");
    expect(result.body).not.toContain("**배경 설명**");
    expect(result.body).not.toContain("**쟁점**");
    expect(result.body).not.toContain("**향후 확인할 점**");
    expect(result.body).not.toContain("**출처**");
    expect(result.body).toContain("한국의 연간 수출액이...");
  });
});

describe("detectInternalSectionHeadings", () => {
  it("내부 소제목이 없으면 빈 배열을 반환한다", () => {
    expect(detectInternalSectionHeadings("## 왜 지금 중요한가\n\n내용")).toEqual([]);
  });

  it("내부 소제목이 있으면 키 목록을 반환한다(수정하지 않는다)", () => {
    const body = "## 본문\n\n내용\n\n## 쟁점\n\n내용";
    expect(detectInternalSectionHeadings(body)).toEqual(["body", "issues"]);
  });

  it("null/undefined는 빈 배열을 반환한다", () => {
    expect(detectInternalSectionHeadings(null)).toEqual([]);
    expect(detectInternalSectionHeadings(undefined)).toEqual([]);
  });
});
