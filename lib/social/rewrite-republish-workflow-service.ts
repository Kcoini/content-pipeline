// Phase 3-13: Rewrite Re-approval & Re-export Workflow — 진행 상태 계산.
// rewrite version이 재게시 준비 파이프라인(재승인 → 재export → guard →
// dry-run → handoff → manual posting) 중 어디에 있는지 계산하고, 다음에
// 무엇을 해야 하는지 안내한다. 이 서비스는 어떤 상태도 자동으로
// 전진시키지 않는다 — 각 단계는 사람이 버튼을 눌러야 진행된다.

import { getRewriteVersionForReapproval, updateRewriteRepublishWorkflowStatus } from "@/lib/repositories/social-posts-repository";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { RewriteRepublishWorkflowStatus, SocialPost } from "./social-platform-types";

export interface RewriteRepublishWorkflowResult {
  status: RewriteRepublishWorkflowStatus;
  summary: Record<string, unknown>;
  nextAction: string;
  warnings: string[];
  blockedReasons: string[];
}

async function logWorkflowEvent(
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

function buildSummary(post: SocialPost): Record<string, unknown> {
  return {
    isRewriteVersion: post.isRewriteVersion,
    recommendedForRepost: post.recommendedForRepost,
    versionComparisonStatus: post.versionComparisonStatus,
    qualityStatus: post.qualityStatus,
    approvalStatus: post.approvalStatus,
    rewriteReapprovalStatus: post.rewriteReapprovalStatus,
    rewriteReexportStatus: post.rewriteReexportStatus,
    exportStatus: post.exportStatus,
    platformPublishGuardStatus: post.platformPublishGuardStatus,
    platformPublishReady: post.platformPublishReady,
    dryRunStatus: post.platformPublishDryRunStatus,
    handoffStatus: post.handoffStatus,
    manualPostStatus: post.manualPostStatus,
  };
}

/**
 * rewrite version의 재게시 준비 상태를 계산한다(읽기 전용, 저장하지
 * 않음). 실제 저장은 refreshRewriteRepublishWorkflowStatus()가 담당한다.
 */
function computeWorkflowStatus(post: SocialPost): RewriteRepublishWorkflowResult {
  const warnings: string[] = [];
  const blockedReasons: string[] = [];

  if (!post.isRewriteVersion) warnings.push("is_rewrite_version=false입니다 — 이 workflow는 rewrite version 전용입니다.");
  if (!post.recommendedForRepost) warnings.push("recommended_for_repost=false입니다.");
  if (post.qualityStatus !== "ready") warnings.push(`quality_status가 'ready'가 아닙니다(${post.qualityStatus}).`);

  const build = (status: RewriteRepublishWorkflowStatus, nextAction: string): RewriteRepublishWorkflowResult => ({
    status,
    summary: buildSummary(post),
    nextAction,
    warnings,
    blockedReasons,
  });

  if (["rejected", "revoked", "blocked", "failed"].includes(post.rewriteReapprovalStatus)) {
    blockedReasons.push(`rewrite_reapproval_status=${post.rewriteReapprovalStatus}`);
    return build("blocked", "재승인 상태를 확인하세요.");
  }
  if (post.rewriteReexportStatus === "blocked" || post.rewriteReexportStatus === "failed") {
    blockedReasons.push(`rewrite_reexport_status=${post.rewriteReexportStatus}`);
    return build("blocked", "재export 상태를 확인하세요.");
  }

  if (post.manualPostStatus === "posted") return build("manual_post_recorded", "수동 게시가 기록되었습니다.");
  if (post.handoffStatus === "completed") return build("handoff_completed", "Manual Posting Result를 기록하세요.");
  if (post.handoffStatus === "ready") return build("handoff_ready", "Handoff를 완료하세요.");
  if (post.platformPublishDryRunStatus === "ready") return build("dry_run_ready", "Handoff를 준비하세요.");
  if (post.platformPublishGuardStatus === "ready" && post.platformPublishReady) return build("guard_ready", "Publish Dry-run을 생성하세요.");
  if (post.rewriteReexportStatus === "exported") return build("reexported", "Platform Publishing Guard를 실행하세요.");
  if (post.rewriteReexportStatus === "ready") return build("reexport_ready", "재Export payload를 생성하세요.");
  if (post.rewriteReapprovalStatus === "approved") return build("reapproved", "재Export를 준비하세요.");
  if (post.rewriteReapprovalStatus === "pending_review") return build("reapproval_pending", "재승인을 완료(승인/반려)하세요.");
  if (post.rewriteReapprovalStatus === "not_requested") return build("ready_for_reapproval", "재승인을 요청하세요.");

  return build("not_started", "");
}

/** rewrite version의 재게시 workflow 상태를 계산한다(저장하지 않음). */
export async function getRewriteRepublishWorkflowStatus(socialPostId: string): Promise<RewriteRepublishWorkflowResult | null> {
  const post = await getRewriteVersionForReapproval(socialPostId);
  if (!post) return null;
  return computeWorkflowStatus(post);
}

/** rewrite version의 재게시 workflow 상태를 다시 계산해 social_posts에 저장한다. */
export async function refreshRewriteRepublishWorkflowStatus(
  socialPostId: string
): Promise<{ success: boolean; message: string; result?: RewriteRepublishWorkflowResult; socialPost?: SocialPost }> {
  const post = await getRewriteVersionForReapproval(socialPostId);
  if (!post) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  try {
    const result = computeWorkflowStatus(post);
    const updated = await updateRewriteRepublishWorkflowStatus(socialPostId, { status: result.status, summary: result.summary });

    await logWorkflowEvent(
      "social_rewrite_republish_workflow_refreshed",
      "info",
      `social post(${socialPostId})의 재게시 workflow 상태가 갱신되었습니다 (status: ${result.status}).`,
      post.articleId,
      {
        socialPostId,
        articleId: post.articleId,
        platform: post.platform,
        toneStyle: post.toneStyle,
        rootSocialPostId: post.rootSocialPostId,
        parentSocialPostId: post.parentSocialPostId,
        versionNumber: post.versionNumber,
        recommendedForRepost: post.recommendedForRepost,
        versionComparisonStatus: post.versionComparisonStatus,
        qualityStatus: post.qualityStatus,
        approvalStatus: post.approvalStatus,
        rewriteReapprovalStatus: post.rewriteReapprovalStatus,
        rewriteReexportStatus: post.rewriteReexportStatus,
        rewriteRepublishWorkflowStatus: result.status,
        exportStatus: post.exportStatus,
        platformPublishGuardStatus: post.platformPublishGuardStatus,
        platformPublishReady: post.platformPublishReady,
        dryRunStatus: post.platformPublishDryRunStatus,
        handoffStatus: post.handoffStatus,
        manualPostStatus: post.manualPostStatus,
        nextAction: result.nextAction,
        warningCount: result.warnings.length,
        blockedCount: result.blockedReasons.length,
      }
    );

    return { success: true, message: `workflow 상태: ${result.status}`, result, socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logWorkflowEvent("social_rewrite_republish_workflow_failed", "failed", `workflow 상태 갱신 실패: ${message}`, post.articleId, {
      socialPostId,
      platform: post.platform,
    });
    return { success: false, message };
  }
}
