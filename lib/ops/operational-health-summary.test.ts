import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PipelineLogEntry } from "@/lib/repositories/log-repository";

const getLogsByTypesAndRange = vi.fn();

vi.mock("@/lib/repositories/log-repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/repositories/log-repository")>(
    "@/lib/repositories/log-repository"
  );
  return {
    ...actual,
    getLogsByTypesAndRange: (...args: unknown[]) => getLogsByTypesAndRange(...args),
  };
});

const { buildOperationalHealthSummary } = await import("./operational-health-summary");

function entry(type: PipelineLogEntry["type"], status: PipelineLogEntry["status"] = "success"): PipelineLogEntry {
  return {
    id: `log-${Math.random()}`,
    type,
    status,
    message: "테스트 로그",
    details: {},
    createdAt: "2026-09-23T00:00:00.000Z",
  };
}

beforeEach(() => {
  getLogsByTypesAndRange.mockReset();
});

describe("buildOperationalHealthSummary", () => {
  it("실행 실패(job_run_failed 등)를 failures에 정확히 센다", async () => {
    getLogsByTypesAndRange.mockResolvedValue([
      entry("job_run_failed", "failed"),
      entry("ai_generation_failed", "failed"),
      entry("wordpress_actual_publish_failed", "failed"),
    ]);

    const summary = await buildOperationalHealthSummary();

    expect(summary.jobs.failed).toBe(1);
    expect(summary.failures.generation).toBe(1);
    expect(summary.failures.wordpressDraft).toBe(1);
    expect(summary.failures.total).toBe(3); // job_run_failed(other) + generation + wordpressDraft
  });

  it("business 차단 상태(guard blocked/quality gate blocked)는 failures에 포함하지 않는다", async () => {
    getLogsByTypesAndRange.mockResolvedValue([
      entry("social_platform_publish_guard_blocked", "success"), // QA-01-FIX1/OPS-02B 수정 이후 실제로 저장되는 값
      entry("publish_quality_gate_blocked", "success"),
      entry("social_quality_gate_blocked", "success"),
    ]);

    const summary = await buildOperationalHealthSummary();

    expect(summary.failures.total).toBe(0);
    expect(summary.businessBlocked.publishGuardBlocked).toBe(1);
    expect(summary.businessBlocked.qualityGateBlocked).toBe(2);
  });

  it("stalled job을 별도로 센다(실행 실패와 구분)", async () => {
    getLogsByTypesAndRange.mockResolvedValue([entry("job_run_stalled_detected", "info")]);

    const summary = await buildOperationalHealthSummary();

    expect(summary.jobs.stalled).toBe(1);
    expect(summary.failures.total).toBe(0);
  });

  it("정상 완료 run은 completed로 집계되고 어떤 failure에도 잡히지 않는다", async () => {
    getLogsByTypesAndRange.mockResolvedValue([entry("job_run_completed", "success")]);

    const summary = await buildOperationalHealthSummary();

    expect(summary.jobs.completed).toBe(1);
    expect(summary.failures.total).toBe(0);
    expect(summary.jobs.failed).toBe(0);
  });

  it("since/until을 그대로 getLogsByTypesAndRange에 전달한다", async () => {
    getLogsByTypesAndRange.mockResolvedValue([]);

    const summary = await buildOperationalHealthSummary({ since: "2026-09-01T00:00:00.000Z", until: "2026-09-23T00:00:00.000Z" });

    expect(getLogsByTypesAndRange).toHaveBeenCalledWith(
      expect.any(Array),
      { since: "2026-09-01T00:00:00.000Z", until: "2026-09-23T00:00:00.000Z" }
    );
    expect(summary.rangeSince).toBe("2026-09-01T00:00:00.000Z");
    expect(summary.rangeUntil).toBe("2026-09-23T00:00:00.000Z");
  });

  it("evaluationFailuresNotInstrumented가 항상 true다(미계측 값을 0건 실패처럼 보이게 하지 않는다)", async () => {
    getLogsByTypesAndRange.mockResolvedValue([]);

    const summary = await buildOperationalHealthSummary();

    expect(summary.evaluationFailuresNotInstrumented).toBe(true);
  });
});
