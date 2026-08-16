// Phase 3-21: Platform API Publishing Preparation.
// social_post 하나가 "API dry-run을 시도해도 되는지" / "실제 API
// 게시로 진행해도 되는지"를 판정하는 read-only guard다. 어떤 함수도
// DB를 변경하거나 외부 API를 호출하지 않는다. eligibleForActualPublish는
// PLATFORM_API_PUBLISHING_ENABLED=false 또는 PLATFORM_API_DRY_RUN_ONLY=true
// (기본값)인 한 항상 false다.

import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { checkPlatformApiReadiness } from "./platform-api-readiness-checker";

export interface PlatformApiPublishEligibility {
  socialPostId: string;
  eligibleForDryRun: boolean;
  eligibleForActualPublish: boolean;
  blockers: string[];
  warnings: string[];
  nextAction: string;
}

/** social_post 하나의 API 게시 적격성을 판정한다. */
export async function checkPlatformApiPublishEligibility(socialPostId: string): Promise<PlatformApiPublishEligibility> {
  const socialPost = await getSocialPostById(socialPostId);
  if (!socialPost) {
    return {
      socialPostId,
      eligibleForDryRun: false,
      eligibleForActualPublish: false,
      blockers: [`social post를 찾을 수 없습니다: ${socialPostId}`],
      warnings: [],
      nextAction: "social_post_id를 확인하세요.",
    };
  }

  const readiness = checkPlatformApiReadiness(socialPost.platform);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (socialPost.qualityStatus !== "ready") blockers.push(`quality_status가 'ready'가 아닙니다 (현재: ${socialPost.qualityStatus}).`);
  if (socialPost.approvalStatus !== "approved") blockers.push(`approval_status가 'approved'가 아닙니다 (현재: ${socialPost.approvalStatus}).`);
  if (socialPost.exportStatus !== "ready" && socialPost.exportStatus !== "exported") {
    blockers.push(`export_status가 'ready'/'exported'가 아닙니다 (현재: ${socialPost.exportStatus}).`);
  }
  if (socialPost.platformPublishGuardStatus !== "ready") {
    blockers.push(`platform_publish_guard_status가 'ready'가 아닙니다 (현재: ${socialPost.platformPublishGuardStatus}).`);
  }
  if (!socialPost.platformPublishReady) blockers.push("platform_publish_ready가 true가 아닙니다.");
  if (socialPost.platformPublishDryRunStatus !== "ready") {
    blockers.push(`platform_publish_dry_run_status가 'ready'가 아닙니다 (현재: ${socialPost.platformPublishDryRunStatus}).`);
  }
  if (socialPost.handoffStatus !== "ready" && socialPost.handoffStatus !== "completed") {
    warnings.push(`handoff_status가 'ready'/'completed'가 아닙니다 (현재: ${socialPost.handoffStatus}) — API mode에서는 handoff 없이도 dry-run은 가능합니다.`);
  }
  if (socialPost.publishStatus === "published") blockers.push("이미 publish_status='published'입니다.");
  if (socialPost.manualPostStatus === "posted") warnings.push("manual_post_status='posted'입니다 — 이미 수동으로 게시된 글입니다.");

  if (readiness.status === "not_supported") blockers.push(`${socialPost.platform}는 API dry-run을 지원하지 않습니다.`);
  blockers.push(...readiness.blockers);
  warnings.push(...readiness.warnings);

  const eligibleForDryRun = readiness.status !== "not_supported";
  const readinessAllowsActual = readiness.status === "dry_run_ready" || readiness.status === "ready_for_future_test";
  const eligibleForActualPublish = blockers.length === 0 && readinessAllowsActual && readiness.publishEnabled && !readiness.dryRunOnly;

  let nextAction: string;
  if (eligibleForActualPublish) {
    // 이번 Phase 코드에는 실제 게시 실행 경로가 없다 — 조건이 모두 충족돼도 여기서 멈춘다.
    nextAction = "모든 조건이 충족됐지만, 실제 API 게시 실행은 이번 단계 코드에 구현되어 있지 않습니다.";
  } else if (eligibleForDryRun) {
    nextAction = "dry-run payload를 확인하세요. 실제 게시는 아직 준비되지 않았습니다.";
  } else {
    nextAction = "blocker를 먼저 해결하세요.";
  }

  return { socialPostId, eligibleForDryRun, eligibleForActualPublish, blockers, warnings, nextAction };
}
