-- Phase 1-16: 공통 테마 후보 중복 방지
--
-- 문제: theme_clusters에 재수집(clusterCommonThemes) 때마다 같은 테마가
-- 다시 insert되어 중복이 쌓인다. 비교 기준(정규화 키/하위 주제/근거)을
-- 저장할 컬럼이 theme_clusters에 없어서 application에서 dedupe/merge를
-- 할 수 없었다.
--
-- 이 마이그레이션은 컬럼 추가만 수행한다(모두 nullable 또는 기본값 있는
-- ADD COLUMN IF NOT EXISTS) — 기존 행을 삭제/변경하지 않고, 기존
-- 조회/삽입 흐름을 깨뜨리지 않는다.
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table theme_clusters
  add column if not exists normalized_key text,
  add column if not exists subtopics jsonb not null default '[]'::jsonb,
  add column if not exists evidence jsonb not null default '[]'::jsonb,
  add column if not exists seen_count integer not null default 1,
  add column if not exists last_seen_at timestamptz not null default now();

-- 정규화 키로 기존 후보를 빠르게 찾기 위한 인덱스.
-- unique index는 만들지 않는다 — 이 마이그레이션 적용 시점에 이미
-- 쌓여 있는 중복 행이 있을 수 있어(이번 개선 이전에 생성된 것들),
-- unique 제약을 걸면 마이그레이션 자체가 실패할 수 있다. 정리가
-- 필요하면 기존 중복 행을 사람이 확인 후 별도로 정리(보관 처리)한 뒤
-- unique index 추가를 검토한다.
create index if not exists theme_clusters_normalized_key_idx
  on theme_clusters (normalized_key);
