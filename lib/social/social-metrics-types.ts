// Phase 3-9: Social Metrics Manual Input & Performance Tracking.
// 실제 플랫폼 Analytics/Insights API 연동은 하지 않는다 — 모든 수치는
// 사람이 플랫폼 화면을 보고 직접 입력한다. performance_score는 절대적인
// 마케팅 지표가 아니라 내부 비교용 점수다.

import type { SocialPlatform, SocialPerformanceStatus } from "./social-platform-types";

export type { SocialPerformanceStatus };

/** social_post_metrics row 하나(입력 이력 한 건). */
export interface SocialPostMetrics {
  id: string;
  socialPostId: string;
  articleId: string;
  platform: SocialPlatform;
  measuredAt: string;
  recordedBy: string | null;
  views: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  profileVisits: number;
  follows: number;
  reach: number;
  engagementRate: number | null;
  clickThroughRate: number | null;
  conversionCount: number;
  conversionRate: number | null;
  performanceScore: number | null;
  notes: string | null;
  rawMetrics: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** 사람이 입력하는 원시 지표(계산 이전 값). */
export interface SocialMetricsInput {
  measuredAt?: string;
  recordedBy?: string;
  views?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  profileVisits?: number;
  follows?: number;
  reach?: number;
  conversionCount?: number;
  notes?: string;
}

/** social_posts에 반영되는 최신 성과 요약. */
export interface SocialMetricsSummary {
  latestMetricsId: string | null;
  latestMetricsRecordedAt: string | null;
  latestViews: number;
  latestImpressions: number;
  latestLikes: number;
  latestComments: number;
  latestShares: number;
  latestSaves: number;
  latestClicks: number;
  latestEngagementRate: number | null;
  latestClickThroughRate: number | null;
  latestPerformanceScore: number | null;
  performanceStatus: SocialPerformanceStatus;
  performanceSummary: Record<string, unknown>;
}

/** 플랫폼별 주요 지표 정의(필수/선택/점수 반영 여부). */
export interface PlatformMetricsConfig {
  platform: SocialPlatform;
  requiredMetrics: (keyof SocialMetricsInput)[];
  optionalMetrics: (keyof SocialMetricsInput)[];
  scoreWeights: Partial<Record<keyof SocialMetricsInput, number>>;
  /** engagement_rate 분모 후보로 사용할 지표 우선순위(impressions → reach → views). */
  engagementDenominatorPriority: ("impressions" | "reach" | "views")[];
}
