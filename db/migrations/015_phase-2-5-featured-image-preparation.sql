-- Phase 2-5: Featured Image Preparation
--
-- 수익형 블로그 글과 WordPress 게시를 위해 대표 이미지(featured image) 준비
-- 정보(prompt, alt text, caption, style 등)를 저장한다. 이번 단계에서는 실제
-- 이미지를 생성하거나 WordPress에 업로드하지 않는다 (safe stub — 준비 정보만
-- 생성/저장한다).
--
-- 기존 데이터는 삭제하지 않으며, alter table ... add column if not exists
-- 형식만 사용해 여러 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table articles
  add column if not exists featured_image_status text not null default 'not_ready';

alter table articles
  add column if not exists featured_image_prompt text;

alter table articles
  add column if not exists featured_image_alt_text text;

alter table articles
  add column if not exists featured_image_caption text;

alter table articles
  add column if not exists featured_image_style text;

alter table articles
  add column if not exists featured_image_aspect_ratio text not null default '16:9';

alter table articles
  add column if not exists featured_image_metadata jsonb not null default '{}'::jsonb;

alter table articles
  add column if not exists featured_image_generated_at timestamptz;

alter table articles
  add column if not exists featured_image_reviewed_at timestamptz;

-- 실제 업로드는 아직 구현하지 않으며, 나중에 media id/url을 채울 자리만 마련한다.
alter table articles
  add column if not exists featured_image_wordpress_media_id integer;

alter table articles
  add column if not exists featured_image_wordpress_url text;

alter table articles
  add column if not exists featured_image_error text;

-- featured_image_status 값 검증 (허용된 5개 값만)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'articles_featured_image_status_check'
  ) then
    alter table articles
      add constraint articles_featured_image_status_check
      check (featured_image_status in ('not_ready', 'prepared', 'reviewed', 'failed', 'uploaded'));
  end if;
end $$;
