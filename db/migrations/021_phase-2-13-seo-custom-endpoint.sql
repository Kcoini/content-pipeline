-- Phase 2-13: Custom WordPress SEO Metadata Endpoint (Rank Math 전용)
--
-- 표준 WordPress posts REST API로 Rank Math SEO metadata 반영 여부가
-- 확인되지 않아(Phase 2-12), WordPress 쪽 custom REST endpoint를 통해
-- update_post_meta로 직접 저장한 시도 결과를 추적하기 위해 articles에
-- 컬럼을 추가한다. 기존 데이터는 삭제하지 않으며, add column if not exists
-- 형식만 사용해 여러 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table articles
  add column if not exists seo_plugin_custom_endpoint_status text not null default 'not_attempted';

alter table articles
  add column if not exists seo_plugin_custom_endpoint_verified boolean not null default false;

alter table articles
  add column if not exists seo_plugin_custom_endpoint_error text;

alter table articles
  add column if not exists seo_plugin_custom_endpoint_attempted_at timestamptz;
