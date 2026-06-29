-- Phase 1-13: 선택된 테마 기반 관련 기사 URL 후보 수집
--
-- article_url_candidates: 키워드 검색으로 수집된 기사 URL 후보.
-- 사용자가 확인 후 선택하면 sources 테이블에 등록된다.
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

create table if not exists article_url_candidates (
  id               uuid primary key default gen_random_uuid(),
  theme_id         uuid references themes(id) on delete cascade,
  theme_cluster_id uuid,                                   -- themes 저장 전 cluster 연결 시 사용
  platform         text not null,                          -- 'naver' | 'daum' | 'mock'
  query            text,                                   -- 수집에 사용된 검색 쿼리
  title            text,
  snippet          text,
  url              text not null,
  publisher        text,
  published_at     timestamptz,
  rank_position    integer,
  status           text not null default 'candidate'
                   check (status in ('candidate', 'selected', 'dismissed', 'imported')),
  metadata         jsonb not null default '{}'::jsonb,
  collected_at     timestamptz default now(),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- 같은 테마+URL 조합이 중복 수집되지 않도록
create unique index if not exists article_url_candidates_theme_url_idx
  on article_url_candidates (theme_id, url)
  where theme_id is not null;
