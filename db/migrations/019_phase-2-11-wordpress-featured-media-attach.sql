-- Phase 2-11: WordPress Featured Media Draft Publish Test
--
-- 기존 WordPress draft post에 featured_media(WordPress media id)를 연결한
-- 시도 결과를 추적하기 위해 articles에 컬럼을 추가한다. 기존 데이터는
-- 삭제하지 않으며, add column if not exists 형식만 사용해 여러 번 실행해도
-- 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table articles
  add column if not exists wordpress_featured_media_attach_status text not null default 'not_attached';

alter table articles
  add column if not exists wordpress_featured_media_attached_at timestamptz;

alter table articles
  add column if not exists wordpress_featured_media_attach_error text;

-- media id가 없어 featured_media 연결을 건너뛴 경우를 publish_logs.status='skipped'로
-- 기록하기 위해 status check 제약에 'skipped'를 허용하도록 재생성한다
-- (dry_run은 migration 012에서 이미 허용되어 있다).
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'publish_logs_status_check'
  ) then
    alter table publish_logs drop constraint publish_logs_status_check;
  end if;

  alter table publish_logs
    add constraint publish_logs_status_check
    check (status in ('success', 'failed', 'dry_run', 'skipped'));
end $$;
