import "./load-env";
import { describe, it, expect } from "vitest";
import { getLogsByTypesAndRange, type LogEventType } from "@/lib/repositories/log-repository";
import { aggregateAiUsage, aggregateAiUsageByArticle, type AiUsageRecord } from "@/lib/ops/ai-cost-aggregator";

// OPS-02B (섹션 12): 실제 pipeline_logs에서 AI 사용량을 조회해 request
// count/token/추정 비용을 report한다. full prompt/body는 어디에도
// 출력하지 않는다 — count/id/cost만 출력한다.

/** 현재 실제 AI usage(inputTokens/outputTokens)를 로그로 남기는 event 목록.
 * article 생성/평가/출처 요약은 아직 token usage를 로그에 남기지 않는다
 * (OPS-02A/B 시점 기준 코드 확인 결과) — 이 report는 그 범위만 다룬다는
 * 것을 출력에 명시한다(과소 집계를 과장된 완전성으로 포장하지 않는다). */
const AI_USAGE_EVENT_TYPES: LogEventType[] = ["social_ai_generation_completed", "social_draft_generation_completed"];

export interface ReportAiUsageOptions {
  since?: string;
  until?: string;
  articleId?: string;
  limit?: number;
}

export async function reportAiUsage(options: ReportAiUsageOptions = {}) {
  const logs = await getLogsByTypesAndRange(AI_USAGE_EVENT_TYPES, {
    since: options.since,
    until: options.until,
    limit: options.limit,
  });

  const filtered = options.articleId ? logs.filter((l) => l.details.articleId === options.articleId) : logs;

  const records: AiUsageRecord[] = filtered.map((l) => ({
    modelId: typeof l.details.model === "string" ? l.details.model : undefined,
    inputTokens: typeof l.details.inputTokens === "number" ? l.details.inputTokens : undefined,
    outputTokens: typeof l.details.outputTokens === "number" ? l.details.outputTokens : undefined,
    timestamp: l.createdAt,
    articleId: typeof l.details.articleId === "string" ? l.details.articleId : null,
  }));

  const overall = aggregateAiUsage(records);
  const byArticle = aggregateAiUsageByArticle(records);

  return { overall, byArticle, recordCount: records.length };
}

function formatUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

async function printReport(): Promise<void> {
  const { overall, byArticle } = await reportAiUsage();

  console.log("\nAI Usage Report (pipeline_logs 기반)\n");
  console.log(
    `범위: ${AI_USAGE_EVENT_TYPES.join(", ")} 이벤트만(현재 이 두 이벤트만 token usage를 로그에 남긴다 — article 생성/평가/출처 요약은 아직 집계 범위 밖).`
  );
  console.log(`request count: ${overall.totalRequests}`);
  console.log(`input tokens: ${overall.totalInputTokens}`);
  console.log(`output tokens: ${overall.totalOutputTokens}`);
  console.log(`가격 계산 가능 request: ${overall.requestsWithKnownCost}건, known cost: ${formatUsd(overall.knownCostUsd)}`);
  console.log(
    `가격 계산 불가 request: ${overall.requestsWithUnknownCost}건(0원으로 합산하지 않음 — lib/ops/model-pricing.ts의 PRICING_TABLE에 실제 가격을 채워야 계산 가능)`
  );

  const articleIds = Object.keys(byArticle).filter((k) => k !== "(no-article)");
  if (articleIds.length > 0) {
    console.log(`\narticle별 집계 (${articleIds.length}건):`);
    for (const id of articleIds) {
      const a = byArticle[id];
      console.log(
        `  - ${id}: requests=${a.totalRequests}, input=${a.totalInputTokens}, output=${a.totalOutputTokens}, known=${formatUsd(a.knownCostUsd)}, unknown=${a.requestsWithUnknownCost}건`
      );
    }
  }
  console.log("");
}

// npm run ops:report-usage로 실행하는 CLI(vitest.ops.config.ts가
// scripts/ops/*.ts를 러너로 실행하는 기존 패턴 재사용). 실제 Supabase를
// 읽기 전용으로 조회한다 — 쓰기/AI 호출 없음.
describe("ops:report-ai-usage", () => {
  it("prints a real (read-only) AI usage report and returns a well-formed aggregate", async () => {
    await printReport();
    const { overall } = await reportAiUsage();
    expect(overall.totalRequests).toBeGreaterThanOrEqual(0);
    expect(overall.requestsWithKnownCost + overall.requestsWithUnknownCost).toBe(overall.totalRequests);
  });
});
