import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const messagesCreate = vi.fn();
const getAnthropicClient = vi.fn();

vi.mock("@/lib/ai/anthropic-client", () => ({
  getAnthropicClient: (...args: unknown[]) => getAnthropicClient(...args),
}));

const { generateSocialPostWithAI } = await import("./social-ai-client");

function baseInput(overrides: Partial<Parameters<typeof generateSocialPostWithAI>[0]> = {}) {
  return {
    systemPrompt: "system",
    userPrompt: "user",
    platform: "naver_blog" as const,
    toneStyle: "informational" as const,
    contractName: "naver-blog.schema.json",
    maxTokens: 1000,
    temperature: 0.5,
    ...overrides,
  };
}

beforeEach(() => {
  messagesCreate.mockReset();
  getAnthropicClient.mockReset();
  getAnthropicClient.mockReturnValue({ messages: { create: messagesCreate } });
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateSocialPostWithAI", () => {
  it("SOCIAL_AI_GENERATION_ENABLED=false이면 API를 호출하지 않는다", async () => {
    vi.stubEnv("SOCIAL_AI_GENERATION_ENABLED", "false");

    const result = await generateSocialPostWithAI(baseInput());

    expect(result.ok).toBe(false);
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it("SOCIAL_AI_GENERATION_ENABLED=true이면 API를 호출하고 JSON을 파싱한다", async () => {
    vi.stubEnv("SOCIAL_AI_GENERATION_ENABLED", "true");
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ post_title: "제목", post_body: "본문" }) }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await generateSocialPostWithAI(baseInput());

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ post_title: "제목", post_body: "본문" });
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
  });

  it("markdown code fence가 있어도 파싱 전에 제거한다", async () => {
    vi.stubEnv("SOCIAL_AI_GENERATION_ENABLED", "true");
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "```json\n" + JSON.stringify({ post_body: "본문" }) + "\n```" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await generateSocialPostWithAI(baseInput());

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ post_body: "본문" });
  });

  it("JSON 파싱에 실패하면 안전한 오류를 반환한다", async () => {
    vi.stubEnv("SOCIAL_AI_GENERATION_ENABLED", "true");
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "이것은 JSON이 아닙니다" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await generateSocialPostWithAI(baseInput());

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("예외가 발생해도 Runtime Error로 터지지 않고 안전한 실패를 반환한다", async () => {
    vi.stubEnv("SOCIAL_AI_GENERATION_ENABLED", "true");
    messagesCreate.mockRejectedValue(new Error("network down"));

    const result = await generateSocialPostWithAI(baseInput());

    expect(result.ok).toBe(false);
    expect(result.error).toContain("network down");
  });

  it("오류 메시지에서 API key로 의심되는 패턴을 제거한다", async () => {
    vi.stubEnv("SOCIAL_AI_GENERATION_ENABLED", "true");
    messagesCreate.mockRejectedValue(new Error("auth failed with sk-ant-api03-abcdefg12345"));

    const result = await generateSocialPostWithAI(baseInput());

    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("sk-ant-api03-abcdefg12345");
  });
});
