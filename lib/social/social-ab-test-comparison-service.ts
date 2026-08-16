// Phase 3-20: A/B Testing Draft Structure — variant 비교/승자 판정
// 서비스. 이 서비스의 어떤 함수도 자동으로 재게시하거나 원본을
// 수정하지 않는다 — winner를 결정해도 실제 게시는 사람이 기존
// approval/export/handoff/manual posting 흐름을 통해 별도로 진행해야
// 한다. 모든 지표는 수동 입력된 social_post_metrics 기반이며, 동일
// 조건의 A/B 테스트가 아닐 수 있으므로 참고 지표로만 사용해야 한다.

import { getAbTestById, listVariantsByAbTest, updateAbTest, updateAbTestVariant, updateSocialPostAbTestSummary } from "@/lib/repositories/social-ab-tests-repository";
import { getLatestMetricsBySocialPost } from "@/lib/repositories/social-metrics-repository";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { SocialPostMetrics } from "./social-metrics-types";
import type { SocialAbTest, SocialAbTestVariant, AbTestPrimaryMetric, AbTestComparisonResult, AbTestVariantComparisonResult } from "./social-ab-testing-types";
import type { AbTestResult } from "./social-ab-test-service";

/** performance_score는 절대 점수 차이(점), 그 외 지표는 상대(%) 차이로 승자를 가른다. */
const PERFORMANCE_SCORE_ABSOLUTE_THRESHOLD = 10;
const RELATIVE_DIFFERENCE_THRESHOLD = 0.1;

async function logComparisonEvent(
  type: LogEventType,
  status: LogStatus,
  message: string,
  articleId: string,
  details?: Record<string, unknown>
): Promise<void> {
  await logEvent({
    type,
    status,
    message,
    articleId,
    targetType: "article",
    targetId: articleId,
    ...(details ? { details } : {}),
  });
}

function getMetricValue(metrics: SocialPostMetrics | null, metric: AbTestPrimaryMetric): number | null {
  if (!metrics) return null;
  switch (metric) {
    case "performance_score":
      return metrics.performanceScore;
    case "views":
      return metrics.views;
    case "impressions":
      return metrics.impressions;
    case "engagement_rate":
      return metrics.engagementRate;
    case "click_through_rate":
      return metrics.clickThroughRate;
    case "clicks":
      return metrics.clicks;
    case "comments":
      return metrics.comments;
    case "shares":
      return metrics.shares;
    case "saves":
      return metrics.saves;
    case "conversion_rate":
      return metrics.conversionRate;
    default: {
      const exhaustiveCheck: never = metric;
      throw new Error(`지원하지 않는 primary_metric입니다: ${String(exhaustiveCheck)}`);
    }
  }
}

/**
 * 1위와 2위 값의 차이가 승자를 가릴 만큼 큰지 판단한다.
 * performance_score는 절대 점수 차이(10점) 기준, 그 외 지표는 1위 값
 * 대비 상대 차이(10%) 기준이다.
 */
function isDifferenceDecisive(primaryMetric: AbTestPrimaryMetric, top: number, second: number): boolean {
  if (primaryMetric === "performance_score") {
    return top - second >= PERFORMANCE_SCORE_ABSOLUTE_THRESHOLD;
  }
  if (top <= 0) return false;
  return (top - second) / top >= RELATIVE_DIFFERENCE_THRESHOLD;
}

/**
 * A/B test의 모든 variant를 primary_metric 기준으로 비교한다. 읽기
 * 전용이며 어떤 DB row도 변경하지 않는다. metrics가 2개 미만이면
 * inconclusive로 표시한다.
 */
