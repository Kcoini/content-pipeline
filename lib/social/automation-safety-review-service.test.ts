import { beforeEach, describe, expect, it, vi } from "vitest";

const logEvent = vi.fn();
const auditPublishingFeatureFlags = vi.fn();
const auditRecentPipelineLogsForSensitiveData = vi.fn();
const auditPublishWorkflowSafety = vi.fn();
const auditContentSafetyRules = vi.fn();

vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));
vi.mock("./feature-flag-safety-auditor", () => ({
  auditPublishingFeatureFlags: (...args: unknown[]) => auditPublishingFeatureFlags(...args),
}));
vi.mock("./logging-security-auditor", () => ({
  auditRecentPipelineLogsForSensitiveData: (...args: unknown[]) => auditRecentPipelineLogsForSensitiveData(...args),
}));
vi.mock("./publish-workflow-safety-auditor", () => ({
  auditPublishWorkflowSafety: (...args: unknown[]) => auditPublishWorkflowSafety(...args),
}));
vi.mock("./content-safety-auditor", () => ({
  auditContentSafetyRules: (...args: unknown[]) => auditContentSafetyRules(...args),
}));

const { runAutomationSafetyReview } = await import("./automation-safety-review-service");

beforeEach(() => {
  logEvent.mockReset();
  auditPublishingFeatureFlags.mockReset();
  auditRecentPipelineLogsForSensitiveData.mockReset();
  auditPublishWorkflowSafety.mockReset();
  auditContentSafetyRules.mockReset();

  auditPublishingFeatureFlags.mockReturnValue([]);
  auditRecentPipelineLogsForSensitiveData.mockResolvedValue([]);
  auditPublishWorkflowSafety.mockResolvedValue([]);
  auditContentSafetyRules.mockResolvedValue({ ruleChecks: [{ id: "forbidden_pattern_checker_exists", exists: true, message: "ok" }], sampleFindings: [] });
});

describe("runAutomationSafetyReview", () => {
  it("문제가 없으면 status=safe를 반환한다", async () => {
    const result = await runAutomationSafetyReview();
    expect(result.status).toBe("safe");
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.checklist.length).toBeGreaterThan(0);
  });

  it("critical finding이 있으면 status=blocked를 반환한다", async () => {
    auditPublishingFeatureFlags.mockReturnValue([
      { flagName: "PLATFORM_API_PUBLISHING_ENABLED", configured: true, safeDefault: "false", status: "critical", severity: "critical", message: "위험" },
    ]);
    const result = await runAutomationSafetyReview();
    expect(result.status).toBe("blocked");
    expect(result.blockers.length).toBe(1);
  });

  it("warning 수준 finding만 있으면 status=warning을 반환한다", async () => {
    auditPublishWorkflowSafety.mockResolvedValue([
      { ruleId: "published_but_manual_post_not_recorded", severity: "medium", message: "확인 필요", count: 1, sampleIds: ["p1"] },
    ]);
    const result = await runAutomationSafetyReview();
    expect(result.status).toBe("warning");
    expect(result.warnings.length).toBe(1);
  });

  it("카테고리별 결과와 recommendations를 생성한다", async () => {
    auditPublishWorkflowSafety.mockResolvedValue([
      { ruleId: "not_approved_but_publish_ready", severity: "critical", message: "위험", count: 1, sampleIds: ["p1"] },
    ]);
    const result = await runAutomationSafetyReview();
    expect(result.categoryResults.some((c) => c.category === "publish_guards" && c.status === "blocked")).toBe(true);
    expect(result.recommendations.length).toBe(1);
  });

  it("started/completed 로그를 기록한다", async () => {
    await runAutomationSafetyReview();
    const types = logEvent.mock.calls.map((c) => c[0].type);
    expect(types).toContain("automation_safety_review_started");
    expect(types).toContain("automation_safety_review_completed");
  });

  it("로그 details에는 상태/개수만 담기고 민감정보는 담기지 않는다", async () => {
    await runAutomationSafetyReview();
    for (const call of logEvent.mock.calls) {
      const details = call[0].details ?? {};
      const serialized = JSON.stringify(details);
      expect(serialized).not.toMatch(/authorization|access_token|refresh_token|application_password/i);
    }
  });
});
