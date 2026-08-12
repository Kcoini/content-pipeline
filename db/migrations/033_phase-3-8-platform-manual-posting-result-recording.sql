-- Phase 3-8: Platform Manual Posting Checklist & Result Recording
--
-- handoff_status='completed'가 된 social_posts에 대해, 사람이 실제
-- 플랫폼에 수동으로 게시한 결과(게시 URL/시간/게시자/메모)를 기록하기
-- 위한 컬럼을 추가한다. 이 migration/기능 어디에도 실제 외부 게시 API
-- 호출은 없다 — manual_post_status='posted'는 "사람이 직접 게시했다는
-- 기록"일 뿐 자동 게시 완료가 아니다. add column if not exists만
-- 사용해 여러 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table social_posts add column if not exists manual_post_status text not null default 'not_recorded';
alter table social_posts add column if not exists manual_post_url text;
alter table social_posts add column if not exists manual_posted_at timestamptz;
alter table social_posts add column if not exists manual_posted_by text;
alter table social_posts add column if not exists manual_post_result_notes text;
alter table social_posts add column if not exists manual_post_error text;
alter table social_posts add column if not exists manual_post_recorded_at timestamptz;
alter table social_posts add column if not exists manual_post_recorded_by text;
alter table social_posts add column if not exists manual_post_checklist jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_manual_post_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_manual_post_status_check
      check (manual_post_status in ('not_recorded', 'ready_to_record', 'posted', 'skipped', 'failed', 'blocked'));
  end if;
end $$;

create index if not exists idx_social_posts_manual_post_status on social_posts (manual_post_status);

-- 컬럼 추가 후 PostgREST schema cache를 갱신한다.
notify pgrst, 'reload schema';
