# Phase 2-9: WordPress Draft Publish Stabilization

## 목적

Phase 2-8에서 구현한 실제 WordPress 연결 테스트와 draft post 생성 기능을
**안정화**한다. 이번 단계에서는 새 기능을 추가하지 않고, 다음 항목만 개선한다:

- 중복 게시 방지 (같은 기사에 이미 성공한 draft가 있으면 재생성하지 않음)
- `publishArticleToWordPressDraft`의 조건/순서 점검
- `publish_logs.details_json`을 안정된 구조로 정리
- `pipeline_logs.event_name` 기준 이벤트 정리
- 상태 코드별 오류 메시지 개선
- article 상세 페이지 UI에서 게시 상태를 더 명확히 확인 가능하도록 개선

이미지 업로드 실제 테스트와 SEO plugin 실제 write는 이번 단계에서 하지 않고
다음 단계로 미룬다 (`skipped_deferred`).

## 중복 게시 방지

`lib/repositories/publish-repository.ts`의 `getSuccessfulWordPressDraft(articleId)`가
다음 조건을 모두 만족하는 가장 최근 기록을 조회한다.

- `publish_logs.target = 'wordpress'`
- `publish_logs.status = 'success'`
- `publish_logs.external_post_id is not null`

기록이 있으면 `publishArticleToWordPressDraft`는:

1. 새 draft를 생성하지 않는다 (`createDraftPost`를 호출하지 않음).
2. `pipeline_logs`에 `wordpress_publish_skipped_duplicate`(기존)와
   `wordpress_actual_publish_skipped_duplicate`(Phase 2-9)를 함께 기록한다.
3. 이전에 생성된 `external_post_id`/`post_url`을 그대로 반환해 UI에서
   "이미 WordPress 초안이 생성되어 있어 중복 생성을 건너뜁니다" 메시지와 함께
   기존 post URL을 확인할 수 있게 한다.

`publishArticleToWordPressDraft(articleId, { force: true })` 형태로 강제
재생성이 가능하도록 함수 시그니처(`PublishArticleOptions.force`)만 준비해
두었다 — 이번 단계에서는 강제 재생성 버튼을 UI에 추가하지 않는다.

## `publishArticleToWordPressDraft` 점검 결과

기존 순서를 그대로 유지하면서 다음을 재확인/강화했다.

1. article이 존재해야 한다 (없으면 `success: false` 반환).
2. `article.status === 'reviewed'`가 아니면 `wordpress_publish_skipped_not_reviewed`와
   `wordpress_actual_publish_skipped_not_reviewed`를 함께 기록하고 중단한다.
3. `approval_logs`에 승인 기록이 없어도 동일하게 두 이벤트를 함께 기록하고 중단한다.
4. 중복 게시 판정 (위 참고).
5. `WORDPRESS_PUBLISH_ENABLED=false` → dry-run으로 처리 (실제 API 호출 없음).
6. `WORDPRESS_PUBLISH_ENABLED=true` → 실제 WordPress API 호출.
   - title은 `seo_title`(monetized_blog 모드에서 있는 경우) 우선, 없으면 `title`.
   - excerpt는 `meta_description` 우선.
   - slug가 있으면 그대로 사용.
   - post status는 `lib/publish/wordpress-client.ts`의 `createDraftPost`가
     **입력값과 무관하게 항상 `"draft"`로 고정**한다 (`CreateDraftPostInput`에는
     애초에 status 필드 자체가 없다).
   - 기사 본문(content) 전체는 WordPress API 요청에는 포함되지만,
     `publish_logs.details_json`에는 저장하지 않는다.

## `publish_logs` 저장 구조

### 성공 (`status = 'success'`)
```json
{
  "actual": true,
  "dryRun": false,
  "wordpressPostId": 123,
  "wordpressStatus": "draft",
  "title": "...",
  "slug": "...",
  "categoryCount": 2,
  "tagCount": 3,
  "mediaUpload": { "status": "skipped_deferred" },
  "seoPluginWrite": { "status": "skipped_deferred" }
}
```
`external_post_id`/`post_url`은 별도 컬럼에 저장되고, `error_message`는 `null`이다.

### dry-run (`status = 'dry_run'`)
```json
{
  "actual": false,
  "dryRun": true,
  "reason": "WORDPRESS_PUBLISH_ENABLED=false",
  "...": "기존 Phase 2-3~2-7 요약 정보(카테고리/태그/SEO/이미지)는 그대로 유지"
}
```
`external_post_id`/`post_url`은 `null`이다.

### 실패 (`status = 'failed'`)
```json
{
  "actual": true,
  "dryRun": false,
  "statusCode": 401,
  "endpointType": "wp/v2/posts",
  "reasonCandidate": [
    "username 또는 Application Password 오류",
    "Application Password 복사 오류",
    "보안 플러그인에서 REST API 인증 차단 가능성"
  ]
}
```
`error_message`(safe message)는 별도 컬럼에 저장되고, `external_post_id`/`post_url`은 `null`이다.

