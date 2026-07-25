import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getImageGenerationProvider,
  isImageGenerationEnabled,
  getImageGenerationTimeoutMs,
  getDefaultImageModel,
  getDefaultDimensions,
} from "./image-generation-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getImageGenerationProvider", () => {
  it("기본값(미설정)은 mock이다", () => {
    vi.stubEnv("IMAGE_GENERATION_PROVIDER", "");
    expect(getImageGenerationProvider()).toBe("mock");
  });

  it("유효한 값을 그대로 사용한다", () => {
    vi.stubEnv("IMAGE_GENERATION_PROVIDER", "openai");
    expect(getImageGenerationProvider()).toBe("openai");
  });

  it("잘못된 값이면 mock으로 대체한다", () => {
    vi.stubEnv("IMAGE_GENERATION_PROVIDER", "invalid-provider");
    expect(getImageGenerationProvider()).toBe("mock");
  });
});

describe("isImageGenerationEnabled", () => {
  it("기본값(미설정)은 false이다", () => {
    vi.stubEnv("IMAGE_GENERATION_ENABLED", "");
    expect(isImageGenerationEnabled()).toBe(false);
  });

  it("true로 설정하면 true를 반환한다", () => {
    vi.stubEnv("IMAGE_GENERATION_ENABLED", "true");
    expect(isImageGenerationEnabled()).toBe(true);
  });
});

describe("getImageGenerationTimeoutMs", () => {
  it("기본값은 30000ms이다", () => {
    vi.stubEnv("IMAGE_GENERATION_TIMEOUT_MS", "");
    expect(getImageGenerationTimeoutMs()).toBe(30000);
  });

  it("환경변수로 재정의할 수 있다", () => {
    vi.stubEnv("IMAGE_GENERATION_TIMEOUT_MS", "5000");
    expect(getImageGenerationTimeoutMs()).toBe(5000);
  });
});

describe("getDefaultImageModel", () => {
  it("비어있으면 undefined를 반환한다", () => {
    vi.stubEnv("IMAGE_GENERATION_DEFAULT_MODEL", "");
    expect(getDefaultImageModel()).toBeUndefined();
  });

  it("설정되어 있으면 그대로 반환한다", () => {
    vi.stubEnv("IMAGE_GENERATION_DEFAULT_MODEL", "dall-e-3");
    expect(getDefaultImageModel()).toBe("dall-e-3");
  });
});

describe("getDefaultDimensions", () => {
  it("16:9는 1536x864이다", () => {
    expect(getDefaultDimensions("16:9")).toEqual({ width: 1536, height: 864 });
  });

  it("4:3은 1200x900이다", () => {
    expect(getDefaultDimensions("4:3")).toEqual({ width: 1200, height: 900 });
  });

  it("1:1은 1024x1024이다", () => {
    expect(getDefaultDimensions("1:1")).toEqual({ width: 1024, height: 1024 });
  });

  it("알 수 없는 비율이면 16:9 기본값을 사용한다", () => {
    expect(getDefaultDimensions("21:9")).toEqual({ width: 1536, height: 864 });
  });
});
