// Phase 1-3: 출처 요약기.
// prompts/source-summary.v1.md의 출력 형식(sourceId, summary)을 따른다.
// mock 구현(summarizeSourcesMock)과 실제 AI 연동을 위한 인터페이스
// (summarizeSourcesWithAi)를 분리한다.

import type { Source } from "@/lib/types/domain";

export interface SourceSummary {
  sourceId: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  summary: string;
}

/**
 * Phase 1-3: 실제 AI 호출 없이, 출처에 등록된 정보를 그대로 요약으로 사용하는
 * mock 구현. 등록된 summary가 없으면 제목/출판사로 대체 문구를 만든다.
 */
export function summarizeSourcesMock(sources: Source[]): SourceSummary[] {
  return sources.map((source) => ({
    sourceId: source.id,
    title: source.title,
    url: source.url,
    publisher: source.publisher,
    publishedAt: source.publishedAt,
    summary: source.summary || `${source.title} (${source.publisher || "출처 미상"})`,
  }));
}

/**
 * Phase 1-3 TODO: prompts/source-summary.v1.md 기준으로 실제 LLM 요약을 호출한다.
 * 아직 구현되지 않았으며, 호출 시 에러를 던진다.
 */
export async function summarizeSourcesWithAi(sources: Source[]): Promise<SourceSummary[]> {
  void sources;
  throw new Error(
    "summarizeSourcesWithAi은 아직 구현되지 않았습니다 " +
      "(Phase 1-3 TODO: prompts/source-summary.v1.md 기준 LLM 연동 필요)"
  );
}
