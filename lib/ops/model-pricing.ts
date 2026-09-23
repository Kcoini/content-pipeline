// OPS-02B: AI 모델 단가 테이블. 가격 정보와 token usage를 분리한다
// (섹션 7) — 이 파일은 "가격이 얼마인가"만 담당하고, 실제 사용량 집계는
// lib/ops/ai-cost-aggregator.ts가 담당한다.
//
// 중요(섹션 9): 근거 없는 가격을 추정해 코드에 박아 넣지 않는다. 이
// 프로젝트를 만든 환경에서는 실시간으로 공식 가격 페이지를 확인할 수
// 없었으므로, 기본 테이블은 비워 둔다 — 배포 운영자가 실제 가격을
// 공식 provider 가격 페이지(예: https://www.anthropic.com/pricing)에서
// 직접 확인해 아래 PRICING_TABLE에 채워 넣어야 한다. 가격이 채워지지
// 않은 모델은 항상 costUnavailable을 반환한다 — 절대 0으로 계산하지
// 않는다(섹션 8).
//
// 채워 넣는 방법: PRICING_TABLE 배열에 ModelPricingEntry를 추가하고,
// sourceNote에 어디서/언제 확인한 가격인지 남긴다. effectiveFrom부터
// 그 다음 entry의 effectiveFrom 전까지 적용된다(가장 최근에 적용
// 가능한 entry를 고른다 — 섹션 9).

export interface ModelPricingEntry {
  provider: string;
  modelId: string;
  /** 1,000,000 input 토큰당 USD 가격. */
  inputPricePerMillionTokens: number;
  /** 1,000,000 output 토큰당 USD 가격. */
  outputPricePerMillionTokens: number;
  /** 이 가격이 적용되기 시작한 시각(ISO 8601). */
  effectiveFrom: string;
  /** 이 가격의 근거(출처/확인 시각). 반드시 채운다 — 빈 문자열 금지. */
  sourceNote: string;
}

/**
 * 운영자가 실제로 확인한 가격만 여기 채운다. 예시:
 *
 * {
 *   provider: "anthropic",
 *   modelId: "claude-sonnet-4-6",
 *   inputPricePerMillionTokens: 3.0,
 *   outputPricePerMillionTokens: 15.0,
 *   effectiveFrom: "2026-01-01T00:00:00.000Z",
 *   sourceNote: "https://www.anthropic.com/pricing 확인일: 2026-XX-XX (운영자 직접 확인 필요 — 이 값은 예시일 뿐 검증되지 않았다)",
 * }
 *
 * 이번 Phase(OPS-02B)에서는 검증되지 않은 가격을 기본값으로 넣지
 * 않는다 — 배포 전 운영자가 직접 채워야 하는 항목이다.
 */
export const PRICING_TABLE: ModelPricingEntry[] = [];

export interface ResolvedPrice {
  entry: ModelPricingEntry;
}

export type PriceLookupResult = ResolvedPrice | { costUnavailable: true; reason: string };

function isResolvedPrice(result: PriceLookupResult): result is ResolvedPrice {
  return "entry" in result;
}

/**
 * modelId + 사용 시각에 적용 가능한 가격 entry를 찾는다. 여러 entry가
 * 있으면 usageTimestamp 이전(또는 같은 시각)의 effectiveFrom 중 가장
 * 최근 것을 고른다(섹션 9). 일치하는 entry가 없으면 절대 0으로
 * 계산하지 않고 costUnavailable을 반환한다(섹션 8).
 */
export function lookupModelPrice(modelId: string | undefined, usageTimestamp: string | undefined): PriceLookupResult {
  if (!modelId) {
    return { costUnavailable: true, reason: "model identifier가 없습니다." };
  }

  const candidates = PRICING_TABLE.filter((e) => e.modelId === modelId);
  if (candidates.length === 0) {
    return { costUnavailable: true, reason: `"${modelId}"에 대한 확인된 가격 정보가 없습니다.` };
  }

  const usageTime = usageTimestamp ? Date.parse(usageTimestamp) : NaN;
  const applicable = Number.isNaN(usageTime)
    ? candidates
    : candidates.filter((e) => Date.parse(e.effectiveFrom) <= usageTime);

  if (applicable.length === 0) {
    return {
      costUnavailable: true,
      reason: `"${modelId}"의 가격 정보는 있지만 사용 시점(${usageTimestamp ?? "알 수 없음"})에 적용 가능한 entry가 없습니다(모두 그 이후 effectiveFrom).`,
    };
  }

  const chosen = applicable.reduce((latest, e) => (Date.parse(e.effectiveFrom) > Date.parse(latest.effectiveFrom) ? e : latest));
  return { entry: chosen };
}

export interface CalculatedCost {
  usd: number;
  entry: ModelPricingEntry;
}

/** inputTokens/outputTokens가 둘 다 숫자여야 계산한다 — 하나라도 없으면 costUnavailable. */
export function calculateRequestCost(
  modelId: string | undefined,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
  usageTimestamp: string | undefined
): { usd: number } | { costUnavailable: true; reason: string } {
  if (typeof inputTokens !== "number" || typeof outputTokens !== "number") {
    return { costUnavailable: true, reason: "token usage(inputTokens/outputTokens)가 기록되어 있지 않습니다." };
  }

  const priceResult = lookupModelPrice(modelId, usageTimestamp);
  if (!isResolvedPrice(priceResult)) {
    return priceResult;
  }

  const usd =
    (inputTokens / 1_000_000) * priceResult.entry.inputPricePerMillionTokens +
    (outputTokens / 1_000_000) * priceResult.entry.outputPricePerMillionTokens;

  return { usd };
}
