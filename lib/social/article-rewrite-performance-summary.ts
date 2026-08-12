// Phase 3-14: 기사 단위 rewrite 성과 비교 요약. social_rewrite_
// performance_comparisons에 쌓인 결과를 모아 "이 기사에서 rewrite가
// 얼마나 도움이 되었는지"를 한눈에 보여준다. 실제 게시/재작성 자동화는
// 하지 않으며, 모든 값은 사람이 입력한 metrics를 기반으로 계산된
// 내부 비교용 참고 지표다.

import { listRewritePerformanceComparisonsByArticle } from "@/lib/repositories/social-rewrite-performance-comparisons-repository";
import type { SocialPlatform, ToneStyle } from "./social-platform-types";

export interface ArticleRewritePerformanceSummary {
  articleId: string;
  totalComparisons: number;
  rewriteWonCount: number;
  originalWonCount: number;
  similarCount: number;
  needsMoreDataCount: number;
  inconclusiveCount: number;
  blockedCount: number;
  failedCount: number;
  averagePerformanceScoreDelta: number | null;
  averageImprovementRate: number | null;
  bestRewriteSocialPostId: string | null;
  bestPerformanceScoreDelta: number | null;
  bestPlatform: SocialPlatform | null;
  bestToneStyle: ToneStyle | null;
  latestComparisonAt: string | null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * 기사 하나에 속한 모든 rewrite 성과 비교 결과를 모아 요약을 만든다.
 * comparisonStatus별 카운트, 평균 개선율, 가장 좋았던 rewrite version을
 * 계산한다 — 어떤 계산도 자동 게시/자동 재작성으로 이어지지 않는다.
 */
export async function buildArticleRewritePerformanceSummary(articleId: string): Promise<ArticleRewritePerformanceSummary> {
  const comparisons = await listRewritePerformanceComparisonsByArticle(articleId);

  let rewriteWonCount = 0;
  let originalWonCount = 0;
  let similarCount = 0;
  let needsMoreDataCount = 0;
  let inconclusiveCount = 0;
  let blockedCount = 0;
  let failedCount = 0;

  const scoreDeltas: number[] = [];
  const improvementRates: number[] = [];

  let bestRewriteSocialPostId: string | null = null;
  let bestPerformanceScoreDelta: number | null = null;
  let bestPlatform: SocialPlatform | null = null;
  let bestToneStyle: ToneStyle | null = null;
  let latestComparisonAt: string | null = null;

  for (const comparison of comparisons) {
    switch (comparison.comparisonStatus) {
      case "rewrite_won":
        rewriteWonCount += 1;
        break;
      case "original_won":
        originalWonCount += 1;
        break;
      case "similar":
        similarCount += 1;
        break;
      case "needs_more_data":
        needsMoreDataCount += 1;
        break;
      case "inconclusive":
        inconclusiveCount += 1;
        break;
      case "blocked":
        blockedCount += 1;
        break;
      case "failed":
        failedCount += 1;
        break;
    }

    if (comparison.performanceScoreDelta !== null) {
      scoreDeltas.push(comparison.performanceScoreDelta);
      if (bestPerformanceScoreDelta === null || comparison.performanceScoreDelta > bestPerformanceScoreDelta) {
        bestPerformanceScoreDelta = comparison.performanceScoreDelta;
        bestRewriteSocialPostId = comparison.rewriteSocialPostId;
        bestPlatform = comparison.platform;
        bestToneStyle = comparison.toneStyle;
      }
    }
    if (comparison.performanceScoreDeltaRate !== null) {
      improvementRates.push(comparison.performanceScoreDeltaRate);
    }

    const comparedAt = comparison.comparedAt ?? comparison.createdAt;
    if (!latestComparisonAt || comparedAt > latestComparisonAt) {
      latestComparisonAt = comparedAt;
    }
  }

  return {
    articleId,
    totalComparisons: comparisons.length,
    rewriteWonCount,
    originalWonCount,
    similarCount,
    needsMoreDataCount,
    inconclusiveCount,
    blockedCount,
    failedCount,
    averagePerformanceScoreDelta: average(scoreDeltas),
    averageImprovementRate: average(improvementRates),
    bestRewriteSocialPostId,
    bestPerformanceScoreDelta,
    bestPlatform,
    bestToneStyle,
    latestComparisonAt,
  };
}
