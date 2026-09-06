// Phase 3-2/3-3: 실제 Claude API 호출 여부와 관련 설정을 제어하는 feature
// flag/설정값. 기본값은 항상 안전한 값(비활성화, 적당한 토큰/온도)이다.
// ANTHROPIC_API_KEY는 기존 lib/ai/anthropic-client.ts의 서버 전용 client를
// 그대로 재사용하며, 이 파일에서 API key를 직접 다루지 않는다.

const DEFAULT_SOCIAL_AI_MODEL = "claude-sonnet-4-5";
// wordpress_blog는 post_body 목표 길이가 2,500~4,000자(한국어)이고, 같은
// JSON 응답 안에 seoTitle/metaDescription/answerSummary/eeatNotes/
// geoSummary/structuredDataSuggestions/titleCandidates 등 metadata까지
// 함께 생성해야 한다. 처음 기본값(3000)은 물론 6000/8000도 실측 결과
// 부족했다 — 실제 제주 주거지원 정책 기사로 재생성 검증한 결과 post_body
// 4,603자 + metadata를 합쳐 outputTokens가 7,961까지 나왔고, 같은 article로
// 다시 생성했을 때는 8,000에서도 잘렸다(stop_reason: "max_tokens" → JSON
// 파싱 실패). 안전 여유를 두기 위해 12000으로 올렸다. 다른
// 플랫폼(naver_blog/x/threads/instagram 등)은 이 값을 그대로 상한선으로만
// 쓸 뿐 실제 출력 길이를 강제로 늘리지 않는다(각 플랫폼 프롬프트가
// 스스로 짧게 쓴다) — 비용은 max_tokens 상한이 아니라 실제 사용
// 토큰(usage.outputTokens) 기준으로 청구되므로, 상한을 올린다고 다른
// 플랫폼의 비용이 늘지는 않는다. 다만 wordpress_blog가 실제로 더 긴
// 응답을 생성하게 되면 그만큼 비용이 늘 수 있다는 점은 인지한다.
const DEFAULT_SOCIAL_AI_MAX_TOKENS = 12000;
const DEFAULT_SOCIAL_AI_TEMPERATURE = 0.7;

export function isSocialAiGenerationEnabled(): boolean {
  return process.env.SOCIAL_AI_GENERATION_ENABLED === "true";
}

/** SOCIAL_AI_MODEL이 없으면 안전한 기본 모델명을 사용한다. */
export function getSocialAiModel(): string {
  const raw = process.env.SOCIAL_AI_MODEL;
  return raw && raw.trim().length > 0 ? raw.trim() : DEFAULT_SOCIAL_AI_MODEL;
}

/** SOCIAL_AI_MAX_TOKENS가 없거나 유효하지 않으면 기본값(12000)을 사용한다. */
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
