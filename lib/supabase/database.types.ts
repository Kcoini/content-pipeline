// db/schema.sql과 1:1로 대응하는 Supabase 테이블 타입 정의.
// 스키마가 바뀌면 이 파일도 함께 갱신한다.

export type TopicStatus =
  | "draft"
  | "sources_ready"
  | "generating"
  | "drafted"
  | "reviewed"
  | "failed";

export type ArticleStatus = "draft" | "reviewed" | "published";

// pipeline_stage / pipeline_log_status: lib/harness/pipeline.ts(전체 오케스트레이터, Phase 2)에서
// 사용할 예정인 단계 이름이다. 현재 MVP의 lib/harness/logger.ts는 더 세분화된
// 이벤트 타입(theme_created, source_added 등)을 사용하므로 pipeline_logs.stage/status는
// text 컬럼으로 두고, 두 어휘 중 logger.ts 쪽을 우선 저장한다.
export type PipelineStage =
  | "source_validation"
  | "article_generation"
  | "article_contract_check"
  | "article_eval"
  | "human_review";

export type PipelineLogStatus = "started" | "succeeded" | "failed" | "skipped";

export type ContractTargetType = "source" | "article";

export type TopicRow = {
  id: string;
  title: string;
  description: string | null;
  keywords: string[];
  language: string;
  status: TopicStatus;
  created_at: string;
  updated_at: string;
};

export type SourceRow = {
  id: string;
  topic_id: string;
  url: string;
  title: string;
  author: string | null;
  published_at: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ArticleRow = {
  id: string;
  topic_id: string;
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

export type ContractRunRow = {
  id: string;
  topic_id: string | null;
  target_type: ContractTargetType;
  target_id: string | null;
  contract_name: string;
  passed: boolean;
  violations: unknown[];
  created_at: string;
};

export type EvalRunRow = {
  id: string;
  article_id: string;
  eval_name: string;
  criteria_scores: Record<string, unknown>;
  aggregate_score: number | null;
  passed: boolean;
  notes: string | null;
  created_at: string;
};

export type PipelineLogRow = {
  id: string;
  topic_id: string | null;
  article_id: string | null;
  stage: string;
  status: string;
  message: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      topics: {
        Row: TopicRow;
        Insert: Partial<TopicRow> & Pick<TopicRow, "title">;
        Update: Partial<TopicRow>;
        Relationships: [];
      };
      sources: {
        Row: SourceRow;
        Insert: Partial<SourceRow> & Pick<SourceRow, "topic_id" | "url" | "title">;
        Update: Partial<SourceRow>;
        Relationships: [];
      };
      articles: {
        Row: ArticleRow;
        Insert: Partial<ArticleRow> & Pick<ArticleRow, "topic_id" | "title" | "content">;
        Update: Partial<ArticleRow>;
        Relationships: [];
      };
      article_sources: {
        Row: ArticleSourceRow;
        Insert: Partial<ArticleSourceRow> & Pick<ArticleSourceRow, "article_id" | "source_id">;
        Update: Partial<ArticleSourceRow>;
        Relationships: [];
      };
      contract_runs: {
        Row: ContractRunRow;
        Insert: Partial<ContractRunRow> &
          Pick<ContractRunRow, "target_type" | "contract_name" | "passed">;
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
        Insert: Partial<PipelineLogRow> & Pick<PipelineLogRow, "stage" | "status">;
        Update: Partial<PipelineLogRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
