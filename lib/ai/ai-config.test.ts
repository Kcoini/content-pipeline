import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAiProvider, isAiGenerationEnabled, shouldUseAnthropic } from "./ai-config";

const ENV_KEYS = ["AI_GENERATION_ENABLED", "AI_PROVIDER", "ANTHROPIC_API_KEY"] as const;

let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  originalEnv = {};
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe("isAiGenerationEnabled", () => {
  it("AI_GENERATION_ENABLED가 설정되지 않으면 false를 반환한다", () => {
    expect(isAiGenerationEnabled()).toBe(false);
  });

  it("AI_GENERATION_ENABLED=true이면 true를 반환한다", () => {
    process.env.AI_GENERATION_ENABLED = "true";
    expect(isAiGenerationEnabled()).toBe(true);
  });

  it("AI_GENERATION_ENABLED=false이면 false를 반환한다", () => {
    process.env.AI_GENERATION_ENABLED = "false";
    expect(isAiGenerationEnabled()).toBe(false);
  });
});

describe("getAiProvider", () => {
  it("AI_PROVIDER가 설정되지 않으면 기본값 anthropic을 반환한다", () => {
    expect(getAiProvider()).toBe("anthropic");
  });

  it("AI_PROVIDER가 설정되면 해당 값을 반환한다", () => {
    process.env.AI_PROVIDER = "anthropic";
    expect(getAiProvider()).toBe("anthropic");
  });
});

describe("shouldUseAnthropic", () => {
  it("AI_GENERATION_ENABLED=false이면 mock generator를 사용한다 (false)", () => {
    process.env.AI_GENERATION_ENABLED = "false";
    process.env.AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "sk-test";

    expect(shouldUseAnthropic()).toBe(false);
  });

  it("AI_GENERATION_ENABLED=true이지만 ANTHROPIC_API_KEY가 없으면 false를 반환한다", () => {
    process.env.AI_GENERATION_ENABLED = "true";
    process.env.AI_PROVIDER = "anthropic";

    expect(shouldUseAnthropic()).toBe(false);
  });

  it("AI_GENERATION_ENABLED=true, AI_PROVIDER=anthropic, ANTHROPIC_API_KEY가 있으면 true를 반환한다", () => {
    process.env.AI_GENERATION_ENABLED = "true";
    process.env.AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "sk-test";

    expect(shouldUseAnthropic()).toBe(true);
  });

  it("AI_PROVIDER가 anthropic이 아니면 false를 반환한다", () => {
    process.env.AI_GENERATION_ENABLED = "true";
    process.env.AI_PROVIDER = "other";
    process.env.ANTHROPIC_API_KEY = "sk-test";

    expect(shouldUseAnthropic()).toBe(false);
  });
});
