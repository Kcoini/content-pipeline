import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobRunRow, JobRunStepRow } from "@/lib/supabase/database.types";

const createServerSupabaseClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: (...args: unknown[]) => createServerSupabaseClient(...args),
}));

const {
  mapJobRunRow,
  mapJobRunStepRow,
  insertJobRun,
  updateJobRunRow,
  getJobRunById,
  getLatestJobRunByTarget,
  insertJobRunSteps,
  getJobRunSteps,
  updateJobRunStepRow,
} = await import("./job-progress-repository");

function makeJobRunRow(overrides: Partial<JobRunRow> = {}): JobRunRow {
  return {
    id: "job-run-1",
    job_type: "wordpress_auto_prep",
    target_type: "social_post",
    target_id: "social-post-1",
    article_id: "article-1",
    social_post_id: "social-post-1",
    theme_id: null,
    status: "queued",
    current_step_key: null,
    current_step_label: null,
    total_steps: 0,
    completed_steps: 0,
    progress_percent: 0,
    user_message: null,
    error_message: null,
    error_category: null,
    retryable: false,
    next_action_label: null,
    next_action_href: null,
    started_at: null,
    last_heartbeat_at: null,
    finished_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeJobRunStepRow(overrides: Partial<JobRunStepRow> = {}): JobRunStepRow {
  return {
    id: "job-run-step-1",
    job_run_id: "job-run-1",
    step_order: 1,
    step_key: "draft",
    step_label: "WordPress Draft",
    status: "queued",
    message: null,
    error_message: null,
    started_at: null,
    finished_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

beforeEach(() => {
  createServerSupabaseClient.mockReset();
});

describe("mapJobRunRow / mapJobRunStepRow", () => {
  it("job_runs row를 camelCase 도메인 타입으로 변환한다", () => {
    const row = makeJobRunRow({ status: "running", progress_percent: 40 });
    const entry = mapJobRunRow(row);
    expect(entry.id).toBe("job-run-1");
    expect(entry.jobType).toBe("wordpress_auto_prep");
    expect(entry.status).toBe("running");
    expect(entry.progressPercent).toBe(40);
  });

  it("job_run_steps row를 camelCase 도메인 타입으로 변환한다", () => {
    const row = makeJobRunStepRow({ status: "completed" });
    const entry = mapJobRunStepRow(row);
    expect(entry.jobRunId).toBe("job-run-1");
    expect(entry.stepKey).toBe("draft");
    expect(entry.status).toBe("completed");
  });
});

describe("insertJobRun", () => {
  it("job_runs에 insert하고 매핑된 결과를 반환한다", async () => {
    const row = makeJobRunRow();
    const chain = makeChain({ data: row, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await insertJobRun({
      jobType: "wordpress_auto_prep",
      targetType: "social_post",
      targetId: "social-post-1",
      articleId: "article-1",
      socialPostId: "social-post-1",
      themeId: null,
      status: "queued",
      totalSteps: 0,
      userMessage: null,
    });

    expect(from).toHaveBeenCalledWith("job_runs");
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ job_type: "wordpress_auto_prep", status: "queued" }));
    expect(result.id).toBe("job-run-1");
  });

  it("insert 실패 시 에러를 던진다", async () => {
    const chain = makeChain({ data: null, error: { message: "insert failed" } });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await expect(
      insertJobRun({
        jobType: "wordpress_auto_prep",
        targetType: null,
        targetId: null,
        articleId: null,
        socialPostId: null,
        themeId: null,
        status: "queued",
        totalSteps: 0,
        userMessage: null,
      })
    ).rejects.toThrow(/작업 실행 기록 생성에 실패했습니다/);
  });
});

describe("updateJobRunRow", () => {
  it("job_runs row를 patch로 갱신한다", async () => {
    const row = makeJobRunRow({ status: "running" });
    const chain = makeChain({ data: row, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await updateJobRunRow("job-run-1", { status: "running" });

    expect(chain.update).toHaveBeenCalledWith({ status: "running" });
    expect(chain.eq).toHaveBeenCalledWith("id", "job-run-1");
    expect(result.status).toBe("running");
  });
});

describe("getJobRunById / getLatestJobRunByTarget", () => {
  it("id로 job_run을 조회한다", async () => {
    const chain = makeChain({ data: makeJobRunRow(), error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await getJobRunById("job-run-1");
    expect(result?.id).toBe("job-run-1");
  });

  it("데이터가 없으면 null을 반환한다", async () => {
    const chain = makeChain({ data: null, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await getJobRunById("missing");
    expect(result).toBeNull();
  });

  it("target_type/target_id 기준으로 최신 job_run을 조회한다", async () => {
    const chain = makeChain({ data: makeJobRunRow(), error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await getLatestJobRunByTarget("social_post", "social-post-1");
    expect(chain.eq).toHaveBeenCalledWith("target_type", "social_post");
    expect(result?.id).toBe("job-run-1");
  });
});

describe("insertJobRunSteps / getJobRunSteps / updateJobRunStepRow", () => {
  it("빈 배열이면 insert 없이 빈 배열을 반환한다", async () => {
    const result = await insertJobRunSteps([]);
    expect(result).toEqual([]);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("여러 단계를 한 번에 insert한다", async () => {
    const rows = [makeJobRunStepRow({ id: "s1", step_order: 1 }), makeJobRunStepRow({ id: "s2", step_order: 2, step_key: "seo" })];
    const chain = makeChain({ data: rows, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await insertJobRunSteps([
      { jobRunId: "job-run-1", stepOrder: 1, stepKey: "draft", stepLabel: "Draft" },
      { jobRunId: "job-run-1", stepOrder: 2, stepKey: "seo", stepLabel: "SEO" },
    ]);

    expect(from).toHaveBeenCalledWith("job_run_steps");
    expect(result).toHaveLength(2);
  });

  it("job_run_id 기준 step_order 순으로 조회한다", async () => {
    const rows = [makeJobRunStepRow()];
    const chain = makeChain({ data: rows, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await getJobRunSteps("job-run-1");
    expect(chain.eq).toHaveBeenCalledWith("job_run_id", "job-run-1");
    expect(chain.order).toHaveBeenCalledWith("step_order", { ascending: true });
    expect(result).toHaveLength(1);
  });

  it("job_run_id + step_key로 단계 하나를 갱신한다", async () => {
    const row = makeJobRunStepRow({ status: "completed" });
    const chain = makeChain({ data: row, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await updateJobRunStepRow("job-run-1", "draft", { status: "completed" });
    expect(chain.eq).toHaveBeenCalledWith("job_run_id", "job-run-1");
    expect(chain.eq).toHaveBeenCalledWith("step_key", "draft");
    expect(result.status).toBe("completed");
  });
});
