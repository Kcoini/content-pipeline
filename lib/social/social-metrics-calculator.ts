// Phase 3-9: Social Metrics 계산.
// 여기서 계산하는 engagement_rate/click_through_rate/conversion_rate/
// performance_score는 정확한 마케팅 분석 공식이 아니라, 플랫폼/문체별
// 성과를 내부적으로 비교하기 위한 근사치다. 외부 API 연동은 없다.

import type { SocialPlatform } from "./social-platform-types";
import type { SocialMetricsInput, SocialPerformanceStatus } from "./social-metrics-types";
import { getPlatformMetricsConfig } from "./platform-metrics-config";

/** engagement_rate/click_through_rate 계산 시 사용할 분모를 우선순위대로 고른다. */
function pickDenominator(input: SocialMetricsInput, priority: ("impressions" | "reach" | "views")[]): number | null {
  for (const key of priority) {
    const value = input[key];
    if (typeof value === "number" && value > 0) return value;
  }
  return null;
}

/** engagement_rate = (likes+comments+shares+saves) / denominator. 분모가 없거나 0이면 null. */
export function calculateEngagementRate(
  input: SocialMetricsInput,
  priority: ("impressions" | "reach" | "views")[] = ["impressions", "reach", "views"]
): number | null {
  const denominator = pickDenominator(input, priority);
  if (denominator === null) return null;

  const engagementSum = (input.likes ?? 0) + (input.comments ?? 0) + (input.shares ?? 0) + (input.saves ?? 0);
  return engagementSum / denominator;
}

/** click_through_rate = clicks / denominator. 분모가 없거나 0이면 null. */
export function calculateClickThroughRate(
  input: SocialMetricsInput,
  priority: ("impressions" | "reach" | "views")[] = ["impressions", "reach", "views"]
): number | null {
  const denominator = pickDenominator(input, priority);
  if (denominator === null) return null;
  return (input.clicks ?? 0) / denominator;
}

/** conversion_rate = conversion_count / clicks. clicks가 없거나 0이면 null. */
export function calculateConversionRate(input: SocialMetricsInput): number | null {
  const clicks = input.clicks ?? 0;
  if (clicks <= 0) return null;
  return (input.conversionCount ?? 0) / clicks;
}

/** 지표 하나를 0~1 사이 값으로 saturate시키기 위한 "이 정도면 훌륭하다" 기준값. */
const METRIC_SATURATION_THRESHOLDS: Partial<Record<keyof SocialMetricsInput, number>> = {
  views: 1000,
  impressions: 5000,
  reach: 5000,
  likes: 100,
  comments: 20,
  shares: 20,
  saves: 20,
  clicks: 50,
  profileVisits: 50,
  follows: 20,
  conversionCount: 10,
};

function saturate(value: number, threshold: number): number {
  if (threshold <= 0) return 0;
  return Math.max(0, Math.min(1, value / threshold));
}

/**
 * performance_score(0~100)를 계산한다. 플랫폼별 가중치
 * (platform-metrics-config.ts)를 각 지표의 saturate된(0~1) 값에 곱해
 * 합산한다. 정확한 마케팅 지표가 아니라 내부 비교용 근사치다.
 */
export function calculatePerformanceScore(input: SocialMetricsInput, platform: SocialPlatform): number {
  const config = getPlatformMetricsConfig(platform);
  let score = 0;

  for (const [metric, weight] of Object.entries(config.scoreWeights) as [keyof SocialMetricsInput, number][]) {
    const value = input[metric];
    const numericValue = typeof value === "number" ? value : 0;
    const threshold = METRIC_SATURATION_THRESHOLDS[metric] ?? 1;
    score += weight * saturate(numericValue, threshold);
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * performance_score를 5단계 성과 상태로 분류한다. 이 함수는 "측정
 * 자체가 없는 경우"(not_measured)는 다루지 않는다 — 호출하는 쪽에서
 * social_post_metrics row가 있을 때만 호출한다.
 */
export function classifyPerformanceStatus(score: number): SocialPerformanceStatus {
  if (score >= 80) return "excellent";
  if (score >= 65) return "good";
  if (score >= 40) return "average";
  if (score >= 1) return "low";
  return "needs_review";
}
