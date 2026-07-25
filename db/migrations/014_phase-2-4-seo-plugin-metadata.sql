-- Phase 2-4: SEO Plugin Metadata Mapping (Yoast / Rank Math / AIOSEO)
--
-- Phase 2-3에서 생성한 SEO title/meta description/slug/target keyword/
-- secondary keywords 등을 WordPress SEO 플러그인별 metadata payload로 변환해
-- 저장하기 위한 컬럼을 추가한다. 실제 plugin write는 이번 단계에서 구현하지
-- 않으며(safe stub), payload 생성/저장/검토만 지원한다.
--
-- 기존 데이터는 삭제하지 않으며, alter table ... add column if not exists
-- 형식만 사용해 여러 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table articles
  add column if not exists seo_plugin_provider text not null default 'none';

alter table articles
  add column if not exists seo_plugin_payload jsonb not null default '{}'::jsonb;

alter table articles
  add column if not exists seo_plugin_metadata_status text not null default 'not_ready';

alter table articles
  add column if not exists seo_plugin_metadata_generated_at timestamptz;

alter table articles
  add column if not exists seo_plugin_write_status text not null default 'not_attempted';

alter table articles
  add column if not exists seo_plugin_write_error text;

-- seo_plugin_provider 값 검증 (허용된 4개 값만)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'articles_seo_plugin_provider_check'
  ) then
    alter table articles
      add constraint articles_seo_plugin_provider_check
      check (seo_plugin_provider in ('none', 'yoast', 'rank_math', 'aioseo'));
  end if;
end $$;

-- seo_plugin_metadata_status 값 검증
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'articles_seo_plugin_metadata_status_check'
  ) then
    alter table articles
      add constraint articles_seo_plugin_metadata_status_check
      check (seo_plugin_metadata_status in ('not_ready', 'generated', 'reviewed', 'failed'));
  end if;
end $$;

-- seo_plugin_write_status 값 검증
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'articles_seo_plugin_write_status_check'
  ) then
    alter table articles
      add constraint articles_seo_plugin_write_status_check
      check (seo_plugin_write_status in ('not_attempted', 'skipped_dry_run', 'skipped_provider_none', 'success', 'failed'));
  end if;
end $$;
