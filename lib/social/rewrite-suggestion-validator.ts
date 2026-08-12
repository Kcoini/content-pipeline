// Phase 3-10: rewrite suggestion 검증.
// 저장하기 전에 다시 한 번 확인한다 — 협박/공포조장/광고클릭유도/과장
// 수익 표현이 있으면 blocked, 내용이 전혀 없으면 blocked, 그 외 사소한
// 문제는 warning으로만 남긴다. 예외를 던지지 않는다.

import { isToneStyle } from "./social-platform-types";
import type { CreateRewriteSuggestionInput } from "./social-rewrite-types";

const THREAT_PATTERNS = ["협박", "가만두지 않겠다", "당장 하지 않으면", "큰일 납니다", "후회하게 될"];
const FEARMONGERING_PATTERNS = ["지금 안 하면 큰일", "모르면 손해", "위험에 처할 수 있습니다"];
const AD_CLICK_BAIT_PATTERNS = ["광고 클릭", "지금 클릭", "클릭하면 돈"];
const INCOME_GUARANTEE_PATTERNS = ["수익 보장", "원금 보장", "확정 수익", "무조건 돈 버는"];
const MAX_SUGGESTION_TEXT_LENGTH = 4000;

export interface RewriteSuggestionValidationResult {
  valid: boolean;
  blocked: boolean;
  errors: string[];
  warnings: string[];
}

function collectSuggestionText(suggestion: CreateRewriteSuggestionInput): string {
  const threadText = (suggestion.suggestedThreadItems ?? []).map((item) => item.text).join(" ");
  const cardText = (suggestion.suggestedCardItems ?? []).map((item) => `${item.heading} ${item.body}`).join(" ");
  return [
    suggestion.suggestedTitle,
    suggestion.suggestedHook,
    suggestion.suggestedCta,
    suggestion.expectedImprovementReason,
    threadText,
    cardText,
  ]
    .filter(Boolean)
    .join(" ");
}

function hasAnySuggestionContent(suggestion: CreateRewriteSuggestionInput): boolean {
  return Boolean(
    suggestion.suggestedTitle?.trim() ||
      suggestion.suggestedHook?.trim() ||
      suggestion.suggestedCta?.trim() ||
      (suggestion.suggestedThreadItems && suggestion.suggestedThreadItems.length > 0) ||
      (suggestion.suggestedCardItems && suggestion.suggestedCardItems.length > 0) ||
      (suggestion.suggestedHashtags && suggestion.suggestedHashtags.length > 0) ||
      (suggestion.suggestedBodyOutline && suggestion.suggestedBodyOutline.length > 0)
  );
}

/**
 * rewrite suggestion을 저장하기 전 검증한다. 예외를 던지지 않고 항상
 * 결과 객체를 반환한다.
 */
export function validateRewriteSuggestion(suggestion: CreateRewriteSuggestionInput): RewriteSuggestionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!suggestion.suggestedChanges || Object.keys(suggestion.suggestedChanges).length === 0) {
    errors.push("suggested_changes가 비어 있습니다.");
  }
  if (!suggestion.diagnosis || Object.keys(suggestion.diagnosis).length === 0) {
    errors.push("diagnosis가 비어 있습니다.");
  }

  if (!hasAnySuggestionContent(suggestion)) {
    errors.push("suggested_title/suggested_hook/suggested_cta/플랫폼별 제안 중 최소 하나는 있어야 합니다.");
  }

  if (suggestion.suggestedToneStyle !== undefined && suggestion.suggestedToneStyle !== null && !isToneStyle(suggestion.suggestedToneStyle)) {
    errors.push(`지원하지 않는 suggested_tone_style입니다: ${suggestion.suggestedToneStyle}`);
  }

  if (suggestion.suggestedThreadItems !== undefined && !Array.isArray(suggestion.suggestedThreadItems)) {
    errors.push("suggested_thread_items는 배열이어야 합니다.");
  }
  if (suggestion.suggestedCardItems !== undefined && !Array.isArray(suggestion.suggestedCardItems)) {
    errors.push("suggested_card_items는 배열이어야 합니다.");
  }
  if (suggestion.suggestedHashtags !== undefined && !Array.isArray(suggestion.suggestedHashtags)) {
    errors.push("suggested_hashtags는 배열이어야 합니다.");
  }

  const text = collectSuggestionText(suggestion);

  const threatFound = THREAT_PATTERNS.filter((pattern) => text.includes(pattern));
  if (threatFound.length > 0) errors.push(`협박성 표현이 발견되었습니다: ${threatFound.join(", ")}`);

  const fearFound = FEARMONGERING_PATTERNS.filter((pattern) => text.includes(pattern));
  if (fearFound.length > 0) errors.push(`공포 조장 표현이 발견되었습니다: ${fearFound.join(", ")}`);

  const adClickFound = AD_CLICK_BAIT_PATTERNS.filter((pattern) => text.includes(pattern));
  if (adClickFound.length > 0) errors.push(`광고 클릭 유도 표현이 발견되었습니다: ${adClickFound.join(", ")}`);

  const incomeFound = INCOME_GUARANTEE_PATTERNS.filter((pattern) => text.includes(pattern));
  if (incomeFound.length > 0) errors.push(`과장 수익 표현이 발견되었습니다: ${incomeFound.join(", ")}`);

  if (text.length > MAX_SUGGESTION_TEXT_LENGTH) {
    warnings.push(`제안 텍스트가 비정상적으로 깁니다(${text.length}자).`);
  }

  const blocked = threatFound.length + fearFound.length + adClickFound.length + incomeFound.length > 0 || !hasAnySuggestionContent(suggestion);

  return { valid: errors.length === 0, blocked, errors, warnings };
}
