import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const PLATFORM_PROMPT_FILES = [
  "wordpress-blog.md",
  "naver-blog.md",
  "naver-cafe.md",
  "x-thread.md",
  "threads.md",
  "instagram-caption.md",
];

const TONE_PROMPT_FILES = [
  "explanatory.md",
  "informational.md",
  "persuasive.md",
  "warning.md",
  "loss-aversion.md",
  "curiosity.md",
  "comparison.md",
  "story.md",
];

const SAFETY_PROMPT_FILES = [
  "no-threat.md",
  "no-fearmongering.md",
  "no-ad-click-inducement.md",
  "no-false-claim.md",
  "no-copyright-copy.md",
  "no-sensitive-personal-data.md",
];

const CONTRACT_SCHEMA_FILES = [
  "wordpress-blog.schema.json",
  "naver-blog.schema.json",
  "naver-cafe.schema.json",
  "x-thread.schema.json",
  "threads.schema.json",
  "instagram-caption.schema.json",
];

describe("prompts/social/*.md", () => {
  it.each(PLATFORM_PROMPT_FILES)("%s 파일이 존재한다", (fileName) => {
    expect(existsSync(join(ROOT, "prompts", "social", fileName))).toBe(true);
  });
});

describe("prompts/tones/*.md", () => {
  it.each(TONE_PROMPT_FILES)("%s 파일이 존재한다", (fileName) => {
    expect(existsSync(join(ROOT, "prompts", "tones", fileName))).toBe(true);
  });
});

describe("prompts/safety/*.md", () => {
  it.each(SAFETY_PROMPT_FILES)("%s 파일이 존재한다", (fileName) => {
    expect(existsSync(join(ROOT, "prompts", "safety", fileName))).toBe(true);
  });
});

describe("prompts/social/wordpress-blog.md 구조 강화 지시 (Phase 2-24)", () => {
  const content = readFileSync(join(ROOT, "prompts", "social", "wordpress-blog.md"), "utf-8");

  it('핵심 요약 박스를 <div class="summary-box">HTML로 지시한다', () => {
    expect(content).toContain('<div class="summary-box">');
    expect(content).toContain("summary-box");
    expect(content).toContain("key-points-box");
    expect(content).toContain("checklist-box");
    expect(content).toContain("warning-box");
    expect(content).toContain("source-box");
  });

  it("inline style을 금지한다", () => {
    expect(content).toMatch(/inline\s*`?style/);
  });

  it("FAQ 최소 4개를 요구한다", () => {
    expect(content).toMatch(/FAQ는 최소 4개/);
  });

  it("경제/금융/정책/제도 주제에 자료 기준일 안내를 요구한다", () => {
    expect(content).toContain("기준일 안내");
  });

  it("최소 1개 이상의 markdown table을 요구한다", () => {
    expect(content).toMatch(/비교표\(최소 1개/);
  });
});

describe("prompts/social/naver-cafe.md 구조 강화 지시 (Phase 3-20)", () => {
  const content = readFileSync(join(ROOT, "prompts", "social", "naver-cafe.md"), "utf-8");

  it("markdown heading/HTML 태그/굵게(**)/표 사용을 금지한다", () => {
    expect(content).toContain("markdown heading 금지");
    expect(content).toContain("HTML 태그 금지");
    expect(content).toContain("굵게 표시(`**`) 금지");
    expect(content).toContain("표(table) 금지");
  });

  it("plain text로 작성해야 한다고 명시한다", () => {
    expect(content).toContain("plain text");
  });

  it("700~1200자 권장 길이를 명시한다", () => {
    expect(content).toContain("700~1,200자");
  });

  it("제목은 질문형/공감형으로 작성하도록 안내한다", () => {
    expect(content).toContain("질문형 또는 공감형");
  });

  it("본문 마지막에 회원에게 묻는 질문 3~5개를 요구한다", () => {
    expect(content).toMatch(/질문[^\n]*3~5개/);
  });

  it("export/dry-run/handoff payload에 내부 관리 정보를 포함하지 않는다고 명시한다", () => {
    expect(content).toContain("quality_status/approval_status");
    expect(content).toContain("localhost 링크");
  });
});

describe("contracts/social/*.schema.json", () => {
  it.each(CONTRACT_SCHEMA_FILES)("%s 파일이 존재하고 유효한 JSON이다", (fileName) => {
    const filePath = join(ROOT, "contracts", "social", fileName);
    expect(existsSync(filePath)).toBe(true);

    const raw = readFileSync(filePath, "utf-8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
