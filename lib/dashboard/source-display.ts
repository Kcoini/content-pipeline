// Phase 1-23: 대시보드 "선택된 테마 작업" 화면 표시 로직.
// UI에서 재사용하는 순수 함수만 모아둔다 — DB/네트워크 접근 없음.

/** URL에서 도메인만 추출한다(긴 URL 전체를 목록에 노출하지 않기 위함). */
export function extractDomain(url: string | null): string {
  if (!url || url.trim().length === 0) return "(URL 없음)";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export interface SourceLikeStatus {
  fetchStatus: string;
  summaryStatus: string;
}

export interface SourceStatusSummary {
  total: number;
  minRequired: number;
  isReady: boolean;
  fetchSuccessCount: number;
  summarySuccessCount: number;
  fetchFailedCount: number;
  summaryFailedCount: number;
}

/** 출처 상태 요약(등록 개수, 조건 충족 여부, 본문/요약 수집 현황)을 계산한다. */
export function summarizeSourceStatus(sources: readonly SourceLikeStatus[], minRequired: number): SourceStatusSummary {
  return {
    total: sources.length,
    minRequired,
    isReady: sources.length >= minRequired,
    fetchSuccessCount: sources.filter((s) => s.fetchStatus === "success").length,
    summarySuccessCount: sources.filter((s) => s.summaryStatus === "success").length,
    fetchFailedCount: sources.filter((s) => s.fetchStatus === "failed").length,
    summaryFailedCount: sources.filter((s) => s.summaryStatus === "failed").length,
  };
}

/** "다음 작업" 카드가 어떤 상태 문구/버튼을 보여줘야 하는지 결정한다. */
export type NextActionState = "needs_source" | "ready_to_generate" | "article_exists";

export function resolveNextActionState(sourceCount: number, minRequired: number, hasArticle: boolean): NextActionState {
  if (hasArticle) return "article_exists";
  if (sourceCount >= minRequired) return "ready_to_generate";
  return "needs_source";
}
