-- Phase 2-16: Human Approval Before Public Publish
alter table articles
  add column if not exists public_publish_approval_status text not null default 'not_requested';
alter table articles
  add column if not exists public_publish_approved boolean not null default false;
alter table articles
  add column if not exists public_publish_approved_at timestamptz;
alter table articles
  add column if not exists public_publish_approved_by text;
alter table articles
  add column if not exists public_publish_approval_error text;
alter table articles
  add column if not exists public_publish_approval_notes text;

notify pgrst, 'reload schema';
