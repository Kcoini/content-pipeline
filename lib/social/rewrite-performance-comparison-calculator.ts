// Phase 3-14: 원본 social_post와 rewrite version의 수동 입력 metrics를
// 비교하는 순수 계산 함수 모음. 이 파일의 어떤 함수도 DB/네트워크에
// 접근하지 않는다. 여기서 계산하는 점수는 내부 비교용 참고 지표일
// 뿐이며, 절대적인 마케팅 성공 지표가 아니다.

import type { SocialPlatform, RewritePerformanceComparisonStatus, RewritePerformanceWinner } from "./social-platform-types";

/** 비교에 사용하는 metrics 스냅샷 하나(원본 또는 rewrite 한쪽). */
export interface RewritePerformanceMetricsInput {
  views: number;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  profileVisits: number;
  follows: number;
  conversionCount: number;
  engagementRate: number | null;
  clickThroughRate: number | null;
  conversionRate: number | null;
  performanceScore: number | null;
}

export interface DeltaResult {
  delta: number;
  deltaRate: number | null;
}

/** delta = rewrite - original. */
export function calculateDelta(originalValue: number, rewriteValue: number): number {
  return rewriteValue - originalValue;
}

/**
 * delta_rate = delta / original (original > 0일 때만). original이 0이면
 * (rewrite가 0보다 크더라도) 분모가 0이라 계산할 수 없으므로 null을
 * 반환한다 — 호출하는 쪽에서 별도 warning으로 안내해야 한다.
 */
export function calculateDeltaRate(originalValue: number, rewriteValue: number): number | null {
  if (originalValue > 0) {
    return (rewriteValue - originalValue) / originalValue;
  }
  return null;
}

function toDeltaResult(originalValue: number, rewriteValue: number): DeltaResult {
  return {
    delta: calculateDelta(originalValue, rewriteValue),
    deltaRate: calculateDeltaRate(originalValue, rewriteValue),
  };
}

export interface PerformanceScoreComparisonResult {
  performanceScoreDelta: number | null;
  performanceScoreDeltaRate: number | null;
}

/** performance_score가 둘 다 있을 때만 계산한다. 하나라도 없으면 null. */
export function comparePerformanceScores(
  original: number | null,
  rewrite: number | null
): PerformanceScoreComparisonResult {
  if (original === null || rewrite === null) {
    return { performanceScoreDelta: null, performanceScoreDeltaRate: null };
  }
  return {
    performanceScoreDelta: calculateDelta(original, rewrite),
    performanceScoreDeltaRate: calculateDeltaRate(original, rewrite),
  };
}

export interface EngagementComparisonResult {
  engagementRateDelta: number | null;
  clickThroughRateDelta: number | null;
}

/** engagement_rate/click_through_rate는 이미 비율이므로 delta_rate 없이 delta만 계산한다. */
export function compareEngagement(
  original: { engagementRate: number | null; clickThroughRate: number | null },
  rewrite: { engagementRate: number | null; clickThroughRate: number | null }
): EngagementComparisonResult {
  return {
    engagementRateDelta:
      original.engagementRate !== null && rewrite.engagementRate !== null
        ? rewrite.engagementRate - original.engagementRate
        : null,
    clickThroughRateDelta:
      original.clickThroughRate !== null && rewrite.clickThroughRate !== null
        ? rewrite.clickThroughRate - original.clickThroughRate
        : null,
  };
}

/** clicks delta/delta_rate. */
export function compareClicks(original: number, rewrite: number): DeltaResult {
  return toDeltaResult(original, rewrite);
}

export interface OverallRewriteImprovementResult {
  viewsDelta: number;
  viewsDeltaRate: number | null;
  impressionsDelta: number;
  impressionsDeltaRate: number | null;
  engagementRateDelta: number | null;
  clickThroughRateDelta: number | null;
  clicksDelta: number;
  clicksDeltaRate: number | null;
  commentsDelta: number;
  commentsDeltaRate: number | null;
  sharesDelta: number;
  sharesDeltaRate: number | null;
  savesDelta: number;
  savesDeltaRate: number | null;
  performanceScoreDelta: number | null;
  performanceScoreDeltaRate: number | null;
  improvementSummary: Record<string, unknown>;
  /** original=0인데 rewrite>0이라 delta_rate를 계산할 수 없었던 지표에 대한 안내. */
  warnings: string[];
}

