-- Phase 3-13: Rewrite Re-approval & Re-export Workflow
--
-- Phase 3-12에서 recommended_for_repost=true가 된 rewrite version
-- social_posts를 다시 Quality Gate/Approval/Manual Export/Platform
-- Guard/Dry-run/Handoff 흐름으로 보낼 수 있도록 재승인/재export 상태
-- 컬럼을 추가한다. 이 migration/기능 어디에도 실제 플랫폼 자동
-- 재게시나 원본 자동 수정은 없다 — recommended_for_repost=true여도
-- 자동으로 승인/게시되지 않는다. add column if not exists만 사용해
-- 여러 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table social_posts add column if not exists rewrite_reapproval_status text not null default 'not_requested';
alter table social_posts add column if not exists rewrite_reapproval_requested_at timestamptz;
alter table social_posts add column if not exists rewrite_reapproval_requested_by text;
alter table social_posts add column if not exists rewrite_reapproved_at timestamptz;
alter table social_posts add column if not exists rewrite_reapproved_by text;
alter table social_posts add column if not exists rewrite_reapproval_notes text;
alter table social_posts add column if not exists rewrite_reapproval_error text;
alter table social_posts add column if not exists rewrite_reexport_status text not null default 'not_started';
alter table social_posts add column if not exists rewrite_reexported_at timestamptz;
alter table social_posts add column if not exists rewrite_reexported_by text;
alter table social_posts add column if not exists rewrite_reexport_error text;
alter table social_posts add column if not exists rewrite_republish_workflow_status text not null default 'not_started';
alter table social_posts add column if not exists rewrite_republish_workflow_summary jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_rewrite_reapproval_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_rewrite_reapproval_status_check
      check (rewrite_reapproval_status in ('not_requested', 'pending_review', 'approved', 'rejected', 'revoked', 'blocked', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_rewrite_reexport_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_rewrite_reexport_status_check
      check (rewrite_reexport_status in ('not_started', 'ready', 'exported', 'blocked', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_rewrite_republish_workflow_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_rewrite_republish_workflow_status_check
      check (rewrite_republish_workflow_status in (
        'not_started', 'ready_for_reapproval', 'reapproval_pending', 'reapproved', 'reexport_ready',
        'reexported', 'guard_ready', 'dry_run_ready', 'handoff_ready', 'handoff_completed',
        'manual_post_recorded', 'blocked', 'failed'
      ));
  end if;
end $$;

create index if not exists idx_social_posts_rewrite_reapproval_status on social_posts (rewrite_reapproval_status);
create index if not exists idx_social_posts_rewrite_reexport_status on social_posts (rewrite_reexport_status);
create index if not exists idx_social_posts_rewrite_republish_workflow_status on social_posts (rewrite_republish_workflow_status);

-- 컬럼 추가 후 PostgREST schema cache를 갱신한다.
notify pgrst, 'reload schema';
