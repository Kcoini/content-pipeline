-- Featured Image Workflow: Source Setup 상태 컬럼 보강
--
-- 대표 이미지 처리를 Source Setup / WordPress Media Upload / Featured Media
-- Attach 3단계로 명확히 분리하기 위해, source 설정 자체의 상태를 별도
-- 컬럼으로 추적한다. 기존 컬럼(featured_image_source_type/source_url/
-- local_path/filename/mime_type/upload_status/wordpress_media_id/
-- wordpress_url, wordpress_featured_media_attach_status)은 그대로 유지한다.
--
-- 기존 데이터는 삭제하지 않으며, alter table ... add column if not exists
-- 형식만 사용해 여러 번 실행해도 안전하다 (idempotent).

alter table articles
  add column if not exists featured_image_source_status text not null default 'none';

alter table articles
  add column if not exists featured_image_source_error text;

alter table articles
  add column if not exists featured_image_manual_source_saved_at timestamptz;

-- featured_image_source_status 허용 값 검증 (허용된 4개 값만)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'articles_featured_image_source_status_check'
  ) then
    alter table articles
      add constraint articles_featured_image_source_status_check
      check (featured_image_source_status in ('none', 'prepared', 'invalid', 'failed'));
  end if;
end $$;

notify pgrst, 'reload schema';
