import { afterEach, describe, expect, it, vi } from "vitest";
import { mockImageProvider } from "./mock-image-provider";
import { openaiImageProvider } from "./openai-image-provider";
import { customImageProvider } from "./custom-image-provider";
import { getImageProviderClient } from "./index";
import type { ImageGenerationRequest } from "../image-generation-types";

function makeRequest(overrides: Partial<ImageGenerationRequest> = {}): ImageGenerationRequest {
  return {
    articleId: "article-1",
    provider: "mock",
    prompt: "A clean editorial illustration of a topic, no text in image, 16:9 aspect ratio.",
    negativePrompt: "text overlay, watermark, logo",
    aspectRatio: "16:9",
    articleMode: "monetized_blog",
    dryRun: true,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mockImageProvider", () => {
  it("실제 외부 API를 호출하지 않고 generated 상태와 mock URL을 반환한다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await mockImageProvider.generateImage(makeRequest());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe("generated");
    expect(result.provider).toBe("mock");
    expect(result.imageUrl).toBe("/mock/generated-images/article-1.webp");
    expect(result.width).toBe(1536);
    expect(result.height).toBe(864);
    expect(result.format).toBe("webp");

    vi.unstubAllGlobals();
  });

  it("aspect ratio에 맞는 크기를 반환한다", async () => {
    const result = await mockImageProvider.generateImage(makeRequest({ aspectRatio: "1:1" }));
    expect(result.width).toBe(1024);
    expect(result.height).toBe(1024);
  });
});

describe("openaiImageProvider", () => {
  it("IMAGE_GENERATION_ENABLED=false(기본값)이면 mock으로 안전하게 대체한다", async () => {
    vi.stubEnv("IMAGE_GENERATION_ENABLED", "false");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await openaiImageProvider.generateImage(makeRequest());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe("generated");
    expect(result.provider).toBe("openai");
    expect(result.metadata.disabled).toBe(true);

    vi.unstubAllGlobals();
  });

  it("IMAGE_GENERATION_ENABLED=true인데 OPENAI_API_KEY가 없으면 failed를 반환한다", async () => {
    vi.stubEnv("IMAGE_GENERATION_ENABLED", "true");
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const result = await openaiImageProvider.generateImage(makeRequest());

    expect(result.status).toBe("failed");
    expect(result.error).toContain("OPENAI_API_KEY");

    if (original !== undefined) process.env.OPENAI_API_KEY = original;
  });

  it("두 조건이 모두 충족되어도 실제 호출은 구현되지 않아 failed를 반환한다 (예외를 던지지 않는다)", async () => {
    vi.stubEnv("IMAGE_GENERATION_ENABLED", "true");
    process.env.OPENAI_API_KEY = "test-key-not-real";

    const result = await openaiImageProvider.generateImage(makeRequest());

    expect(result.status).toBe("failed");
    expect(result.error).toBeTruthy();

    delete process.env.OPENAI_API_KEY;
  });
});

describe("customImageProvider", () => {
  it("IMAGE_GENERATION_ENABLED=false(기본값)이면 mock으로 안전하게 대체한다", async () => {
    vi.stubEnv("IMAGE_GENERATION_ENABLED", "false");

    const result = await customImageProvider.generateImage(makeRequest());

    expect(result.status).toBe("generated");
    expect(result.provider).toBe("custom");
    expect(result.metadata.disabled).toBe(true);
  });

  it("IMAGE_GENERATION_ENABLED=true여도 실제 구현이 없어 failed를 반환한다", async () => {
    vi.stubEnv("IMAGE_GENERATION_ENABLED", "true");

    const result = await customImageProvider.generateImage(makeRequest());

    expect(result.status).toBe("failed");
    expect(result.error).toBeTruthy();
  });
});

describe("getImageProviderClient", () => {
  it("provider별로 올바른 client를 반환한다", () => {
    expect(getImageProviderClient("mock")).toBe(mockImageProvider);
    expect(getImageProviderClient("openai")).toBe(openaiImageProvider);
    expect(getImageProviderClient("custom")).toBe(customImageProvider);
  });
});
