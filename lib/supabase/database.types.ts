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

/** Phase 2-1: 수익형 콘텐츠 글쓰기 모드 3종 */
export type ArticleMode = "general_news" | "source_based_explainer" | "monetized_blog";

// PipelineStage: lib/harness/pipeline.ts(전체 오케스트레이터, Phase 2)에서 사용할
// 단계 이름이다. pipeline_logs.stage / contract_runs.stage 컬럼은 이 값을 위해
// 마련해 둔 자리이며, 현재 MVP 코드는 이 컬럼에 값을 쓰지 않는다 (항상 null).
// 현재 사용 중인 이벤트 어휘는 lib/repositories/log-repository.ts의
// LogEventType(theme_created, source_added 등)이며, pipeline_logs.event_name 컬럼에
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
  /** Phase 1-12: 생성 방식 메타데이터 { creation_method, theme_cluster_id? } */
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Phase 1-12: 트렌드 후보 (네이버/다음/mock) */
export type TrendCandidateRow = {
  id: string;
  platform: string;
  keyword: string | null;
  title: string | null;
  snippet: string | null;
  url: string | null;
  rank_position: number | null;
  collected_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Phase 1-13: 기사 URL 후보 상태 */
export type ArticleUrlCandidateStatus = "candidate" | "selected" | "dismissed" | "imported";

/** Phase 1-13: 테마 키워드 검색으로 수집된 기사 URL 후보 */
export type ArticleUrlCandidateRow = {
  id: string;
  theme_id: string | null;
  theme_cluster_id: string | null;
  platform: string;
  query: string | null;
  title: string | null;
  snippet: string | null;
  url: string;
  publisher: string | null;
  published_at: string | null;
  rank_position: number | null;
  status: ArticleUrlCandidateStatus;
  metadata: Record<string, unknown>;
  collected_at: string;
  created_at: string;
  updated_at: string;
};

/** Phase 1-12: 키워드 클러스터링 결과 */
export type ThemeClusterRow = {
  id: string;
  title: string;
  description: string | null;
  keywords: string[];
  naver_count: number;
  daum_count: number;
  score: number;
  status: "candidate" | "selected" | "dismissed";
  created_at: string;
  updated_at: string;
};

export type FetchStatus = "pending" | "success" | "failed";
export type SummaryStatus = "pending" | "success" | "failed" | "skipped";

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
  /** Phase 1-9: URL 본문 수집 상태 */
  fetch_status: FetchStatus;
  raw_content: string | null;
  extracted_title: string | null;
  fetched_at: string | null;
  fetch_error: string | null;
  /** Phase 1-10: AI 자동 요약 상태 */
  summary_status: SummaryStatus;
  summary_error: string | null;
  summarized_at: string | null;
  key_points: string[];
};

/** Phase 2-3: WordPress metadata 생성/검토 상태 */
export type WordPressMetadataStatus = "not_ready" | "generated" | "reviewed" | "failed";

/** Phase 2-4: 지원하는 WordPress SEO plugin */
export type SeoPluginProvider = "none" | "yoast" | "rank_math" | "aioseo";

/** Phase 2-4: SEO plugin metadata 생성/검토 상태 */
export type SeoPluginMetadataStatus = "not_ready" | "generated" | "reviewed" | "failed";

/** Phase 2-4: SEO plugin 실제 write 시도 상태 (safe stub) */
export type SeoPluginWriteStatus =
  | "not_attempted"
  | "skipped_dry_run"
  | "skipped_provider_none"
  | "success"
  | "failed";

/** Phase 2-5: 대표 이미지(featured image) 준비/검토 상태 */
export type FeaturedImageStatus = "not_ready" | "prepared" | "reviewed" | "failed" | "uploaded";

/** Phase 2-6: featured image 원본 소스 종류 */
export type WordPressMediaSourceType = "none" | "generated_url" | "external_url" | "local_file" | "uploaded";

