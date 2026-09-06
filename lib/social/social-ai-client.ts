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
 * 모델이 JSON 앞뒤로 설명 문구를 덧붙이거나(예: "다음은 요청하신 글입니다:\n```json...")
 * code fence를 닫지 않은 채(응답이 중간에 잘린 경우) 응답할 때를 대비해,
 * 첫 `{`부터 마지막 `}`까지를 다시 한 번 추출해본다. wordpress_blog처럼
 * post_body가 길고 metadata 필드가 많은 응답은 code fence 하나로 깔끔하게
 * 감싸지지 않는 경우가 있어 stripCodeFence만으로는 부족할 수 있다.
 */
function extractJsonObjectSubstring(text: string): string | null {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  return text.slice(firstBrace, lastBrace + 1);
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
      // code fence가 온전히 감싸지 못했거나(설명 문구가 앞뒤에 붙음) 응답이
      // 중간에 잘렸을 수 있으니, 첫 { ~ 마지막 }를 다시 추출해 한 번 더 시도한다.
      const fallback = extractJsonObjectSubstring(cleaned);
      if (fallback) {
        try {
          parsed = JSON.parse(fallback);
        } catch {
          parsed = undefined;
        }
      }

      if (parsed === undefined) {
        // max_tokens에 도달해 응답이 중간에 잘린 경우(stop_reason: "max_tokens")를
        // 구분해서 알려준다 — 이 경우는 SOCIAL_AI_MAX_TOKENS를 늘려야 해결된다.
        const truncated = response.stop_reason === "max_tokens";
        return {
          ok: false,
          error: truncated
            ? `AI 응답이 max_tokens(${input.maxTokens}) 제한에 도달해 중간에 잘렸습니다 — SOCIAL_AI_MAX_TOKENS를 늘려야 합니다.`
            : "AI 응답을 JSON으로 파싱하지 못했습니다.",
        };
      }
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
