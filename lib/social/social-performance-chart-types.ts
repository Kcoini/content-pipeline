// Phase 3-19: Dashboard Charts & Trend Visualization — 읽기 전용 차트
// 데이터 타입 정의. 이 파일이 정의하는 모든 타입은 이미 저장된
// social_posts/social_post_metrics/social_rewrite_performance_comparisons
// 데이터를 집계해 화면에 시각화하기 위한 것이며, 어떤 필드도 데이터를
// 변경하는 데 사용되지 않는다. performance_score/engagement 관련 값은
// Phase 3-15와 동일하게 모두 내부 비교용 참고 지표다.

import type { SocialPlatform, ToneStyle } from "./social-platform-types";

/**
 * 차트 조회 전용 필터. 기존 DashboardFilter(Phase 3-15)와 겹치는
 * 필드는 이름을 맞췄지만, 차트에 필요한 최소 집합만 갖는 별도 타입이다
 * — social-performance-chart-service.ts가 내부적으로 DashboardFilter로
 * 변환해 기존 repository를 그대로 재사용한다.
 */
export interface DashboardChartFilter {
  articleId?: string;
  platform?: SocialPlatform;
  toneStyle?: ToneStyle;
  dateFrom?: string;
  dateTo?: string;
  includeRewriteVersions: boolean;
  onlyPublished: boolean;
  onlyMeasured: boolean;
}

/** bar chart 하나의 항목(label + value)을 표현하는 범용 데이터 포인트. */
export interface ChartDataPoint {
  label: string;
  value: number;
}

/** 시간(월/일) 하나에 대한 metrics 집계 포인트. */
export interface TimeSeriesDataPoint {
  /** "2026-01"(월별 집계) 또는 "2026-01-15"(일별 집계) 형식. */
  period: string;
  views: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  averagePerformanceScore: number | null;
}

export interface PlatformPerformanceChartData {
  platform: SocialPlatform;
  averagePerformanceScore: number | null;
  totalViews: number;
  totalClicks: number;
  totalEngagement: number;
  measuredCount: number;
}

export interface TonePerformanceChartData {
  toneStyle: ToneStyle;
  averagePerformanceScore: number | null;
  totalViews: number;
  totalClicks: number;
  measuredCount: number;
}

export interface MetricsTrendChartData {
  /** 데이터가 여러 달에 걸쳐 있으면 "month", 그렇지 않으면(최근 metrics 소수) "day". */
  granularity: "month" | "day";
  points: TimeSeriesDataPoint[];
}

export interface RewriteComparisonChartData {
  rewriteWonCount: number;
  originalWonCount: number;
  similarCount: number;
  needsMoreDataCount: number;
}

/** social_posts.performance_status 분포. */
export interface LowPerformanceChartData {
  low: number;
  needsReview: number;
  notMeasured: number;
  average: number;
  good: number;
  excellent: number;
}

export interface MetricsMissingChartData {
  measured: number;
  missing: number;
}

/** buildSocialPerformanceCharts()가 반환하는 차트 데이터 묶음. */
export interface SocialPerformanceCharts {
  filter: DashboardChartFilter;
  platformPerformanceChart: PlatformPerformanceChartData[];
  tonePerformanceChart: TonePerformanceChartData[];
  metricsTrendChart: MetricsTrendChartData;
  rewriteComparisonChart: RewriteComparisonChartData;
  lowPerformanceChart: LowPerformanceChartData;
  metricsMissingChart: MetricsMissingChartData;
}

/** 필터 기본값 — includeRewriteVersions/onlyPublished/onlyMeasured 모두 false(전체 표시). */
export const DEFAULT_DASHBOARD_CHART_FILTER: DashboardChartFilter = {
  includeRewriteVersions: false,
  onlyPublished: false,
  onlyMeasured: false,
};
