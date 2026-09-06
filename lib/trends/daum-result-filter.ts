// Phase 1-17: Daum/Kakao 결과 중 실제로 쓸 수 없는(최소한의 정보도 없는)
// 항목만 제외한다. publisher(발행처)나 게시일(datetime)은 필수로 요구하지
// 않는다 — Kakao 웹 검색 결과에는 publisher 필드 자체가 없고, datetime이
// 없어도 후보에서 즉시 제외하지 않는다(정보를 정직하게 unknown으로 둔다).
// url이 없으면(중복 제거/기사 작성 근거 링크로 쓸 수 없어) 제외한다.

import type { InsertTrendCandidateInput } from "@/lib/repositories/trend-repository";

export interface DaumResultFilterOutcome {
  kept: InsertTrendCandidateInput[];
  filteredOutCount: number;
  /** 제외 사유별 건수 — 원본 응답 전체가 아니라 집계된 개수만 남긴다(로그 안전). */
  skippedReasonsSummary: Record<string, number>;
}

function addReason(summary: Record<string, number>, reason: string): void {
  summary[reason] = (summary[reason] ?? 0) + 1;
}

export function filterUsableDaumResults(inputs: InsertTrendCandidateInput[]): DaumResultFilterOutcome {
  const kept: InsertTrendCandidateInput[] = [];
  const skippedReasonsSummary: Record<string, number> = {};

  for (const input of inputs) {
    const hasUrl = Boolean(input.url && input.url.trim().length > 0);
    const hasTitle = Boolean(input.title && input.title.trim().length > 0);

    if (!hasUrl && !hasTitle) {
      addReason(skippedReasonsSummary, "missing_url_and_title");
      continue;
    }
    if (!hasUrl) {
      addReason(skippedReasonsSummary, "missing_url");
      continue;
    }

    kept.push(input);
  }

  return { kept, filteredOutCount: inputs.length - kept.length, skippedReasonsSummary };
}
