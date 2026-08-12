-- Phase 3-1: Multi-platform Writing Schema & Foundation
--
-- 기존 WordPress article 기반 시스템 위에 멀티 플랫폼(wordpress_blog/
-- naver_blog/naver_cafe/x/threads/instagram) 자동 글쓰기 시스템의 기본
-- 구조(social_posts 및 관련 테이블)를 추가한다. 이 migration은 실제 게시
-- API 연동을 포함하지 않으며, 기존 articles/publish_logs/pipeline_logs 등
-- 어떤 기존 테이블도 변경하지 않는다 (신규 테이블만 추가).
--
-- 기존 데이터는 삭제하지 않으며, create table if not exists /
-- add column if not exists 형식만 사용해 여러 번 실행해도 안전하다
-- (idempotent).
--
-- 주의: 파일명은 요청된 번호(027)가 이미 사용 중이어서(featured image
-- workflow) 028로 부여했다.
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

-- ---------------------------------------------------------------------
-- 1) social_posts: article 하나를 플랫폼별/문체별로 변환한 글 초안
-- ---------------------------------------------------------------------

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  platform text not null,
  tone_style text not null,
  post_title text,
  post_body text,
  caption text,
  excerpt text,
  hashtags text[] not null default '{}',
  thread_items jsonb not null default '[]'::jsonb,
  card_items jsonb not null default '[]'::jsonb,
  media_requirements jsonb not null default '{}'::jsonb,
  platform_metadata jsonb not null default '{}'::jsonb,
  generation_context jsonb not null default '{}'::jsonb,
  quality_status text not null default 'not_checked',
  quality_score numeric,
  quality_summary jsonb not null default '{}'::jsonb,
  approval_status text not null default 'not_requested',
  approved_by text,
  approved_at timestamptz,
  publish_status text not null default 'not_published',
  external_post_id text,
  post_url text,
  export_format text,
  export_payload jsonb not null default '{}'::jsonb,
  error_message text,
  generated_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_social_posts_article_id on social_posts (article_id);
create index if not exists idx_social_posts_platform on social_posts (platform);
create index if not exists idx_social_posts_tone_style on social_posts (tone_style);
create index if not exists idx_social_posts_quality_status on social_posts (quality_status);
create index if not exists idx_social_posts_approval_status on social_posts (approval_status);
create index if not exists idx_social_posts_publish_status on social_posts (publish_status);
create index if not exists idx_social_posts_created_at on social_posts (created_at);
create index if not exists idx_social_posts_updated_at on social_posts (updated_at);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_platform_check'
  ) then
    alter table social_posts
      add constraint social_posts_platform_check
      check (platform in (
        'wordpress_blog', 'naver_blog', 'naver_cafe', 'x', 'threads', 'instagram'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_tone_style_check'
  ) then
    alter table social_posts
      add constraint social_posts_tone_style_check
      check (tone_style in (
        'explanatory', 'informational', 'persuasive', 'warning',
        'loss_aversion', 'curiosity', 'comparison', 'story'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_quality_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_quality_status_check
      check (quality_status in ('not_checked', 'ready', 'needs_revision', 'blocked', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_approval_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_approval_status_check
      check (approval_status in ('not_requested', 'pending_review', 'approved', 'rejected', 'revoked'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_publish_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_publish_status_check
      check (publish_status in (
        'not_published', 'dry_run', 'exported', 'scheduled', 'published', 'failed', 'blocked'
      ));
  end if;
end $$;

drop trigger if exists trg_social_posts_updated_at on social_posts;
create trigger trg_social_posts_updated_at
  before update on social_posts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 2) social_post_quality_runs: social_posts에 대한 quality gate 실행 기록
-- ---------------------------------------------------------------------

create table if not exists social_post_quality_runs (
  id uuid primary key default gen_random_uuid(),
  social_post_id uuid not null references social_posts(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  platform text not null,
  tone_style text not null,
  status text not null,
  score numeric,
  checklist jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  failures jsonb not null default '[]'::jsonb,
  blocked_reasons jsonb not null default '[]'::jsonb,
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_social_post_quality_runs_social_post_id on social_post_quality_runs (social_post_id);
create index if not exists idx_social_post_quality_runs_article_id on social_post_quality_runs (article_id);
create index if not exists idx_social_post_quality_runs_platform on social_post_quality_runs (platform);
create index if not exists idx_social_post_quality_runs_status on social_post_quality_runs (status);
create index if not exists idx_social_post_quality_runs_created_at on social_post_quality_runs (created_at);

-- ---------------------------------------------------------------------
-- 3) social_post_approvals: social_posts 승인/거부/취소 이력
-- ---------------------------------------------------------------------

create table if not exists social_post_approvals (
  id uuid primary key default gen_random_uuid(),
  social_post_id uuid not null references social_posts(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  platform text not null,
  approval_status text not null,
  approved_by text,
  approval_notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_social_post_approvals_social_post_id on social_post_approvals (social_post_id);
create index if not exists idx_social_post_approvals_article_id on social_post_approvals (article_id);
create index if not exists idx_social_post_approvals_platform on social_post_approvals (platform);
create index if not exists idx_social_post_approvals_approval_status on social_post_approvals (approval_status);
create index if not exists idx_social_post_approvals_created_at on social_post_approvals (created_at);

-- 컬럼/테이블 추가 후 PostgREST schema cache를 갱신한다.
notify pgrst, 'reload schema';
