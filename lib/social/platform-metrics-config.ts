// Phase 3-9: 플랫폼별 성과 지표 설정.
// 어떤 지표가 필수/선택인지, performance_score 계산에 어떤 가중치로
// 반영할지 정의한다. 실제 API 연동은 하지 않는다.

import type { SocialPlatform } from "./social-platform-types";
import type { PlatformMetricsConfig } from "./social-metrics-types";

export const PLATFORM_METRICS_CONFIGS: Record<SocialPlatform, PlatformMetricsConfig> = {
  wordpress_blog: {
    platform: "wordpress_blog",
    requiredMetrics: ["views"],
    optionalMetrics: ["clicks", "comments", "conversionCount"],
    scoreWeights: { views: 25, clicks: 35, comments: 10, conversionCount: 30 },
    engagementDenominatorPriority: ["impressions", "reach", "views"],
  },
  naver_blog: {
    platform: "naver_blog",
    requiredMetrics: ["views"],
    optionalMetrics: ["likes", "comments", "shares", "saves"],
    scoreWeights: { views: 30, likes: 20, comments: 20, shares: 15, saves: 15 },
    engagementDenominatorPriority: ["impressions", "reach", "views"],
  },
  naver_cafe: {
    platform: "naver_cafe",
    requiredMetrics: ["views"],
    optionalMetrics: ["comments", "likes", "shares"],
    scoreWeights: { views: 25, comments: 40, likes: 15, shares: 20 },
    engagementDenominatorPriority: ["impressions", "reach", "views"],
  },
  x: {
    platform: "x",
    requiredMetrics: ["impressions"],
    optionalMetrics: ["likes", "comments", "shares", "clicks", "profileVisits", "follows"],
    scoreWeights: { impressions: 20, likes: 20, comments: 20, shares: 20, clicks: 20 },
    engagementDenominatorPriority: ["impressions", "reach", "views"],
  },
  threads: {
    platform: "threads",
    requiredMetrics: ["likes"],
    optionalMetrics: ["views", "comments", "shares", "follows"],
    scoreWeights: { views: 20, likes: 25, comments: 25, shares: 15, follows: 15 },
    engagementDenominatorPriority: ["impressions", "reach", "views"],
  },
  instagram: {
    platform: "instagram",
    requiredMetrics: ["reach"],
    optionalMetrics: ["impressions", "likes", "comments", "shares", "saves", "profileVisits", "follows"],
    scoreWeights: { reach: 20, likes: 20, comments: 20, shares: 15, saves: 15, profileVisits: 5, follows: 5 },
    engagementDenominatorPriority: ["impressions", "reach", "views"],
  },
};

export function getPlatformMetricsConfig(platform: SocialPlatform): PlatformMetricsConfig {
  return PLATFORM_METRICS_CONFIGS[platform];
}
