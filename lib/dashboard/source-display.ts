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

/**
 * Phase 3-23: 대시보드 상단 "현재 상태 / 다음 작업" 카드용 통합 상태.
 *
 * Phase 3-23-2: 예전에는 이 상태와 별도로 `resolveNextActionState`/
 * `NextActionState`(출처→기사초안까지 3단계)가 나란히 존재해서, 같은
 * 화면에 서로 다른 기준의 상태 문구가 동시에 노출되는 문제가 있었다
 * ("기사 작성 가능"과 "검토 대기"가 동시에 보이는 식). 상태 판단 기준을
 * 이 함수 하나로 통합하기 위해 `resolveNextActionState`/`NextActionState`는
 * 제거했다 — 대시보드의 모든 상태 문구/배지/CTA는 반드시 이 함수의
 * 반환값(`DashboardWorkflowState`) 하나로만 결정해야 한다.
 */
export type DashboardWorkflowState =
  | "needs_theme"
  | "needs_source"
  | "ready_to_generate"
  | "needs_platform_posts"
  | "needs_review"
  | "ready_for_publish_prep";

export interface DashboardWorkflowStateInput {
  /** 선택된 테마가 있는지. 없으면 다른 값과 무관하게 needs_theme를 반환한다. */
  hasTheme: boolean;
  sourceCount: number;
  minRequired: number;
  hasArticle: boolean;
  /** 이 테마의 기사로 생성된 플랫폼별 글(social_posts) 총 개수. */
  socialPostCount: number;
  /** 그중 승인(approved)된 글 개수. */
  approvedSocialPostCount: number;
}

export function resolveDashboardWorkflowState(input: DashboardWorkflowStateInput): DashboardWorkflowState {
  const { hasTheme, sourceCount, minRequired, hasArticle, socialPostCount, approvedSocialPostCount } = input;
  if (!hasTheme) return "needs_theme";
  if (!hasArticle) {
    return sourceCount >= minRequired ? "ready_to_generate" : "needs_source";
  }
  if (approvedSocialPostCount > 0) return "ready_for_publish_prep";
  if (socialPostCount > 0) return "needs_review";
  return "needs_platform_posts";
}
