-- Phase 2-7: Image Generation Integration
--
-- Phase 2-5에서 준비한 featured image prompt/alt text/caption/style/aspect
-- ratio를 바탕으로 실제 또는 mock 이미지 생성 결과를 저장한다. 기본 provider는
-- mock이며, 실제 이미지 생성 provider(openai 등) 연동은 안전한 stub으로
-- 시작한다 (IMAGE_GENERATION_ENABLED=false가 기본값).
--
-- 기존 데이터는 삭제하지 않으며, alter table ... add column if not exists
-- 형식만 사용해 여러 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table articles
  add column if not exists generated_image_status text not null default 'not_generated';

alter table articles
  add column if not exists generated_image_provider text not null default 'mock';

alter table articles
  add column if not exists generated_image_model text;

alter table articles
  add column if not exists generated_image_prompt text;

alter table articles
  add column if not exists generated_image_negative_prompt text;

alter table articles
  add column if not exists generated_image_url text;

alter table articles
  add column if not exists generated_image_local_path text;

alter table articles
  add column if not exists generated_image_width integer;

alter table articles
  add column if not exists generated_image_height integer;

alter table articles
  add column if not exists generated_image_format text;

alter table articles
  add column if not exists generated_image_metadata jsonb not null default '{}'::jsonb;

alter table articles
  add column if not exists generated_image_error text;

alter table articles
  add column if not exists generated_image_requested_at timestamptz;

alter table articles
  add column if not exists generated_image_completed_at timestamptz;

alter table articles
  add column if not exists generated_image_reviewed_at timestamptz;

-- generated_image_status 값 검증 (허용된 6개 값만)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'articles_generated_image_status_check'
  ) then
    alter table articles
      add constraint articles_generated_image_status_check
      check (generated_image_status in ('not_generated', 'queued', 'generating', 'generated', 'reviewed', 'failed'));
  end if;
end $$;

-- generated_image_provider 값 검증 (허용된 3개 값만)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'articles_generated_image_provider_check'
  ) then
    alter table articles
      add constraint articles_generated_image_provider_check
      check (generated_image_provider in ('mock', 'openai', 'custom'));
  end if;
end $$;
