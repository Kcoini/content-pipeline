-- Phase 3-10: Performance-based Rewrite Suggestion
--
-- Phase 3-9에서 기록한 social_post_metrics/social_posts.latest_* 성과
-- 데이터를 바탕으로, 성과가 낮은 social_post에 대한 개선 제안(제목/
-- 도입부/문체/CTA/해시태그/스레드/카드뉴스 문구)을 별도 테이블에
-- 저장한다. 이 migration/기능 어디에도 기존 social_posts 본문을 자동
-- 수정하거나 실제 재게시하는 경로는 없다 — 제안은 사람이 확인하기
-- 전까지 적용되지 않는다. create table/add column if not exists만
-- 사용해 여러 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

-- ---------------------------------------------------------------------
-- 1) social_post_rewrite_suggestions: 성과 기반 개선 제안
-- ---------------------------------------------------------------------

create table if not exists social_post_rewrite_suggestions (
  id uuid primary key default gen_random_uuid(),
  social_post_id uuid not null references social_posts(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  platform text not null,
  tone_style text not null,
  original_performance_status text,
  original_performance_score numeric,
  suggestion_status text not null default 'draft',
  diagnosis jsonb not null default '{}'::jsonb,
  suggested_changes jsonb not null default '{}'::jsonb,
  suggested_title text,
  suggested_hook text,
  suggested_body_outline jsonb not null default '[]'::jsonb,
  suggested_cta text,
  suggested_hashtags text[] not null default '{}',
  suggested_thread_items jsonb not null default '[]'::jsonb,
  suggested_card_items jsonb not null default '[]'::jsonb,
  suggested_tone_style text,
  risk_notes jsonb not null default '[]'::jsonb,
  quality_notes jsonb not null default '[]'::jsonb,
  expected_improvement_reason text,
  generated_by text,
  generated_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  applied_at timestamptz,
  rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_social_post_rewrite_suggestions_social_post_id on social_post_rewrite_suggestions (social_post_id);
create index if not exists idx_social_post_rewrite_suggestions_article_id on social_post_rewrite_suggestions (article_id);
create index if not exists idx_social_post_rewrite_suggestions_platform on social_post_rewrite_suggestions (platform);
create index if not exists idx_social_post_rewrite_suggestions_tone_style on social_post_rewrite_suggestions (tone_style);
create index if not exists idx_social_post_rewrite_suggestions_suggestion_status on social_post_rewrite_suggestions (suggestion_status);
create index if not exists idx_social_post_rewrite_suggestions_original_performance_score on social_post_rewrite_suggestions (original_performance_score);
create index if not exists idx_social_post_rewrite_suggestions_generated_at on social_post_rewrite_suggestions (generated_at);
create index if not exists idx_social_post_rewrite_suggestions_created_at on social_post_rewrite_suggestions (created_at);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_post_rewrite_suggestions_status_check'
  ) then
    alter table social_post_rewrite_suggestions
      add constraint social_post_rewrite_suggestions_status_check
      check (suggestion_status in ('draft', 'ready', 'needs_review', 'approved', 'rejected', 'applied', 'blocked', 'failed'));
  end if;
end $$;

drop trigger if exists trg_social_post_rewrite_suggestions_updated_at on social_post_rewrite_suggestions;
create trigger trg_social_post_rewrite_suggestions_updated_at
  before update on social_post_rewrite_suggestions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 2) social_posts: rewrite suggestion 요약 컬럼
-- ---------------------------------------------------------------------

alter table social_posts add column if not exists latest_rewrite_suggestion_id uuid;
alter table social_posts add column if not exists rewrite_suggestion_status text not null default 'not_created';
alter table social_posts add column if not exists rewrite_suggestion_count integer not null default 0;
alter table social_posts add column if not exists latest_rewrite_suggested_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_rewrite_suggestion_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_rewrite_suggestion_status_check
      check (rewrite_suggestion_status in ('not_created', 'suggested', 'approved', 'rejected', 'applied', 'blocked', 'failed'));
  end if;
end $$;

create index if not exists idx_social_posts_rewrite_suggestion_status on social_posts (rewrite_suggestion_status);

-- 컬럼/테이블 추가 후 PostgREST schema cache를 갱신한다.
notify pgrst, 'reload schema';
