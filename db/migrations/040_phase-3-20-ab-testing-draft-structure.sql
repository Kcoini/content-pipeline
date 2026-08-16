-- Phase 3-20: A/B Testing Draft Structure
--
-- 실제 자동 A/B 테스트를 실행하기 전에 테스트 계획(가설/목적/지표)과
-- variant(원본/rewrite 또는 여러 후보)를 구조화해서 관리하기 위한
-- draft 테이블이다. 이 migration/기능 어디에도 실제 플랫폼 자동 게시,
-- 자동 metrics 수집, 자동 승자 반영/재게시는 없다 — variant도 기존
-- approval/export/handoff/manual posting 흐름을 그대로 거쳐야 하며,
-- 결과는 사람이 수동 입력한 metrics를 기반으로 판단하기 위한 참고
-- 자료일 뿐이다. create table/add column if not exists만 사용해 여러
-- 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

-- ---------------------------------------------------------------------
-- 1) social_ab_tests: A/B 테스트 draft(계획) 한 건
-- ---------------------------------------------------------------------

create table if not exists social_ab_tests (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  root_social_post_id uuid,
  platform text not null,
  test_name text not null,
  test_description text,
  hypothesis text,
  test_goal text,
  primary_metric text not null default 'performance_score',
  secondary_metrics text[] not null default '{}',
  test_status text not null default 'draft',
  test_type text not null default 'manual',
  comparison_method text not null default 'manual_metrics',
  winner_social_post_id uuid,
  winner_reason text,
  result_summary jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_by text,
  started_at timestamptz,
  ended_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_ab_tests_test_status_check'
  ) then
    alter table social_ab_tests
      add constraint social_ab_tests_test_status_check
      check (test_status in ('draft', 'ready', 'running', 'paused', 'completed', 'inconclusive', 'cancelled', 'blocked', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'social_ab_tests_test_type_check'
  ) then
    alter table social_ab_tests
      add constraint social_ab_tests_test_type_check
      check (test_type in ('manual', 'original_vs_rewrite', 'title_test', 'hook_test', 'cta_test', 'tone_test', 'platform_test', 'hashtag_test'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'social_ab_tests_comparison_method_check'
  ) then
    alter table social_ab_tests
      add constraint social_ab_tests_comparison_method_check
      check (comparison_method in ('manual_metrics', 'rewrite_performance_comparison', 'dashboard_summary', 'future_api_metrics'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'social_ab_tests_primary_metric_check'
  ) then
    alter table social_ab_tests
      add constraint social_ab_tests_primary_metric_check
      check (primary_metric in ('performance_score', 'views', 'impressions', 'engagement_rate', 'click_through_rate', 'clicks', 'comments', 'shares', 'saves', 'conversion_rate'));
  end if;
end $$;

create index if not exists idx_social_ab_tests_article_id on social_ab_tests (article_id);
create index if not exists idx_social_ab_tests_root_social_post_id on social_ab_tests (root_social_post_id);
create index if not exists idx_social_ab_tests_platform on social_ab_tests (platform);
create index if not exists idx_social_ab_tests_test_status on social_ab_tests (test_status);
create index if not exists idx_social_ab_tests_test_type on social_ab_tests (test_type);
create index if not exists idx_social_ab_tests_created_at on social_ab_tests (created_at);

drop trigger if exists trg_social_ab_tests_updated_at on social_ab_tests;
create trigger trg_social_ab_tests_updated_at
  before update on social_ab_tests
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 2) social_ab_test_variants: A/B 테스트에 속한 variant(원본/rewrite/후보) 한 건
-- ---------------------------------------------------------------------

create table if not exists social_ab_test_variants (
  id uuid primary key default gen_random_uuid(),
  ab_test_id uuid not null references social_ab_tests(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  social_post_id uuid not null references social_posts(id) on delete cascade,
  variant_label text not null,
  variant_role text not null default 'candidate',
  variant_description text,
  variant_hypothesis text,
  platform text not null,
  tone_style text,
  version_number integer,
  is_control boolean not null default false,
  is_rewrite_version boolean not null default false,
  manual_post_status text,
  post_url text,
  latest_metrics_id uuid,
  latest_performance_score numeric,
  latest_metrics_recorded_at timestamptz,
  variant_status text not null default 'draft',
  result_rank integer,
  result_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_ab_test_variants_variant_role_check'
  ) then
    alter table social_ab_test_variants
      add constraint social_ab_test_variants_variant_role_check
      check (variant_role in ('control', 'variant_a', 'variant_b', 'variant_c', 'candidate'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'social_ab_test_variants_variant_status_check'
  ) then
    alter table social_ab_test_variants
      add constraint social_ab_test_variants_variant_status_check
      check (variant_status in ('draft', 'ready', 'posted', 'measured', 'winner', 'loser', 'inconclusive', 'blocked', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'social_ab_test_variants_unique_social_post'
  ) then
    alter table social_ab_test_variants
      add constraint social_ab_test_variants_unique_social_post
      unique (ab_test_id, social_post_id);
  end if;
end $$;

create index if not exists idx_social_ab_test_variants_ab_test_id on social_ab_test_variants (ab_test_id);
create index if not exists idx_social_ab_test_variants_article_id on social_ab_test_variants (article_id);
create index if not exists idx_social_ab_test_variants_social_post_id on social_ab_test_variants (social_post_id);
create index if not exists idx_social_ab_test_variants_variant_role on social_ab_test_variants (variant_role);
create index if not exists idx_social_ab_test_variants_variant_status on social_ab_test_variants (variant_status);
create index if not exists idx_social_ab_test_variants_created_at on social_ab_test_variants (created_at);

drop trigger if exists trg_social_ab_test_variants_updated_at on social_ab_test_variants;
create trigger trg_social_ab_test_variants_updated_at
  before update on social_ab_test_variants
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 3) social_posts: 이 글이 속한 A/B 테스트 요약 컬럼
-- ---------------------------------------------------------------------

alter table social_posts add column if not exists ab_test_status text not null default 'not_in_test';
alter table social_posts add column if not exists latest_ab_test_id uuid;
alter table social_posts add column if not exists ab_test_variant_role text;
alter table social_posts add column if not exists ab_test_variant_label text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_ab_test_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_ab_test_status_check
      check (ab_test_status in ('not_in_test', 'draft', 'ready', 'running', 'completed', 'winner', 'loser', 'inconclusive', 'blocked'));
  end if;
end $$;

create index if not exists idx_social_posts_ab_test_status on social_posts (ab_test_status);
create index if not exists idx_social_posts_latest_ab_test_id on social_posts (latest_ab_test_id);

-- 컬럼/테이블 추가 후 PostgREST schema cache를 갱신한다.
notify pgrst, 'reload schema';
