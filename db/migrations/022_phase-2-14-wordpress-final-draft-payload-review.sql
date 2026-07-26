-- Phase 2-14: WordPress Final Draft Payload Review
--
-- 이 저장소에는 Phase 2-14 관련 코드가 아직 구현되어 있지 않다. 이 migration은
-- 최종 draft payload 검토 결과를 저장할 컬럼만 미리 추가해 둔다 (schema
-- alignment 목적). 기존 데이터는 삭제하지 않으며, add column if not exists
-- 형식만 사용해 여러 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table articles
  add column if not exists wordpress_final_draft_review_status text not null default 'not_reviewed';

alter table articles
  add column if not exists wordpress_final_draft_review_score numeric;

alter table articles
  add column if not exists wordpress_final_draft_review_summary jsonb not null default '{}'::jsonb;

alter table articles
  add column if not exists wordpress_final_draft_review_error text;

alter table articles
  add column if not exists wordpress_final_draft_reviewed_at timestamptz;

-- 컬럼 추가 후 PostgREST가 새 컬럼을 인식하지 못하는 경우가 있어 schema cache를
-- 갱신한다 (Supabase SQL Editor에서 이 migration과 함께 실행 권장).
notify pgrst, 'reload schema';
