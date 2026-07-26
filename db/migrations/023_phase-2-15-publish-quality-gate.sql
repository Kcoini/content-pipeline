-- Phase 2-15: Publish Quality Gate
--
-- WordPress 공개 게시 전에 반드시 통과해야 하는 품질검사 게이트 결과를
-- 저장하기 위해 articles에 컬럼을 추가한다. 기존 테이블/컬럼/데이터는
-- 삭제하거나 변경하지 않으며, add column if not exists 형식만 사용해
-- 여러 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table articles
  add column if not exists publish_quality_gate_status text not null default 'not_checked';

alter table articles
  add column if not exists publish_quality_gate_score numeric;

alter table articles
  add column if not exists publish_quality_gate_summary jsonb not null default '{}'::jsonb;

alter table articles
  add column if not exists publish_quality_gate_error text;

alter table articles
  add column if not exists publish_quality_gate_checked_at timestamptz;

alter table articles
  add column if not exists publish_ready boolean not null default false;

alter table articles
  add column if not exists publish_blocked_reason text;

-- 컬럼 추가 후 PostgREST가 새 컬럼을 인식하지 못하는 경우가 있어 schema cache를 갱신한다.
notify pgrst, 'reload schema';
