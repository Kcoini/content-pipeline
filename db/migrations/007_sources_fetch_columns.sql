-- Phase 1-9: sources 테이블에 URL 본문 수집 관련 컬럼 추가
--
-- 기존 데이터 삭제 없이 컬럼만 추가한다.
-- fetch_status 기본값: 'pending' (수집 대기)
-- raw_content / extracted_title / fetched_at / fetch_error 는 수집 완료 후 채워진다.
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table sources
  add column if not exists fetch_status text not null default 'pending'
    check (fetch_status in ('pending', 'success', 'failed')),
  add column if not exists raw_content text,
  add column if not exists extracted_title text,
  add column if not exists fetched_at timestamptz,
  add column if not exists fetch_error text;
