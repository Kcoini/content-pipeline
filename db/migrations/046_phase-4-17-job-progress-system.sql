-- Phase 4-17: Job Progress System
--
-- 트렌드 수집/마스터 원고 생성/블로그·SNS 글 생성/WordPress 게시 준비 등
-- 여러 단계로 이루어진 내부 작업의 진행 상태를 사용자가 화면에서 확인할
-- 수 있게 하기 위한 공통 테이블이다. job_runs가 작업 실행 1건(run)을,
-- job_run_steps가 그 안의 단계 하나하나를 기록한다.
--
-- 이 migration/기능 어디에도 자동 public publish는 없다. WordPress는
-- 여전히 Draft 생성/업데이트까지만 허용한다. full article body/full
-- social post body/full prompt/full AI response/API key/auth token/
-- Application Password는 이 테이블 어디에도 저장하지 않는다 —
-- error_message는 짧고 안전한 요약 문자열만 저장한다.
--
-- create table if not exists / add column if not exists만 사용해 여러
-- 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

-- ---------------------------------------------------------------------
-- 1) job_runs: 작업 실행 1건
-- ---------------------------------------------------------------------

create table if not exists job_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  target_type text,
  target_id text,
  article_id uuid references articles(id) on delete set null,
  social_post_id uuid references social_posts(id) on delete set null,
  theme_id uuid references themes(id) on delete set null,
  status text not null default 'queued',
  current_step_key text,
  current_step_label text,
  total_steps integer not null default 0,
  completed_steps integer not null default 0,
  progress_percent integer not null default 0,
  user_message text,
  error_message text,
  error_category text,
  retryable boolean not null default false,
  next_action_label text,
  next_action_href text,
  started_at timestamptz,
  last_heartbeat_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'job_runs_status_check'
  ) then
    alter table job_runs
      add constraint job_runs_status_check
      check (status in (
        'not_started', 'queued', 'running', 'waiting_user', 'retrying',
        'partial_success', 'completed', 'failed', 'blocked', 'cancelled', 'stalled'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'job_runs_progress_percent_check'
  ) then
    alter table job_runs
      add constraint job_runs_progress_percent_check
      check (progress_percent >= 0 and progress_percent <= 100);
  end if;
end $$;

create index if not exists idx_job_runs_job_type on job_runs (job_type);
create index if not exists idx_job_runs_status on job_runs (status);
create index if not exists idx_job_runs_target on job_runs (target_type, target_id);
create index if not exists idx_job_runs_article_id on job_runs (article_id);
create index if not exists idx_job_runs_social_post_id on job_runs (social_post_id);
create index if not exists idx_job_runs_theme_id on job_runs (theme_id);
create index if not exists idx_job_runs_created_at on job_runs (created_at desc);

drop trigger if exists trg_job_runs_updated_at on job_runs;
create trigger trg_job_runs_updated_at
  before update on job_runs
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 2) job_run_steps: job_run 안의 단계 하나
-- ---------------------------------------------------------------------

create table if not exists job_run_steps (
  id uuid primary key default gen_random_uuid(),
  job_run_id uuid not null references job_runs(id) on delete cascade,
  step_order integer not null,
  step_key text not null,
  step_label text not null,
  status text not null default 'queued',
  message text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'job_run_steps_status_check'
  ) then
    alter table job_run_steps
      add constraint job_run_steps_status_check
      check (status in (
        'not_started', 'queued', 'running', 'waiting_user', 'retrying',
        'partial_success', 'completed', 'failed', 'blocked', 'cancelled', 'stalled', 'skipped'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'job_run_steps_unique_step'
  ) then
    alter table job_run_steps
      add constraint job_run_steps_unique_step
      unique (job_run_id, step_key);
  end if;
end $$;

create index if not exists idx_job_run_steps_job_run_id on job_run_steps (job_run_id, step_order);

drop trigger if exists trg_job_run_steps_updated_at on job_run_steps;
create trigger trg_job_run_steps_updated_at
  before update on job_run_steps
  for each row execute function set_updated_at();

-- 컬럼/테이블 추가 후 PostgREST schema cache를 갱신한다.
notify pgrst, 'reload schema';
