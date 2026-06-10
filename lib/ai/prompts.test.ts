import { existsSync } from "node:fs";
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
