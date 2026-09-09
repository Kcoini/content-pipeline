-- Phase 4-3: "마스터 원고 중심" 구조 전환 3차 — news_article 플랫폼 추가.
--
-- social_posts.platform CHECK 제약(social_posts_platform_check,
-- migration 028)이 기존 6개 값만 허용하고 있어, 새 플랫폼
-- "news_article"(언론 기사형)을 저장하려면 이 제약을 확장해야 한다.
-- 이 마이그레이션은 제약 재정의만 수행한다 — 기존 행을 삭제/변경하지
-- 않고, 기존 6개 플랫폼의 동작도 전혀 바꾸지 않는다.
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'social_posts_platform_check'
  ) then
    alter table social_posts drop constraint social_posts_platform_check;
  end if;

  alter table social_posts
    add constraint social_posts_platform_check
    check (platform in (
      'news_article', 'wordpress_blog', 'naver_blog', 'naver_cafe', 'x', 'threads', 'instagram'
    ));
end $$;
