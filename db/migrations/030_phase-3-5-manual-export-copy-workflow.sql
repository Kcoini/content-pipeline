-- Phase 3-5: Manual Export & Copy Workflow
--
-- Phase 3-4에서 review/edit/approval까지 완료된 social_posts를 플랫폼별
-- 수동 게시용 형식으로 export하고 복사 여부를 추적하기 위한 컬럼을
-- 추가한다. 실제 외부 플랫폼 게시 API 연동은 포함하지 않으며, 기존
-- publish_status/social_post_quality_runs/social_post_approvals 구조는
-- 변경하지 않는다. add column if not exists만 사용해 여러 번 실행해도
-- 안전하다 (idempotent).
--
-- export_status는 publish_status와 별개의 트랙이다: 수동 export는 실제
-- publish가 아니므로 이 migration으로 publish_status='published'가 되는
-- 경로는 없다.
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table social_posts add column if not exists export_status text not null default 'not_exported';
alter table social_posts add column if not exists exported_at timestamptz;
alter table social_posts add column if not exists exported_by text;
alter table social_posts add column if not exists export_error text;
alter table social_posts add column if not exists export_copy_count integer not null default 0;
alter table social_posts add column if not exists last_copied_at timestamptz;
alter table social_posts add column if not exists export_notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_export_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_export_status_check
      check (export_status in ('not_exported', 'ready', 'exported', 'blocked', 'failed'));
  end if;
end $$;

create index if not exists idx_social_posts_export_status on social_posts (export_status);

-- 컬럼 추가 후 PostgREST schema cache를 갱신한다.
notify pgrst, 'reload schema';
