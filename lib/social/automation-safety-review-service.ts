// Phase 3-22: Automation Safety Review — 전체 안전 점검을 조합하는
// orchestrating 서비스. 이 서비스는 어떤 데이터도 수정하지 않으며,
// feature flag/publish workflow/logging/content safety 점검 결과를
// 모아 하나의 요약으로 반환한다. 로그에는 상태/개수만 남기고 민감정보나
// 전체 payload는 절대 남기지 않는다.

import { logEvent } from "@/lib/harness/logger";
import { auditPublishingFeatureFlags } from "./feature-flag-safety-auditor";
import { auditRecentPipelineLogsForSensitiveData } from "./logging-security-auditor";
import { auditPublishWorkflowSafety } from "./publish-workflow-safety-auditor";
import { auditContentSafetyRules } from "./content-safety-auditor";
import { AUTOMATION_SAFETY_CHECKLIST } from "./automation-safety-checklist";
import type {
  AutomationSafetyCategory,
  AutomationSafetyCategoryResult,
  AutomationSafetyFinding,
  AutomationSafetyRecommendation,
  AutomationSafetyReviewResult,
  AutomationSafetyStatus,
} from "./automation-safety-review-types";

export interface RunAutomationSafetyReviewOptions {
  /** 로깅 대상 pipeline_logs 조회 개수(기본값은 auditor 내부 기본값 사용). */
  logAuditLimit?: number;
}

function severityRank(status: AutomationSafetyStatus): number {
  switch (status) {
    case "failed":
      return 4;
    case "blocked":
      return 3;
    case "warning":
      return 2;
    case "safe":
      return 1;
    case "not_checked":
      return 0;
  }
}

function worstStatus(a: AutomationSafetyStatus, b: AutomationSafetyStatus): AutomationSafetyStatus {
  return severityRank(a) >= severityRank(b) ? a : b;
}

function findingToStatus(severity: AutomationSafetyFinding["severity"]): AutomationSafetyStatus {
  if (severity === "critical") return "blocked";
  if (severity === "high" || severity === "medium") return "warning";
  return "safe";
}

function buildCategoryResult(category: AutomationSafetyCategory, findings: AutomationSafetyFinding[]): AutomationSafetyCategoryResult {
  let status: AutomationSafetyStatus = "safe";
  for (const finding of findings) {
    status = worstStatus(status, findingToStatus(finding.severity));
  }
  return { category, status, findings };
}

/**
 * 전체 automation safety review를 실행한다. 어떤 데이터도 수정하지 않으며,
 * feature flag 실제 값, API key/token 값, 콘텐츠 전체 원문은 절대 반환/로깅하지 않는다.
 */
