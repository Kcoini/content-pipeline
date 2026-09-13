import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobRun, JobRunStep } from "./job-progress-types";

const insertJobRun = vi.fn();
const insertJobRunSteps = vi.fn();
const updateJobRunRow = vi.fn();
const getJobRunById = vi.fn();
const getJobRunSteps = vi.fn();
const getLatestJobRunByTarget = vi.fn();
const updateJobRunStepRow = vi.fn();
const logEvent = vi.fn();

vi.mock("./job-progress-repository", () => ({
  insertJobRun: (...args: unknown[]) => insertJobRun(...args),
  insertJobRunSteps: (...args: unknown[]) => insertJobRunSteps(...args),
  updateJobRunRow: (...args: unknown[]) => updateJobRunRow(...args),
  getJobRunById: (...args: unknown[]) => getJobRunById(...args),
  getJobRunSteps: (...args: unknown[]) => getJobRunSteps(...args),
  getLatestJobRunByTarget: (...args: unknown[]) => getLatestJobRunByTarget(...args),
  updateJobRunStepRow: (...args: unknown[]) => updateJobRunStepRow(...args),
}));

vi.mock("@/lib/repositories/log-repository", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const {
  createJobRun,
  createJobSteps,
  startJobRun,
  startJobStep,
  completeJobStep,
  failJobStep,
  completeJobRun,
  partialSuccessJobRun,
  failJobRun,
  blockJobRun,
  markJobRunWaitingUser,
  heartbeatJobRun,
  getJobRunWithSteps,
  getLatestJobRunForTarget,
  detectStalledJobRun,
  markJobRunStalled,
  createJobProgressTracker,
} = await import("./job-progress-service");

function makeJobRun(overrides: Partial<JobRun> = {}): JobRun {
  return {
    id: "job-run-1",
    jobType: "wordpress_auto_prep",
    targetType: "social_post",
    targetId: "social-post-1",
    articleId: "article-1",
    socialPostId: "social-post-1",
    themeId: null,
    status: "queued",
    currentStepKey: null,
    currentStepLabel: null,
    totalSteps: 3,
    completedSteps: 0,
    progressPercent: 0,
    userMessage: null,
    errorMessage: null,
    errorCategory: null,
    retryable: false,
    nextActionLabel: null,
    nextActionHref: null,
    startedAt: null,
    lastHeartbeatAt: null,
    finishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeJobRunStep(overrides: Partial<JobRunStep> = {}): JobRunStep {
  return {
    id: "step-1",
    jobRunId: "job-run-1",
    stepOrder: 1,
    stepKey: "draft",
    stepLabel: "WordPress Draft",
    status: "queued",
    message: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  insertJobRun.mockReset();
  insertJobRunSteps.mockReset();
  updateJobRunRow.mockReset();
  getJobRunById.mockReset();
  getJobRunSteps.mockReset();
  getLatestJobRunByTarget.mockReset();
  updateJobRunStepRow.mockReset();
  logEvent.mockReset().mockResolvedValue(undefined);
});

describe("createJobRun", () => {
  it("job_runs를 생성하고 job_run_created 로그를 남긴다", async () => {
    insertJobRun.mockResolvedValue(makeJobRun());

    const result = await createJobRun({ jobType: "wordpress_auto_prep", targetType: "social_post", targetId: "social-post-1" });

    expect(insertJobRun).toHaveBeenCalledWith(expect.objectContaining({ jobType: "wordpress_auto_prep", status: "queued" }));
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "job_run_created" }));
    expect(result.id).toBe("job-run-1");
  });

  it("logEvent가 실패해도 job_run 생성 결과는 그대로 반환한다", async () => {
    insertJobRun.mockResolvedValue(makeJobRun());
    logEvent.mockRejectedValue(new Error("log failed"));

    await expect(createJobRun({ jobType: "wordpress_auto_prep" })).resolves.toMatchObject({ id: "job-run-1" });
  });
});