export async function compareAbTestVariants(abTestId: string): Promise<AbTestComparisonResult> {
  const abTest = await getAbTestById(abTestId);
  if (!abTest) {
    return {
      abTestId,
      primaryMetric: "performance_score",
      variants: [],
      winnerSocialPostId: null,
      winnerVariantId: null,
      winnerReason: null,
      isInconclusive: true,
      inconclusiveReason: "A/B test를 찾을 수 없습니다.",
      warnings: [],
    };
  }

  const variantRows = await listVariantsByAbTest(abTestId);
  const warnings: string[] = [];

  const withMetrics = await Promise.all(
    variantRows.map(async (variant) => {
      const metrics = await getLatestMetricsBySocialPost(variant.socialPostId);
      const value = getMetricValue(metrics, abTest.primaryMetric);
      if (value === null) warnings.push(`variant(${variant.variantLabel})에 ${abTest.primaryMetric} 값이 없습니다.`);
      return { variant, value };
    })
  );

  const measured = withMetrics.filter((entry): entry is { variant: SocialAbTestVariant; value: number } => entry.value !== null);
  const sorted = [...measured].sort((a, b) => b.value - a.value);

  const rankBySocialPostId = new Map<string, number>();
  sorted.forEach((entry, index) => rankBySocialPostId.set(entry.variant.socialPostId, index + 1));

  let winnerSocialPostId: string | null = null;
  let winnerVariantId: string | null = null;
  let winnerReason: string | null = null;
  let isInconclusive = false;
  let inconclusiveReason: string | null = null;

  if (measured.length < 2) {
    isInconclusive = true;
    inconclusiveReason = "비교할 수 있는 metrics가 2개 미만입니다 (최소 2개 variant에 metrics가 필요합니다).";
  } else {
    const [top, second] = sorted;
    if (isDifferenceDecisive(abTest.primaryMetric, top.value, second.value)) {
      winnerSocialPostId = top.variant.socialPostId;
      winnerVariantId = top.variant.id;
      winnerReason = `${abTest.primaryMetric} 기준 ${top.variant.variantLabel}이(가) ${second.variant.variantLabel}보다 우세합니다 (${top.value} vs ${second.value}).`;
    } else {
      isInconclusive = true;
      inconclusiveReason = `상위 두 variant의 ${abTest.primaryMetric} 차이가 승자를 가릴 만큼 크지 않습니다 (${top.value} vs ${second.value}).`;
    }
  }

  const variants: AbTestVariantComparisonResult[] = variantRows.map((variant) => {
    const value = withMetrics.find((entry) => entry.variant.id === variant.id)?.value ?? null;
    return {
      variantId: variant.id,
      socialPostId: variant.socialPostId,
      variantLabel: variant.variantLabel,
      variantRole: variant.variantRole,
      primaryMetricValue: value,
      rank: rankBySocialPostId.get(variant.socialPostId) ?? null,
      isWinner: variant.socialPostId === winnerSocialPostId,
    };
  });

  return {
    abTestId,
    primaryMetric: abTest.primaryMetric,
    variants,
    winnerSocialPostId,
    winnerVariantId,
    winnerReason,
    isInconclusive,
    inconclusiveReason,
    warnings,
  };
}

/**
 * compareAbTestVariants() 결과를 social_ab_tests/social_ab_test_variants/
 * social_posts에 반영한다. winner가 나와도 어떤 실제 게시도 수행하지
 * 않는다 — 상태값만 저장한다.
 */
export async function decideAbTestWinner(abTestId: string): Promise<AbTestResult> {
  const abTest = await getAbTestById(abTestId);
  if (!abTest) return { success: false, message: `A/B test를 찾을 수 없습니다: ${abTestId}` };

  const comparison = await compareAbTestVariants(abTestId);

  const updated = await updateAbTest(abTestId, {
    testStatus: comparison.isInconclusive ? "inconclusive" : abTest.testStatus,
    winnerSocialPostId: comparison.winnerSocialPostId,
    winnerReason: comparison.isInconclusive ? comparison.inconclusiveReason : comparison.winnerReason,
    resultSummary: { variants: comparison.variants, primaryMetric: comparison.primaryMetric },
    warnings: comparison.warnings,
  });

  await Promise.all(
    comparison.variants.map(async (v) => {
      const variantStatus = comparison.isInconclusive ? "inconclusive" : v.isWinner ? "winner" : v.rank !== null ? "loser" : "inconclusive";
      await updateAbTestVariant(v.variantId, { variantStatus, resultRank: v.rank });
      await updateSocialPostAbTestSummary(v.socialPostId, {
        abTestStatus: comparison.isInconclusive ? "inconclusive" : v.isWinner ? "winner" : "loser",
        latestAbTestId: abTestId,
        abTestVariantRole: v.variantRole,
        abTestVariantLabel: v.variantLabel,
      });
    })
  );

  if (comparison.isInconclusive) {
    await logComparisonEvent(
      "social_ab_test_comparison_inconclusive",
      "info",
      `A/B test(${abTestId}) 비교 결과가 inconclusive입니다: ${comparison.inconclusiveReason ?? ""}`,
      abTest.articleId,
      { abTestId, articleId: abTest.articleId, primaryMetric: comparison.primaryMetric, reasonCode: "inconclusive" }
    );
    return { success: true, message: comparison.inconclusiveReason ?? "비교 결과가 명확하지 않습니다 (inconclusive).", abTest: updated };
  }

  await logComparisonEvent(
    "social_ab_test_comparison_completed",
    "success",
    `A/B test(${abTestId}) 비교를 완료했습니다.`,
    abTest.articleId,
    { abTestId, articleId: abTest.articleId, primaryMetric: comparison.primaryMetric, winnerSocialPostId: comparison.winnerSocialPostId }
  );

  return { success: true, message: comparison.winnerReason ?? "승자를 결정했습니다.", abTest: updated };
}

export interface AbTestComparisonSummary {
  abTest: SocialAbTest;
  variants: SocialAbTestVariant[];
  comparison: AbTestComparisonResult;
}

/** UI(요약 카드)에서 바로 쓸 수 있게 A/B test + variant 목록 + 비교 결과를 한 번에 묶어 반환한다. 읽기 전용이다. */
export async function buildAbTestComparisonSummary(abTestId: string): Promise<AbTestComparisonSummary | null> {
  const abTest = await getAbTestById(abTestId);
  if (!abTest) return null;

  const [variants, comparison] = await Promise.all([listVariantsByAbTest(abTestId), compareAbTestVariants(abTestId)]);

  return { abTest, variants, comparison };
}
