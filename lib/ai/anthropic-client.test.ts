import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ANTHROPIC_MODEL, getAnthropicClient } from "./anthropic-client";

let originalApiKey: string | undefined;

beforeEach(() => {
  originalApiKey = process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalApiKey;
});

describe("getAnthropicClient", () => {
  it("ANTHROPIC_API_KEY가 없으면 명확한 오류를 던진다", () => {
    delete process.env.ANTHROPIC_API_KEY;

    expect(() => getAnthropicClient()).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("ANTHROPIC_API_KEY가 있으면 client를 생성한다", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";

    expect(() => getAnthropicClient()).not.toThrow();
  });
});

describe("ANTHROPIC_MODEL", () => {
  it("evals/article-quality.v1.eval.yaml의 model.name과 일치한다", () => {
    expect(ANTHROPIC_MODEL).toBe("claude-sonnet-4-6");
  });
});