describe("createJobSteps", () => {
  it("job_run_steps를 생성하고 total_steps를 갱신한다", async () => {
    insertJobRunSteps.mockResolvedValue([makeJobRunStep()]);
    updateJobRunRow.mockResolvedValue(makeJobRun());

    await createJobSteps("job-run-1", [{ stepKey: "draft", stepLabel: "WordPress Draft" }]);

    expect(insertJobRunSteps).toHaveBeenCalledWith([{ jobRunId: "job-run-1", stepOrder: 1, stepKey: "draft", stepLabel: "WordPress Draft" }]);
    expect(updateJobRunRow).toHaveBeenCalledWith("job-run-1", { total_steps: 1, progress_percent: 0 });
  });
});

describe("startJobRun", () => {
  it("status를 running으로 바꾸고 started_at/last_heartbeat_at을 채운다", async () => {
    updateJobRunRow.mockResolvedValue(makeJobRun({ status: "running" }));

    const result = await startJobRun("job-run-1");

    const patch = updateJobRunRow.mock.calls[0][1];
    expect(patch.status).toBe("running");
    expect(typeof patch.started_at).toBe("string");
    expect(typeof patch.last_heartbeat_at).toBe("string");
    expect(result.status).toBe("running");
  });
});

describe("startJobStep / completeJobStep / failJobStep", () => {
  it("startJobStep은 step을 running으로, job_run의 current_step을 갱신한다", async () => {
    updateJobRunStepRow.mockResolvedValue(makeJobRunStep({ status: "running" }));
    updateJobRunRow.mockResolvedValue(makeJobRun());

    await startJobStep("job-run-1", "draft", "WordPress Draft");

    expect(updateJobRunStepRow).toHaveBeenCalledWith("job-run-1", "draft", expect.objectContaining({ status: "running" }));
    expect(updateJobRunRow).toHaveBeenCalledWith(
      "job-run-1",
      expect.objectContaining({ current_step_key: "draft", current_step_label: "WordPress Draft" })
    );
  });

  it("completeJobStep은 completed_steps/progress_percent를 갱신한다(2/3 단계 완료 시 67%)", async () => {
    updateJobRunStepRow.mockResolvedValue(makeJobRunStep({ status: "completed" }));
    getJobRunSteps.mockResolvedValue([
      makeJobRunStep({ stepKey: "a", status: "completed" }),
      makeJobRunStep({ stepKey: "b", status: "completed" }),
      makeJobRunStep({ stepKey: "c", status: "queued" }),
    ]);
    getJobRunById.mockResolvedValue(makeJobRun({ totalSteps: 3 }));
    updateJobRunRow.mockResolvedValue(makeJobRun());

    await completeJobStep("job-run-1", "draft", "완료 메시지");

    expect(updateJobRunRow).toHaveBeenCalledWith(
      "job-run-1",
      expect.objectContaining({ completed_steps: 2, progress_percent: 67 })
    );
  });

  it("failJobStep은 step을 failed로 저장하고 error_message를 담는다", async () => {
    updateJobRunStepRow.mockResolvedValue(makeJobRunStep({ status: "failed", errorMessage: "실패 사유" }));

    await failJobStep("job-run-1", "draft", "실패 사유");

    expect(updateJobRunStepRow).toHaveBeenCalledWith(
      "job-run-1",
      "draft",
      expect.objectContaining({ status: "failed", error_message: "실패 사유" })
    );
  });
});

