// Phase 3-3: 실제 Claude API를 호출해 social post 초안을 생성하는 client.
// 기존 lib/ai/anthropic-client.ts의 서버 전용 client를 재사용한다.
// SOCIAL_AI_GENERATION_ENABLED=false이면 이 함수는 호출되지 않아야 하며,
// 호출되더라도 즉시 안전한 실패를 반환한다. full prompt/full response는
// 반환값에 포함하지 않고, 오류 메시지에서도 민감정보로 보일 수 있는
// 패턴을 제거한다.

import { getAnthropicClient } from "@/lib/ai/anthropic-client";
import { isSocialAiGenerationEnabled, getSocialAiModel } from "./social-ai-generation-config";
import type { SocialPlatform, ToneStyle } from "./social-platform-types";

export interface GenerateSocialPostWithAiInput {
  systemPrompt: string;
  userPrompt: string;
  platform: SocialPlatform;
  toneStyle: ToneStyle;
  contractName: string;
  maxTokens: number;
  temperature: number;
}

export interface GenerateSocialPostWithAiUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface GenerateSocialPostWithAiResult {
  ok: boolean;
  output?: Record<string, unknown>;
  error?: string;
  usage?: GenerateSocialPostWithAiUsage;
}

/** API key/토큰으로 의심되는 패턴을 오류 메시지에서 제거한다 (방어적 조치). */
function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/sk-ant-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/Basic\s+[a-zA-Z0-9+/=]+/gi, "Basic [redacted]");
}

/** 응답 텍스트에서 markdown code fence(```json ... ```)를 제거한다. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

/**
 * 실제 Claude API를 호출해 social post 출력을 생성한다.
 * SOCIAL_AI_GENERATION_ENABLED=false이면 API를 호출하지 않고 즉시
 * 실패를 반환한다. 응답은 JSON만 파싱하며, 파싱에 실패하거나 JSON
 * 객체가 아니면 안전한 오류를 반환한다.
 */
export async function generateSocialPostWithAI(
  input: GenerateSocialPostWithAiInput
): Promise<GenerateSocialPostWithAiResult> {
  if (!isSocialAiGenerationEnabled()) {
    return {
      ok: false,
      error: "SOCIAL_AI_GENERATION_ENABLED=false이므로 실제 AI 생성을 호출하지 않습니다.",
    };
  }

  try {
    const client = getAnthropicClient();
    const model = getSocialAiModel();

    const response = await client.messages.create({
      model,
      max_tokens: input.maxTokens,
      temperature: input.temperature,
      system: input.systemPrompt,
      messages: [{ role: "user", content: input.userPrompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "AI 응답에서 텍스트 블록을 찾을 수 없습니다." };
    }

    const cleaned = stripCodeFence(textBlock.text);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return { ok: false, error: "AI 응답을 JSON으로 파싱하지 못했습니다." };
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "AI 응답이 JSON 객체 형식이 아닙니다." };
    }

    return {
      ok: true,
      output: parsed as Record<string, unknown>,
      usage: {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return { ok: false, error: sanitizeErrorMessage(message) };
  }
}
