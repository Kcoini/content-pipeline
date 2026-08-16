// Phase 3-20: A/B Testing Draft Structure — 테스트 계획(draft)과 variant를
// 관리하는 서비스. 이 서비스의 어떤 함수도 실제 플랫폼에 자동
// 게시하지 않는다 — variant로 추가된 social_post도 기존 approval/
// export/handoff/manual posting 흐름을 그대로 거쳐야 게시된다.
// 결과 판정(compareAbTestVariants 등)은 별도
// social-ab-test-comparison-service.ts가 담당한다.

import {
  createAbTest,
  getAbTestById,
  listAbTestsByArticle,
  listAbTestsBySocialPost,
  updateAbTest,
  createAbTestVariant,
  listVariantsByAbTest,
  updateAbTestVariant,
  updateSocialPostAbTestSummary,
} from "@/lib/repositories/social-ab-tests-repository";
import { getArticleById } from "@/lib/repositories/article-repository";
import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { getLatestMetricsBySocialPost } from "@/lib/repositories/social-metrics-repository";
import { isSocialPlatform } from "./social-platform-types";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type {
  SocialAbTest,
  SocialAbTestVariant,
  CreateAbTestInput,
  AddAbTestVariantInput,
  AbTestPrimaryMetric,
  AbTestSummary,
} from "./social-ab-testing-types";

const PRIMARY_METRICS: AbTestPrimaryMetric[] = [
  "performance_score",
  "views",
  "impressions",
  "engagement_rate",
  "click_through_rate",
  "clicks",
  "comments",
  "shares",
  "saves",
  "conversion_rate",
];

export function isAbTestPrimaryMetric(value: unknown): value is AbTestPrimaryMetric {
  return typeof value === "string" && (PRIMARY_METRICS as string[]).includes(value);
}

/** 최소 이 개수 이상 variant가 있어야 draft를 ready로 전환할 수 있다(의미 있는 A/B 비교를 위해). */
const MIN_VARIANTS_FOR_READY = 2;

export interface AbTestResult {
  success: boolean;
  message: string;
  abTest?: SocialAbTest;
  warnings?: string[];
}

export interface AbTestVariantResult {
  success: boolean;
  message: string;
  variant?: SocialAbTestVariant;
  warnings?: string[];
}

export interface CreateOriginalVsRewriteResult extends AbTestResult {
  variants?: SocialAbTestVariant[];
}