/** Phase 2-6: WordPress media upload 준비/시도 상태 (safe stub) */
export type WordPressMediaUploadStatus = "not_ready" | "prepared" | "dry_run" | "uploaded" | "failed" | "skipped";

/** Phase 2-7: 이미지 생성 provider */
export type ImageGenerationProvider = "mock" | "openai" | "custom";

/** Phase 2-7: 이미지 생성 상태 */
export type GeneratedImageStatus = "not_generated" | "queued" | "generating" | "generated" | "reviewed" | "failed";

/** Phase 2-11: WordPress draft post에 featured_media 연결 시도 상태 */
export type WordPressFeaturedMediaAttachStatus = "not_attached" | "attached" | "skipped_no_media_id" | "failed";

/** Phase 2-12: SEO plugin 실제 metadata write 시도 상태 */
export type SeoPluginActualWriteStatus =
  | "not_attempted"
  | "skipped_disabled"
  | "skipped_provider_none"
  | "skipped_no_wordpress_post"
  | "skipped_missing_target_keyword"
  | "success"
  | "failed"
  | "needs_custom_endpoint";

/** Phase 2-13: WordPress custom SEO endpoint(Rank Math 전용) write 시도 상태 */
export type SeoPluginCustomEndpointStatus =
  | "not_attempted"
  | "skipped_disabled"
  | "skipped_provider_not_supported"
  | "skipped_no_wordpress_post"
  | "skipped_missing_target_keyword"
  | "success"
  | "failed";

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
  /** Phase 2-1: 글쓰기 모드 및 모드별 부가 필드 */
  article_mode: ArticleMode;
  seo_title: string | null;
  meta_description: string | null;
  slug: string | null;
  target_keyword: string | null;
  secondary_keywords: string[];
  search_intent: string | null;
  reader_persona: string | null;
  ad_slots: Record<string, unknown>[];
  internal_link_suggestions: Record<string, unknown>[];
  monetization_score: number | null;
  policy_risk_score: number | null;
  format_metadata: Record<string, unknown>;
  /** Phase 2-3: WordPress 카테고리/태그/metadata 상태 */
  wp_category_names: string[];
  wp_tag_names: string[];
  wp_category_ids: number[];
  wp_tag_ids: number[];
  wp_metadata_status: WordPressMetadataStatus;
  wp_metadata_generated_at: string | null;
  /** Phase 2-4: SEO plugin metadata mapping 상태 */
  seo_plugin_provider: SeoPluginProvider;
  seo_plugin_payload: Record<string, unknown>;
  seo_plugin_metadata_status: SeoPluginMetadataStatus;
  seo_plugin_metadata_generated_at: string | null;
  seo_plugin_write_status: SeoPluginWriteStatus;
  seo_plugin_write_error: string | null;
  /** Phase 2-5: 대표 이미지 준비 정보 */
  featured_image_status: FeaturedImageStatus;
  featured_image_prompt: string | null;
  featured_image_alt_text: string | null;
  featured_image_caption: string | null;
  featured_image_style: string | null;
  featured_image_aspect_ratio: string;
  featured_image_metadata: Record<string, unknown>;
  featured_image_generated_at: string | null;
  featured_image_reviewed_at: string | null;
  featured_image_wordpress_media_id: number | null;
  featured_image_wordpress_url: string | null;
  featured_image_error: string | null;
  /** Phase 2-6: WordPress media upload 준비 정보 */
  featured_image_source_type: WordPressMediaSourceType;
  featured_image_source_url: string | null;
  featured_image_local_path: string | null;
  featured_image_filename: string | null;
  featured_image_mime_type: string | null;
  featured_image_upload_status: WordPressMediaUploadStatus;
  featured_image_upload_payload: Record<string, unknown>;
  featured_image_upload_error: string | null;
  featured_image_upload_attempted_at: string | null;
  /** Phase 2-7: 이미지 생성 결과 */
  generated_image_status: GeneratedImageStatus;
  generated_image_provider: ImageGenerationProvider;
  generated_image_model: string | null;
  generated_image_prompt: string | null;
  generated_image_negative_prompt: string | null;
  generated_image_url: string | null;
  generated_image_local_path: string | null;
  generated_image_width: number | null;
  generated_image_height: number | null;
  generated_image_format: string | null;
  generated_image_metadata: Record<string, unknown>;
  generated_image_error: string | null;
  generated_image_requested_at: string | null;
  generated_image_completed_at: string | null;
  generated_image_reviewed_at: string | null;
  /** Phase 2-11: WordPress draft post에 featured_media 연결 시도 상태 */
  wordpress_featured_media_attach_status: WordPressFeaturedMediaAttachStatus;
  wordpress_featured_media_attached_at: string | null;
  wordpress_featured_media_attach_error: string | null;
  /** Phase 2-12: SEO plugin 실제 metadata write 시도 상태 */
  seo_plugin_actual_write_status: SeoPluginActualWriteStatus;
  seo_plugin_actual_write_provider: string | null;
  seo_plugin_actual_write_post_id: number | null;
  seo_plugin_actual_write_error: string | null;
  seo_plugin_actual_write_attempted_at: string | null;
  seo_plugin_actual_write_verified: boolean;
  seo_plugin_actual_write_warning: string | null;
  /** Phase 2-13: WordPress custom SEO endpoint(Rank Math 전용) write 시도 상태 */
  seo_plugin_custom_endpoint_status: SeoPluginCustomEndpointStatus;
  seo_plugin_custom_endpoint_verified: boolean;
  seo_plugin_custom_endpoint_error: string | null;
  seo_plugin_custom_endpoint_attempted_at: string | null;
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
  event_name: string;
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
  /** 승인 대상 종류 (article / source 등). 현재는 'article' 고정. */
  target_type: string | null;
  /** 승인 대상 id. article 승인 시 article_id와 동일하다. */
  target_id: string | null;
  action: string;
  approved_by: string | null;
  status: ApprovalLogStatus;
  notes: string | null;
  created_at: string;
};

