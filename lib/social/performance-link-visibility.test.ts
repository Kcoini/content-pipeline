import { describe, expect, it } from "vitest";
import { shouldShowPerformanceLink } from "./performance-link-visibility";

function makeInput(overrides: Partial<Parameters<typeof shouldShowPerformanceLink>[0]> = {}) {
  return {
    manualPostStatus: "not_recorded" as const,
    latestMetricsRecordedAt: null,
    performanceStatus: "not_measured" as const,
    ...overrides,
  };
}

describe("shouldShowPerformanceLink", () => {
  it("게시 전 + 성과 미측정이면 false를 반환한다", () => {
    expect(shouldShowPerformanceLink(makeInput())).toBe(false);
  });

  it("manualPostStatus가 posted면 true를 반환한다", () => {
    expect(shouldShowPerformanceLink(makeInput({ manualPostStatus: "posted" }))).toBe(true);
  });

  it("latestMetricsRecordedAt이 있으면 true를 반환한다", () => {
    expect(shouldShowPerformanceLink(makeInput({ latestMetricsRecordedAt: "2026-01-01T00:00:00.000Z" }))).toBe(true);
  });

  it("performanceStatus가 not_measured가 아니면 true를 반환한다", () => {
    expect(shouldShowPerformanceLink(makeInput({ performanceStatus: "good" }))).toBe(true);
  });
});