async function logAbTestEvent(
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

function baseTestDetails(abTest: SocialAbTest, extra?: Record<string, unknown>): Record<string, unknown> {
  return {
    abTestId: abTest.id,
    articleId: abTest.articleId,
    platform: abTest.platform,
    testType: abTest.testType,
    testStatus: abTest.testStatus,
    primaryMetric: abTest.primaryMetric,
    ...extra,
  };
}

/** A/B test draft 하나를 생성한다. article이 존재해야 하고 platform/test_name/primary_metric이 유효해야 한다. */
export async function createAbTestDraft(input: CreateAbTestInput): Promise<AbTestResult> {
  const article = await getArticleById(input.articleId);
  if (!article) {
    return { success: false, message: `article을 찾을 수 없습니다: ${input.articleId}` };
  }
  if (!isSocialPlatform(input.platform)) {
    return { success: false, message: `지원하지 않는 platform입니다: ${input.platform}` };
  }
  if (!input.testName || input.testName.trim().length === 0) {
    return { success: false, message: "test_name을 입력하세요." };
  }
  if (input.primaryMetric !== undefined && !isAbTestPrimaryMetric(input.primaryMetric)) {
    return { success: false, message: `지원하지 않는 primary_metric입니다: ${input.primaryMetric}` };
  }
  const secondaryMetrics = (input.secondaryMetrics ?? []).filter(isAbTestPrimaryMetric);

  try {
    const abTest = await createAbTest({
      articleId: input.articleId,
      rootSocialPostId: input.rootSocialPostId ?? null,
      platform: input.platform,
      testName: input.testName.trim(),
      testDescription: input.testDescription,
      hypothesis: input.hypothesis,
      testGoal: input.testGoal,
      primaryMetric: input.primaryMetric,
      secondaryMetrics,
      testType: input.testType,
      comparisonMethod: input.comparisonMethod,
      createdBy: input.createdBy,
    });

    await logAbTestEvent(
      "social_ab_test_draft_created",
      "success",
      `A/B test draft(${abTest.id})를 생성했습니다.`,
      abTest.articleId,
      baseTestDetails(abTest, { variantCount: 0 })
    );

    return { success: true, message: "A/B test draft를 생성했습니다. 실제 게시는 아직 수행되지 않았습니다.", abTest };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logAbTestEvent("social_ab_test_failed", "failed", message, input.articleId, { reasonCode: "create_draft_exception" });
    return { success: false, message };
  }
}

/** social_post 하나를 A/B test에 variant로 추가한다. 같은 social_post 중복 추가는 차단한다. */
export async function addVariantToAbTest(abTestId: string, socialPostId: string, input: AddAbTestVariantInput): Promise<AbTestVariantResult> {
  const abTest = await getAbTestById(abTestId);
  if (!abTest) {
    return { success: false, message: `A/B test를 찾을 수 없습니다: ${abTestId}` };
  }
  const socialPost = await getSocialPostById(socialPostId);
  if (!socialPost) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }
  if (socialPost.articleId !== abTest.articleId) {
    return { success: false, message: "social post의 article_id가 A/B test와 다릅니다." };
  }
  if (!input.variantLabel || input.variantLabel.trim().length === 0) {
    return { success: false, message: "variant_label을 입력하세요." };
  }

  const existingVariants = await listVariantsByAbTest(abTestId);
  if (existingVariants.some((v) => v.socialPostId === socialPostId)) {
    return { success: false, message: "이미 이 A/B test에 추가된 social post입니다." };
  }

  const warnings: string[] = [];
  if (socialPost.platform !== abTest.platform) {
    warnings.push(`variant의 platform(${socialPost.platform})이 테스트 platform(${abTest.platform})과 다릅니다.`);
  }
  if (!socialPost.latestMetricsRecordedAt) {
    warnings.push("아직 metrics가 입력되지 않은 social post입니다.");
  }

  try {
    const variant = await createAbTestVariant({
      abTestId,
      articleId: abTest.articleId,
      socialPostId,
      variantLabel: input.variantLabel.trim(),
      variantRole: input.variantRole,
      variantDescription: input.variantDescription,
      variantHypothesis: input.variantHypothesis,
      platform: socialPost.platform,
      toneStyle: socialPost.toneStyle,
      versionNumber: socialPost.versionNumber,
      isControl: input.isControl ?? false,
      isRewriteVersion: socialPost.isRewriteVersion,
      manualPostStatus: socialPost.manualPostStatus,
      postUrl: socialPost.postUrl,
      latestMetricsId: socialPost.latestMetricsId,
      latestPerformanceScore: socialPost.latestPerformanceScore,
      latestMetricsRecordedAt: socialPost.latestMetricsRecordedAt,
    });

    await updateSocialPostAbTestSummary(socialPostId, {
      abTestStatus: abTest.testStatus === "draft" ? "draft" : "ready",
      latestAbTestId: abTestId,
      abTestVariantRole: variant.variantRole,
      abTestVariantLabel: variant.variantLabel,
    });

    await logAbTestEvent(
      "social_ab_test_variant_added",
      "success",
      `A/B test(${abTestId})에 variant(${variant.id})를 추가했습니다.`,
      abTest.articleId,
      baseTestDetails(abTest, { variantCount: existingVariants.length + 1 })
    );

    return { success: true, message: "variant를 추가했습니다.", variant, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logAbTestEvent("social_ab_test_failed", "failed", message, abTest.articleId, { reasonCode: "add_variant_exception" });
    return { success: false, message };
  }
}

/**
 * 원본 social_post와 rewrite social_post를 곧바로 control/variant_a로
 * 묶는 A/B test draft를 생성한다 (Phase 3-14 rewrite comparison
 * 구조를 재사용). 같은 article/platform이 아니거나 rewrite version이
 * 아니어도 draft 자체는 생성하되 warning으로 안내한다 — metrics가
 * 없어도 draft는 만들 수 있다(그 경우도 warning).
 */
export async function createOriginalVsRewriteAbTest(
  originalSocialPostId: string,
  rewriteSocialPostId: string,
  input?: Partial<CreateAbTestInput>
): Promise<CreateOriginalVsRewriteResult> {
  const original = await getSocialPostById(originalSocialPostId);
  if (!original) {
    return { success: false, message: `원본 social post를 찾을 수 없습니다: ${originalSocialPostId}` };
  }
  const rewrite = await getSocialPostById(rewriteSocialPostId);
  if (!rewrite) {
    return { success: false, message: `rewrite social post를 찾을 수 없습니다: ${rewriteSocialPostId}` };
  }

  const warnings: string[] = [];
  if (original.articleId !== rewrite.articleId) {
    warnings.push("원본과 rewrite의 article_id가 다릅니다.");
  }
  if (original.platform !== rewrite.platform) {
    warnings.push("원본과 rewrite의 platform이 다릅니다.");
  }
  if (!rewrite.isRewriteVersion) {
    warnings.push("rewrite social post의 is_rewrite_version이 false입니다.");
  }
  if (!original.latestMetricsRecordedAt || !rewrite.latestMetricsRecordedAt) {
    warnings.push("원본 또는 rewrite에 아직 metrics가 입력되지 않았습니다.");
  }

  const draftResult = await createAbTestDraft({
    articleId: original.articleId,
    platform: original.platform,
    testName: input?.testName ?? `원본 vs Rewrite (${original.platform})`,
    testDescription: input?.testDescription,
    hypothesis: input?.hypothesis,
    testGoal: input?.testGoal,
    primaryMetric: input?.primaryMetric ?? "performance_score",
    secondaryMetrics: input?.secondaryMetrics,
    testType: "original_vs_rewrite",
    comparisonMethod: "rewrite_performance_comparison",
    rootSocialPostId: original.rootSocialPostId ?? original.id,
    createdBy: input?.createdBy,
  });

  if (!draftResult.success || !draftResult.abTest) {
    return draftResult;
  }

  const controlResult = await addVariantToAbTest(draftResult.abTest.id, originalSocialPostId, {
    variantLabel: "원본 (control)",
    variantRole: "control",
    isControl: true,
  });
  const variantResult = await addVariantToAbTest(draftResult.abTest.id, rewriteSocialPostId, {
    variantLabel: "Rewrite (variant A)",
    variantRole: "variant_a",
  });

  const variants = [controlResult.variant, variantResult.variant].filter((v): v is SocialAbTestVariant => v !== undefined);
  const allWarnings = [...warnings, ...(controlResult.warnings ?? []), ...(variantResult.warnings ?? [])];

  return {
    success: true,
    message: "원본 vs Rewrite A/B test draft를 생성했습니다. 실제 게시는 아직 수행되지 않았습니다.",
    abTest: draftResult.abTest,
    variants,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
  };
}

/** draft → ready. 의미 있는 비교를 위해 variant가 최소 2개 이상이어야 한다. */
export async function markAbTestReady(abTestId: string): Promise<AbTestResult> {
  const abTest = await getAbTestById(abTestId);
  if (!abTest) return { success: false, message: `A/B test를 찾을 수 없습니다: ${abTestId}` };
  if (abTest.testStatus !== "draft") {
    return { success: false, message: `draft 상태에서만 ready로 전환할 수 있습니다 (현재: ${abTest.testStatus}).` };
  }
  const variants = await listVariantsByAbTest(abTestId);
  if (variants.length < MIN_VARIANTS_FOR_READY) {
    return { success: false, message: `variant가 최소 ${MIN_VARIANTS_FOR_READY}개 이상 필요합니다 (현재: ${variants.length}개).` };
  }

  const updated = await updateAbTest(abTestId, { testStatus: "ready" });
  await Promise.all(
    variants.map((v) => updateSocialPostAbTestSummary(v.socialPostId, { abTestStatus: "ready", latestAbTestId: abTestId, abTestVariantRole: v.variantRole, abTestVariantLabel: v.variantLabel }))
  );

  await logAbTestEvent("social_ab_test_ready", "success", `A/B test(${abTestId})를 ready로 전환했습니다.`, updated.articleId, baseTestDetails(updated, { variantCount: variants.length }));

  return { success: true, message: "A/B test를 ready로 전환했습니다.", abTest: updated };
}

/** ready 또는 paused 상태에서 running으로 전환한다(재개 포함). */
export async function startAbTest(abTestId: string, startedBy?: string): Promise<AbTestResult> {
  const abTest = await getAbTestById(abTestId);
  if (!abTest) return { success: false, message: `A/B test를 찾을 수 없습니다: ${abTestId}` };
  if (abTest.testStatus !== "ready" && abTest.testStatus !== "paused") {
    return { success: false, message: `ready 또는 paused 상태에서만 시작할 수 있습니다 (현재: ${abTest.testStatus}).` };
  }

  const updated = await updateAbTest(abTestId, {
    testStatus: "running",
    startedAt: abTest.startedAt ?? new Date().toISOString(),
  });

  await logAbTestEvent("social_ab_test_started", "success", `A/B test(${abTestId})를 시작했습니다.`, updated.articleId, baseTestDetails(updated, { startedBy: startedBy ?? null }));

  return { success: true, message: "A/B test를 시작했습니다. 실제 자동 게시는 수행되지 않습니다 — variant는 각자 기존 게시 흐름을 거쳐야 합니다.", abTest: updated };
}

/** running → paused. */
export async function pauseAbTest(abTestId: string, reason?: string): Promise<AbTestResult> {
  const abTest = await getAbTestById(abTestId);
  if (!abTest) return { success: false, message: `A/B test를 찾을 수 없습니다: ${abTestId}` };
  if (abTest.testStatus !== "running") {
    return { success: false, message: `running 상태에서만 일시정지할 수 있습니다 (현재: ${abTest.testStatus}).` };
  }

  const updated = await updateAbTest(abTestId, { testStatus: "paused" });

  await logAbTestEvent("social_ab_test_paused", "success", `A/B test(${abTestId})를 일시정지했습니다.`, updated.articleId, baseTestDetails(updated, { reason: reason ?? null }));

  return { success: true, message: "A/B test를 일시정지했습니다.", abTest: updated };
}

/** running 또는 paused 상태에서 completed로 전환한다. */
export async function completeAbTest(abTestId: string, completedBy?: string): Promise<AbTestResult> {
  const abTest = await getAbTestById(abTestId);
  if (!abTest) return { success: false, message: `A/B test를 찾을 수 없습니다: ${abTestId}` };
  if (abTest.testStatus !== "running" && abTest.testStatus !== "paused") {
    return { success: false, message: `running 또는 paused 상태에서만 완료할 수 있습니다 (현재: ${abTest.testStatus}).` };
  }

  const updated = await updateAbTest(abTestId, {
    testStatus: "completed",
    endedAt: new Date().toISOString(),
    reviewedBy: completedBy ?? null,
    reviewedAt: new Date().toISOString(),
  });

  const variants = await listVariantsByAbTest(abTestId);
  await Promise.all(variants.map((v) => updateSocialPostAbTestSummary(v.socialPostId, { abTestStatus: "completed", latestAbTestId: abTestId, abTestVariantRole: v.variantRole, abTestVariantLabel: v.variantLabel })));

  await logAbTestEvent("social_ab_test_completed", "success", `A/B test(${abTestId})를 완료 처리했습니다.`, updated.articleId, baseTestDetails(updated, { completedBy: completedBy ?? null }));

  return { success: true, message: "A/B test를 완료 처리했습니다. 결과는 참고 지표이며 자동 재게시는 수행되지 않습니다.", abTest: updated };
}

/** draft/ready/running/paused 상태에서 cancelled로 전환한다. */
export async function cancelAbTest(abTestId: string, reason?: string): Promise<AbTestResult> {
  const abTest = await getAbTestById(abTestId);
  if (!abTest) return { success: false, message: `A/B test를 찾을 수 없습니다: ${abTestId}` };
  if (abTest.testStatus === "completed" || abTest.testStatus === "cancelled") {
    return { success: false, message: `이미 종료된 테스트는 취소할 수 없습니다 (현재: ${abTest.testStatus}).` };
  }

  const updated = await updateAbTest(abTestId, { testStatus: "cancelled", winnerReason: reason ?? null });

  await logAbTestEvent("social_ab_test_cancelled", "success", `A/B test(${abTestId})를 취소했습니다.`, updated.articleId, baseTestDetails(updated, { reason: reason ?? null }));

  return { success: true, message: "A/B test를 취소했습니다.", abTest: updated };
}

/**
 * 각 variant의 social_post 최신 metrics를 다시 읽어 variant row에 반영한다.
 * 외부 Analytics API를 호출하지 않으며, 이미 수동 입력되어 있는
 * social_posts.latest_* 값을 그대로 복사할 뿐이다.
 */
export async function refreshAbTestVariantMetrics(abTestId: string): Promise<AbTestResult> {
  const abTest = await getAbTestById(abTestId);
  if (!abTest) return { success: false, message: `A/B test를 찾을 수 없습니다: ${abTestId}` };

  const variants = await listVariantsByAbTest(abTestId);
  const warnings: string[] = [];

  for (const variant of variants) {
    const socialPost = await getSocialPostById(variant.socialPostId);
    if (!socialPost) {
      warnings.push(`variant(${variant.id})의 social post를 찾을 수 없습니다.`);
      continue;
    }
    const latestMetrics = await getLatestMetricsBySocialPost(variant.socialPostId);
    await updateAbTestVariant(variant.id, {
      manualPostStatus: socialPost.manualPostStatus,
      postUrl: socialPost.postUrl,
      latestMetricsId: latestMetrics?.id ?? null,
      latestPerformanceScore: socialPost.latestPerformanceScore,
      latestMetricsRecordedAt: socialPost.latestMetricsRecordedAt,
      variantStatus: socialPost.latestMetricsRecordedAt ? "measured" : variant.variantStatus,
    });
    if (!socialPost.latestMetricsRecordedAt) {
      warnings.push(`variant(${variant.variantLabel})에 아직 metrics가 입력되지 않았습니다.`);
    }
  }

  await logAbTestEvent(
    "social_ab_test_metrics_refreshed",
    "success",
    `A/B test(${abTestId})의 variant metrics를 새로고침했습니다.`,
    abTest.articleId,
    baseTestDetails(abTest, { variantCount: variants.length })
  );

  return { success: true, message: "variant metrics를 새로고침했습니다.", abTest, warnings: warnings.length > 0 ? warnings : undefined };
}

/** article/social_post 상세 화면에서 보여줄 A/B test 요약을 만든다. */
export async function summarizeAbTest(abTestId: string): Promise<AbTestSummary | null> {
  const abTest = await getAbTestById(abTestId);
  if (!abTest) return null;
  const variants = await listVariantsByAbTest(abTestId);

  return {
    id: abTest.id,
    testName: abTest.testName,
    testType: abTest.testType,
    testStatus: abTest.testStatus,
    platform: abTest.platform,
    primaryMetric: abTest.primaryMetric,
    variantCount: variants.length,
    winnerSocialPostId: abTest.winnerSocialPostId,
    createdAt: abTest.createdAt,
    updatedAt: abTest.updatedAt,
  };
}

/** article 하나에 속한 모든 A/B test 목록을 조회한다. */
export async function listAbTestsForArticle(articleId: string): Promise<SocialAbTest[]> {
  return listAbTestsByArticle(articleId);
}

/** social_post 하나가 속한 A/B test 목록을 조회한다. */
export async function listAbTestsForSocialPost(socialPostId: string): Promise<SocialAbTest[]> {
  return listAbTestsBySocialPost(socialPostId);
}
