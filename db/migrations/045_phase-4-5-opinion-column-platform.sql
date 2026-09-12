-- Phase 4-5: 글 유형별 생성·검토 기준 분리 — opinion_column(칼럼) 플랫폼 추가
--
-- Phase 4-3(044)에서 news_article을 추가할 때와 동일한 이유로,
-- social_posts.platform CHECK 제약(migration 028)을 다시 확장해야 한다.
-- 기존 행은 전혀 건드리지 않는다(제약 재정의뿐이다).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

alter table social_posts drop constraint social_posts_platform_check;
alter table social_posts
  add constraint social_posts_platform_check
  check (platform in (
    'news_article', 'opinion_column', 'wordpress_blog', 'naver_blog', 'naver_cafe', 'x', 'threads', 'instagram'
  ));
