// Phase 3-14: 플랫폼별 성과 비교 가중치(주요/보조 지표) 정의와 최종
// classification. 여기서 계산하는 점수/순위는 내부 비교용 참고 지표일
// 뿐이며, 절대적인 마케팅 성공 지표가 아니다.

import type { SocialPlatform, RewritePerformanceComparisonStatus, RewritePerformanceWinner } from "./social-platform-types";
import {
  decideRewritePerformanceWinner,
  type PrimaryMetricComparison,
  type RewritePerformanceMetricsInput,
} from "./rewrite-performance-comparison-calculator";

export interface PlatformPerformanceComparisonRules {
  platform: SocialPlatform;
  /** 이 플랫폼에서 승자 판단 시 우선적으로 보는 지표(performance_score가 없을 때 사용). */
  primaryMetrics: (keyof RewritePerformanceMetricsInput)[];
  /** 참고용 보조 지표(승자 판단에는 직접 쓰이지 않음). */
  secondaryMetrics: (keyof RewritePerformanceMetricsInput)[];
  notes: string;
}

const RULES: Record<SocialPlatform, PlatformPerformanceComparisonRules> = {
  wordpress_blog: {
    platform: "wordpress_blog",
    primaryMetrics: ["clicks", "views", "conversionCount", "comments"],
    secondaryMetrics: ["impressions", "likes", "shares"],
    notes: "블로그는 조회 자체보다 클릭/전환/댓글 등 실제 행동 지표를 우선한다.",
  },
  naver_blog: {
    platform: "naver_blog",
    primaryMetrics: ["views", "likes", "comments", "saves", "shares"],
    secondaryMetrics: ["impressions", "clicks"],
    notes: "네이버 블로그는 조회수와 좋아요/댓글/스크랩·공유를 함께 본다.",
  },
  naver_cafe: {
    platform: "naver_cafe",
    primaryMetrics: ["comments", "views", "likes"],
    secondaryMetrics: ["shares"],
    notes: "카페는 커뮤니티 특성상 댓글(반응) 비중을 가장 높게 본다.",
  },
  x: {
    platform: "x",
    primaryMetrics: ["impressions", "likes", "comments", "shares", "clicks"],
    secondaryMetrics: ["views"],
    notes: "X(트위터)는 노출과 확산(리트윗/좋아요/댓글/클릭)을 함께 본다.",
  },
  threads: {
    platform: "threads",
    primaryMetrics: ["views", "likes", "comments", "shares"],
    secondaryMetrics: ["impressions"],
    notes: "Threads는 조회/좋아요/댓글/공유를 기본 지표로 본다.",
  },
  instagram: {
    platform: "instagram",
    primaryMetrics: ["reach", "impressions", "likes", "comments", "saves", "shares", "profileVisits"],
    secondaryMetrics: ["follows", "views"],
    notes: "인스타그램은 도달/노출/저장/프로필 방문 등 알고리즘 관련 지표 비중이 크다.",
  },
};

export function getPlatformPerformanceComparisonRules(platform: SocialPlatform): PlatformPerformanceComparisonRules {
  return RULES[platform];
}

export function getPrimaryMetricsForPlatform(platform: SocialPlatform): (keyof RewritePerformanceMetricsInput)[] {
  return RULES[platform].primaryMetrics;
}

export function getSecondaryMetricsForPlatform(platform: SocialPlatform): (keyof RewritePerformanceMetricsInput)[] {
  return RULES[platform].secondaryMetrics;
}

export interface ClassifyRewritePerformanceComparisonInput {
  platform: SocialPlatform;
  original: RewritePerformanceMetricsInput;
  rewrite: RewritePerformanceMetricsInput;
  hasOriginalMetrics: boolean;
  hasRewriteMetrics: boolean;
}

export interface ClassifyRewritePerformanceComparisonResult {
  comparisonStatus: RewritePerformanceComparisonStatus;
  winner: RewritePerformanceWinner | null;
  reasonCode: string;
  platformSpecificSummary: Record<string, unknown>;
}

/**
 * 원본/rewrite 중 metrics가 없는 쪽이 있으면 blocked가 아니라
 * needs_more_data로 처리한다. 둘 다 있으면 performance_score를
 * 우선하고, 없으면 플랫폼별 primary metrics 다수결로 판단한다.
 */
export function classifyRewritePerformanceComparison(
  input: ClassifyRewritePerformanceComparisonInput
): ClassifyRewritePerformanceComparisonResult {
  if (!input.hasOriginalMetrics && !input.hasRewriteMetrics) {
    return {
      comparisonStatus: "needs_more_data",
      winner: null,
      reasonCode: "no_metrics_for_either_version",
      platformSpecificSummary: { platform: input.platform },
    };
  }
  if (!input.hasOriginalMetrics || !input.hasRewriteMetrics) {
    return {
      comparisonStatus: "needs_more_data",
      winner: null,
      reasonCode: !input.hasOriginalMetrics ? "missing_original_metrics" : "missing_rewrite_metrics",
      platformSpecificSummary: { platform: input.platform },
    };
  }

  const primaryMetrics = getPrimaryMetricsForPlatform(input.platform);
  const primaryMetricComparisons: PrimaryMetricComparison[] = primaryMetrics.map((metric) => ({
    metric,
    originalValue: input.original[metric] as number,
    rewriteValue: input.rewrite[metric] as number,
  }));

  const performanceScoreDelta =
    input.original.performanceScore !== null && input.rewrite.performanceScore !== null
      ? input.rewrite.performanceScore - input.original.performanceScore
      : null;

  const decision = decideRewritePerformanceWinner({
    performanceScoreDelta,
    originalPerformanceScore: input.original.performanceScore,
    rewritePerformanceScore: input.rewrite.performanceScore,
    primaryMetricComparisons,
  });

  return {
    comparisonStatus: decision.comparisonStatus,
    winner: decision.winner,
    reasonCode: decision.reasonCode,
    platformSpecificSummary: {
      platform: input.platform,
      primaryMetrics,
      primaryMetricComparisons,
    },
  };
}
