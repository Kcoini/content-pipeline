-- Phase 3-12: Rewrite Version Quality Recheck & Comparison
--
-- Phase 3-11에서 생성된 rewrite version social_posts를 원본과
-- 비교하고, 새 버전의 품질을 재검사해 어느 버전이 더 나은지 판단할
-- 수 있는 보조 지표를 저장한다. 이 migration/기능 어디에도 실제
-- 플랫폼 재게시, 자동 원본 교체, public publish는 없다 — 비교
-- 결과는 사람이 판단하기 위한 참고 자료일 뿐이다. add column/create
-- table if not exists만 사용해 여러 번 실행해도 안전하다
-- (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

-- ---------------------------------------------------------------------
-- 1) social_post_version_comparisons: 원본 vs rewrite version 비교 결과
-- ---------------------------------------------------------------------

create table if not exists social_post_version_comparisons (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  root_social_post_id uuid not null,
  original_social_post_id uuid not null references social_posts(id) on delete cascade,
  rewrite_social_post_id uuid not null references social_posts(id) on delete cascade,
  rewrite_source_suggestion_id uuid,
  platform text not null,
  original_version_number integer,
  rewrite_version_number integer,
  original_quality_status text,
  original_quality_score numeric,
  rewrite_quality_status text,
  rewrite_quality_score numeric,
  original_performance_status text,
  original_performance_score numeric,
  rewrite_performance_status text,
  rewrite_performance_score numeric,
  comparison_status text not null default 'not_compared',
  comparison_score numeric,
  recommended_social_post_id uuid,
  recommendation_reason text,
  comparison_summary jsonb not null default '{}'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  failures jsonb not null default '[]'::jsonb,
  compared_by text,
  compared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_social_post_version_comparisons_article_id on social_post_version_comparisons (article_id);
create index if not exists idx_social_post_version_comparisons_root_social_post_id on social_post_version_comparisons (root_social_post_id);
create index if not exists idx_social_post_version_comparisons_original_social_post_id on social_post_version_comparisons (original_social_post_id);
create index if not exists idx_social_post_version_comparisons_rewrite_social_post_id on social_post_version_comparisons (rewrite_social_post_id);
create index if not exists idx_social_post_version_comparisons_rewrite_source_suggestion_id on social_post_version_comparisons (rewrite_source_suggestion_id);
create index if not exists idx_social_post_version_comparisons_platform on social_post_version_comparisons (platform);
create index if not exists idx_social_post_version_comparisons_comparison_status on social_post_version_comparisons (comparison_status);
create index if not exists idx_social_post_version_comparisons_compared_at on social_post_version_comparisons (compared_at);
create index if not exists idx_social_post_version_comparisons_created_at on social_post_version_comparisons (created_at);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_post_version_comparisons_status_check'
  ) then
    alter table social_post_version_comparisons
      add constraint social_post_version_comparisons_status_check
      check (comparison_status in ('not_compared', 'original_better', 'rewrite_better', 'similar', 'needs_review', 'blocked', 'failed'));
  end if;
end $$;

drop trigger if exists trg_social_post_version_comparisons_updated_at on social_post_version_comparisons;
create trigger trg_social_post_version_comparisons_updated_at
  before update on social_post_version_comparisons
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 2) social_posts: 버전 비교 요약 컬럼
-- ---------------------------------------------------------------------

alter table social_posts add column if not exists latest_version_comparison_id uuid;
alter table social_posts add column if not exists version_comparison_status text not null default 'not_compared';
alter table social_posts add column if not exists version_comparison_score numeric;
alter table social_posts add column if not exists recommended_for_repost boolean not null default false;
alter table social_posts add column if not exists version_comparison_checked_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_version_comparison_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_version_comparison_status_check
      check (version_comparison_status in ('not_compared', 'original_better', 'rewrite_better', 'similar', 'needs_review', 'blocked', 'failed'));
  end if;
end $$;

create index if not exists idx_social_posts_version_comparison_status on social_posts (version_comparison_status);
create index if not exists idx_social_posts_recommended_for_repost on social_posts (recommended_for_repost);

-- 컬럼/테이블 추가 후 PostgREST schema cache를 갱신한다.
notify pgrst, 'reload schema';
