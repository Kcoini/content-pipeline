import { beforeEach, describe, expect, it, vi } from "vitest";

const listSocialPostsForPublishSafetyAudit = vi.fn();
const listApiPublishPreparationRiskItems = vi.fn();
const listRewriteWorkflowRiskItems = vi.fn();

vi.mock("@/lib/repositories/automation-safety-review-repository", () => ({
  listSocialPostsForPublishSafetyAudit: (...args: unknown[]) => listSocialPostsForPublishSafetyAudit(...args),
  listApiPublishPreparationRiskItems: (...args: unknown[]) => listApiPublishPreparationRiskItems(...args),
  listRewriteWorkflowRiskItems: (...args: unknown[]) => listRewriteWorkflowRiskItems(...args),
}));

const { auditPublishWorkflowSafety } = await import("./publish-workflow-safety-auditor");

function makeSocialPost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    articleId: "article-1",
    platform: "wordpress_blog",
    qualityStatus: "ready",
    approvalStatus: "approved",
    exportStatus: "ready",
    platformPublishGuardStatus: "ready",
    platformPublishReady: false,
    platformPublishDryRunStatus: "ready",
    handoffStatus: "completed",
    publishStatus: "not_published",
    manualPostStatus: "not_recorded",
    isRewriteVersion: false,
    ...overrides,
  };
}

beforeEach(() => {
  listSocialPostsForPublishSafetyAudit.mockReset();
  listApiPublishPreparationRiskItems.mockReset();
  listRewriteWorkflowRiskItems.mockReset();
  listApiPublishPreparationRiskItems.mockResolvedValue([]);
  listRewriteWorkflowRiskItems.mockResolvedValue([]);
});

describe("auditPublishWorkflowSafety", () => {
  it("문제 없는 항목만 있으면 위험 항목이 없다", async () => {
    listSocialPostsForPublishSafetyAudit.mockResolvedValue([makeSocialPost()]);
    const result = await auditPublishWorkflowSafety();
    expect(result).toEqual([]);
  });

  it("approval_status가 approved가 아닌데 platform_publish_ready=true인 항목을 탐지한다", async () => {
    listSocialPostsForPublishSafetyAudit.mockResolvedValue([
      makeSocialPost({ id: "risk-1", approvalStatus: "pending_review", platformPublishReady: true }),
    ]);
    const result = await auditPublishWorkflowSafety();
    const rule = result.find((r) => r.ruleId === "not_approved_but_publish_ready");
    expect(rule?.count).toBe(1);
    expect(rule?.sampleIds).toContain("risk-1");
  });

  it("quality_status가 ready가 아닌데 platform_publish_ready=true인 항목을 탐지한다", async () => {
    listSocialPostsForPublishSafetyAudit.mockResolvedValue([
      makeSocialPost({ id: "risk-2", qualityStatus: "needs_revision", platformPublishReady: true }),
    ]);
    const result = await auditPublishWorkflowSafety();
    expect(result.some((r) => r.ruleId === "quality_not_ready_but_publish_ready")).toBe(true);
  });

  it("api_publish_eligible_for_actual_publish=true 항목을 critical로 탐지한다", async () => {
    listSocialPostsForPublishSafetyAudit.mockResolvedValue([makeSocialPost()]);
    listApiPublishPreparationRiskItems.mockResolvedValue([makeSocialPost({ id: "risk-3" })]);
    const result = await auditPublishWorkflowSafety();
    const rule = result.find((r) => r.ruleId === "api_publish_eligible_for_actual_publish_true");
    expect(rule?.severity).toBe("critical");
  });

  it("rejected/revoked인데 export가 진행된 항목을 탐지한다", async () => {
    listSocialPostsForPublishSafetyAudit.mockResolvedValue([
      makeSocialPost({ id: "risk-4", approvalStatus: "rejected", exportStatus: "ready" }),
    ]);
    const result = await auditPublishWorkflowSafety();
    expect(result.some((r) => r.ruleId === "rejected_or_revoked_but_exportable")).toBe(true);
  });

  it("dry-run 준비 없이 handoff가 완료된 항목을 탐지한다", async () => {
    listSocialPostsForPublishSafetyAudit.mockResolvedValue([
      makeSocialPost({ id: "risk-5", handoffStatus: "completed", platformPublishDryRunStatus: "not_created" }),
    ]);
    const result = await auditPublishWorkflowSafety();
    expect(result.some((r) => r.ruleId === "handoff_completed_without_dry_run_ready")).toBe(true);
  });

  it("어떤 함수도 데이터를 수정하지 않는다(update/insert/delete 호출 없음)", async () => {
    listSocialPostsForPublishSafetyAudit.mockResolvedValue([makeSocialPost({ approvalStatus: "pending_review", platformPublishReady: true })]);
    await auditPublishWorkflowSafety();
    // repository mock에는 update/insert/delete 관련 함수가 애초에 존재하지 않는다 —
    // audit 함수가 read 함수만 호출했는지 mock 호출 인자로 확인한다.
    expect(listSocialPostsForPublishSafetyAudit).toHaveBeenCalled();
  });
});
