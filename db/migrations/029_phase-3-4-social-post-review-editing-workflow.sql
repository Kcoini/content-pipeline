-- Phase 3-4: Social Post Review & Editing Workflow
--
-- Phase 3-3에서 생성된 social_posts를 사람이 확인/수정/재검수/승인/반려/
-- 승인취소할 수 있도록 review/editing/approval 관련 컬럼을 추가한다.
-- 기존 social_posts / social_post_quality_runs / social_post_approvals
-- 구조는 변경하지 않으며, add column if not exists만 사용해 여러 번
-- 실행해도 안전하다 (idempotent). 실제 게시 API 연동은 포함하지 않는다.
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table social_posts add column if not exists edited_at timestamptz;
alter table social_posts add column if not exists edited_by text;
alter table social_posts add column if not exists review_notes text;
alter table social_posts add column if not exists revision_count integer not null default 0;
alter table social_posts add column if not exists last_quality_checked_at timestamptz;
alter table social_posts add column if not exists approval_requested_at timestamptz;
alter table social_posts add column if not exists rejection_reason text;
alter table social_posts add column if not exists revoked_at timestamptz;
alter table social_posts add column if not exists revoked_reason text;

-- 컬럼 추가 후 PostgREST schema cache를 갱신한다.
notify pgrst, 'reload schema';
