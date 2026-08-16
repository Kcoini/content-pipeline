// Phase 3-20: A/B Testing Draft Structure.
// 실제 자동 A/B 테스트 실행이 아니라, 테스트 계획(가설/목적/지표)과
// variant(원본/rewrite 또는 여러 후보)를 구조화하기 위한 draft 타입
// 정의다. 어떤 필드도 실제 플랫폼 자동 게시나 자동 승자 반영에
// 쓰이지 않는다 — 결과는 사람이 판단하기 위한 참고 자료다.

import type { SocialPlatform, ToneStyle } from "./social-platform-types";

export type AbTestStatus = "draft" | "ready" | "running" | "paused" | "completed" | "inconclusive" | "cancelled" | "blocked" | "failed";

export type AbTestType =
  | "manual"
  | "original_vs_rewrite"
  | "title_test"
  | "hook_test"
  | "cta_test"
  | "tone_test"
  | "platform_test"
  | "hashtag_test";

export type AbTestComparisonMethod = "manual_metrics" | "rewrite_performance_comparison" | "dashboard_summary" | "future_api_metrics";

export type AbTestPrimaryMetric =
  | "performance_score"
  | "views"
  | "impressions"
  | "engagement_rate"
  | "click_through_rate"
  | "clicks"
  | "comments"
  | "shares"
  | "saves"
  | "conversion_rate";

export type AbTestVariantRole = "control" | "variant_a" | "variant_b" | "variant_c" | "candidate";

export type AbTestVariantStatus = "draft" | "ready" | "posted" | "measured" | "winner" | "loser" | "inconclusive" | "blocked" | "failed";

/** social_ab_tests row 하나(테스트 draft/계획). */
export interface SocialAbTest {
  id: string;
  articleId: string;
  rootSocialPostId: string | null;
  platform: SocialPlatform;
  testName: string;
  testDescription: string | null;
  hypothesis: string | null;
  testGoal: string | null;
  primaryMetric: AbTestPrimaryMetric;
  secondaryMetrics: AbTestPrimaryMetric[];
  testStatus: AbTestStatus;
  testType: AbTestType;
  comparisonMethod: AbTestComparisonMethod;
  winnerSocialPostId: string | null;
  winnerReason: string | null;
  resultSummary: Record<string, unknown>;
  warnings: string[];
  createdBy: string | null;
  startedAt: string | null;
  endedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** social_ab_test_variants row 하나(테스트에 속한 social_post 하나). */
export interface SocialAbTestVariant {
  id: string;
  abTestId: string;
  articleId: string;
  socialPostId: string;
  variantLabel: string;
  variantRole: AbTestVariantRole;
  variantDescription: string | null;
  variantHypothesis: string | null;
  platform: SocialPlatform;
  toneStyle: ToneStyle | null;
  versionNumber: number | null;
  isControl: boolean;
  isRewriteVersion: boolean;
  manualPostStatus: string | null;
  postUrl: string | null;
  latestMetricsId: string | null;
  latestPerformanceScore: number | null;
  latestMetricsRecordedAt: string | null;
  variantStatus: AbTestVariantStatus;
  resultRank: number | null;
  resultNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAbTestInput {
  articleId: string;
  platform: SocialPlatform;
  testName: string;
  testDescription?: string;
  hypothesis?: string;
  testGoal?: string;
  primaryMetric?: AbTestPrimaryMetric;
  secondaryMetrics?: AbTestPrimaryMetric[];
  testType?: AbTestType;
  comparisonMethod?: AbTestComparisonMethod;
  rootSocialPostId?: string;
  createdBy?: string;
}

export interface AddAbTestVariantInput {
  variantLabel: string;
  variantRole?: AbTestVariantRole;
  variantDescription?: string;
  variantHypothesis?: string;
  isControl?: boolean;
}

/** compareAbTestVariants()/buildAbTestComparisonSummary()가 반환하는 variant 1개의 비교 결과. */
export interface AbTestVariantComparisonResult {
  variantId: string;
  socialPostId: string;
  variantLabel: string;
  variantRole: AbTestVariantRole;
  primaryMetricValue: number | null;
  rank: number | null;
  isWinner: boolean;
}

/** compareAbTestVariants()가 반환하는 테스트 전체 비교 결과. */
export interface AbTestComparisonResult {
  abTestId: string;
  primaryMetric: AbTestPrimaryMetric;
  variants: AbTestVariantComparisonResult[];
  winnerSocialPostId: string | null;
  winnerVariantId: string | null;
  winnerReason: string | null;
  isInconclusive: boolean;
  inconclusiveReason: string | null;
  warnings: string[];
}

/** article/social_post 상세 화면에서 보여줄 A/B 테스트 요약. */
export interface AbTestSummary {
  id: string;
  testName: string;
  testType: AbTestType;
  testStatus: AbTestStatus;
  platform: SocialPlatform;
  primaryMetric: AbTestPrimaryMetric;
  variantCount: number;
  winnerSocialPostId: string | null;
  createdAt: string;
  updatedAt: string;
}
