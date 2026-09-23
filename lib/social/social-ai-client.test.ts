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

  it("설명 문구가 code fence 앞뒤에 붙어 있어도 첫 {~마지막 }를 추출해 파싱한다", async () => {
    vi.stubEnv("SOCIAL_AI_GENERATION_ENABLED", "true");
    messagesCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: "다음은 요청하신 wordpress_blog 글입니다:\n\n```json\n" + JSON.stringify({ post_body: "본문" }) + "\n```\n\n이상입니다.",
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await generateSocialPostWithAI(baseInput());

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ post_body: "본문" });
  });

  it("max_tokens 제한으로 응답이 잘려 JSON 파싱에 실패하면 그 사실을 명시한 오류를 반환한다", async () => {
    vi.stubEnv("SOCIAL_AI_GENERATION_ENABLED", "true");
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"post_title": "제목", "post_body": "본문이 중간에 잘림' }],
      usage: { input_tokens: 10, output_tokens: 6000 },
      stop_reason: "max_tokens",
    });

    const result = await generateSocialPostWithAI(baseInput({ maxTokens: 6000 }));

    expect(result.ok).toBe(false);
    expect(result.error).toContain("max_tokens");
    expect(result.error).toContain("SOCIAL_AI_MAX_TOKENS");
  });

  it("OPS-02A 재현: 문자열 값 안의 이스케이프 안 된 큰따옴표(대화/인용)로 JSON이 깨지면 안전한 실패를 반환한다(추측 복구 금지)", async () => {
    // OPS-01 Pilot C에서 실제로 재현된 실패 형태 그대로 — threads+story
    // 조합에서 모델이 대화를 인용하며 "..."를 이스케이프 없이 그대로 써서
    // JSON 문자열이 중간에 끊긴다. code fence는 정상이고 stop_reason도
    // end_turn(잘림 아님)이라 markdown_fence/max_tokens 복구 경로로는
    // 고칠 수 없다 — 이런 경우 "그럴듯하게" 복구를 시도하지 않고 안전한
        // 실패로 남기는 것이 의도된 동작이다(social-prompt-assembler.ts에
    // 예방 지침을 추가했지만, 예방이 100%가 아닐 수 있으므로 이
    // 실패 처리 경로 자체도 회귀 테스트로 고정한다).
    vi.stubEnv("SOCIAL_AI_GENERATION_ENABLED", "true");
    messagesCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text:
            "```json\n{\n  \"platform\": \"threads\",\n  \"tone_style\": \"story\",\n  \"post_body\": \"친구가 물었던 건 \"배터리 얼마나 가냐\"는 거였어요.\",\n  \"hashtags\": []\n}\n```",
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
      stop_reason: "end_turn",
    });

    const result = await generateSocialPostWithAI(baseInput({ platform: "threads", toneStyle: "story" }));

    expect(result.ok).toBe(false);
    expect(result.error).toBe("AI 응답을 JSON으로 파싱하지 못했습니다.");
    expect(result.output).toBeUndefined();
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
