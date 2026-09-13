import { describe, expect, it } from "vitest";
import {
  getJobErrorCategoryLabel,
  getJobStatusLabel,
  getJobStatusTone,
  getJobTypeLabel,
  isTerminalJobStatus,
} from "./job-progress-labels";

describe("getJobTypeLabel", () => {
  it("알려진 job_type을 한국어로 변환한다", () => {
    expect(getJobTypeLabel("wordpress_auto_prep")).toBe("WordPress 게시 준비");
    expect(getJobTypeLabel("trend_collection")).toBe("트렌드 수집");
  });

  it("알 수 없는 값은 원본을 그대로 반환한다", () => {
    expect(getJobTypeLabel("unknown_job")).toBe("unknown_job");
  });
});

describe("getJobStatusLabel", () => {
  it("모든 raw status를 사용자 친화적 문구로 변환한다", () => {
    expect(getJobStatusLabel("queued")).toBe("대기 중");
    expect(getJobStatusLabel("running")).toBe("진행 중");
    expect(getJobStatusLabel("waiting_user")).toBe("확인 필요");
    expect(getJobStatusLabel("partial_success")).toBe("일부 완료");
    expect(getJobStatusLabel("completed")).toBe("완료");
    expect(getJobStatusLabel("failed")).toBe("실패");
    expect(getJobStatusLabel("blocked")).toBe("진행 불가");
    expect(getJobStatusLabel("stalled")).toBe("멈춤 가능성 있음");
  });

  it("알 수 없는 값은 원본을 그대로 반환한다", () => {
    expect(getJobStatusLabel("unknown_status")).toBe("unknown_status");
  });
});

describe("getJobStatusTone", () => {
  it("completed는 success, failed/blocked는 danger다", () => {
    expect(getJobStatusTone("completed")).toBe("success");
    expect(getJobStatusTone("failed")).toBe("danger");
    expect(getJobStatusTone("blocked")).toBe("danger");
  });

  it("running/retrying은 progress, stalled/waiting_user는 warning이다", () => {
    expect(getJobStatusTone("running")).toBe("progress");
    expect(getJobStatusTone("retrying")).toBe("progress");
    expect(getJobStatusTone("stalled")).toBe("warning");
    expect(getJobStatusTone("waiting_user")).toBe("warning");
  });

  it("알 수 없는 값은 neutral이다", () => {
    expect(getJobStatusTone("unknown")).toBe("neutral");
  });
});

describe("getJobErrorCategoryLabel", () => {
  it("알려진 category를 한국어 문구로 바꾼다", () => {
    expect(getJobErrorCategoryLabel("wordpress_connection_error")).toBe("WordPress 연결 오류 가능성");
  });

  it("null/undefined면 기본 '알 수 없는 오류' 문구를 반환한다", () => {
    expect(getJobErrorCategoryLabel(null)).toBe(getJobErrorCategoryLabel("unknown"));
    expect(getJobErrorCategoryLabel(undefined)).toBe(getJobErrorCategoryLabel("unknown"));
  });

  it("알 수 없는 category는 원본을 그대로 반환한다", () => {
    expect(getJobErrorCategoryLabel("something_new")).toBe("something_new");
  });
});

describe("isTerminalJobStatus", () => {
  it("completed/failed/blocked/partial_success/cancelled/waiting_user는 종료 상태다", () => {
    expect(isTerminalJobStatus("completed")).toBe(true);
    expect(isTerminalJobStatus("failed")).toBe(true);
    expect(isTerminalJobStatus("blocked")).toBe(true);
    expect(isTerminalJobStatus("partial_success")).toBe(true);
    expect(isTerminalJobStatus("cancelled")).toBe(true);
    expect(isTerminalJobStatus("waiting_user")).toBe(true);
  });

  it("running/queued/retrying/stalled은 진행 중 상태다", () => {
    expect(isTerminalJobStatus("running")).toBe(false);
    expect(isTerminalJobStatus("queued")).toBe(false);
    expect(isTerminalJobStatus("retrying")).toBe(false);
    expect(isTerminalJobStatus("stalled")).toBe(false);
  });
});
