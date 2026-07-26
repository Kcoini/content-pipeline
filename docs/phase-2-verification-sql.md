# Phase 2 확인용 SQL 모음

Phase 2 WordPress 발행 파이프라인의 상태를 Supabase SQL Editor에서 빠르게
확인할 때 사용하는 SQL을 모아둔다. `pipeline_logs`는 반드시 `event_name`
컬럼 기준으로 조회한다 (`stage`/`status` 컬럼만으로 필터링하지 않는다).

## articles 상태 확인

```sql
select
  id,
  title,
  status,
  article_mode,
  wp_metadata_status,
  seo_plugin_custom_endpoint_status,
  wordpress_final_draft_review_status,
  publish_quality_gate_status,
  publish_ready,
  public_publish_approval_status,
  public_publish_approved,
  public_publish_status,
  public_published
from articles
where id = '<article_id>';
```

## publish_logs 확인

```sql
select
  target,
  status,
  external_post_id,
  post_url,
  error_message,
  details_json,
  created_at
from publish_logs
where article_id = '<article_id>'
order by created_at desc
limit 30;
```

target별로 좁혀서 볼 때:

```sql
select target, status, error_message, details_json, created_at
from publish_logs
where article_id = '<article_id>'
  and target in (
    'wordpress',
    'wordpress_media_upload',
    'wordpress_featured_media_attach',
    'seo_plugin_custom_endpoint',
    'wordpress_final_draft_review',
    'publish_quality_gate',
    'public_publish_approval',
    'wordpress_public_publish'
  )
order by created_at desc;
```

## pipeline_logs 확인 (event_name 기준)

```sql
select event_name, status, message, details_json, created_at
from pipeline_logs
where article_id = '<article_id>'
order by created_at desc
limit 50;
```

Phase별 이벤트만 좁혀서 볼 때 (`event_name like` 패턴):

```sql
-- Phase 2-15 Publish Quality Gate
select event_name, status, message, details_json, created_at
from pipeline_logs
where event_name like 'publish_quality_gate_%'
order by created_at desc
limit 30;

-- Phase 2-16 Human Approval
select event_name, status, message, details_json, created_at
from pipeline_logs
where event_name like 'public_publish_approval_%'
order by created_at desc
limit 30;

-- Phase 2-17 WordPress Public Publish
select event_name, status, message, details_json, created_at
from pipeline_logs
where event_name like 'wordpress_public_publish_%'
order by created_at desc
limit 30;
```

## approval_logs 확인

```sql
select target_type, target_id, action, status, approved_by, notes, created_at
from approval_logs
where article_id = '<article_id>'
order by created_at desc
limit 20;
```

`public_publish_*` 관련 승인/취소 기록만:

```sql
select target_type, target_id, action, status, approved_by, notes, created_at
from approval_logs
where target_type = 'article'
  and action like 'public_publish_%'
order by created_at desc
limit 20;
```

## WordPress public publish 확인

```sql
select
  id,
  title,
  public_publish_status,
  public_published,
  public_published_at,
  public_publish_post_id,
  public_publish_url,
  public_publish_error,
  public_publish_attempted_at
from articles
where id = '<article_id>';
```

## SEO custom endpoint 확인

```sql
select
  id,
  title,
  seo_plugin_provider,
  seo_plugin_custom_endpoint_status,
  seo_plugin_custom_endpoint_verified,
  seo_plugin_custom_endpoint_error,
  seo_plugin_custom_endpoint_attempted_at
from articles
where id = '<article_id>';
```

## Publish Quality Gate 확인

```sql
select
  id,
  title,
  publish_quality_gate_status,
  publish_quality_gate_score,
  publish_quality_gate_summary,
  publish_quality_gate_error,
  publish_quality_gate_checked_at,
  publish_ready,
  publish_blocked_reason
from articles
where id = '<article_id>';
```

## Human Approval 확인

```sql
select
  id,
  title,
  public_publish_approval_status,
  public_publish_approved,
  public_publish_approved_at,
  public_publish_approved_by,
  public_publish_approval_error,
  public_publish_approval_notes
from articles
where id = '<article_id>';
```
