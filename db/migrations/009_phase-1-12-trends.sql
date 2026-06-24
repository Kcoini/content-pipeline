-- Phase 1-12: 트렌드 기반 자동 테마 추출 지원
--
-- 1) themes 테이블에 metadata 컬럼 추가 (수동/자동 생성 방식 구분)
-- 2) trend_candidates 테이블 추가 (네이버/다음 트렌드 후보)
-- 3) theme_clusters 테이블 추가 (키워드 클러스터링 결과)
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

-- 1) themes.metadata 추가
alter table themes
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 2) trend_candidates 테이블
create table if not exists trend_candidates (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null,               -- 'naver' | 'daum' | 'mock'
  keyword       text,
  title         text,
  snippet       text,
  url           text,
  rank_position integer,
  collected_at  timestamptz default now(),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz default now()
);

-- 3) theme_clusters 테이블
create table if not exists theme_clusters (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  keywords    jsonb not null default '[]'::jsonb,
  naver_count integer not null default 0,
  daum_count  integer not null default 0,
  score       numeric not null default 0,
  status      text not null default 'candidate'
              check (status in ('candidate', 'selected', 'dismissed')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
