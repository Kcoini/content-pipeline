import { beforeEach, describe, expect, it, vi } from "vitest";

const listRecentPipelineLogsForAudit = vi.fn();

vi.mock("@/lib/repositories/automation-safety-review-repository", () => ({
  listRecentPipelineLogsForAudit: (...args: unknown[]) => listRecentPipelineLogsForAudit(...args),
}));

const { auditRecentPipelineLogsForSensitiveData } = await import("./logging-security-auditor");

function makeLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "log-1",
    type: "automation_safety_review_started",
    status: "info",
    message: "정상 로그입니다.",
    details: { status: "safe" },
    createdAt: "2026-08-16T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  listRecentPipelineLogsForAudit.mockReset();
});

describe("auditRecentPipelineLogsForSensitiveData", () => {
  it("민감정보가 없는 로그는 findings가 비어 있다", async () => {
    listRecentPipelineLogsForAudit.mockResolvedValue([makeLog()]);
    const result = await auditRecentPipelineLogsForSensitiveData();
    expect(result).toEqual([]);
  });

  it("Authorization 패턴을 탐지한다", async () => {
    listRecentPipelineLogsForAudit.mockResolvedValue([
      makeLog({ details: { note: "Authorization: Bearer abcdef" } }),
    ]);
    const result = await auditRecentPipelineLogsForSensitiveData();
    expect(result.some((f) => f.findingType === "authorization_header")).toBe(true);
  });

  it("access_token 패턴을 탐지한다", async () => {
    listRecentPipelineLogsForAudit.mockResolvedValue([makeLog({ details: { access_token: "abcdef123456" } })]);
    const result = await auditRecentPipelineLogsForSensitiveData();
    expect(result.some((f) => f.findingType === "access_token")).toBe(true);
  });

  it("client_secret 패턴을 탐지한다", async () => {
    listRecentPipelineLogsForAudit.mockResolvedValue([makeLog({ message: "client_secret 노출 의심" })]);
    const result = await auditRecentPipelineLogsForSensitiveData();
    expect(result.some((f) => f.findingType === "client_secret")).toBe(true);
  });

  it("지나치게 긴 텍스트는 full payload 의심으로 탐지한다", async () => {
    listRecentPipelineLogsForAudit.mockResolvedValue([makeLog({ message: "a".repeat(600) })]);
    const result = await auditRecentPipelineLogsForSensitiveData();
    expect(result.some((f) => f.findingType === "suspicious_full_post_body")).toBe(true);
  });

  it("매칭된 민감정보 값 자체는 결과에 포함되지 않는다", async () => {
    const secretValue = "Bearer super-secret-token-value-xyz";
    listRecentPipelineLogsForAudit.mockResolvedValue([makeLog({ details: { note: secretValue } })]);
    const result = await auditRecentPipelineLogsForSensitiveData();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(secretValue);
    expect(serialized).not.toContain("super-secret-token-value-xyz");
  });
});
