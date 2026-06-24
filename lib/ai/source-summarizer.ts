// Phase 1-3/1-4 → Phase 1-10 업데이트: 출처 요약기.
// Phase 1-10부터 source 등록 시점에 source-auto-summarizer.ts가 per-source 요약을 생성하고
// sources.summary / sources.key_points에 저장한다.
// 기사 생성 시 이 모듈은 저장된 요약을 읽어 SourceSummary[] 형태로 포맷할 뿐,
// 추가 AI 호출을 하지 않는다.

import { getAnthropicClient } from "./anthropic-client";
import type { Source, Theme } from "@/lib/types/domain";

export interface SourceSummary {
  sourceId: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  summary: string;
  /** Phase 1-10: 출처별 자동 요약에서 추출한 핵심 포인트 */
  keyPoints: string[];
  /** Phase 1-10: 출처 관점 */
  sourceAngle: string;
}

/**
 * 출처별 요약 텍스트 fallback 순서:
 * 1) sources.summary (자동 생성 또는 사용자 입력)
 * 2) raw_content 앞 400자
 * 3) 제목 + 출판사
 */
function buildSummaryText(source: Source): string {
  if (source.summary) return source.summary;
  if (source.rawContent) return `${source.rawContent.substring(0, 400)}...`;
  return `${source.title} (${source.publisher || "출처 미상"})`;
}

/**
 * mock 구현: 저장된 summary / keyPoints를 그대로 사용한다.
 */
export function summarizeSourcesMock(sources: Source[]): SourceSummary[] {
  return sources.map((source) => ({
    sourceId: source.id,
    title: source.title,
    url: source.url,
    publisher: source.publisher,
    publishedAt: source.publishedAt,
    summary: buildSummaryText(source),
    keyPoints: source.keyPoints ?? [],
    sourceAngle: "",
  }));
}

/**
 * Phase 1-4 → Phase 1-10 업데이트:
 * 출처별 자동 요약이 source 등록 시점에 완료되어 있으므로,
 * 기사 생성 시에는 저장된 summary/keyPoints를 그대로 사용한다 (추가 AI 호출 없음).
 * API key 확인만 수행하여 AI mode 진입을 보장한다.
 */
export async function summarizeSourcesWithAi(
  _theme: Theme,
  sources: Source[]
): Promise<SourceSummary[]> {
  // API key 없으면 즉시 실패 → 호출부에서 mock으로 대체한다
  getAnthropicClient();

  return sources.map((source) => ({
    sourceId: source.id,
    title: source.title,
    url: source.url,
    publisher: source.publisher,
    publishedAt: source.publishedAt,
    summary: buildSummaryText(source),
    keyPoints: source.keyPoints ?? [],
    sourceAngle: "",
  }));
}