/** platform은 improvementSummary에 함께 기록하기 위해서만 사용한다(가중치 계산은 rules 모듈 담당). */
export function calculateOverallRewriteImprovement(
  original: RewritePerformanceMetricsInput,
  rewrite: RewritePerformanceMetricsInput,
  platform: SocialPlatform
): OverallRewriteImprovementResult {
  const views = toDeltaResult(original.views, rewrite.views);
  const impressions = toDeltaResult(original.impressions, rewrite.impressions);
  const clicks = compareClicks(original.clicks, rewrite.clicks);
  const comments = toDeltaResult(original.comments, rewrite.comments);
  const shares = toDeltaResult(original.shares, rewrite.shares);
  const saves = toDeltaResult(original.saves, rewrite.saves);
  const engagement = compareEngagement(original, rewrite);
  const score = comparePerformanceScores(original.performanceScore, rewrite.performanceScore);

  const warnings: string[] = [];
  const zeroBaseChecks: Array<[string, number, number]> = [
    ["views", original.views, rewrite.views],
    ["impressions", original.impressions, rewrite.impressions],
    ["clicks", original.clicks, rewrite.clicks],
    ["comments", original.comments, rewrite.comments],
    ["shares", original.shares, rewrite.shares],
    ["saves", original.saves, rewrite.saves],
  ];
  for (const [name, originalValue, rewriteValue] of zeroBaseChecks) {
    if (originalValue === 0 && rewriteValue > 0) {
      warnings.push(`${name}: 원본 값이 0이라 delta_rate를 계산할 수 없습니다 (증가폭만 참고).`);
    }
  }

  return {
    viewsDelta: views.delta,
    viewsDeltaRate: views.deltaRate,
    impressionsDelta: impressions.delta,
    impressionsDeltaRate: impressions.deltaRate,
    engagementRateDelta: engagement.engagementRateDelta,
    clickThroughRateDelta: engagement.clickThroughRateDelta,
    clicksDelta: clicks.delta,
    clicksDeltaRate: clicks.deltaRate,
    commentsDelta: comments.delta,
    commentsDeltaRate: comments.deltaRate,
    sharesDelta: shares.delta,
    sharesDeltaRate: shares.deltaRate,
    savesDelta: saves.delta,
    savesDeltaRate: saves.deltaRate,
    performanceScoreDelta: score.performanceScoreDelta,
    performanceScoreDeltaRate: score.performanceScoreDeltaRate,
    improvementSummary: {
      platform,
      viewsImproved: views.delta > 0,
      impressionsImproved: impressions.delta > 0,
      clicksImproved: clicks.delta > 0,
      commentsImproved: comments.delta > 0,
      sharesImproved: shares.delta > 0,
      savesImproved: saves.delta > 0,
      engagementRateImproved: engagement.engagementRateDelta !== null ? engagement.engagementRateDelta > 0 : null,
      clickThroughRateImproved: engagement.clickThroughRateDelta !== null ? engagement.clickThroughRateDelta > 0 : null,
      performanceScoreImproved: score.performanceScoreDelta !== null ? score.performanceScoreDelta > 0 : null,
    },
    warnings,
  };
}

/** performance_score 기준 승자 판정 임계값. 10점 미만 차이는 유의미한 개선으로 보지 않는다. */
const WINNER_SCORE_THRESHOLD = 10;

export interface PrimaryMetricComparison {
  metric: string;
  originalValue: number;
  rewriteValue: number;
}

export interface DecideRewritePerformanceWinnerInput {
  performanceScoreDelta: number | null;
  originalPerformanceScore: number | null;
  rewritePerformanceScore: number | null;
  /** performance_score가 없을 때 사용할 플랫폼별 주요 지표 비교 목록. */
  primaryMetricComparisons?: PrimaryMetricComparison[];
}

export interface DecideRewritePerformanceWinnerResult {
  winner: RewritePerformanceWinner;
  comparisonStatus: RewritePerformanceComparisonStatus;
  reasonCode: string;
}

/**
 * performance_score가 둘 다 있으면 10점 이상 차이를 기준으로 승자를
 * 정한다. performance_score가 없으면 플랫폼별 주요 지표(뷰/좋아요/댓글
 * 등)의 다수결로 대체 판단한다 — rewrite가 views는 낮아도 CTR/engagement
 * 등 주요 지표에서 앞서면 rewrite가 이길 수 있다. 주요 지표도 없으면
 * needs_more_data로 처리한다(blocked가 아님).
 */
export function decideRewritePerformanceWinner(
  input: DecideRewritePerformanceWinnerInput
): DecideRewritePerformanceWinnerResult {
  if (input.originalPerformanceScore !== null && input.rewritePerformanceScore !== null) {
    const delta = input.performanceScoreDelta ?? input.rewritePerformanceScore - input.originalPerformanceScore;
    if (delta >= WINNER_SCORE_THRESHOLD) {
      return { winner: "rewrite", comparisonStatus: "rewrite_won", reasonCode: "performance_score_delta_ge_threshold" };
    }
    if (delta <= -WINNER_SCORE_THRESHOLD) {
      return { winner: "original", comparisonStatus: "original_won", reasonCode: "performance_score_delta_le_neg_threshold" };
    }
    return { winner: "tie", comparisonStatus: "similar", reasonCode: "performance_score_delta_within_threshold" };
  }

  const comparisons = input.primaryMetricComparisons ?? [];
  if (comparisons.length === 0) {
    return { winner: "none", comparisonStatus: "needs_more_data", reasonCode: "no_performance_score_no_primary_metrics" };
  }

  let rewriteWins = 0;
  let originalWins = 0;
  for (const comparison of comparisons) {
    if (comparison.rewriteValue > comparison.originalValue) rewriteWins += 1;
    else if (comparison.rewriteValue < comparison.originalValue) originalWins += 1;
  }

  if (rewriteWins === 0 && originalWins === 0) {
    return { winner: "tie", comparisonStatus: "similar", reasonCode: "primary_metrics_all_equal" };
  }

  const majority = Math.ceil(comparisons.length / 2);
  if (rewriteWins > originalWins) {
    return {
      winner: "rewrite",
      comparisonStatus: rewriteWins >= majority ? "rewrite_won" : "inconclusive",
      reasonCode: "primary_metrics_majority_rewrite",
    };
  }
  if (originalWins > rewriteWins) {
    return {
      winner: "original",
      comparisonStatus: originalWins >= majority ? "original_won" : "inconclusive",
      reasonCode: "primary_metrics_majority_original",
    };
  }
  return { winner: "tie", comparisonStatus: "inconclusive", reasonCode: "primary_metrics_tied" };
}