/** Phase 2-2: dry_run은 WORDPRESS_PUBLISH_ENABLED=false일 때의 결과 상태다. */
export type PublishLogStatus = "success" | "failed" | "dry_run" | "skipped";

export type PublishLogRow = {
  id: string;
  article_id: string | null;
  status: PublishLogStatus;
  target: string | null;
  /** 과거 schema의 호환용 컬럼. Phase 2-8부터는 details_json을 사용한다. */
  details: Record<string, unknown>;
  published_at: string | null;
  created_at: string;
  /** Phase 2-2: WordPress 등 외부 게시 대상의 post id */
  external_post_id: string | null;
  /** Phase 2-2: 게시된 글의 URL (성공 시에만 존재) */
  post_url: string | null;
  /** Phase 2-2: 실패 시 오류 메시지 */
  error_message: string | null;
  /** Phase 2-8: pipeline_logs/contract_runs와 컬럼명을 맞춘 상세 정보(jsonb). 민감정보/본문 전체 저장 금지 */
  details_json: Record<string, unknown>;
  updated_at: string;
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
        Insert: Partial<PipelineLogRow> & Pick<PipelineLogRow, "event_name" | "status">;
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
      trend_candidates: {
        Row: TrendCandidateRow;
        Insert: Partial<TrendCandidateRow> & Pick<TrendCandidateRow, "platform">;
        Update: Partial<TrendCandidateRow>;
        Relationships: [];
      };
      theme_clusters: {
        Row: ThemeClusterRow;
        Insert: Partial<ThemeClusterRow> & Pick<ThemeClusterRow, "title">;
        Update: Partial<ThemeClusterRow>;
        Relationships: [];
      };
      article_url_candidates: {
        Row: ArticleUrlCandidateRow;
        Insert: Partial<ArticleUrlCandidateRow> & Pick<ArticleUrlCandidateRow, "platform" | "url">;
        Update: Partial<ArticleUrlCandidateRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
