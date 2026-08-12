-- Phase 3-14: Rewrite Performance Tracking & Original-vs-Rewrite Result Comparison
--
-- Phase 3-13에서 재승인/재Export된 rewrite version이 실제로 수동
-- 게시되고 Phase 3-9의 수동 metrics가 입력된 뒤, 원본 social_post와
-- rewrite version의 성과를 비교해 저장한다. 이 migration/기능 어디에도
-- 실제 플랫폼 Analytics API 자동 수집, 자동 A/B 테스트, 자동 재게시,
-- 자동 원본 수정은 없다 — 비교 결과는 사람이 판단하기 위한 참고
-- 자료일 뿐이다. create table/add column if not exists만 사용해 여러
-- 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

-- ---------------------------------------------------------------------
-- 1) social_rewrite_performance_comparisons: 원본 vs rewrite 성과 비교
-- ---------------------------------------------------------------------

create table if not exists social_rewrite_performance_comparisons (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  root_social_post_id uuid not null,
  original_social_post_id uuid not null references social_posts(id) on delete cascade,
  rewrite_social_post_id uuid not null references social_posts(id) on delete cascade,
  rewrite_source_suggestion_id uuid,
  version_comparison_id uuid,
  platform text not null,
  tone_style text,
  original_version_number integer,
  rewrite_version_number integer,

  original_metrics_id uuid,
  original_measured_at timestamptz,
  original_views integer not null default 0,
  original_impressions integer not null default 0,
  original_reach integer not null default 0,
  original_likes integer not null default 0,
  original_comments integer not null default 0,
  original_shares integer not null default 0,
  original_saves integer not null default 0,
  original_clicks integer not null default 0,
  original_profile_visits integer not null default 0,
  original_follows integer not null default 0,
  original_conversion_count integer not null default 0,
  original_engagement_rate numeric,
  original_click_through_rate numeric,
  original_conversion_rate numeric,
  original_performance_score numeric,
  original_performance_status text,

  rewrite_metrics_id uuid,
  rewrite_measured_at timestamptz,
  rewrite_views integer not null default 0,
  rewrite_impressions integer not null default 0,
  rewrite_reach integer not null default 0,
  rewrite_likes integer not null default 0,
  rewrite_comments integer not null default 0,
  rewrite_shares integer not null default 0,
  rewrite_saves integer not null default 0,
  rewrite_clicks integer not null default 0,
  rewrite_profile_visits integer not null default 0,
  rewrite_follows integer not null default 0,
  rewrite_conversion_count integer not null default 0,
  rewrite_engagement_rate numeric,
  rewrite_click_through_rate numeric,
  rewrite_conversion_rate numeric,
  rewrite_performance_score numeric,
  rewrite_performance_status text,

  comparison_status text not null default 'not_compared',
  winner text,
  performance_score_delta numeric,
  performance_score_delta_rate numeric,
  views_delta integer,
  views_delta_rate numeric,
  impressions_delta integer,
  impressions_delta_rate numeric,
  engagement_rate_delta numeric,
  click_through_rate_delta numeric,
  clicks_delta integer,
  clicks_delta_rate numeric,
  comments_delta integer,
  comments_delta_rate numeric,
  shares_delta integer,
  shares_delta_rate numeric,
  saves_delta integer,
  saves_delta_rate numeric,
  improvement_summary jsonb not null default '{}'::jsonb,
  platform_specific_summary jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  failures jsonb not null default '[]'::jsonb,
  compared_by text,
  compared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_rewrite_performance_comparisons_status_check'
  ) then
    alter table social_rewrite_performance_comparisons
      add constraint social_rewrite_performance_comparisons_status_check
      check (comparison_status in ('not_compared', 'rewrite_won', 'original_won', 'similar', 'inconclusive', 'needs_more_data', 'blocked', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'social_rewrite_performance_comparisons_winner_check'
  ) then
    alter table social_rewrite_performance_comparisons
      add constraint social_rewrite_performance_comparisons_winner_check
      check (winner is null or winner in ('original', 'rewrite', 'tie', 'none'));
  end if;
end $$;

create index if not exists idx_social_rewrite_perf_comparisons_article_id on social_rewrite_performance_comparisons (article_id);
create index if not exists idx_social_rewrite_perf_comparisons_root_social_post_id on social_rewrite_performance_comparisons (root_social_post_id);
create index if not exists idx_social_rewrite_perf_comparisons_original_social_post_id on social_rewrite_performance_comparisons (original_social_post_id);
create index if not exists idx_social_rewrite_perf_comparisons_rewrite_social_post_id on social_rewrite_performance_comparisons (rewrite_social_post_id);
create index if not exists idx_social_rewrite_perf_comparisons_rewrite_source_suggestion_id on social_rewrite_performance_comparisons (rewrite_source_suggestion_id);
create index if not exists idx_social_rewrite_perf_comparisons_version_comparison_id on social_rewrite_performance_comparisons (version_comparison_id);
create index if not exists idx_social_rewrite_perf_comparisons_platform on social_rewrite_performance_comparisons (platform);
create index if not exists idx_social_rewrite_perf_comparisons_comparison_status on social_rewrite_performance_comparisons (comparison_status);
create index if not exists idx_social_rewrite_perf_comparisons_winner on social_rewrite_performance_comparisons (winner);
create index if not exists idx_social_rewrite_perf_comparisons_compared_at on social_rewrite_performance_comparisons (compared_at);
create index if not exists idx_social_rewrite_perf_comparisons_created_at on social_rewrite_performance_comparisons (created_at);

drop trigger if exists trg_social_rewrite_performance_comparisons_updated_at on social_rewrite_performance_comparisons;
create trigger trg_social_rewrite_performance_comparisons_updated_at
  before update on social_rewrite_performance_comparisons
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 2) social_posts: rewrite 성과 비교 요약 컬럼
-- ---------------------------------------------------------------------

alter table social_posts add column if not exists latest_rewrite_performance_comparison_id uuid;
alter table social_posts add column if not exists rewrite_performance_comparison_status text not null default 'not_compared';
alter table social_posts add column if not exists rewrite_performance_winner text;
alter table social_posts add column if not exists rewrite_performance_score_delta numeric;
alter table social_posts add column if not exists rewrite_performance_improvement_rate numeric;
alter table social_posts add column if not exists rewrite_performance_checked_at timestamptz;
alter table social_posts add column if not exists rewrite_performance_summary jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_rewrite_performance_comparison_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_rewrite_performance_comparison_status_check
      check (rewrite_performance_comparison_status in ('not_compared', 'rewrite_won', 'original_won', 'similar', 'inconclusive', 'needs_more_data', 'blocked', 'failed'));
  end if;
end $$;

create index if not exists idx_social_posts_rewrite_performance_comparison_status on social_posts (rewrite_performance_comparison_status);
create index if not exists idx_social_posts_rewrite_performance_winner on social_posts (rewrite_performance_winner);

-- 컬럼/테이블 추가 후 PostgREST schema cache를 갱신한다.
notify pgrst, 'reload schema';
