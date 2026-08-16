-- Phase 3-21: Platform API Publishing Preparation
--
-- 향후 플랫폼 API 게시를 안전하게 연결하기 전, "게시 준비 상태"만
-- social_posts에 요약해서 저장하기 위한 컬럼을 추가한다. 이
-- migration/기능 어디에도 실제 플랫폼 API 호출, OAuth flow, token
-- storage는 없다 — 여기서 저장하는 값은 readiness check/eligibility
-- guard/dry-run payload 빌더가 계산한 "상태 요약"뿐이며, 실제 API
-- publish attempt 결과를 저장하는 테이블은 다음 Phase에서 별도로
--추가할 수 있다. add column if not exists만 사용해 여러 번 실행해도
-- 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table social_posts add column if not exists api_publish_preparation_status text not null default 'not_checked';
alter table social_posts add column if not exists api_publish_readiness_status text;
alter table social_posts add column if not exists api_publish_eligible_for_dry_run boolean not null default false;
alter table social_posts add column if not exists api_publish_eligible_for_actual_publish boolean not null default false;
alter table social_posts add column if not exists api_publish_preparation_summary jsonb not null default '{}'::jsonb;
alter table social_posts add column if not exists api_publish_prepared_at timestamptz;
alter table social_posts add column if not exists api_publish_prepared_by text;
alter table social_posts add column if not exists api_publish_blocked_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_api_publish_preparation_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_api_publish_preparation_status_check
      check (api_publish_preparation_status in ('not_checked', 'disabled', 'missing_config', 'dry_run_ready', 'ready_for_future_test', 'blocked', 'failed'));
  end if;
end $$;

create index if not exists idx_social_posts_api_publish_preparation_status on social_posts (api_publish_preparation_status);
create index if not exists idx_social_posts_api_publish_readiness_status on social_posts (api_publish_readiness_status);

-- 컬럼 추가 후 PostgREST schema cache를 갱신한다.
notify pgrst, 'reload schema';