**절대 저장하지 않는 값**: 기사 본문 전체, Application Password, Authorization
header, Basic Auth 문자열, API key, WordPress 원본 오류 응답 본문 전체
(`responseBodyExcerpt` 등 기존에 저장하던 응답 일부 발췌도 이번 단계에서 제거했다).

## `pipeline_logs.event_name` 정리

현재 DB는 `pipeline_logs.event_name` 컬럼을 사용한다 (`stage`는 Phase 2
오케스트레이터를 위한 자리만 마련된 컬럼이며 값이 채워지지 않는다). Phase 2-9에서
기록하는 이벤트:

- `wordpress_actual_publish_started`
- `wordpress_actual_publish_completed`
- `wordpress_actual_publish_failed`
- `wordpress_actual_publish_skipped_duplicate`
- `wordpress_actual_publish_skipped_not_reviewed`
- `wordpress_actual_publish_dry_run`
- `wordpress_category_sync_completed` / `wordpress_category_sync_failed`
- `wordpress_tag_sync_completed` / `wordpress_tag_sync_failed`
- `wordpress_media_upload_skipped_deferred`
- `seo_plugin_write_skipped_deferred`

기존 Phase 2-2 이벤트(`wordpress_publish_started/completed/failed/dry_run/
skipped_not_reviewed/skipped_duplicate`)도 하위 호환을 위해 그대로 함께
기록된다 — 즉 실제 게시 시 두 세트(범용 이벤트 + Phase 2-9 상세 이벤트)가 모두
남는다.

## 오류 처리 개선

`lib/publish/publish-service.ts`의 `getPublishFailureReasonCandidates(statusCode, errorMessage)`가
연결 테스트(Phase 2-8)와 동일한 어휘로 원인 후보를 제공한다.

| 상태 | 원인 후보 |
|---|---|
| 401 | username 또는 Application Password 오류 / Application Password 복사 오류 / 보안 플러그인에서 REST API 인증 차단 가능성 |
| 403 | 사용자 권한 부족 / REST API 쓰기 권한 제한 / 보안 플러그인 차단 가능성 |
| 404 | WORDPRESS_BASE_URL 오류 / /wp-json 경로 접근 불가 / REST API 차단 가능성 |
| 5xx | WordPress 서버 오류 / 플러그인 충돌 가능성 |
| network error (statusCode 없음) | 사이트 접근 불가 / SSL 문제 / 방화벽 또는 보안 플러그인 문제 |

## 이미지 업로드 / SEO plugin write 보류 방식

- `resolveFeaturedMediaForPublish`: article에 이미 WordPress media id가 있으면
  (Phase 2-6에서 별도로 준비된 값) 그대로 `featured_media`에 연결하지만, 새로운
  업로드는 `WORDPRESS_MEDIA_UPLOAD_ENABLED` 값과 무관하게 이번 단계에서 시도하지
  않는다 — 항상 `wordpress_media_upload_skipped_deferred`로 기록한다.
- `handleSeoPluginWrite`: provider가 `none`이면 `skipped_provider_none`으로
  기록하고, 그 외에는 `SEO_PLUGIN_WRITE_ENABLED` 값과 무관하게 실제 write를
  시도하지 않고 `seo_plugin_write_skipped_deferred`로 기록한다
  (`article.seoPluginWriteStatus`는 기존 `skipped_dry_run` 값을 재사용한다).

## UI 변경점

article 상세 페이지의 **WordPress 게시** 섹션에 다음을 추가로 표시한다.

- `WORDPRESS_PUBLISH_ENABLED` 값 (`true`/`false`)
- 현재 모드 (`actual draft` / `dry-run`)
- media upload: `deferred (다음 단계 예정)`
- SEO plugin write: `deferred (다음 단계 예정)`
- 이미 생성된 draft가 있으면 "중복 생성을 건너뜁니다 (duplicate skip)" 문구
- 최근 게시 상태에 `post_url` 링크를 명시적으로 표시 (기존에는 duplicate 케이스에만 표시됨)

**공개 게시("공개 게시") 버튼은 만들지 않았다.** Application Password/
Authorization header는 여전히 어디에도 표시되지 않는다.

## Supabase 확인 SQL

```sql
-- pipeline_logs는 event_name 컬럼 기준으로 조회한다 (event 컬럼이 아님).
select event_name, status, message, details_json, created_at
from pipeline_logs
where event_name like 'wordpress_%'
order by created_at desc
limit 30;

-- WordPress 게시 결과 확인
select article_id, target, status, external_post_id, post_url, error_message, details_json, created_at
from publish_logs
where target = 'wordpress'
order by created_at desc
limit 10;

-- 중복 방지 판정에 사용되는 조건 그대로 조회 (성공 + external_post_id 존재)
select article_id, external_post_id, post_url, created_at
from publish_logs
where target = 'wordpress' and status = 'success' and external_post_id is not null
order by created_at desc;
```

## 다음 단계 제안

- 실제 media upload 연결 테스트 (이미지 파일을 실제로 WordPress media
  endpoint에 업로드).
- SEO plugin(Yoast/Rank Math/AIOSEO) 실제 write 연동.
- UI에 강제 재생성(force republish) 버튼 추가 (함수 구조는 이미 준비됨).
