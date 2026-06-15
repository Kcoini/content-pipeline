// Phase 1-4: 서버 전용 Anthropic client.
// ANTHROPIC_API_KEY는 서버 코드(Server Action/Route Handler)에서만 사용하며,
// client component에서 이 파일을 import하면 안 된다.

import Anthropic from "@anthropic-ai/sdk";

let cachedClient: Anthropic | undefined;

/**
 * ANTHROPIC_API_KEY를 사용해 Anthropic client를 생성한다.
 * API key가 없으면 명확한 오류를 던진다.
 */
export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다. " +
        ".env.local에 ANTHROPIC_API_KEY를 설정하세요."
    );
  }

  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey });
  }

  return cachedClient;
}

export const ANTHROPIC_MODEL = "claude-sonnet-4-6";
