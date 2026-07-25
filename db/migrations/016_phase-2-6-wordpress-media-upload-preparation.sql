-- Phase 2-6: WordPress Media Upload Preparation
--
-- Phase 2-5에서 준비한 featured image metadata를 바탕으로, 나중에 실제
-- WordPress media upload와 featured_media 설정을 할 수 있도록 구조를
-- 준비한다. 이번 단계에서는 실제 이미지 생성이나 실제 WordPress media
-- upload를 하지 않는다 (payload 준비/저장/dry-run 확인까지만).
--
-- 기존 데이터는 삭제하지 않으며, alter table ... add column if not exists
-- 형식만 사용해 여러 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table articles
  add column if not exists featured_image_source_type text not null default 'none';

alter table articles
  add column if not exists featured_image_source_url text;

alter table articles
  add column if not exists featured_image_local_path text;

alter table articles
  add column if not exists featured_image_filename text;

alter table articles
  add column if not exists featured_image_mime_type text;

alter table articles
  add column if not exists featured_image_upload_status text not null default 'not_ready';

alter table articles
  add column if not exists featured_image_upload_payload jsonb not null default '{}'::jsonb;

alter table articles
  add column if not exists featured_image_upload_error text;

alter table articles
  add column if not exists featured_image_upload_attempted_at timestamptz;

-- featured_image_source_type 값 검증 (허용된 5개 값만)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'articles_featured_image_source_type_check'
  ) then
    alter table articles
      add constraint articles_featured_image_source_type_check
      check (featured_image_source_type in ('none', 'generated_url', 'external_url', 'local_file', 'uploaded'));
  end if;
end $$;

-- featured_image_upload_status 값 검증 (허용된 6개 값만)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'articles_featured_image_upload_status_check'
  ) then
    alter table articles
      add constraint articles_featured_image_upload_status_check
      check (featured_image_upload_status in ('not_ready', 'prepared', 'dry_run', 'uploaded', 'failed', 'skipped'));
  end if;
end $$;
