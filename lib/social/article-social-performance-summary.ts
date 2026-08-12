// Phase 3-9: 기사 단위 social post 성과 요약.
// 플랫폼별/문체별 성과 점수를 비교하기 위한 기본 구조만 제공한다. 실제
// 외부 API 연동은 없으며, 모든 점수는 사람이 입력한 metrics를 기반으로
// 계산된 내부 비교용 값이다.

import { listPerformanceSummaryByArticle } from "@/lib/repositories/social-metrics-repository";
import type { SocialPlatform, ToneStyle } from "./social-platform-types";

export interface ArticleSocialPerformanceSummary {
  articleId: string;
  totalPosts: number;
  postsMeasuredCount: number;
  postsNotMeasuredCount: number;
  byPlatform: Partial<Record<SocialPlatform, number | null>>;
  byToneStyle: Partial<Record<ToneStyle, number | null>>;
  bestPlatform: SocialPlatform | null;
  bestToneStyle: ToneStyle | null;
}

/** platform/tone_style별로 가장 높은 latest_performance_score를 골라 맵으로 만든다. */
function pickBestScoreByKey<K extends string>(
  entries: { key: K; score: number | null }[]
): Partial<Record<K, number | null>> {
  const result: Partial<Record<K, number | null>> = {};
  for (const { key, score } of entries) {
    if (score === null) {
      if (!(key in result)) result[key] = null;
      continue;
    }
    const current = result[key];
    if (current === undefined || current === null || score > current) {
      result[key] = score;
    }
  }
  return result;
}

function findBestKey<K extends string>(scores: Partial<Record<K, number | null>>): K | null {
  let bestKey: K | null = null;
  let bestScore = -Infinity;
  for (const [key, score] of Object.entries(scores) as [K, number | null][]) {
    if (score !== null && score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  return bestKey;
}

/**
 * 기사 하나에 속한 모든 social post의 최신 성과 점수를 모아 플랫폼별/
 * 문체별 비교 요약을 만든다. 실제 게시 여부와 무관하게 존재하는
 * social post를 모두 대상으로 하되, 점수가 없는(not_measured) post는
 * 별도로 집계한다.
 */
export async function buildArticleSocialPerformanceSummary(articleId: string): Promise<ArticleSocialPerformanceSummary> {
  const posts = await listPerformanceSummaryByArticle(articleId);

  const byPlatform = pickBestScoreByKey(posts.map((post) => ({ key: post.platform, score: post.latestPerformanceScore })));
  const byToneStyle = pickBestScoreByKey(posts.map((post) => ({ key: post.toneStyle, score: post.latestPerformanceScore })));

  const postsMeasuredCount = posts.filter((post) => post.performanceStatus !== "not_measured").length;

  return {
    articleId,
    totalPosts: posts.length,
    postsMeasuredCount,
    postsNotMeasuredCount: posts.length - postsMeasuredCount,
    byPlatform,
    byToneStyle,
    bestPlatform: findBestKey(byPlatform),
    bestToneStyle: findBestKey(byToneStyle),
  };
}
