import { afterEach, describe, expect, it } from "vitest";
import {
  isSocialAiGenerationEnabled,
  getSocialAiModel,
  getSocialAiMaxTokens,
  getSocialAiTemperature,
} from "./social-ai-generation-config";

const ENV_KEYS = ["SOCIAL_AI_GENERATION_ENABLED", "SOCIAL_AI_MODEL", "SOCIAL_AI_MAX_TOKENS", "SOCIAL_AI_TEMPERATURE"] as const;
const originalEnv: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) originalEnv[key] = process.env[key];

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe("isSocialAiGenerationEnabled", () => {
  it("SOCIAL_AI_GENERATION_ENABLED=true일 때만 true다", () => {
    process.env.SOCIAL_AI_GENERATION_ENABLED = "true";
    expect(isSocialAiGenerationEnabled()).toBe(true);
  });

  it("설정하지 않으면 false다(기본 비활성화)", () => {
    delete process.env.SOCIAL_AI_GENERATION_ENABLED;
    expect(isSocialAiGenerationEnabled()).toBe(false);
  });
});

describe("getSocialAiModel", () => {
  it("SOCIAL_AI_MODEL이 없으면 기본 모델명을 사용한다", () => {
    delete process.env.SOCIAL_AI_MODEL;
    expect(getSocialAiModel()).toBe("claude-sonnet-4-5");
  });

  it("SOCIAL_AI_MODEL이 있으면 그 값을 사용한다", () => {
    process.env.SOCIAL_AI_MODEL = "claude-opus-4-8";
    expect(getSocialAiModel()).toBe("claude-opus-4-8");
  });
});

describe("getSocialAiMaxTokens", () => {
  it("SOCIAL_AI_MAX_TOKENS가 없으면 기본값 12000을 사용한다 (실제 재생성 검증 결과 6000/8000도 잘려서 상향)", () => {
    delete process.env.SOCIAL_AI_MAX_TOKENS;
    expect(getSocialAiMaxTokens()).toBe(12000);
  });

  it("유효한 값이 있으면 그 값을 사용한다", () => {
    process.env.SOCIAL_AI_MAX_TOKENS = "16000";
    expect(getSocialAiMaxTokens()).toBe(16000);
  });

  it("유효하지 않은 값(0 이하, 숫자 아님)이면 기본값을 사용한다", () => {
    process.env.SOCIAL_AI_MAX_TOKENS = "0";
    expect(getSocialAiMaxTokens()).toBe(12000);
    process.env.SOCIAL_AI_MAX_TOKENS = "abc";
    expect(getSocialAiMaxTokens()).toBe(12000);
  });
});

describe("getSocialAiTemperature", () => {
  it("SOCIAL_AI_TEMPERATURE가 없으면 기본값 0.7을 사용한다", () => {
    delete process.env.SOCIAL_AI_TEMPERATURE;
    expect(getSocialAiTemperature()).toBe(0.7);
  });

  it("0~1 범위를 벗어나면 기본값을 사용한다", () => {
    process.env.SOCIAL_AI_TEMPERATURE = "1.5";
    expect(getSocialAiTemperature()).toBe(0.7);
  });
});
