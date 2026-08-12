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

describe("contracts/social/*.schema.json", () => {
  it.each(CONTRACT_SCHEMA_FILES)("%s 파일이 존재하고 유효한 JSON이다", (fileName) => {
    const filePath = join(ROOT, "contracts", "social", fileName);
    expect(existsSync(filePath)).toBe(true);

    const raw = readFileSync(filePath, "utf-8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