export async function runAutomationSafetyReview(
  options: RunAutomationSafetyReviewOptions = {}
): Promise<AutomationSafetyReviewResult> {
  const checkedAt = new Date().toISOString();

  await logEvent({
    type: "automation_safety_review_started",
    status: "info",
    message: "automation safety review를 시작합니다.",
    details: { reasonCode: "manual_trigger" },
  });

  try {
    const findings: AutomationSafetyFinding[] = [];

    // 1) feature flag 점검
    const flagAudit = auditPublishingFeatureFlags();
    const flagFindings: AutomationSafetyFinding[] = flagAudit
      .filter((f) => f.status !== "safe")
      .map((f) => ({
        id: `feature_flags.${f.flagName}`,
        category: "feature_flags" as const,
        severity: f.severity,
        message: f.message,
      }));
    findings.push(...flagFindings);

    await logEvent({
      type: "automation_safety_feature_flags_audited",
      status: "success",
      message: "feature flag 안전 점검을 완료했습니다.",
      details: {
        checkedCategories: ["feature_flags"],
        findingCount: flagFindings.length,
      },
    });

    // 2) publish workflow 점검 (approval/guard/duplicate/api_publish 등 포함)
    const workflowRisks = await auditPublishWorkflowSafety();
    const workflowFindings: AutomationSafetyFinding[] = workflowRisks.map((r) => ({
      id: `publish_guards.${r.ruleId}`,
      category: (r.ruleId.startsWith("api_publish") ? "api_publish" : "publish_guards") as AutomationSafetyCategory,
      severity: r.severity,
      message: r.message,
      sampleIds: r.sampleIds,
      count: r.count,
    }));
    findings.push(...workflowFindings);

    await logEvent({
      type: "automation_safety_publish_workflow_audited",
      status: "success",
      message: "publish workflow 안전 점검을 완료했습니다.",
      details: {
        checkedCategories: ["approval_gates", "publish_guards", "api_publish"],
        findingCount: workflowFindings.length,
      },
    });

    // 3) logging 보안 점검
    const loggingFindings = await auditRecentPipelineLogsForSensitiveData(options.logAuditLimit);
    const loggingSafetyFindings: AutomationSafetyFinding[] = loggingFindings.map((f) => ({
      id: `logging_security.${f.findingType}.${f.logId}`,
      category: "logging_security" as const,
      severity: f.severity,
      message: `pipeline_logs에서 ${f.findingType} 패턴이 발견되었습니다 (event: ${f.eventName}).`,
      sampleIds: [f.logId],
    }));
    findings.push(...loggingSafetyFindings);

    await logEvent({
      type: "automation_safety_logging_audited",
      status: "success",
      message: "로그 보안 점검을 완료했습니다.",
      details: {
        checkedCategories: ["logging_security"],
        findingCount: loggingSafetyFindings.length,
      },
    });

    // 4) 콘텐츠 안전 규칙 점검
    const contentAudit = await auditContentSafetyRules();
    const missingRuleFindings: AutomationSafetyFinding[] = contentAudit.ruleChecks
      .filter((r) => !r.exists)
      .map((r) => ({
        id: `content_safety.${r.id}`,
        category: "content_safety" as const,
        severity: "high" as const,
        message: r.message,
      }));
    const sampleContentFindings: AutomationSafetyFinding[] = contentAudit.sampleFindings.map((s) => ({
      id: `content_safety.sample.${s.socialPostId}`,
      category: "content_safety" as const,
      severity: s.severity,
      message: `social_post에서 금지 표현 의심 패턴이 ${s.findingCount}건 발견되었습니다.`,
      sampleIds: [s.socialPostId],
      count: s.findingCount,
    }));
    findings.push(...missingRuleFindings, ...sampleContentFindings);

    await logEvent({
      type: "automation_safety_content_rules_audited",
      status: "success",
      message: "콘텐츠 안전 규칙 점검을 완료했습니다.",
      details: {
        checkedCategories: ["content_safety"],
        findingCount: missingRuleFindings.length + sampleContentFindings.length,
      },
    });

    // 5) rollback / manual_workflow / data_integrity / environment는 정적 문서화 항목이므로
    //    findings 없이 checklist 항목 자체가 "문서화됨" 상태로 표시된다 (docs/phase-3-22 참고).

    const categories: AutomationSafetyCategory[] = [
      "feature_flags",
      "approval_gates",
      "publish_guards",
      "api_publish",
      "logging_security",
      "content_safety",
      "data_integrity",
      "rollback",
      "manual_workflow",
      "environment",
    ];

    const categoryResults: AutomationSafetyCategoryResult[] = categories.map((category) =>
      buildCategoryResult(
        category,
        findings.filter((f) => f.category === category)
      )
    );

    const blockers = findings.filter((f) => f.severity === "critical");
    const warnings = findings.filter((f) => f.severity === "high" || f.severity === "medium");

    let status: AutomationSafetyStatus = "safe";
    for (const result of categoryResults) {
      status = worstStatus(status, result.status);
    }

    const recommendations: AutomationSafetyRecommendation[] = findings.map((f) => ({
      id: `recommendation.${f.id}`,
      category: f.category,
      severity: f.severity,
      message:
        f.severity === "critical"
          ? `[즉시 조치 필요] ${f.message}`
          : `[검토 권장] ${f.message}`,
    }));

    const summary =
      status === "safe"
        ? "심각한 안전 문제가 발견되지 않았습니다. 실제 자동 게시는 여전히 비활성화 상태를 유지해야 합니다."
        : status === "warning"
          ? `주의가 필요한 항목이 ${warnings.length}건 발견되었습니다.`
          : `게시를 차단해야 하는 심각한 문제가 ${blockers.length}건 발견되었습니다. 즉시 확인하세요.`;

    await logEvent({
      type: "automation_safety_review_completed",
      status: "success",
      message: "automation safety review를 완료했습니다.",
      details: {
        status,
        blockerCount: blockers.length,
        warningCount: warnings.length,
        criticalCount: blockers.length,
        findingCount: findings.length,
        checkedCategories: categories,
      },
    });

    return {
      status,
      summary,
      checklist: AUTOMATION_SAFETY_CHECKLIST,
      categoryResults,
      findings,
      recommendations,
      blockers,
      warnings,
      checkedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    await logEvent({
      type: "automation_safety_review_failed",
      status: "failed",
      message: `automation safety review 실행 중 오류가 발생했습니다: ${message}`,
      details: { reasonCode: "review_execution_error" },
    });
    throw error;
  }
}
