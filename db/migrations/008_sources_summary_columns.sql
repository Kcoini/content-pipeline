-- Phase 1-10: sources 테이블에 자동 요약 관련 컬럼 추가
--
-- summary 컬럼은 이미 존재하므로 재사용한다.
-- summary_status: pending(요약 대기) / success(요약 완료) / failed(요약 실패) / skipped(raw_content 없어 건너뜀)
-- key_points: AI가 추출한 핵심 포인트 배열 (jsonb)
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table sources
  add column if not exists summary_status text not null default 'pending'
    check (summary_status in ('pending', 'success', 'failed', 'skipped')),
  add column if not exists summary_error text,
  add column if not exists summarized_at timestamptz,
  add column if not exists key_points jsonb not null default '[]'::jsonb;