describe("completeJobRun / partialSuccessJobRun / failJobRun / blockJobRun", () => {
  it("completeJobRun은 status=completed와 finished_at을 저장한다", async () => {
    updateJobRunRow.mockResolvedValue(makeJobRun({ status: "completed" }));

    const result = await completeJobRun("job-run-1", { userMessage: "완료", nextActionLabel: "확인", nextActionHref: "/x" });

    const patch = updateJobRunRow.mock.calls[0][1];
    expect(patch.status).toBe("completed");
    expect(typeof patch.finished_at).toBe("string");
    expect(patch.next_action_label).toBe("확인");
    expect(result.status).toBe("completed");
  });

  it("partial_success 상태를 저장할 수 있다", async () => {
    updateJobRunRow.mockResolvedValue(makeJobRun({ status: "partial_success" }));

    await partialSuccessJobRun("job-run-1", { userMessage: "일부 완료" });

    expect(updateJobRunRow).toHaveBeenCalledWith("job-run-1", expect.objectContaining({ status: "partial_success" }));
  });

  it("failJobRun은 error_message/error_category/retryable을 저장한다", async () => {
    updateJobRunRow.mockResolvedValue(makeJobRun({ status: "failed" }));

    await failJobRun("job-run-1", { errorMessage: "네트워크 오류", errorCategory: "network_error", retryable: true });

    expect(updateJobRunRow).toHaveBeenCalledWith(
      "job-run-1",
      expect.objectContaining({ status: "failed", error_message: "네트워크 오류", error_category: "network_error", retryable: true })
    );
  });

  it("blockJobRun은 status=blocked와 안내 메시지를 저장한다", async () => {
    updateJobRunRow.mockResolvedValue(makeJobRun({ status: "blocked" }));

    await blockJobRun("job-run-1", "승인이 필요합니다.");

    expect(updateJobRunRow).toHaveBeenCalledWith("job-run-1", expect.objectContaining({ status: "blocked", user_message: "승인이 필요합니다." }));
  });
});

describe("markJobRunWaitingUser / heartbeatJobRun", () => {
  it("markJobRunWaitingUser는 status=waiting_user를 저장한다", async () => {
    updateJobRunRow.mockResolvedValue(makeJobRun({ status: "waiting_user" }));

    await markJobRunWaitingUser("job-run-1", "확인이 필요합니다.");

    expect(updateJobRunRow).toHaveBeenCalledWith("job-run-1", expect.objectContaining({ status: "waiting_user", user_message: "확인이 필요합니다." }));
  });

  it("heartbeatJobRun은 last_heartbeat_at을 갱신한다", async () => {
    updateJobRunRow.mockResolvedValue(makeJobRun());

    await heartbeatJobRun("job-run-1");

    const patch = updateJobRunRow.mock.calls[0][1];
    expect(typeof patch.last_heartbeat_at).toBe("string");
  });
});

describe("getJobRunWithSteps / getLatestJobRunForTarget", () => {
  it("job_run이 없으면 null을 반환한다", async () => {
    getJobRunById.mockResolvedValue(null);

    const result = await getJobRunWithSteps("missing");
    expect(result).toBeNull();
  });

  it("job_run과 steps를 합쳐 반환한다", async () => {
    getJobRunById.mockResolvedValue(makeJobRun());
    getJobRunSteps.mockResolvedValue([makeJobRunStep()]);

    const result = await getJobRunWithSteps("job-run-1");
    expect(result?.steps).toHaveLength(1);
  });

  it("target 기준 최신 job_run이 없으면 null을 반환한다", async () => {
    getLatestJobRunByTarget.mockResolvedValue(null);

    const result = await getLatestJobRunForTarget("social_post", "missing");
    expect(result).toBeNull();
  });
});

describe("detectStalledJobRun", () => {
  it("running 상태이고 2분 이상 heartbeat가 없으면 true를 반환한다", () => {
    const now = new Date("2026-01-01T00:10:00.000Z");
    const result = detectStalledJobRun({ status: "running", lastHeartbeatAt: "2026-01-01T00:07:00.000Z" }, now);
    expect(result).toBe(true);
  });

  it("running 상태이고 heartbeat가 최근이면 false를 반환한다", () => {
    const now = new Date("2026-01-01T00:10:00.000Z");
    const result = detectStalledJobRun({ status: "running", lastHeartbeatAt: "2026-01-01T00:09:30.000Z" }, now);
    expect(result).toBe(false);
  });

  it("completed 상태면 heartbeat가 오래됐어도 false를 반환한다", () => {
    const now = new Date("2026-01-01T00:10:00.000Z");
    const result = detectStalledJobRun({ status: "completed", lastHeartbeatAt: "2026-01-01T00:00:00.000Z" }, now);
    expect(result).toBe(false);
  });

  it("lastHeartbeatAt이 없으면 false를 반환한다", () => {
    const result = detectStalledJobRun({ status: "running", lastHeartbeatAt: null });
    expect(result).toBe(false);
  });
});

