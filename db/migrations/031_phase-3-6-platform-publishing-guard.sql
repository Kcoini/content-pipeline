-- Phase 3-6: Platform-specific Approval & Publishing Guard
--
-- 실제 플랫폼 게시 API 연결 전 단계로, social_posts가 플랫폼별 게시
-- 가능 조건을 통과하는지 검사한 결과를 저장할 컬럼을 추가한다. 이
-- migration/기능 어디에도 실제 외부 게시 API 호출은 없으며,
-- publish_status='published'로 바뀌는 경로도 없다. add column if not
-- exists만 사용해 여러 번 실행해도 안전하다 (idempotent).
--
-- platform_publish_ready=true는 "실제 게시 완료"가 아니라 "게시 가능
-- 조건을 통과했다"는 의미일 뿐이다.
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table social_posts add column if not exists platform_publish_guard_status text not null default 'not_checked';
alter table social_posts add column if not exists platform_publish_guard_score numeric;
alter table social_posts add column if not exists platform_publish_guard_summary jsonb not null default '{}'::jsonb;
alter table social_posts add column if not exists platform_publish_guard_error text;
alter table social_posts add column if not exists platform_publish_guard_checked_at timestamptz;
alter table social_posts add column if not exists platform_publish_ready boolean not null default false;
alter table social_posts add column if not exists platform_publish_blocked_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_platform_publish_guard_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_platform_publish_guard_status_check
      check (platform_publish_guard_status in ('not_checked', 'ready', 'needs_revision', 'blocked', 'failed'));
  end if;
end $$;

create index if not exists idx_social_posts_platform_publish_guard_status on social_posts (platform_publish_guard_status);

-- 컬럼 추가 후 PostgREST schema cache를 갱신한다.
notify pgrst, 'reload schema';
