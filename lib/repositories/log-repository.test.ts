import { describe, expect, it } from "vitest";
import { mapContractRunRow, mapLogRow } from "./log-repository";
import type { ContractRunRow, PipelineLogRow } from "@/lib/supabase/database.types";

function makeLogRow(overrides: Partial<PipelineLogRow> = {}): PipelineLogRow {
  return {
    id: "log-1",
    theme_id: "theme-1",
    article_id: null,
    target_type: null,
    target_id: null,
    event: "theme_created",
    stage: null,
    status: "success",
    message: "테마가 생성되었습니다: AI 에이전트 동향",
    details_json: { themeId: "theme-1" },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeContractRunRow(overrides: Partial<ContractRunRow> = {}): ContractRunRow {
  return {
    id: "run-1",
    theme_id: "theme-1",
    article_id: null,
    target_type: "source",
    target_id: null,
    contract_name: "source.contract",
    stage: null,
    passed: true,
    status: "success",
    source_count: null,
    failed_conditions: [],
    violations: [],
    details_json: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("mapLogRow", () => {
  it("pipeline_logs row를 PipelineLogEntry로 변환한다", () => {
    const entry = mapLogRow(makeLogRow());

    expect(entry).toEqual({
      id: "log-1",
      type: "theme_created",
      status: "success",
      message: "테마가 생성되었습니다: AI 에이전트 동향",
      details: { themeId: "theme-1" },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("message가 null이면 빈 문자열로 변환한다", () => {
    const entry = mapLogRow(makeLogRow({ message: null }));
    expect(entry.message).toBe("");
  });
});

describe("mapContractRunRow", () => {
  it("contract_runs row를 ContractCheckRecord로 변환한다", () => {
    const record = mapContractRunRow(
      makeContractRunRow({
        passed: false,
        violations: [{ ruleId: "min-source-count", message: "출처가 부족합니다" }],
      })
    );

    expect(record).toEqual({
      themeId: "theme-1",
      target: "source",
      contractName: "source.contract",
      passed: false,
      violations: [{ ruleId: "min-source-count", message: "출처가 부족합니다" }],
      checkedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("theme_id가 null이면 themeId를 빈 문자열로 변환한다", () => {
    const record = mapContractRunRow(makeContractRunRow({ theme_id: null }));
    expect(record.themeId).toBe("");
  });
});
