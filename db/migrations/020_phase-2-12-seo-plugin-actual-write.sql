-- Phase 2-12: SEO Plugin Actual Metadata Test
--
-- Phase 2-4에서 준비한 SEO plugin metadata payload를 실제 WordPress draft
-- post에 반영한 시도 결과를 추적하기 위해 articles에 컬럼을 추가한다. 기존
-- 데이터는 삭제하지 않으며, add column if not exists 형식만 사용해 여러 번
-- 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table articles
  add column if not exists seo_plugin_actual_write_status text not null default 'not_attempted';

alter table articles
  add column if not exists seo_plugin_actual_write_provider text;

alter table articles
  add column if not exists seo_plugin_actual_write_post_id integer;

alter table articles
  add column if not exists seo_plugin_actual_write_error text;

alter table articles
  add column if not exists seo_plugin_actual_write_attempted_at timestamptz;

alter table articles
  add column if not exists seo_plugin_actual_write_verified boolean not null default false;

alter table articles
  add column if not exists seo_plugin_actual_write_warning text;
