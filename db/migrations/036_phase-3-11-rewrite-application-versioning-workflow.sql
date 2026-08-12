-- Phase 3-11: Rewrite Application & Versioning Workflow
--
-- Phase 3-10에서 생성된 social_post_rewrite_suggestions를 실제
-- social_posts에 반영할 수 있게 하되, 기존 row를 직접 덮어쓰지 않고
-- 새 버전(row)을 만드는 versioning 구조를 추가한다. 이 migration/
-- 기능 어디에도 기존 social_post 원본을 삭제하거나 직접 수정하는
-- 경로는 없다. add column/create table if not exists만 사용해 여러
-- 번 실행해도 안전하다 (idempotent).
--
-- 적용 방법: Supabase 프로젝트 → SQL Editor에서 실행한다.

-- ---------------------------------------------------------------------
-- 1) social_posts: versioning / rewrite application 컬럼
-- ---------------------------------------------------------------------

alter table social_posts add column if not exists parent_social_post_id uuid;
alter table social_posts add column if not exists root_social_post_id uuid;
alter table social_posts add column if not exists version_number integer not null default 1;
alter table social_posts add column if not exists version_label text;
alter table social_posts add column if not exists version_status text not null default 'current';
alter table social_posts add column if not exists rewrite_source_suggestion_id uuid;
alter table social_posts add column if not exists rewrite_applied_from_social_post_id uuid;
alter table social_posts add column if not exists rewrite_applied_at timestamptz;
alter table social_posts add column if not exists rewrite_applied_by text;
alter table social_posts add column if not exists rewrite_application_notes text;
alter table social_posts add column if not exists is_rewrite_version boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_version_status_check'
  ) then
    alter table social_posts
      add constraint social_posts_version_status_check
      check (version_status in ('current', 'archived', 'superseded', 'draft', 'rejected'));
  end if;
end $$;

-- 기존 row는 버전 체계 도입 이전에 생성된 "원본(최초 버전)"이므로,
-- root_social_post_id가 비어 있으면 자기 자신을 가리키도록 보정한다.
update social_posts set root_social_post_id = id where root_social_post_id is null;

create index if not exists idx_social_posts_parent_social_post_id on social_posts (parent_social_post_id);
create index if not exists idx_social_posts_root_social_post_id on social_posts (root_social_post_id);
create index if not exists idx_social_posts_version_status on social_posts (version_status);

-- ---------------------------------------------------------------------
-- 2) social_post_versions: 버전 이력
-- ---------------------------------------------------------------------

create table if not exists social_post_versions (
  id uuid primary key default gen_random_uuid(),
  social_post_id uuid not null references social_posts(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  root_social_post_id uuid not null,
  parent_social_post_id uuid,
  version_number integer not null,
  version_label text,
  version_status text not null default 'current',
  platform text not null,
  tone_style text not null,
  rewrite_source_suggestion_id uuid,
  change_summary jsonb not null default '{}'::jsonb,
  applied_by text,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_social_post_versions_social_post_id on social_post_versions (social_post_id);
create index if not exists idx_social_post_versions_article_id on social_post_versions (article_id);
create index if not exists idx_social_post_versions_root_social_post_id on social_post_versions (root_social_post_id);
create index if not exists idx_social_post_versions_parent_social_post_id on social_post_versions (parent_social_post_id);
create index if not exists idx_social_post_versions_version_number on social_post_versions (version_number);
create index if not exists idx_social_post_versions_version_status on social_post_versions (version_status);
create index if not exists idx_social_post_versions_rewrite_source_suggestion_id on social_post_versions (rewrite_source_suggestion_id);
create index if not exists idx_social_post_versions_created_at on social_post_versions (created_at);

-- 기존 social_post 각각에 대해 "버전 1(원본)" 이력을 소급 생성한다
-- (이미 있으면 건너뜀).
insert into social_post_versions (social_post_id, article_id, root_social_post_id, parent_social_post_id, version_number, version_label, version_status, platform, tone_style, created_at)
select sp.id, sp.article_id, sp.root_social_post_id, null, 1, '원본', 'current', sp.platform, sp.tone_style, sp.created_at
from social_posts sp
where not exists (
  select 1 from social_post_versions sv where sv.social_post_id = sp.id
);

-- ---------------------------------------------------------------------
-- 3) social_post_rewrite_suggestions: 적용(application) 상태 컬럼
-- ---------------------------------------------------------------------

alter table social_post_rewrite_suggestions add column if not exists applied_social_post_id uuid;
alter table social_post_rewrite_suggestions add column if not exists application_status text not null default 'not_applied';
alter table social_post_rewrite_suggestions add column if not exists application_error text;
alter table social_post_rewrite_suggestions add column if not exists application_notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_post_rewrite_suggestions_application_status_check'
  ) then
    alter table social_post_rewrite_suggestions
      add constraint social_post_rewrite_suggestions_application_status_check
      check (application_status in ('not_applied', 'applied', 'blocked', 'failed'));
  end if;
end $$;

-- 컬럼/테이블 추가 후 PostgREST schema cache를 갱신한다.
notify pgrst, 'reload schema';
