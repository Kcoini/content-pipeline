// Phase 3-2/3-3: 실제 Claude API 호출 여부와 관련 설정을 제어하는 feature
// flag/설정값. 기본값은 항상 안전한 값(비활성화, 적당한 토큰/온도)이다.
// ANTHROPIC_API_KEY는 기존 lib/ai/anthropic-client.ts의 서버 전용 client를
// 그대로 재사용하며, 이 파일에서 API key를 직접 다루지 않는다.

const DEFAULT_SOCIAL_AI_MODEL = "claude-sonnet-4-5";
const DEFAULT_SOCIAL_AI_MAX_TOKENS = 3000;
const DEFAULT_SOCIAL_AI_TEMPERATURE = 0.7;

export function isSocialAiGenerationEnabled(): boolean {
  return process.env.SOCIAL_AI_GENERATION_ENABLED === "true";
}

/** SOCIAL_AI_MODEL이 없으면 안전한 기본 모델명을 사용한다. */
export function getSocialAiModel(): string {
  const raw = process.env.SOCIAL_AI_MODEL;
  return raw && raw.trim().length > 0 ? raw.trim() : DEFAULT_SOCIAL_AI_MODEL;
}

/** SOCIAL_AI_MAX_TOKENS가 없거나 유효하지 않으면 기본값(3000)을 사용한다. */
export function getSocialAiMaxTokens(): number {
  const raw = process.env.SOCIAL_AI_MAX_TOKENS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_SOCIAL_AI_MAX_TOKENS;
}

/** SOCIAL_AI_TEMPERATURE가 없거나 0~1 범위를 벗어나면 기본값(0.7)을 사용한다. */
export function getSocialAiTemperature(): number {
  const raw = process.env.SOCIAL_AI_TEMPERATURE;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : DEFAULT_SOCIAL_AI_TEMPERATURE;
}
