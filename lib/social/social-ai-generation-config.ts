// Phase 3-2: 실제 Claude API 호출 여부를 제어하는 feature flag.
// 기본값은 항상 false다 (mock/dry-run으로만 검증). 실제 AI 호출 구현
// 자체는 다음 단계로 미루며, true로 설정해도 이번 단계는 구조만 준비한다.

export function isSocialAiGenerationEnabled(): boolean {
  return process.env.SOCIAL_AI_GENERATION_ENABLED === "true";
}
