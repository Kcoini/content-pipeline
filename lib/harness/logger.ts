// Harness Engineering Lite: 파이프라인의 주요 실행 결과를 로그로 남긴다 (FR-10).
//
// 실제 영속화는 lib/repositories/log-repository.ts(pipeline_logs 테이블)가 담당하고,
// 이 모듈은 console 출력을 더해 harness 계층의 로깅 API를 제공한다.

import {
  getLogs as getLogsFromRepository,
  logEvent as logEventToRepository,
  type LogEventInput,
  type LogEventType,
  type LogStatus,
  type PipelineLogEntry,
} from "@/lib/repositories/log-repository";

export type { LogEventInput, LogEventType, LogStatus, PipelineLogEntry };

/**
 * 파이프라인 이벤트를 기록한다.
 * status가 "failed"인 경우 console.error, 그 외에는 console.log로 출력한다.
 */
export async function logEvent(input: LogEventInput): Promise<PipelineLogEntry> {
  const entry = await logEventToRepository(input);

  const line = JSON.stringify(entry);
  if (entry.status === "failed") {
    console.error(`[pipeline:${entry.type}]`, line);
  } else {
    console.log(`[pipeline:${entry.type}]`, line);
  }

  return entry;
}

/** 최신 로그가 먼저 오도록 정렬된 로그 목록을 반환한다. */
export async function getLogs(limit?: number): Promise<PipelineLogEntry[]> {
  return getLogsFromRepository(limit);
}
