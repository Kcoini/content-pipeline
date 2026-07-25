-- Phase 2-2: WordPress Draft Publish 기능 추가
--
-- reviewed 상태의 article을 WordPress에 draft post로 생성하는 기능을 위해
-- publish_logs 테이블에 컬럼을 추가하고, status에 'dry_run'을 허용한다.
-- 기존 데이터는 삭제하지 않으며, alter table ... add column if not exists
-- 형식만 사용해 여러 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table publish_logs
  add column if not exists external_post_id text;

alter table publish_logs
  add column if not exists post_url text;

alter table publish_logs
  add column if not exists error_message text;

-- target/status/details/published_at 컬럼은 db/schema.sql에 이미 존재한다.
-- status check 제약에 'dry_run'을 허용하도록 재생성한다
-- (WORDPRESS_PUBLISH_ENABLED=false일 때 dry-run 결과를 저장하기 위함).
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'publish_logs_status_check'
  ) then
    alter table publish_logs drop constraint publish_logs_status_check;
  end if;

  alter table publish_logs
    add constraint publish_logs_status_check
    check (status in ('success', 'failed', 'dry_run'));
end $$;

create index if not exists idx_publish_logs_target on publish_logs (target);
