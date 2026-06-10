-- ============================================================
-- 001_align_dashboard_schema.sql
--
-- 목적: 코드(lib/repositories/*)가 실제로 사용하는 테이블/컬럼 구조와
-- 실제 Supabase DB의 schema를 일치시킨다.
--
-- 적용 방법: Supabase 프로젝트의 SQL Editor에서 이 파일 전체를 실행한다.
--
-- 안전성:
-- - create table if not exists / alter table ... add column if not exists
--   형식만 사용하며, drop table / drop column은 사용하지 않는다.
-- - 기존 데이터는 삭제되지 않는다 (필요한 경우 update로 새 컬럼에 백필만 한다).
-- - 여러 번 실행해도 안전하다 (idempotent).
--
-- 최종 결과는 db/schema.sql과 일치한다. db/schema.sql은 신규 프로젝트용
-- 전체 스키마 정의이고, 이 파일은 기존 DB를 그 상태로 맞추기 위한 마이그레이션이다.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- ENUM 타입 (이미 있으면 건너뜀)
-- ------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'theme_status') then
    create type theme_status as enum (
      'draft', 'sources_ready', 'generating', 'drafted', 'reviewed', 'failed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'article_status') then
    create type article_status as enum ('draft', 'reviewed', 'published');
  end if;
end $$;

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
-- themes
-- ------------------------------------------------------------

create table if not exists themes (
  id uuid primary key default gen_random_uuid()
);

alter table themes add column if not exists title text not null default '';
alter table themes add column if not exists description text;
alter table themes add column if not exists keywords text[] not null default '{}';
alter table themes add column if not exists language text not null default 'ko';
alter table themes add column if not exists status theme_status not null default 'draft';
alter table themes add column if not exists created_at timestamptz not null default now();
alter table themes add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_themes_updated_at on themes;
create trigger trg_themes_updated_at
  before update on themes
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- sources
-- ------------------------------------------------------------

create table if not exists sources (
  id uuid primary key default gen_random_uuid()
);

alter table sources add column if not exists theme_id uuid;
alter table sources add column if not exists url text not null default '';
alter table sources add column if not exists title text not null default '';
alter table sources add column if not exists author text;
alter table sources add column if not exists publisher text;
alter table sources add column if not exists published_at timestamptz;
alter table sources add column if not exists summary text;
alter table sources add column if not exists reliability_score numeric;
alter table sources add column if not exists collected_at timestamptz;
alter table sources add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table sources add column if not exists created_at timestamptz not null default now();
alter table sources add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_sources_updated_at on sources;
create trigger trg_sources_updated_at
  before update on sources
  for each row execute function set_updated_at();

create index if not exists idx_sources_theme_id on sources (theme_id);
create unique index if not exists sources_theme_url_unique_idx
  on sources (theme_id, url) where url <> '';

-- ------------------------------------------------------------
-- articles
-- ------------------------------------------------------------

create table if not exists articles (
  id uuid primary key default gen_random_uuid()
);

alter table articles add column if not exists theme_id uuid;
alter table articles add column if not exists title text not null default '';
alter table articles add column if not exists content text not null default '';
alter table articles add column if not exists status article_status not null default 'draft';
alter table articles add column if not exists version integer not null default 1;
alter table articles add column if not exists reviewed_at timestamptz;
alter table articles add column if not exists reviewed_by text;
alter table articles add column if not exists created_at timestamptz not null default now();
alter table articles add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_articles_updated_at on articles;
create trigger trg_articles_updated_at
  before update on articles
  for each row execute function set_updated_at();

create index if not exists idx_articles_theme_id on articles (theme_id);

-- ------------------------------------------------------------
-- article_sources
-- ------------------------------------------------------------

create table if not exists article_sources (
  article_id uuid not null,
  source_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (article_id, source_id)
);

alter table article_sources add column if not exists created_at timestamptz not null default now();

create index if not exists idx_article_sources_source_id on article_sources (source_id);

-- ------------------------------------------------------------
-- agent_runs
-- ------------------------------------------------------------

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid()
);

alter table agent_runs add column if not exists theme_id uuid;
alter table agent_runs add column if not exists article_id uuid;
alter table agent_runs add column if not exists agent_name text not null default '';
alter table agent_runs add column if not exists status text not null default 'success';
alter table agent_runs add column if not exists input jsonb not null default '{}'::jsonb;
alter table agent_runs add column if not exists output jsonb not null default '{}'::jsonb;
alter table agent_runs add column if not exists created_at timestamptz not null default now();

create index if not exists idx_agent_runs_theme_id on agent_runs (theme_id);
create index if not exists idx_agent_runs_article_id on agent_runs (article_id);

-- ------------------------------------------------------------
-- contract_runs
-- ------------------------------------------------------------

create table if not exists contract_runs (
  id uuid primary key default gen_random_uuid()
);

alter table contract_runs add column if not exists theme_id uuid;
alter table contract_runs add column if not exists article_id uuid;
alter table contract_runs add column if not exists target_type text not null default 'source';
alter table contract_runs add column if not exists target_id uuid;
alter table contract_runs add column if not exists contract_name text not null default '';
alter table contract_runs add column if not exists stage text;
alter table contract_runs add column if not exists passed boolean not null default false;
alter table contract_runs add column if not exists status text not null default 'failed';
alter table contract_runs add column if not exists source_count integer;
alter table contract_runs add column if not exists failed_conditions jsonb not null default '[]'::jsonb;
alter table contract_runs add column if not exists violations jsonb not null default '[]'::jsonb;
alter table contract_runs add column if not exists details_json jsonb not null default '{}'::jsonb;
alter table contract_runs add column if not exists details jsonb not null default '{}'::jsonb;
alter table contract_runs add column if not exists created_at timestamptz not null default now();
alter table contract_runs add column if not exists updated_at timestamptz not null default now();

-- status를 passed 값에서 백필한다 (passed=true -> success, false -> failed)
update contract_runs
set status = case when passed then 'success' else 'failed' end;

-- failed_conditions가 비어 있으면 violations(jsonb 배열)의 ruleId로 백필한다.
update contract_runs
set failed_conditions = coalesce(
  (select jsonb_agg(elem->>'ruleId') from jsonb_array_elements(violations) as elem),
  '[]'::jsonb
)
where failed_conditions = '[]'::jsonb
  and jsonb_array_length(violations) > 0;

drop trigger if exists trg_contract_runs_updated_at on contract_runs;
create trigger trg_contract_runs_updated_at
  before update on contract_runs
  for each row execute function set_updated_at();

create index if not exists idx_contract_runs_theme_id on contract_runs (theme_id);
create index if not exists idx_contract_runs_article_id on contract_runs (article_id);

-- ------------------------------------------------------------
-- eval_runs
-- ------------------------------------------------------------

create table if not exists eval_runs (
  id uuid primary key default gen_random_uuid()
);

alter table eval_runs add column if not exists article_id uuid;
alter table eval_runs add column if not exists eval_name text not null default '';
alter table eval_runs add column if not exists criteria_scores jsonb not null default '{}'::jsonb;
alter table eval_runs add column if not exists aggregate_score numeric;
alter table eval_runs add column if not exists passed boolean not null default false;
alter table eval_runs add column if not exists notes text;
alter table eval_runs add column if not exists created_at timestamptz not null default now();

create index if not exists idx_eval_runs_article_id on eval_runs (article_id);

-- ------------------------------------------------------------
-- pipeline_logs
-- ------------------------------------------------------------

create table if not exists pipeline_logs (
  id uuid primary key default gen_random_uuid()
);

alter table pipeline_logs add column if not exists theme_id uuid;
alter table pipeline_logs add column if not exists article_id uuid;
alter table pipeline_logs add column if not exists target_type text;
alter table pipeline_logs add column if not exists target_id uuid;
alter table pipeline_logs add column if not exists event text not null default '';
alter table pipeline_logs add column if not exists stage text;
alter table pipeline_logs add column if not exists status text not null default 'info';
alter table pipeline_logs add column if not exists message text;
alter table pipeline_logs add column if not exists details_json jsonb not null default '{}'::jsonb;
alter table pipeline_logs add column if not exists details jsonb not null default '{}'::jsonb;
alter table pipeline_logs add column if not exists created_at timestamptz not null default now();
alter table pipeline_logs add column if not exists updated_at timestamptz not null default now();

-- 과거에는 stage 컬럼에 LogEventType 값(theme_created 등)을 저장했다.
-- event 컬럼이 비어 있는 행은 stage 값으로 백필하고, stage는 Phase 2
-- PipelineStage 전용 컬럼으로 재사용하기 위해 nullable로 변경한다.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'pipeline_logs' and column_name = 'stage'
  ) then
    update pipeline_logs
    set event = stage
    where event = '' and stage is not null;

    alter table pipeline_logs alter column stage drop not null;
  end if;
end $$;

-- 과거에는 details 컬럼을 상세 정보 저장에 사용했다.
-- details_json이 비어 있는 행은 details 값으로 백필한다.
update pipeline_logs
set details_json = details
where details_json = '{}'::jsonb and details <> '{}'::jsonb;

drop trigger if exists trg_pipeline_logs_updated_at on pipeline_logs;
create trigger trg_pipeline_logs_updated_at
  before update on pipeline_logs
  for each row execute function set_updated_at();

create index if not exists idx_pipeline_logs_theme_id on pipeline_logs (theme_id);
create index if not exists idx_pipeline_logs_article_id on pipeline_logs (article_id);

-- ------------------------------------------------------------
-- approval_logs
-- ------------------------------------------------------------

create table if not exists approval_logs (
  id uuid primary key default gen_random_uuid()
);

alter table approval_logs add column if not exists theme_id uuid;
alter table approval_logs add column if not exists article_id uuid;
alter table approval_logs add column if not exists action text not null default '';
alter table approval_logs add column if not exists approved_by text;
alter table approval_logs add column if not exists status text not null default 'approved';
alter table approval_logs add column if not exists notes text;
alter table approval_logs add column if not exists created_at timestamptz not null default now();

create index if not exists idx_approval_logs_theme_id on approval_logs (theme_id);
create index if not exists idx_approval_logs_article_id on approval_logs (article_id);

-- ------------------------------------------------------------
-- publish_logs
-- ------------------------------------------------------------

create table if not exists publish_logs (
  id uuid primary key default gen_random_uuid()
);

alter table publish_logs add column if not exists article_id uuid;
alter table publish_logs add column if not exists status text not null default 'success';
alter table publish_logs add column if not exists target text;
alter table publish_logs add column if not exists details jsonb not null default '{}'::jsonb;
alter table publish_logs add column if not exists published_at timestamptz;
alter table publish_logs add column if not exists created_at timestamptz not null default now();

create index if not exists idx_publish_logs_article_id on publish_logs (article_id);
