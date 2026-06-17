-- Phase 1-8: sources.url 단독 unique 제약을 제거하고,
-- theme_id + url 조합만 unique로 관리한다.
-- 동일한 URL을 서로 다른 테마에 등록할 수 있도록 허용한다.

alter table sources drop constraint if exists sources_url_key;

create unique index if not exists sources_theme_id_url_key
  on sources (theme_id, url);
