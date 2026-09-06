-- 목록 화면(테마/기사/wordpress_blog·naver_blog 등 social_posts)에 "삭제"
-- 버튼을 추가하기 위한 soft delete(보관 처리) 컬럼 추가.
--
-- 중요: 이 migration은 hard delete(실제 row 삭제)를 하지 않는다. themes→
-- articles→social_posts는 이미 on delete cascade로 연결되어 있어(db/schema.sql
-- 참고) 실제 삭제는 연쇄적으로 위험하다 — 그래서 "보관 처리(archived_at)"
-- 컬럼만 추가하고, 목록 조회 시 archived_at is null 조건으로 걸러내는
-- soft delete 방식을 사용한다. 기존 데이터는 전혀 삭제하지 않으며,
-- add column if not exists만 사용해 여러 번 실행해도 안전하다(idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table themes add column if not exists archived_at timestamptz;
alter table articles add column if not exists archived_at timestamptz;
alter table social_posts add column if not exists archived_at timestamptz;

create index if not exists idx_themes_archived_at on themes (archived_at);
create index if not exists idx_articles_archived_at on articles (archived_at);
create index if not exists idx_social_posts_archived_at on social_posts (archived_at);

comment on column themes.archived_at is '테마 목록 화면에서 "삭제"(보관 처리) 시 now()로 설정된다. null이면 활성 상태.';
comment on column articles.archived_at is '기사 목록 화면에서 "삭제"(보관 처리) 시 now()로 설정된다. null이면 활성 상태.';
comment on column social_posts.archived_at is 'wordpress_blog/naver_blog 등 social post 목록에서 "삭제"(보관 처리) 시 now()로 설정된다. null이면 활성 상태.';
