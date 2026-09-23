// OPS-02B: AI 사용량 usage record 목록을 받아 집계한다(섹션 10-11).
// 가격이 확인되지 않은 요청을 0원으로 합치지 않는다 — 항상
// requestsWithUnknownCost로 분리해서 센다.

import { calculateRequestCost } from "./model-pricing";

export interface AiUsageRecord {
  modelId: string | undefined;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  timestamp: string | undefined;
  /** 집계 결과를 article/job 단위로 묶을 때 쓰는 선택적 식별자. */
  articleId?: string | null;
}

export interface AiUsageAggregate {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  /** 가격을 계산할 수 있었던 요청들의 합계(USD). */
  knownCostUsd: number;
  requestsWithKnownCost: number;
  /** token 누락/model 누락/가격 매핑 없음 등으로 가격을 계산하지 못한 요청 수. */
  requestsWithUnknownCost: number;
}

export function aggregateAiUsage(records: readonly AiUsageRecord[]): AiUsageAggregate {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let knownCostUsd = 0;
  let requestsWithKnownCost = 0;
  let requestsWithUnknownCost = 0;

  for (const record of records) {
    if (typeof record.inputTokens === "number") totalInputTokens += record.inputTokens;
    if (typeof record.outputTokens === "number") totalOutputTokens += record.outputTokens;

    const cost = calculateRequestCost(record.modelId, record.inputTokens, record.outputTokens, record.timestamp);
    if ("usd" in cost) {
      knownCostUsd += cost.usd;
      requestsWithKnownCost += 1;
    } else {
      requestsWithUnknownCost += 1;
    }
  }

  return {
    totalRequests: records.length,
    totalInputTokens,
    totalOutputTokens,
    knownCostUsd,
    requestsWithKnownCost,
    requestsWithUnknownCost,
  };
}

/** articleId별로 묶어서 집계한다(섹션 10 — article/job 기준 집계). articleId가 없는 레코드는 "(no-article)" 키로 묶인다. */
export function aggregateAiUsageByArticle(records: readonly AiUsageRecord[]): Record<string, AiUsageAggregate> {
  const grouped = new Map<string, AiUsageRecord[]>();
  for (const record of records) {
    const key = record.articleId ?? "(no-article)";
    const list = grouped.get(key) ?? [];
    list.push(record);
    grouped.set(key, list);
  }

  const result: Record<string, AiUsageAggregate> = {};
  for (const [key, list] of grouped) {
    result[key] = aggregateAiUsage(list);
  }
  return result;
}
