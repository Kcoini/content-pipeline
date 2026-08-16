// Phase 3-22: Automation Safety Review — publish workflow 안전 점검(audit only).
// 이 파일은 어떤 데이터도 수정하지 않는다. 위험 항목을 찾아 개수/샘플
// id/심각도/권장 조치만 반환한다. 자동 수정은 하지 않는다.

import {
  listSocialPostsForPublishSafetyAudit,
  listApiPublishPreparationRiskItems,
  listRewriteWorkflowRiskItems,
} from "@/lib/repositories/automation-safety-review-repository";
import type { AutomationSafetySeverity } from "./automation-safety-review-types";
import type { SocialPost } from "./social-platform-types";

export interface PublishWorkflowRiskItem {
  ruleId: string;
  severity: AutomationSafetySeverity;
  message: string;
  count: number;
  sampleIds: string[];
  /** 실제 수정은 하지 않으며, 문서 예시용 SQL만 참고로 제공한다. */
  recommendedFixSql?: string;
}

const MAX_SAMPLE_IDS = 5;

function sample(posts: SocialPost[]): string[] {
  return posts.slice(0, MAX_SAMPLE_IDS).map((p) => p.id);
}

/**
 * 전체 publish workflow의 안전성을 점검한다(read-only, audit only).
 * 자동 수정은 절대 하지 않으며, recommendedFixSql은 문서/참고용 예시일 뿐이다.
 */
export async function auditPublishWorkflowSafety(): Promise<PublishWorkflowRiskItem[]> {
  const posts = await listSocialPostsForPublishSafetyAudit();
  const risks: PublishWorkflowRiskItem[] = [];

  const notApprovedButPublishReady = posts.filter(
    (p) => p.platformPublishReady === true && p.approvalStatus !== "approved"
  );
  if (notApprovedButPublishReady.length > 0) {
    risks.push({
      ruleId: "not_approved_but_publish_ready",
      severity: "critical",
      message: "approval_status가 approved가 아닌데 platform_publish_ready=true인 항목이 있습니다.",
      count: notApprovedButPublishReady.length,
      sampleIds: sample(notApprovedButPublishReady),
      recommendedFixSql:
        "-- 예시: update social_posts set platform_publish_ready = false where id = '<id>' and approval_status <> 'approved';",
    });
  }

  const qualityNotReadyButPublishReady = posts.filter(
    (p) => p.platformPublishReady === true && p.qualityStatus !== "ready"
  );
  if (qualityNotReadyButPublishReady.length > 0) {
    risks.push({
      ruleId: "quality_not_ready_but_publish_ready",
      severity: "critical",
      message: "quality_status가 ready가 아닌데 platform_publish_ready=true인 항목이 있습니다.",
      count: qualityNotReadyButPublishReady.length,
      sampleIds: sample(qualityNotReadyButPublishReady),
      recommendedFixSql:
        "-- 예시: update social_posts set platform_publish_ready = false where id = '<id>' and quality_status <> 'ready';",
    });
  }

  const rejectedOrRevokedButExportable = posts.filter(
    (p) => (p.approvalStatus === "rejected" || p.approvalStatus === "revoked") && p.exportStatus !== "not_exported"
  );
  if (rejectedOrRevokedButExportable.length > 0) {
    risks.push({
      ruleId: "rejected_or_revoked_but_exportable",
      severity: "high",
      message: "approval_status가 rejected/revoked인데 export가 진행된 항목이 있습니다.",
      count: rejectedOrRevokedButExportable.length,
      sampleIds: sample(rejectedOrRevokedButExportable),
    });
  }

  const publishedButManualPostNotRecorded = posts.filter(
    (p) => p.publishStatus === "published" && p.manualPostStatus === "not_recorded"
  );
  if (publishedButManualPostNotRecorded.length > 0) {
    risks.push({
      ruleId: "published_but_manual_post_not_recorded",
      severity: "medium",
      message: "publish_status=published인데 manual_post_status가 not_recorded인 항목이 있습니다.",
      count: publishedButManualPostNotRecorded.length,
      sampleIds: sample(publishedButManualPostNotRecorded),
    });
  }

  const manualPostedButPublishNotPublished = posts.filter(
    (p) => p.manualPostStatus === "posted" && p.publishStatus !== "published"
  );
  if (manualPostedButPublishNotPublished.length > 0) {
    risks.push({
      ruleId: "manual_post_posted_but_publish_status_not_published",
      severity: "medium",
      message: "manual_post_status=posted인데 publish_status가 published가 아닌 항목이 있습니다.",
      count: manualPostedButPublishNotPublished.length,
      sampleIds: sample(manualPostedButPublishNotPublished),
    });
  }

  const apiPublishEligibleForActualPublish = await listApiPublishPreparationRiskItems();
  if (apiPublishEligibleForActualPublish.length > 0) {
    risks.push({
      ruleId: "api_publish_eligible_for_actual_publish_true",
      severity: "critical",
      message: "api_publish_eligible_for_actual_publish=true인 항목이 있습니다. 실제 API 게시는 아직 허용되지 않아야 합니다.",
      count: apiPublishEligibleForActualPublish.length,
      sampleIds: sample(apiPublishEligibleForActualPublish),
      recommendedFixSql:
        "-- 예시: update social_posts set api_publish_eligible_for_actual_publish = false where id = '<id>';",
    });
  }

  const publishReadyButGuardNotReady = posts.filter(
    (p) => p.platformPublishReady === true && p.platformPublishGuardStatus !== "ready"
  );
  if (publishReadyButGuardNotReady.length > 0) {
    risks.push({
      ruleId: "platform_publish_ready_but_guard_not_ready",
      severity: "critical",
      message: "platform_publish_ready=true인데 platform_publish_guard_status가 ready가 아닌 항목이 있습니다.",
      count: publishReadyButGuardNotReady.length,
      sampleIds: sample(publishReadyButGuardNotReady),
    });
  }

  const handoffCompletedWithoutDryRunReady = posts.filter(
    (p) => p.handoffStatus === "completed" && p.platformPublishDryRunStatus !== "ready"
  );
  if (handoffCompletedWithoutDryRunReady.length > 0) {
    risks.push({
      ruleId: "handoff_completed_without_dry_run_ready",
      severity: "high",
      message: "handoff_status=completed인데 platform_publish_dry_run_status가 ready가 아닌 항목이 있습니다.",
      count: handoffCompletedWithoutDryRunReady.length,
      sampleIds: sample(handoffCompletedWithoutDryRunReady),
    });
  }

  const rewriteReexportedWithoutReapproval = await listRewriteWorkflowRiskItems();
  if (rewriteReexportedWithoutReapproval.length > 0) {
    risks.push({
      ruleId: "rewrite_version_reexported_without_reapproval",
      severity: "high",
      message: "재승인 없이 재export된 rewrite version이 있습니다.",
      count: rewriteReexportedWithoutReapproval.length,
      sampleIds: sample(rewriteReexportedWithoutReapproval),
    });
  }

  return risks;
}
