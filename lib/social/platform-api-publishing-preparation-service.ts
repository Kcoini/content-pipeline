// Phase 3-21: Platform API Publishing Preparation — 조회 전용 준비
// 서비스. 이 서비스는 social_posts의 "API 게시 준비 상태 요약" 컬럼
// 몇 개만 갱신할 뿐, 다른 어떤 workflow(승인/export/handoff/manual
// posting)도 바꾸지 않는다. 어떤 함수도 외부 API를 호출하지 않는다.

import { getSocialPostForApiPublishPreparation, updateApiPublishPreparationSummary } from "@/lib/repositories/social-posts-repository";
import { checkPlatformApiReadiness, type PlatformApiReadinessResult } from "./platform-api-readiness-checker";
import { checkPlatformApiPublishEligibility, type PlatformApiPublishEligibility } from "./platform-api-publish-eligibility-guard";
import { buildPlatformApiPublishDryRunPayload, type PlatformApiPublishDryRunPayload } from "./platform-api-publish-payload-builder";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { SocialPlatform } from "./social-platform-types";
import type { PlatformApiPreparationStatus } from "./social-platform-types";

export interface PlatformApiPublishPreparationResult {
  socialPostId: string;
  platform: SocialPlatform;
  readiness: PlatformApiReadinessResult;
  eligibility: PlatformApiPublishEligibility;
  dryRunPayload: PlatformApiPublishDryRunPayload | null;
  warnings: string[];
  blockers: string[];
  nextAction: string;
}

async function logPreparationEvent(
  type: LogEventType,
  status: LogStatus,
  message: string,
  articleId: string | undefined,
  details: Record<string, unknown>
): Promise<void> {
  await logEvent({
    type,
    status,
    message,
    ...(articleId ? { articleId, targetType: "article", targetId: articleId } : {}),
    details,
  });
}

/** readiness/eligibility 결과를 social_posts.api_publish_preparation_status 값으로 매핑한다. */
function decidePreparationStatus(
  readiness: PlatformApiReadinessResult,
  eligibility: PlatformApiPublishEligibility
): PlatformApiPreparationStatus {
  if (readiness.status === "not_supported") return "blocked";
  if (readiness.status === "disabled") return "disabled";
  if (readiness.status === "missing_config") return "missing_config";
  if (readiness.status === "blocked") return "blocked";
  if (!eligibility.eligibleForDryRun) return "blocked";
  return readiness.status; // "dry_run_ready" | "ready_for_future_test"
}

/**
 * social_post 하나의 API 게시 준비 상태(readiness+eligibility+dry-run
 * payload)를 계산하고 social_posts 요약 컬럼에 저장한다. 실제 API
 * publish attempt는 절대 만들지 않는다.
 */
export async function preparePlatformApiPublishing(
  socialPostId: string,
  preparedBy?: string
): Promise<PlatformApiPublishPreparationResult> {
  const socialPost = await getSocialPostForApiPublishPreparation(socialPostId);

  if (!socialPost) {
    await logPreparationEvent("social_platform_api_publish_prepare_failed", "failed", `social post를 찾을 수 없습니다: ${socialPostId}`, undefined, {
      socialPostId,
      reasonCode: "social_post_not_found",
    });
    throw new Error(`social post를 찾을 수 없습니다: ${socialPostId}`);
  }

  await logPreparationEvent(
    "social_platform_api_publish_prepare_started",
    "info",
    `social post(${socialPostId})의 API 게시 준비 상태 확인을 시작합니다.`,
    socialPost.articleId,
    { socialPostId, articleId: socialPost.articleId, platform: socialPost.platform }
  );

  const readiness = checkPlatformApiReadiness(socialPost.platform);
  await logPreparationEvent(
    "social_platform_api_readiness_checked",
    "info",
    `platform(${socialPost.platform}) API readiness를 확인했습니다 (status: ${readiness.status}).`,
    socialPost.articleId,
    {
      socialPostId,
      articleId: socialPost.articleId,
      platform: socialPost.platform,
      readinessStatus: readiness.status,
      publishEnabled: readiness.publishEnabled,
      dryRunOnly: readiness.dryRunOnly,
      missingConfigCount: readiness.missingEnvVars.length,
    }
  );

  const eligibility = await checkPlatformApiPublishEligibility(socialPostId);
  const dryRunPayload = eligibility.eligibleForDryRun ? await buildPlatformApiPublishDryRunPayload(socialPostId) : null;

  if (dryRunPayload) {
    await logPreparationEvent(
      "social_platform_api_dry_run_payload_built",
      "success",
      `social post(${socialPostId})의 API dry-run payload를 생성했습니다.`,
      socialPost.articleId,
      { socialPostId, articleId: socialPost.articleId, platform: socialPost.platform, validationValid: dryRunPayload.validation.valid }
    );
  }

  const warnings = [...readiness.warnings, ...eligibility.warnings, ...(dryRunPayload?.warnings ?? [])];
  const blockers = [...readiness.blockers, ...eligibility.blockers, ...(dryRunPayload && !dryRunPayload.validation.valid ? dryRunPayload.validation.errors : [])];
  const preparationStatus = decidePreparationStatus(readiness, eligibility);

  await updateApiPublishPreparationSummary(socialPostId, {
    preparationStatus,
    readinessStatus: readiness.status,
    eligibleForDryRun: eligibility.eligibleForDryRun,
    eligibleForActualPublish: eligibility.eligibleForActualPublish,
    preparationSummary: {
      blockerCount: blockers.length,
      warningCount: warnings.length,
      missingConfigCount: readiness.missingEnvVars.length,
      fallbackMode: readiness.fallbackMode,
    },
    preparedBy: preparedBy ?? null,
    blockedReason: blockers[0] ?? null,
  });

  const eventType: LogEventType = blockers.length > 0 ? "social_platform_api_publish_prepare_blocked" : "social_platform_api_publish_prepare_completed";
  await logPreparationEvent(
    eventType,
    blockers.length > 0 ? "failed" : "success",
    `social post(${socialPostId})의 API 게시 준비 상태 확인을 완료했습니다 (status: ${preparationStatus}).`,
    socialPost.articleId,
    {
      socialPostId,
      articleId: socialPost.articleId,
      platform: socialPost.platform,
      preparationStatus,
      readinessStatus: readiness.status,
      eligibleForDryRun: eligibility.eligibleForDryRun,
      eligibleForActualPublish: eligibility.eligibleForActualPublish,
      blockerCount: blockers.length,
      warningCount: warnings.length,
      missingConfigCount: readiness.missingEnvVars.length,
      dryRunOnly: readiness.dryRunOnly,
      publishEnabled: readiness.publishEnabled,
      fallbackMode: readiness.fallbackMode,
    }
  );

  return {
    socialPostId,
    platform: socialPost.platform,
    readiness,
    eligibility,
    dryRunPayload,
    warnings,
    blockers,
    nextAction: eligibility.nextAction,
  };
}
