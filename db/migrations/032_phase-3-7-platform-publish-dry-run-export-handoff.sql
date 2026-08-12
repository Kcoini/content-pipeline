-- Phase 3-7: Platform Publish Dry-run & Export Handoff
--
-- platform_publish_guard_status='ready'가 된 social_posts에 대해, 실제
-- 외부 플랫폼 게시 API를 호출하지 않고 플랫폼별 게시 직전 payload를
-- dry-run으로 생성/보관하고, 사람이 최종 확인(handoff)했는지 기록하기
-- 위한 컬럼을 추가한다. 이 migration/기능 어디에도 실제 외부 게시 API
-- 호출은 없으며, publish_status='published'로 바뀌는 경로도 없다.
-- add column if not exists만 사용해 여러 번 실행해도 안전하다
-- (idempotent).
--
-- dry-run ready/handoff completed는 모두 "실제 게시 완료"를 의미하지
-- 않는다 — 사람이 수동으로 게시할 준비가 끝났다는 뜻일 뿐이다.
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table social_posts add column if not exists platform_publish_dry_run_status text not null default 'not_created';
alter table social_posts add column if not exists platform_publish_dry_run_payload jsonb not null default '{}'::jsonb;
alter table social_posts add column if not exists platform_publish_dry_run_error text;
alter table social_posts add column if not exists platform_publish_dry_run_created_at timestamptz;
alter table social_posts add column if not exists platform_publish_dry_run_created_by text;
alter table social_posts add column if not exists handoff_status text not null default 'not_started';
alter table social_posts add column if not exists handoff_payload jsonb not null default '{}'::jsonb;
alter table social_posts add column if not exists handoff_notes text;
alter table social_posts add column if not exists handoff_completed_at timestamptz;
alter table social_posts add column if not exists handoff_completed_by text;
alter table social_posts add column if not exists handoff_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_platform_publish_dry_run_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_platform_publish_dry_run_status_check
      check (platform_publish_dry_run_status in ('not_created', 'ready', 'blocked', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_handoff_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_handoff_status_check
      check (handoff_status in ('not_started', 'ready', 'completed', 'blocked', 'failed'));
  end if;
end $$;

create index if not exists idx_social_posts_platform_publish_dry_run_status on social_posts (platform_publish_dry_run_status);
create index if not exists idx_social_posts_handoff_status on social_posts (handoff_status);

-- 컬럼 추가 후 PostgREST schema cache를 갱신한다.
notify pgrst, 'reload schema';
