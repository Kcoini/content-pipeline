-- Phase 2-19: Manual Featured Image Source Setup
--
-- 필요한 컬럼은 Phase 2-6(016)에서 이미 추가되어 있으므로 add column if not
-- exists로 안전하게 재확인만 한다 (idempotent, 기존 데이터 변경 없음).

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
  add column if not exists featured_image_upload_error text;

-- featured_image_source_type 허용 값에 'local_upload'/'wordpress_media_existing'을
-- 추가한다. 기존 값(none/generated_url/external_url/local_file/uploaded)은
-- 그대로 유지해 기존 데이터와의 호환성을 깨지 않는다.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'articles_featured_image_source_type_check'
  ) then
    alter table articles drop constraint articles_featured_image_source_type_check;
  end if;

  alter table articles
    add constraint articles_featured_image_source_type_check
    check (featured_image_source_type in (
      'none', 'generated_url', 'external_url', 'local_file', 'uploaded',
      'local_upload', 'wordpress_media_existing'
    ));
end $$;

-- 컬럼/제약 추가 후 PostgREST schema cache를 갱신한다.
notify pgrst, 'reload schema';
