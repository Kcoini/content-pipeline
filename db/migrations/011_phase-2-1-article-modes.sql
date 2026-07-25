-- Phase 2-1: 수익형 콘텐츠 글쓰기 모드 3종 (article_mode) 추가
--
-- general_news / source_based_explainer / monetized_blog 3개 모드를 지원하기 위해
-- articles 테이블에 컬럼을 추가한다. 기존 데이터는 삭제하지 않으며,
-- alter table ... add column if not exists 형식만 사용해 여러 번 실행해도 안전하다 (idempotent).
--
-- 기본값은 기존 동작(출처 기반 설명형)에 가장 가까운 'source_based_explainer'로 설정해
-- 기존 article generation 흐름을 깨뜨리지 않는다.
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table articles
  add column if not exists article_mode text not null default 'source_based_explainer';

alter table articles
  add column if not exists seo_title text;

alter table articles
  add column if not exists meta_description text;

alter table articles
  add column if not exists slug text;

alter table articles
  add column if not exists target_keyword text;

alter table articles
  add column if not exists secondary_keywords text[] not null default '{}';

alter table articles
  add column if not exists search_intent text;

alter table articles
  add column if not exists reader_persona text;

alter table articles
  add column if not exists ad_slots jsonb not null default '[]'::jsonb;

alter table articles
  add column if not exists internal_link_suggestions jsonb not null default '[]'::jsonb;

alter table articles
  add column if not exists monetization_score numeric;

alter table articles
  add column if not exists policy_risk_score numeric;

alter table articles
  add column if not exists format_metadata jsonb not null default '{}'::jsonb;

-- article_mode 값 검증 (허용된 3개 값만)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'articles_article_mode_check'
  ) then
    alter table articles
      add constraint articles_article_mode_check
      check (article_mode in ('general_news', 'source_based_explainer', 'monetized_blog'));
  end if;
end $$;
