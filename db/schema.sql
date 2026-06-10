-- ============================================================
-- content-pipeline DB 스키마 (Supabase / PostgreSQL)
--
-- 적용 방법: Supabase 프로젝트의 SQL Editor에서 이 파일 전체를 실행한다.
-- 이 스키마는 docs/requirements.md, docs/acceptance-criteria.md,
-- contracts/*.yaml에 정의된 상태 모델/계약을 따른다.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- ENUM 타입
-- ------------------------------------------------------------

-- topic 상태: draft -> sources_ready -> generating -> drafted -> reviewed
--             (계약/평가 실패 시) -> failed
create type topic_status as enum (
  'draft',
  'sources_ready',
  'generating',
  'drafted',
  'reviewed',
  'failed'
);

-- article 상태: draft -> reviewed -> published
-- published는 MVP 이후 사용 예정이며, 구조만 미리 정의한다.
create type article_status as enum (
  'draft',
  'reviewed',
  'published'
);

-- 파이프라인 단계 (lib/harness/logger.ts의 PipelineStage와 일치해야 한다)
create type pipeline_stage as enum (
  'source_validation',
  'article_generation',
  'article_contract_check',
  'article_eval',
  'human_review'
);

-- 파이프라인 로그 상태 (lib/harness/logger.ts의 PipelineLogStatus와 일치해야 한다)
create type pipeline_log_status as enum (
  'started',
  'succeeded',
  'failed',
  'skipped'
);

-- ------------------------------------------------------------
-- 공통: updated_at 자동 갱신 트리거 함수
-- ------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ------------------------------------------------------------
-- topics: 사용자가 입력한 기사 주제
-- ------------------------------------------------------------

create table topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status topic_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_topics_updated_at
  before update on topics
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- sources: 주제별 출처 (URL + 메타데이터)
-- source.contract.yaml의 required-fields, url-format, unique-url-per-topic,
-- min-source-count 규칙에 대응한다.
-- ------------------------------------------------------------

create table sources (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id) on delete cascade,
  url text not null,
  title text not null,
  author text,
  published_at timestamptz,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint sources_url_format check (url ~* '^https?://'),
  constraint sources_topic_url_unique unique (topic_id, url)
);

create index idx_sources_topic_id on sources (topic_id);

-- ------------------------------------------------------------
-- articles: 출처를 근거로 생성된 기사 초안
-- article.contract.yaml의 initial-status-draft, min-content-length 규칙에 대응한다.
-- ------------------------------------------------------------

create table articles (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id) on delete cascade,
  title text not null,
  content text not null,
  status article_status not null default 'draft',
  version integer not null default 1,
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint articles_min_content_length check (char_length(content) >= 500),
  -- reviewed/published 상태는 reviewed_at, reviewed_by가 함께 기록되어야 한다 (FR-9)
  constraint articles_review_fields_required check (
    status = 'draft'
    or (reviewed_at is not null and reviewed_by is not null)
  )
);

create trigger trg_articles_updated_at
  before update on articles
  for each row execute function set_updated_at();

create index idx_articles_topic_id on articles (topic_id);

-- ------------------------------------------------------------
-- article_sources: 기사가 인용한 출처 (다대다)
-- article.contract.yaml의 min-linked-sources 규칙에 대응한다.
-- ------------------------------------------------------------

create table article_sources (
  article_id uuid not null references articles(id) on delete cascade,
  source_id uuid not null references sources(id) on delete restrict,
  created_at timestamptz not null default now(),

  primary key (article_id, source_id)
);

create index idx_article_sources_source_id on article_sources (source_id);

-- ------------------------------------------------------------
-- contract_runs: contract-runner 실행 결과 (source/article 계약 검사 이력)
-- ------------------------------------------------------------

create table contract_runs (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references topics(id) on delete cascade,
  target_type text not null check (target_type in ('source', 'article')),
  target_id uuid,
  contract_name text not null,
  passed boolean not null,
  violations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_contract_runs_topic_id on contract_runs (topic_id);

-- ------------------------------------------------------------
-- eval_runs: AI Evals 실행 결과 (evals/article-quality.eval.yaml 기준)
-- ------------------------------------------------------------

create table eval_runs (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  eval_name text not null,
  criteria_scores jsonb not null default '{}'::jsonb,
  aggregate_score numeric,
  passed boolean not null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_eval_runs_article_id on eval_runs (article_id);

-- ------------------------------------------------------------
-- pipeline_logs: 파이프라인 단계별 실행 로그 (FR-10)
-- ------------------------------------------------------------

create table pipeline_logs (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references topics(id) on delete cascade,
  article_id uuid references articles(id) on delete set null,
  stage pipeline_stage not null,
  status pipeline_log_status not null,
  message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_pipeline_logs_topic_id on pipeline_logs (topic_id);
create index idx_pipeline_logs_article_id on pipeline_logs (article_id);

-- ------------------------------------------------------------
-- Row Level Security (Phase 1 이후)
--
-- MVP에서는 Next.js 서버(Route Handler)가 service_role 키로 모든 테이블에
-- 접근하고, 클라이언트는 직접 테이블에 접근하지 않는 것을 전제로 한다.
-- 추후 다중 사용자/권한 분리가 필요해지면 아래와 같이 RLS를 활성화하고
-- 정책을 추가한다.
--
-- alter table topics enable row level security;
-- alter table sources enable row level security;
-- alter table articles enable row level security;
-- alter table article_sources enable row level security;
-- alter table contract_runs enable row level security;
-- alter table eval_runs enable row level security;
-- alter table pipeline_logs enable row level security;
-- ------------------------------------------------------------
