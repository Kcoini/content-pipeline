// Harness Engineering Lite: 파이프라인의 주요 실행 결과를 로그로 남긴다 (FR-10).
//
// NOTE(Phase 1): 현재는 콘솔 출력만 수행한다.
// db/schema.sql의 pipeline_logs 테이블에 저장하는 로직은
// lib/supabase/server.ts 연동 이후 추가한다 (docs/phase-1-plan.md 참고).

export type PipelineStage =
  | "source_validation"
  | "article_generation"
  | "article_contract_check"
  | "article_eval"
  | "human_review";

export type PipelineLogStatus = "started" | "succeeded" | "failed" | "skipped";

export interface PipelineLogEntry {
  topicId?: string;
  articleId?: string;
  stage: PipelineStage;
  status: PipelineLogStatus;
  message?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export type PipelineLogInput = Omit<PipelineLogEntry, "createdAt">;

export function createLogEntry(input: PipelineLogInput): PipelineLogEntry {
  return { ...input, createdAt: new Date().toISOString() };
}

/**
 * 파이프라인 단계 실행 결과를 기록한다.
 * 실패(status: "failed") 로그는 console.error로, 그 외는 console.log로 출력한다.
 */
export function logPipelineEvent(input: PipelineLogInput): PipelineLogEntry {
  const entry = createLogEntry(input);
  const line = JSON.stringify(entry);

  if (entry.status === "failed") {
    console.error(`[pipeline:${entry.stage}]`, line);
  } else {
    console.log(`[pipeline:${entry.stage}]`, line);
  }

  return entry;
}
