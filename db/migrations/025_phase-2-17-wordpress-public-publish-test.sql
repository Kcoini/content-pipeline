-- Phase 2-17: WordPress Public Publish Test
alter table articles
  add column if not exists public_publish_status text not null default 'not_published';
alter table articles
  add column if not exists public_published boolean not null default false;
alter table articles
  add column if not exists public_published_at timestamptz;
alter table articles
  add column if not exists public_publish_post_id integer;
alter table articles
  add column if not exists public_publish_url text;
alter table articles
  add column if not exists public_publish_error text;
alter table articles
  add column if not exists public_publish_attempted_at timestamptz;

notify pgrst, 'reload schema';
