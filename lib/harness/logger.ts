// Harness Engineering Lite: 파이프라인의 주요 실행 결과를 로그로 남긴다 (FR-10).
//
// Phase 1에서는 메모리(globalThis) 기반 로그 저장 + console 출력을 함께 수행한다.
// Supabase 연동 이후 pipeline_logs 테이블 저장으로 교체한다 (docs/phase-1-plan.md 참고).

export type LogEventType =
  | "theme_created"
  | "source_added"
  | "contract_checked"
  | "article_draft_created";

export type LogStatus = "success" | "failed" | "info";

export interface PipelineLogEntry {
  id: string;
  type: LogEventType;
  status: LogStatus;
  message: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface LogEventInput {
  type: LogEventType;
  status: LogStatus;
  message: string;
  details?: Record<string, unknown>;
}

const globalForLogger = globalThis as unknown as {
  __contentPipelineLogs?: PipelineLogEntry[];
};

function getLogStore(): PipelineLogEntry[] {
  if (!globalForLogger.__contentPipelineLogs) {
    globalForLogger.__contentPipelineLogs = [];
  }
  return globalForLogger.__contentPipelineLogs;
}

/**
 * 파이프라인 이벤트를 기록한다.
 * status가 "failed"인 경우 console.error, 그 외에는 console.log로 출력한다.
 */
export function logEvent(input: LogEventInput): PipelineLogEntry {
  const entry: PipelineLogEntry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };

  const logStore = getLogStore();
  logStore.push(entry);

  const line = JSON.stringify(entry);
  if (entry.status === "failed") {
    console.error(`[pipeline:${entry.type}]`, line);
  } else {
    console.log(`[pipeline:${entry.type}]`, line);
  }

  return entry;
}

/** 최신 로그가 먼저 오도록 정렬된 전체 로그 목록을 반환한다. */
export function getLogs(): PipelineLogEntry[] {
  return [...getLogStore()].reverse();
}
