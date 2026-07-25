-- Phase 2-3: WordPress Category, Tag, SEO Metadata 기능 추가
--
-- article_generation 이후 WordPress 게시 준비(카테고리/태그/SEO metadata)를 위해
-- articles 테이블에 컬럼을 추가한다. seo_title/meta_description/slug/target_keyword/
-- secondary_keywords/internal_link_suggestions/ad_slots/format_metadata는 이미
-- db/migrations/011_phase-2-1-article-modes.sql에서 추가되어 재사용한다.
--
-- 기존 데이터는 삭제하지 않으며, alter table ... add column if not exists
-- 형식만 사용해 여러 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table articles
  add column if not exists wp_category_names text[] not null default '{}';

alter table articles
  add column if not exists wp_tag_names text[] not null default '{}';

alter table articles
  add column if not exists wp_category_ids integer[] not null default '{}';

alter table articles
  add column if not exists wp_tag_ids integer[] not null default '{}';

alter table articles
  add column if not exists wp_metadata_status text not null default 'not_ready';

alter table articles
  add column if not exists wp_metadata_generated_at timestamptz;

-- wp_metadata_status 값 검증 (허용된 4개 값만)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'articles_wp_metadata_status_check'
  ) then
    alter table articles
      add constraint articles_wp_metadata_status_check
      check (wp_metadata_status in ('not_ready', 'generated', 'reviewed', 'failed'));
  end if;
end $$;
