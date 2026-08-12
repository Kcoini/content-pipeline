-- Phase 3-9: Social Metrics Manual Input & Performance Tracking
--
-- manual_post_status='posted'가 된 social_posts에 대해, 사람이 플랫폼
-- 화면에서 직접 확인한 성과 지표(조회수/좋아요/댓글/공유/저장/클릭 등)를
-- 수동으로 입력하고 이력을 저장하기 위한 테이블/컬럼을 추가한다. 이
-- migration/기능 어디에도 실제 외부 플랫폼 Analytics/Insights API 호출은
-- 없다 — 모든 수치는 사람이 직접 입력한다. create table/add column if
-- not exists만 사용해 여러 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

-- ---------------------------------------------------------------------
-- 1) social_post_metrics: social post별 성과 지표 입력 이력
-- ---------------------------------------------------------------------

create table if not exists social_post_metrics (
  id uuid primary key default gen_random_uuid(),
  social_post_id uuid not null references social_posts(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  platform text not null,
  measured_at timestamptz not null default now(),
  recorded_by text,
  views integer not null default 0,
  impressions integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  saves integer not null default 0,
  clicks integer not null default 0,
  profile_visits integer not null default 0,
  follows integer not null default 0,
  reach integer not null default 0,
  engagement_rate numeric,
  click_through_rate numeric,
  conversion_count integer not null default 0,
  conversion_rate numeric,
  performance_score numeric,
  notes text,
  raw_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_social_post_metrics_social_post_id on social_post_metrics (social_post_id);
create index if not exists idx_social_post_metrics_article_id on social_post_metrics (article_id);
create index if not exists idx_social_post_metrics_platform on social_post_metrics (platform);
create index if not exists idx_social_post_metrics_measured_at on social_post_metrics (measured_at);
create index if not exists idx_social_post_metrics_created_at on social_post_metrics (created_at);
create index if not exists idx_social_post_metrics_performance_score on social_post_metrics (performance_score);

drop trigger if exists trg_social_post_metrics_updated_at on social_post_metrics;
create trigger trg_social_post_metrics_updated_at
  before update on social_post_metrics
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 2) social_posts: 최신 성과 요약 컬럼
-- ---------------------------------------------------------------------

-- latest_metrics_id는 social_post_metrics(id)를 참조하되, 참조 순서
-- (social_posts가 먼저 생성됨) 및 이전 phase와의 호환성을 위해 FK
-- 제약 없이 uuid 컬럼만 둔다.
alter table social_posts add column if not exists latest_metrics_id uuid;
alter table social_posts add column if not exists latest_metrics_recorded_at timestamptz;
alter table social_posts add column if not exists latest_views integer not null default 0;
alter table social_posts add column if not exists latest_impressions integer not null default 0;
alter table social_posts add column if not exists latest_likes integer not null default 0;
alter table social_posts add column if not exists latest_comments integer not null default 0;
alter table social_posts add column if not exists latest_shares integer not null default 0;
alter table social_posts add column if not exists latest_saves integer not null default 0;
alter table social_posts add column if not exists latest_clicks integer not null default 0;
alter table social_posts add column if not exists latest_engagement_rate numeric;
alter table social_posts add column if not exists latest_click_through_rate numeric;
alter table social_posts add column if not exists latest_performance_score numeric;
alter table social_posts add column if not exists performance_status text not null default 'not_measured';
alter table social_posts add column if not exists performance_summary jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_performance_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_performance_status_check
      check (performance_status in ('not_measured', 'low', 'average', 'good', 'excellent', 'needs_review'));
  end if;
end $$;

create index if not exists idx_social_posts_performance_status on social_posts (performance_status);

-- 컬럼/테이블 추가 후 PostgREST schema cache를 갱신한다.
notify pgrst, 'reload schema';
