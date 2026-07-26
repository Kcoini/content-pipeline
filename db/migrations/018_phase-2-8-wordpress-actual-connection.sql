-- Phase 2-8: Actual WordPress Connection Test
--
-- 다른 로그 테이블(pipeline_logs, contract_runs)과 컬럼명을 맞추기 위해
-- publish_logs에 details_json을 추가하고, 기존 details 값을 백필한다.
-- external_post_id/post_url/error_message는 이미 migration 012에서 추가되어
-- 있으므로 add column if not exists로 안전하게 재확인만 한다.
--
-- 기존 데이터는 삭제하지 않으며, alter table ... add column if not exists
-- 형식만 사용해 여러 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table publish_logs
  add column if not exists details_json jsonb not null default '{}'::jsonb;

alter table publish_logs
  add column if not exists external_post_id text;

alter table publish_logs
  add column if not exists post_url text;

alter table publish_logs
  add column if not exists error_message text;

alter table publish_logs
  add column if not exists updated_at timestamptz not null default now();

-- 기존 details 값을 details_json으로 백필한다 (details_json이 아직 비어있는 행만).
update publish_logs
set details_json = details
where details_json = '{}'::jsonb
  and details is not null
  and details <> '{}'::jsonb;

-- updated_at 자동 갱신 트리거 (schema.sql의 set_updated_at() 함수를 재사용한다).
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_publish_logs_updated_at'
  ) then
    create trigger trg_publish_logs_updated_at
      before update on publish_logs
      for each row execute function set_updated_at();
  end if;
end $$;

-- Phase 2-3에서 준비한 wp_category_ids/wp_tag_ids에 실제 동기화된 id를
-- 저장하기 위한 컬럼은 이미 존재한다 (db/migrations/011_phase-2-1-article-modes.sql).
-- 이번 migration에서는 추가 컬럼이 필요하지 않다.
