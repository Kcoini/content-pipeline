-- ============================================================
-- 003_eval_runs_score_column.sql
--
-- 목적: eval_runs 테이블의 평가 점수 컬럼을 aggregate_score 기준으로
-- 정리하되, 과거 schema의 score not null 컬럼이 남아 있어도 insert 오류가
-- 나지 않게 한다.
--
-- 배경: lib/repositories/eval-repository.ts의 saveEvalRun()은 eval_runs에
-- aggregate_score(가중 평균 점수)를 저장한다. 그런데 일부 환경의 eval_runs
-- 테이블에는 과거 schema에서 만들어진 score not null 컬럼이 남아 있어,
-- aggregate_score만 채워서 insert하면
--   null value in column "score" of relation "eval_runs"
--   violates not-null constraint
-- 오류가 발생한다.
--
-- 이 migration은
-- 1) aggregate_score, score 컬럼이 모두 존재하고 default 0을 갖도록 보장하고
-- 2) 두 컬럼의 기존 null 값을 서로 백필한 뒤
-- 3) score의 not null 제약을 제거한다 (컬럼 자체는 호환성을 위해 유지).
--
-- 이후 코드는 aggregate_score와 score에 항상 같은 값을 저장한다
-- (aggregate_score가 canonical, score는 호환용).
--
-- 안전성: add column if not exists / alter column만 사용하며, drop column은
-- 사용하지 않는다. 여러 번 실행해도 안전하다 (idempotent).
-- ============================================================

alter table eval_runs
  add column if not exists aggregate_score numeric;

alter table eval_runs
  add column if not exists score numeric;

update eval_runs
set aggregate_score = coalesce(aggregate_score, score, 0)
where aggregate_score is null;

update eval_runs
set score = coalesce(score, aggregate_score, 0)
where score is null;

alter table eval_runs
  alter column aggregate_score set default 0;

alter table eval_runs
  alter column score set default 0;

alter table eval_runs
  alter column score drop not null;
