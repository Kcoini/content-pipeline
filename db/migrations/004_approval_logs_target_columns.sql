-- ============================================================
-- 004_approval_logs_target_columns.sql
--
-- 목적: approval_logs 테이블에 target_type / target_id 컬럼을 추가하고,
--       기존 행(article 승인 기록)을 백필한다.
--
-- 배경: lib/repositories/approval-repository.ts의 saveApprovalLog()는
--       approval_logs에 승인 대상 종류(target_type)와 대상 id(target_id)를
--       함께 저장한다. 실제 DB에 이 컬럼이 NOT NULL로 존재하지만 초기
--       schema와 migration에 누락되어 있어 insert 시
--         null value in column "target_type" ... violates not-null constraint
--       오류가 발생한다.
--
-- 이 migration은
-- 1) target_type, target_id 컬럼이 존재하도록 보장하고
-- 2) 기존 행의 target_type을 'article'로, target_id를 article_id로 백필하며
-- 3) target_type에 default 'article'을 설정한다
--
-- 안전성: add column if not exists / update만 사용하며, drop column은
--         사용하지 않는다. 여러 번 실행해도 안전하다 (idempotent).
-- ============================================================

alter table approval_logs
  add column if not exists target_type text;

alter table approval_logs
  add column if not exists target_id uuid;

-- 기존 approval_logs 행의 target_type 백필 (article 승인 기록만 있으므로 'article')
update approval_logs
set target_type = 'article'
where target_type is null;

-- 기존 approval_logs 행의 target_id 백필 (article_id와 동일)
update approval_logs
set target_id = article_id
where target_id is null
  and article_id is not null;

-- 이후 insert 시 target_type 기본값을 'article'로 설정
alter table approval_logs
  alter column target_type set default 'article';
