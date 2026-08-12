// Phase 3-10: Performance-based Rewrite Suggestion — AI 사용 여부 설정.
// SOCIAL_REWRITE_AI_ENABLED=false(기본값)이면 rule-based/mock suggestion만
// 생성한다. true로 바뀌어도 이번 단계는 실제 Claude API 호출을
// 구현하지 않는다(다음 단계에서 연결 예정).

const DEFAULT_SOCIAL_REWRITE_AI_MODEL = "claude-sonnet-4-5";
const DEFAULT_SOCIAL_REWRITE_AI_MAX_TOKENS = 2000;
const DEFAULT_SOCIAL_REWRITE_AI_TEMPERATURE = 0.6;

export function isSocialRewriteAiEnabled(): boolean {
  return process.env.SOCIAL_REWRITE_AI_ENABLED === "true";
}

export function getSocialRewriteAiModel(): string {
  const raw = process.env.SOCIAL_REWRITE_AI_MODEL;
  return raw && raw.trim().length > 0 ? raw.trim() : DEFAULT_SOCIAL_REWRITE_AI_MODEL;
}

export function getSocialRewriteAiMaxTokens(): number {
  const raw = process.env.SOCIAL_REWRITE_AI_MAX_TOKENS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_SOCIAL_REWRITE_AI_MAX_TOKENS;
}

export function getSocialRewriteAiTemperature(): number {
  const raw = process.env.SOCIAL_REWRITE_AI_TEMPERATURE;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : DEFAULT_SOCIAL_REWRITE_AI_TEMPERATURE;
}
