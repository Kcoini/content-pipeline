import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const componentSource = readFileSync(path.join(__dirname, "job-progress-polling.tsx"), "utf8");

describe("JobProgressPolling 정적 소스 검사", () => {
  it('"use client" 컴포넌트이며 /api/job-runs/[id]를 polling한다', () => {
    expect(componentSource).toContain('"use client"');
    expect(componentSource).toContain("fetch(`/api/job-runs/${jobRunId}`");
  });

  it("터미널 상태(completed/failed/blocked 등)가 되면 polling을 멈춘다", () => {
    expect(componentSource).toContain("isTerminalJobStatus");
    expect(componentSource).toContain("clearTimeout(timerRef.current)");
  });

  it("polling 실패 시 '상태를 불러오지 못했습니다' 메시지를 보여준다", () => {
    expect(componentSource).toContain("상태를 불러오지 못했습니다. 다시 시도해 주세요.");
  });

  it("멈춤 가능성 판정은 서버 전용 의존성이 없는 job-progress-types에서 import한다(client bundle에 supabase가 섞이지 않도록)", () => {
    expect(componentSource).toContain('from "@/lib/job-progress/job-progress-types"');
    expect(componentSource).not.toContain("job-progress-service");
    expect(componentSource).not.toContain("job-progress-repository");
  });

  it("기본 polling 간격은 2~3초 사이다", () => {
    expect(componentSource).toContain("const POLL_INTERVAL_MS = 2500;");
  });
});