describe("createJobProgressTracker", () => {
  it("job_run/steps 생성 후 running으로 전환하고, 이후 메서드가 실제 helper를 호출한다", async () => {
    insertJobRun.mockResolvedValue(makeJobRun());
    insertJobRunSteps.mockResolvedValue([makeJobRunStep()]);
    updateJobRunRow.mockResolvedValue(makeJobRun({ status: "running" }));
    updateJobRunStepRow.mockResolvedValue(makeJobRunStep({ status: "completed" }));
    getJobRunSteps.mockResolvedValue([makeJobRunStep({ status: "completed" })]);
    getJobRunById.mockResolvedValue(makeJobRun({ totalSteps: 1 }));

    const tracker = await createJobProgressTracker(
      { jobType: "wordpress_auto_prep", articleId: "article-1", socialPostId: "social-post-1" },
      [{ stepKey: "draft", stepLabel: "WordPress Draft" }]
    );

    expect(tracker.jobRunId).toBe("job-run-1");
    expect(insertJobRunSteps).toHaveBeenCalled();

    await tracker.startStep("draft", "WordPress Draft");
    expect(updateJobRunStepRow).toHaveBeenCalledWith("job-run-1", "draft", expect.objectContaining({ status: "running" }));

    await tracker.completeStep("draft", "완료");
    await tracker.finishCompleted({ userMessage: "완료됨" });
    expect(updateJobRunRow).toHaveBeenCalledWith("job-run-1", expect.objectContaining({ status: "completed" }));
  });

  it("job_run 생성이 실패하면 NOOP tracker(jobRunId=null)를 반환하고, 이후 호출도 예외 없이 조용히 무시된다", async () => {
    insertJobRun.mockRejectedValue(new Error("db unavailable"));

    const tracker = await createJobProgressTracker({ jobType: "wordpress_auto_prep" }, [{ stepKey: "draft", stepLabel: "Draft" }]);

    expect(tracker.jobRunId).toBeNull();
    await expect(tracker.startStep("draft", "Draft")).resolves.toBeUndefined();
    await expect(tracker.finishFailed({ errorMessage: "실패" })).resolves.toBeUndefined();
    // NOOP이므로 repository 호출도 전혀 없어야 한다.
    expect(updateJobRunStepRow).not.toHaveBeenCalled();
  });

  it("step 기록 중 오류가 나도 예외를 던지지 않는다(실제 작업 흐름을 막지 않는다)", async () => {
    insertJobRun.mockResolvedValue(makeJobRun());
    insertJobRunSteps.mockResolvedValue([makeJobRunStep()]);
    updateJobRunRow.mockResolvedValue(makeJobRun({ status: "running" }));
    updateJobRunStepRow.mockRejectedValue(new Error("update failed"));

    const tracker = await createJobProgressTracker({ jobType: "wordpress_auto_prep" }, [{ stepKey: "draft", stepLabel: "Draft" }]);

    await expect(tracker.startStep("draft", "Draft")).resolves.toBeUndefined();
  });
});

describe("markJobRunStalled", () => {
  it("status를 stalled로 갱신하고 로그를 남긴다", async () => {
    updateJobRunRow.mockResolvedValue(makeJobRun({ status: "stalled" }));

    await markJobRunStalled("job-run-1");

    expect(updateJobRunRow).toHaveBeenCalledWith("job-run-1", { status: "stalled" });
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "job_run_stalled_detected" }));
  });
});
