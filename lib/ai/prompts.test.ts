import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PROMPTS_DIR = join(process.cwd(), "prompts");

const requiredPromptFiles = [
  "source-summary.v1.md",
  "article-draft.v1.md",
  "article-eval.v1.md",
];

describe("prompts/*.v1.md", () => {
  it.each(requiredPromptFiles)("%s 파일이 존재한다", (fileName) => {
    expect(existsSync(join(PROMPTS_DIR, fileName))).toBe(true);
  });
});

describe("prompts/article-draft.v1.md", () => {
  const content = readFileSync(join(PROMPTS_DIR, "article-draft.v1.md"), "utf-8");

  it("표절 방지: 15단어 이상 연속 복사 금지 조건이 포함되어 있다", () => {
    expect(content).toContain("15단어");
  });

  it("표절 방지: 출처 요약 단순 나열 금지 조건이 포함되어 있다", () => {
    expect(content).toContain("단순 나열");
  });

  it("표절 방지: 출처 요약 복사 금지 조건이 포함되어 있다", () => {
    expect(content.toLowerCase()).toMatch(/복사|붙여 넣/);
  });

  it("구조: 7개 섹션 (리드문, 배경, 핵심 쟁점, 공통점과 차이점, 독자, 전망) 언급이 있다", () => {
    expect(content).toContain("리드문");
    expect(content).toContain("배경");
    expect(content).toContain("핵심 쟁점");
    expect(content).toContain("공통점과 차이점");
    expect(content).toContain("향후 전망");
  });

  it("종합: 최소 3개 출처를 종합해야 한다는 조건이 포함되어 있다", () => {
    expect(content).toContain("3개 이상");
  });
});

describe("prompts/article-eval.v1.md", () => {
  const content = readFileSync(join(PROMPTS_DIR, "article-eval.v1.md"), "utf-8");

  it("Phase 1-8 신규 기준: originality 기준이 포함되어 있다", () => {
    expect(content).toContain("originality");
  });

  it("Phase 1-8 신규 기준: synthesis 기준이 포함되어 있다", () => {
    expect(content).toContain("synthesis");
  });

  it("Phase 1-8 신규 기준: copy-risk 기준이 포함되어 있다", () => {
    expect(content).toContain("copy-risk");
  });

  it("Phase 1-8 신규 기준: source-integration 기준이 포함되어 있다", () => {
    expect(content).toContain("source-integration");
  });

  it("gate 조건: copy-risk gate 설명이 포함되어 있다", () => {
    expect(content).toMatch(/copy.risk.*(4|gate|강제)/i);
  });

  it("15단어 복사 평가 기준이 포함되어 있다", () => {
    expect(content).toContain("15단어");
  });
});
