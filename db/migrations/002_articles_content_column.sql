-- ============================================================
-- 002_articles_content_column.sql
--
-- 목적: articles 테이블의 기사 본문 컬럼을 content 기준으로 통일한다.
--
-- 배경: lib/repositories/article-repository.ts의 saveDraftArticle()은
-- articles.content에만 본문을 저장한다. 그런데 일부 환경의 articles
-- 테이블에는 과거 schema에서 만들어진 draft_body not null 컬럼이 남아 있어,
-- content만 채워서 insert하면
--   null value in column "draft_body" of relation "articles"
--   violates not-null constraint
-- 오류가 발생한다.
--
-- 이 migration은
-- 1) content 컬럼이 항상 존재하고 not null + default ''를 갖도록 보장하고
-- 2) draft_body 컬럼이 남아 있다면, 기존 데이터를 content로 백필한 뒤
--    not null 제약을 제거하고 default ''를 부여한다 (컬럼 자체는 삭제하지 않음).
--
-- 안전성: add column if not exists / 조건부 alter만 사용하며, drop column은
-- 사용하지 않는다. 여러 번 실행해도 안전하다 (idempotent).
-- ============================================================

-- 1) content 컬럼 보장
alter table articles add column if not exists content text;

-- 2) draft_body가 남아 있다면 content로 백필
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'articles'
      and column_name = 'draft_body'
  ) then
    update articles
    set content = coalesce(content, draft_body, '')
    where content is null;
  end if;
end $$;

-- content가 여전히 null인 행(draft_body가 없던 환경)은 빈 문자열로 채운다.
update articles
set content = ''
where content is null;

alter table articles alter column content set default '';
alter table articles alter column content set not null;

-- 3) draft_body가 남아 있다면 not null 제약을 제거하고 default를 부여한다
--    (컬럼은 호환성을 위해 유지, 더 이상 코드에서 사용하지 않음)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'articles'
      and column_name = 'draft_body'
  ) then
    alter table articles alter column draft_body drop not null;
    alter table articles alter column draft_body set default '';
  end if;
end $$;
