# Supabase Migration 체크리스트 (Phase 2)

Phase 2에서 추가된 migration 파일과 각 파일이 추가한 주요 컬럼을
정리한다. 모든 migration은 `alter table ... add column if not exists`
형식만 사용해 idempotent하며(여러 번 실행해도 안전), 기존 테이블/컬럼/
데이터를 삭제하지 않는다.

## 1. Phase 2 관련 migration 파일 목록과 주요 컬럼

| 파일 | Phase | 대상 테이블 | 주요 컬럼 |
|---|---|---|---|
| `011_phase-2-1-article-modes.sql` | 2-1 | `articles` | `article_mode`, `seo_title`, `meta_description`, `slug`, `target_keyword`, `secondary_keywords`, `ad_slots`, `format_metadata` 등 |
| `012_phase-2-2-wordpress-draft-publish.sql` | 2-2 | `publish_logs` | `external_post_id`, `post_url`, `error_message` |
| `013_phase-2-3-wordpress-metadata.sql` | 2-3 | `articles` | `wp_category_names`, `wp_tag_names`, `wp_category_ids`, `wp_tag_ids`, `wp_metadata_status`, `wp_metadata_generated_at` |
| `014_phase-2-4-seo-plugin-metadata.sql` | 2-4 | `articles` | `seo_plugin_provider`, `seo_plugin_payload`, `seo_plugin_metadata_status`, `seo_plugin_write_status` |
| `015_phase-2-5-featured-image-preparation.sql` | 2-5 | `articles` | `featured_image_status`, `featured_image_prompt`, `featured_image_alt_text`, `featured_image_caption`, `featured_image_wordpress_media_id` |
| `016_phase-2-6-wordpress-media-upload-preparation.sql` | 2-6 | `articles` | `featured_image_source_type`, `featured_image_upload_status`, `featured_image_upload_payload` |
| `017_phase-2-7-image-generation-integration.sql` | 2-7 | `articles` | `generated_image_status`, `generated_image_provider`, `generated_image_url` |
| `018_phase-2-8-wordpress-actual-connection.sql` | 2-8 | `publish_logs` | `details_json`, `external_post_id`, `post_url`, `error_message`, `updated_at` |
| `019_phase-2-11-wordpress-featured-media-attach.sql` | 2-11 | `articles` | `wordpress_featured_media_attach_status`, `wordpress_featured_media_attached_at` |
| `020_phase-2-12-seo-plugin-actual-write.sql` | 2-12 | `articles` | `seo_plugin_actual_write_status`, `seo_plugin_actual_write_post_id`, `seo_plugin_actual_write_verified` |
| `021_phase-2-13-seo-custom-endpoint.sql` | 2-13 | `articles` | `seo_plugin_custom_endpoint_status`, `seo_plugin_custom_endpoint_verified` |
| `022_phase-2-14-wordpress-final-draft-payload-review.sql` | 2-14 | `articles` | `wordpress_final_draft_review_status`, `wordpress_final_draft_review_score`, `wordpress_final_draft_review_summary` |
| `023_phase-2-15-publish-quality-gate.sql` | 2-15 | `articles` | `publish_quality_gate_status`, `publish_quality_gate_score`, `publish_ready`, `publish_blocked_reason` |
| `024_phase-2-16-human-approval-before-public-publish.sql` | 2-16 | `articles` | `public_publish_approval_status`, `public_publish_approved`, `public_publish_approved_at` |
| `025_phase-2-17-wordpress-public-publish-test.sql` | 2-17 | `articles` | `public_publish_status`, `public_published`, `public_publish_url` |

(Phase 1 migration은 `001`~`010`이며 이 문서의 범위 밖이다.)

## 2. 적용 방법

Supabase 프로젝트의 **SQL Editor**에서 `db/migrations/` 아래 파일을
번호 순서대로 실행한다. 이미 적용된 migration을 다시 실행해도
`add column if not exists`이므로 오류 없이 안전하게 건너뛴다.

## 3. 컬럼 목록 확인 SQL

`articles` 테이블에 Phase 2 컬럼이 모두 반영되었는지 확인한다.

```sql
select
  column_name,
  data_type
from information_schema.columns
where table_name = 'articles'
order by ordinal_position;
```

특정 컬럼 존재 여부만 빠르게 확인하려면:

```sql
select column_name
from information_schema.columns
where table_name = 'articles'
  and column_name in (
    'publish_quality_gate_status',
    'publish_ready',
    'public_publish_approval_status',
    'public_publish_approved',
    'public_publish_status',
    'public_published'
  );
```

`publish_logs`/`pipeline_logs`/`approval_logs`도 동일한 패턴으로 확인할
수 있다 (`table_name = 'publish_logs'` 등으로 교체).

## 4. schema cache reload 방법

컬럼을 추가한 직후 PostgREST(Supabase API 레이어)가 새 컬럼을 즉시
인식하지 못해 "column does not exist" 오류가 발생할 수 있다. 이 경우
schema cache를 강제로 갱신한다.

```sql
notify pgrst, 'reload schema';
```

이 문서의 모든 migration 파일은 마지막 줄에 이 구문을 포함하고 있어
보통 자동으로 갱신되지만, 그래도 오류가 지속되면 위 SQL을 SQL Editor에서
직접 한 번 더 실행한다.

## 5. 컬럼 누락 오류 대응 방법

1. `select column_name from information_schema.columns where table_name = '<table>' and column_name = '<column>';`로 컬럼이 실제로 있는지 확인한다.
2. 없다면 해당 Phase의 migration 파일을 SQL Editor에서 다시 실행한다 (idempotent하므로 안전).
3. 컬럼은 있는데 API에서 여전히 인식하지 못하면 `notify pgrst, 'reload schema';`를 실행한다.
4. 그래도 해결되지 않으면 Supabase 프로젝트 설정에서 API 캐시를 강제로
   재시작(프로젝트 일시정지 후 재개, 또는 Supabase 대시보드의
   "Restart project" 기능)한다.
5. 애플리케이션 코드(`lib/supabase/database.types.ts`)의 필드명과 실제
   컬럼명(snake_case)이 정확히 일치하는지 오타를 확인한다.
