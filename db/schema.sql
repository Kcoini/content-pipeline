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

-- theme 상태: draft -> sources_ready -> generating -> drafted -> reviewed
--             (계약/평가 실패 시) -> failed
create type theme_status as enum (
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
-- themes: 사용자가 입력한 기사 주제
-- ------------------------------------------------------------

create table themes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  keywords text[] not null default '{}',
  language text not null default 'ko' check (language in ('ko', 'en')),
  status theme_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_themes_updated_at
  before update on themes
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- sources: 주제별 출처 (URL + 메타데이터)
-- source.contract.yaml의 required-fields, url-format, unique-url-per-theme,
-- min-source-count 규칙에 대응한다.
-- ------------------------------------------------------------

-- url/title은 출처 등록 시점에는 비어 있을 수 있다 (source.contract.yaml의
-- required-fields 규칙은 기사 생성 시점에 검사하며, 그 전까지는 미완성 출처로 등록될 수 있다).
-- publisher/reliability_score/collected_at은 Phase 2 placeholder 컬럼이다.
-- 현재 코드(lib/repositories/source-repository.ts)는 author 컬럼을 출처(publisher)로
-- 사용하며, 이 세 컬럼에는 값을 쓰지 않는다 (스키마 자리만 마련).
create table sources (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references themes(id) on delete cascade,
  url text not null default '',
  title text not null default '',
  author text,
  publisher text,
  published_at timestamptz,
  summary text,
  reliability_score numeric,
  collected_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sources_url_format check (url = '' or url ~* '^https?://'),

  -- Phase 1-9: URL 본문 수집 상태
  -- fetch_status: pending(수집 대기) / success(수집 완료) / failed(수집 실패)
  fetch_status text not null default 'pending'
    check (fetch_status in ('pending', 'success', 'failed')),
  raw_content text,
  extracted_title text,
  fetched_at timestamptz,
  fetch_error text
);

create trigger trg_sources_updated_at
  before update on sources
  for each row execute function set_updated_at();

create index idx_sources_theme_id on sources (theme_id);

-- url이 비어 있지 않은 출처에 한해 같은 주제 내 중복 URL을 막는다.
create unique index sources_theme_url_unique_idx on sources (theme_id, url) where url <> '';

-- ------------------------------------------------------------
-- articles: 출처를 근거로 생성된 기사 초안
-- article.contract.yaml의 initial-status-draft, min-content-length 규칙에 대응한다.
-- 기사 본문은 content 컬럼 기준이다 (draft_body 등 과거 컬럼은 사용하지 않음;
-- 기존 DB에 남아있는 경우 db/migrations/002_articles_content_column.sql 참고).
-- ------------------------------------------------------------

create table articles (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references themes(id) on delete cascade,
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

create index idx_articles_theme_id on articles (theme_id);

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
-- 로그/실행 기록 테이블의 역할 구분 (docs/requirements.md 7장 참고)
--
-- - agent_runs:     AI/에이전트(LLM) 호출 자체의 실행 기록 (입력/출력, 성공·실패)
-- - contract_runs:  계약 검사(Reins Engineering) 실행 결과 이력
-- - eval_runs:      AI Evals(품질 평가) 결과 기록
-- - pipeline_logs:  대시보드에 노출되는 파이프라인 이벤트 로그 (FR-10)
-- - approval_logs:  사용자 승인(Human Approval) 이벤트 기록 (FR-9, MVP 이후 사용)
-- - publish_logs:   기사 게시(publish) 이벤트 기록 (MVP 이후, 구조만 정의)
--
-- 비고: pipeline_logs / contract_runs의 상세 정보 컬럼명은 details_json으로
-- 통일한다 (lib/repositories/log-repository.ts가 읽고 쓰는 컬럼).
--
-- pipeline_logs.event_name / contract_runs에서 사용하는 어휘는 현재
-- lib/repositories/log-repository.ts의 LogEventType(theme_created, source_added,
-- contract_checked, article_draft_created)이다. pipeline_logs.stage,
-- contract_runs.stage는 lib/harness/pipeline.ts(Phase 2 오케스트레이터)에서 사용할
-- PipelineStage(source_validation 등) 값을 위한 자리만 마련해 둔 컬럼이며,
-- 현재 코드는 이 컬럼에 값을 쓰지 않는다 (항상 null).
--
-- contract_runs.source_count/failed_conditions는 recordContractCheck가 계약 검사
-- 시점의 출처 개수와 실패한 규칙 ID 목록을 채운다. pipeline_logs.target_type/
-- target_id, contract_runs.article_id/details_json은 향후 더 상세한 추적을 위한
-- 자리만 마련해 둔 컬럼으로, 현재 코드는 값을 쓰지 않는다 (항상 null/기본값).
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- agent_runs: AI/에이전트(LLM) 실행 기록
-- 기사 초안 생성(lib/ai/generate-article.ts), AI 평가(lib/ai/eval-article.ts) 등
-- LLM 호출 단위의 입력/출력과 성공·실패 여부를 기록한다.
-- ------------------------------------------------------------

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid references themes(id) on delete cascade,
  article_id uuid references articles(id) on delete set null,
  agent_name text not null,
  status text not null check (status in ('success', 'failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_agent_runs_theme_id on agent_runs (theme_id);
create index idx_agent_runs_article_id on agent_runs (article_id);

-- ------------------------------------------------------------
-- contract_runs: contract-runner 실행 결과 (source/article 계약 검사 이력)
-- ------------------------------------------------------------

create table contract_runs (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid references themes(id) on delete cascade,
  article_id uuid references articles(id) on delete set null,
  target_type text not null check (target_type in ('source', 'article')),
  target_id uuid,
  contract_name text not null,
  stage text,
  passed boolean not null,
  status text not null check (status in ('success', 'failed')),
  source_count integer,
  failed_conditions jsonb not null default '[]'::jsonb,
  violations jsonb not null default '[]'::jsonb,
  details_json jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_contract_runs_updated_at
  before update on contract_runs
  for each row execute function set_updated_at();

create index idx_contract_runs_theme_id on contract_runs (theme_id);
create index idx_contract_runs_article_id on contract_runs (article_id);

-- ------------------------------------------------------------
-- eval_runs: AI Evals 실행 결과 (evals/article-quality.eval.yaml 기준)
-- 평가 점수는 aggregate_score 기준이다. score는 과거 schema와의 호환을 위해
-- 유지하는 컬럼으로, lib/repositories/eval-repository.ts가 aggregate_score와
-- 항상 동일한 값을 함께 저장한다 (db/migrations/003_eval_runs_score_column.sql 참고).
-- ------------------------------------------------------------

create table eval_runs (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  eval_name text not null,
  criteria_scores jsonb not null default '{}'::jsonb,
  aggregate_score numeric default 0,
  score numeric default 0,
  passed boolean not null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_eval_runs_article_id on eval_runs (article_id);

-- ------------------------------------------------------------
-- pipeline_logs: 파이프라인 단계별 실행 로그 (FR-10)
--
-- 대시보드(app/dashboard)에 표시되는 이벤트 로그이다. agent_runs(LLM 호출 자체의
-- 입출력 기록)와 달리, pipeline_logs는 사용자에게 보여주는 단계별 진행 상황
-- (테마 생성, 출처 등록, 계약 검사, 기사 초안 생성 등)을 기록한다.
--
-- event/status는 lib/repositories/log-repository.ts의 LogEventType/LogStatus
-- (theme_created, source_added, contract_checked, article_draft_created /
--  success, failed, info)를 그대로 저장한다. stage/target_type/target_id는
-- lib/harness/pipeline.ts(Phase 2 오케스트레이터)에서 사용할 자리만 마련해 둔
-- 컬럼이며, 현재 코드는 값을 쓰지 않는다.
-- ------------------------------------------------------------

create table pipeline_logs (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid references themes(id) on delete cascade,
  article_id uuid references articles(id) on delete set null,
  target_type text check (target_type in ('source', 'article')),
  target_id uuid,
  event_name text not null,
  stage text,
  status text not null check (status in ('success', 'failed', 'info')),
  message text,
  details_json jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_pipeline_logs_updated_at
  before update on pipeline_logs
  for each row execute function set_updated_at();

create index idx_pipeline_logs_theme_id on pipeline_logs (theme_id);
create index idx_pipeline_logs_article_id on pipeline_logs (article_id);

-- ------------------------------------------------------------
-- approval_logs: 사용자 승인(Human Approval) 이벤트 기록 (FR-9)
-- lib/harness/approval-gate.ts를 통한 status 전환(reviewed/published) 승인 시
-- 누가, 언제, 무엇을 승인했는지 기록한다. MVP에서는 구조만 정의하고
-- 실제 저장 로직은 이후 단계에서 연결한다.
-- ------------------------------------------------------------

create table approval_logs (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid references themes(id) on delete cascade,
  article_id uuid references articles(id) on delete cascade,
  -- 승인 대상 종류 (현재는 'article' 고정). saveApprovalLog()가 반드시 채운다.
  target_type text not null default 'article',
  -- 승인 대상 id. article 승인 시 article_id와 동일하다.
  target_id uuid,
  action text not null,
  approved_by text,
  status text not null check (status in ('approved', 'rejected')),
  notes text,
  created_at timestamptz not null default now()
);

create index idx_approval_logs_theme_id on approval_logs (theme_id);
create index idx_approval_logs_article_id on approval_logs (article_id);

-- ------------------------------------------------------------
-- publish_logs: 기사 게시(publish) 이벤트 기록
-- article.status가 'published'로 전환될 때의 게시 결과를 기록한다.
-- published 상태로의 게시 흐름은 MVP 이후 범위이며, 이 테이블은 구조만 정의한다.
-- ------------------------------------------------------------

create table publish_logs (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references articles(id) on delete cascade,
  status text not null check (status in ('success', 'failed')),
  target text,
  details jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_publish_logs_article_id on publish_logs (article_id);

-- ------------------------------------------------------------
-- Row Level Security (Phase 1 이후)
--
-- MVP에서는 Next.js 서버(Route Handler)가 service_role 키로 모든 테이블에
-- 접근하고, 클라이언트는 직접 테이블에 접근하지 않는 것을 전제로 한다.
-- 추후 다중 사용자/권한 분리가 필요해지면 아래와 같이 RLS를 활성화하고
-- 정책을 추가한다.
--
-- alter table themes enable row level security;
-- alter table sources enable row level security;
-- alter table articles enable row level security;
-- alter table article_sources enable row level security;
-- alter table agent_runs enable row level security;
-- alter table contract_runs enable row level security;
-- alter table eval_runs enable row level security;
-- alter table pipeline_logs enable row level security;
-- alter table approval_logs enable row level security;
-- alter table publish_logs enable row level security;
-- ------------------------------------------------------------
