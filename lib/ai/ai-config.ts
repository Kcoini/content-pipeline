// Phase 1-4: AI 기사 생성 feature flag 및 provider 선택 유틸.
// AI_GENERATION_ENABLED, AI_PROVIDER, ANTHROPIC_API_KEY 환경 변수를 읽어
// mock generator와 실제 AI generator 중 무엇을 사용할지 결정한다.
// 서버 코드(Server Action 등)에서만 사용한다.

export type AiProvider = "anthropic";

/** AI_GENERATION_ENABLED=true일 때만 AI 호출을 허용한다. */
export function isAiGenerationEnabled(): boolean {
  return process.env.AI_GENERATION_ENABLED === "true";
}

/** AI_PROVIDER 환경 변수 값을 그대로 반환한다 (기본값 "anthropic"). */
export function getAiProvider(): string {
  return process.env.AI_PROVIDER || "anthropic";
}

/**
 * AI_GENERATION_ENABLED=true이고 AI_PROVIDER=anthropic이고 ANTHROPIC_API_KEY가
 * 설정되어 있으면 true를 반환한다. 이 값이 false이면 mock generator를 사용해야 한다.
 */
export function shouldUseAnthropic(): boolean {
  return (
    isAiGenerationEnabled() &&
    getAiProvider() === "anthropic" &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  );
}
