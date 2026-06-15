// db/schema.sql과 1:1로 대응하는 Supabase 테이블 타입 정의.
// 스키마가 바뀌면 이 파일도 함께 갱신한다.

export type ThemeStatus =
  | "draft"
  | "sources_ready"
  | "generating"
  | "drafted"
  | "reviewed"
  | "failed";

export type ArticleStatus = "draft" | "reviewed" | "published";

// PipelineStage: lib/harness/pipeline.ts(전체 오케스트레이터, Phase 2)에서 사용할
// 단계 이름이다. pipeline_logs.stage / contract_runs.stage 컬럼은 이 값을 위해
// 마련해 둔 자리이며, 현재 MVP 코드는 이 컬럼에 값을 쓰지 않는다 (항상 null).
// 현재 사용 중인 이벤트 어휘는 lib/repositories/log-repository.ts의
// LogEventType(theme_created, source_added 등)이며, pipeline_logs.event 컬럼에
// 저장한다.
export type PipelineStage =
  | "source_validation"
  | "article_generation"
  | "article_contract_check"
  | "article_eval"
  | "human_review";

export type PipelineLogStatus = "started" | "succeeded" | "failed" | "skipped";

export type ContractTargetType = "source" | "article";

export type ContractRunStatus = "success" | "failed";

export type ThemeRow = {
  id: string;
  title: string;
  description: string | null;
  keywords: string[];
  language: string;
  status: ThemeStatus;
  created_at: string;
  updated_at: string;
};

export type SourceRow = {
  id: string;
  theme_id: string;
  url: string;
  title: string;
  author: string | null;
  published_at: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ArticleRow = {
  id: string;
  theme_id: string;
  title: string;
  content: string;
  status: ArticleStatus;
  version: number;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ArticleSourceRow = {
  article_id: string;
  source_id: string;
  created_at: string;
};

export type AgentRunStatus = "success" | "failed";

export type AgentRunRow = {
  id: string;
  theme_id: string | null;
  article_id: string | null;
  agent_name: string;
  status: AgentRunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  created_at: string;
};

export type ContractRunRow = {
  id: string;
  theme_id: string | null;
  article_id: string | null;
  target_type: ContractTargetType;
  target_id: string | null;
  contract_name: string;
  stage: PipelineStage | null;
  passed: boolean;
  status: ContractRunStatus;
  source_count: number | null;
  failed_conditions: string[];
  violations: unknown[];
  details_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EvalRunRow = {
  id: string;
  article_id: string;
  eval_name: string;
  criteria_scores: Record<string, unknown>;
  aggregate_score: number | null;
  /** 과거 schema의 호환용 컬럼. aggregate_score와 동일한 값을 저장한다. */
  score: number | null;
  passed: boolean;
  notes: string | null;
  created_at: string;
};

export type PipelineLogRow = {
  id: string;
  theme_id: string | null;
  article_id: string | null;
  target_type: ContractTargetType | null;
  target_id: string | null;
  event: string;
  stage: PipelineStage | null;
  status: string;
  message: string | null;
  details_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ApprovalLogStatus = "approved" | "rejected";

export type ApprovalLogRow = {
  id: string;
  theme_id: string | null;
  article_id: string | null;
  action: string;
  approved_by: string | null;
  status: ApprovalLogStatus;
  notes: string | null;
  created_at: string;
};

export type PublishLogStatus = "success" | "failed";

export type PublishLogRow = {
  id: string;
  article_id: string | null;
  status: PublishLogStatus;
  target: string | null;
  details: Record<string, unknown>;
  published_at: string | null;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      themes: {
        Row: ThemeRow;
        Insert: Partial<ThemeRow> & Pick<ThemeRow, "title">;
        Update: Partial<ThemeRow>;
        Relationships: [];
      };
      sources: {
        Row: SourceRow;
        Insert: Partial<SourceRow> & Pick<SourceRow, "theme_id" | "url" | "title">;
        Update: Partial<SourceRow>;
        Relationships: [];
      };
      articles: {
        Row: ArticleRow;
        Insert: Partial<ArticleRow> & Pick<ArticleRow, "theme_id" | "title" | "content">;
        Update: Partial<ArticleRow>;
        Relationships: [];
      };
      article_sources: {
        Row: ArticleSourceRow;
        Insert: Partial<ArticleSourceRow> & Pick<ArticleSourceRow, "article_id" | "source_id">;
        Update: Partial<ArticleSourceRow>;
        Relationships: [];
      };
      agent_runs: {
        Row: AgentRunRow;
        Insert: Partial<AgentRunRow> & Pick<AgentRunRow, "agent_name" | "status">;
        Update: Partial<AgentRunRow>;
        Relationships: [];
      };
      contract_runs: {
        Row: ContractRunRow;
        Insert: Partial<ContractRunRow> &
          Pick<ContractRunRow, "target_type" | "contract_name" | "passed" | "status">;
        Update: Partial<ContractRunRow>;
        Relationships: [];
      };
      eval_runs: {
        Row: EvalRunRow;
        Insert: Partial<EvalRunRow> & Pick<EvalRunRow, "article_id" | "eval_name" | "passed">;
        Update: Partial<EvalRunRow>;
        Relationships: [];
      };
      pipeline_logs: {
        Row: PipelineLogRow;
        Insert: Partial<PipelineLogRow> & Pick<PipelineLogRow, "event" | "status">;
        Update: Partial<PipelineLogRow>;
        Relationships: [];
      };
      approval_logs: {
        Row: ApprovalLogRow;
        Insert: Partial<ApprovalLogRow> & Pick<ApprovalLogRow, "action" | "status">;
        Update: Partial<ApprovalLogRow>;
        Relationships: [];
      };
      publish_logs: {
        Row: PublishLogRow;
        Insert: Partial<PublishLogRow> & Pick<PublishLogRow, "status">;
        Update: Partial<PublishLogRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
