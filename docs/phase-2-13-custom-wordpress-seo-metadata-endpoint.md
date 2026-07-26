# Phase 2-13: Custom WordPress SEO Metadata Endpoint

## 목적

Phase 2-12에서 표준 WordPress posts REST API(`POST /wp-json/wp/v2/posts/{id}`)
로 Rank Math SEO metadata를 반영했지만, 반영 여부가 REST 응답으로 확인되지
않아(`seo_plugin_actual_write_needs_custom_endpoint`) WordPress 쪽에
custom REST endpoint를 배포하고, 그 endpoint를 통해 `update_post_meta`로
직접 저장하는 구조를 만든다. 이번 단계는 **Rank Math 전용**이다 —
Yoast/AIOSEO의 actual write는 이번 단계에서 구현하지 않고 이후 provider로
남겨둔다.

## 왜 custom endpoint가 필요한지

표준 WordPress REST API는 `register_meta`로 등록되고 `show_in_rest`가
true인 meta key만 `posts` endpoint의 `meta` 필드로 읽고 쓸 수 있다. Rank
Math가 사용하는 `rank_math_title`/`rank_math_description`/
`rank_math_focus_keyword`는 기본적으로 이 조건을 만족하지 않는 protected
meta key다. 그 결과 표준 REST 요청은 HTTP 200으로 성공해도 실제로는 값이
저장되지 않을 수 있다(Phase 2-12에서 관찰한 현상). custom endpoint는
WordPress 서버 내부에서 직접 `update_post_meta()`/`get_post_meta()`를
호출하므로 이 제약을 우회하지 않고 정상적으로 저장/검증할 수 있다.

## Rank Math 대상인 이유

- Phase 2-12에서 반영 미확인이 관찰된 provider가 Rank Math였다.
- Yoast/AIOSEO는 저장 방식(별도 테이블, 직렬화 등)이 Rank Math와 달라 별도
  검증과 구현이 필요하다 — 범위를 명확히 하기 위해 이번 단계는 Rank Math
  전용으로 한정한다.

## WordPress plugin 설치 방법

`docs/phase-2-13-wordpress-plugin-install.md` 참고 (zip 업로드 → 활성화 →
Rank Math 활성화 확인 → 권한 확인 → endpoint 테스트).

## endpoint 구조

```
POST /wp-json/ai-pipeline/v1/seo-meta

{
  "postId": 123,
  "provider": "rank_math",
  "seoTitle": "...",
  "metaDescription": "...",
  "focusKeyword": "...",
  "secondaryKeywords": ["..."]
}
```

성공 응답:

```json
{
  "success": true,
  "postId": 123,
  "provider": "rank_math",
  "updatedKeys": ["rank_math_title", "rank_math_description", "rank_math_focus_keyword"],
  "verified": true
}
```

## permission_callback 설명

`wordpress-plugin/ai-pipeline-seo-endpoint/ai-pipeline-seo-endpoint.php`의
`ai_pipeline_seo_endpoint_permission_callback()`은 `is_user_logged_in()`
확인만으로 끝내지 않는다. 다음을 순서대로 확인한다.

1. 로그인 여부 (`is_user_logged_in()`) — 아니면 401.
2. 요청의 `postId`가 유효한 양의 정수인지 — 아니면 400.
3. `provider`가 정확히 `"rank_math"`인지 — 아니면 400.
4. 해당 `postId`의 글이 실제로 존재하는지(`get_post()`) — 아니면 404.
5. **핵심 권한 검사**: `current_user_can('edit_post', $post_id)` — 아니면
   403. `'__return_true'`는 사용하지 않는다.

callback 함수 내부에서도 동일한 권한 검사를 다시 수행한다(defense in
depth) — 혹시라도 훅 순서나 캐싱 문제로 permission_callback이 우회되는
경우에 대비한다.

## `update_post_meta` 사용 방식

callback은 입력값을 `sanitize_text_field`/`sanitize_textarea_field`로
정제한 뒤, 값이 있는 필드만 `update_post_meta($post_id, $key, $value)`로
저장한다.

| 입력 필드 | Rank Math meta key |
|---|---|
| `seoTitle` | `rank_math_title` |
| `metaDescription` | `rank_math_description` |
| `focusKeyword`(+ `secondaryKeywords`는 comma로 이어붙임) | `rank_math_focus_keyword` |

저장 직후 `get_post_meta($post_id, $key, true)`로 다시 읽어, 저장한 값이
실제로 존재하는지 확인한다(`verified` 필드). 이 재조회는 WordPress 서버
내부에서 이루어지므로 REST API의 protected meta 노출 제약을 받지 않는다.

## `.env.local` 설정

```
SEO_PLUGIN_PROVIDER=rank_math
SEO_PLUGIN_WRITE_ENABLED=true
WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED=true
WORDPRESS_SEO_CUSTOM_ENDPOINT_PATH=/wp-json/ai-pipeline/v1/seo-meta
WORDPRESS_PUBLISH_ENABLED=true
```

## Next.js에서 호출하는 흐름

1. `lib/seo/wordpress-seo-custom-endpoint-client.ts`의
   `updateRankMathSeoViaCustomEndpoint(input)`이 `WORDPRESS_BASE_URL` +
   `WORDPRESS_SEO_CUSTOM_ENDPOINT_PATH`로 Basic Auth POST 요청을 보낸다.
2. `lib/seo/seo-plugin-actual-write-service.ts`의
   `writeSeoPluginMetadataToWordPress(articleId)`는 `SEO_PLUGIN_PROVIDER=
   rank_math`이고 `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED=true`이면 표준 REST
   posts meta update 대신 이 custom endpoint를 **우선 사용**한다.
3. custom endpoint가 비활성화되어 있으면(fallback) 기존 표준 REST posts meta
   update 방식을 그대로 사용한다.
4. custom endpoint 호출이 실패하면 표준 REST 방식으로 fallback하지 않고
   실패를 그대로 저장한다 — 어떤 경로가 실제로 반영했는지 혼동을 막기
   위함이다.
5. 전용 버튼("Rank Math custom endpoint로 SEO 반영")은
   `writeRankMathSeoViaCustomEndpoint(articleId)`를 직접 호출해 항상
   custom endpoint 경로만 시도한다(provider가 rank_math가 아니거나
   custom endpoint가 비활성화되어 있으면 skip).

## articles 저장 필드

- `seo_plugin_custom_endpoint_status`: `not_attempted` / `skipped_disabled`
  / `skipped_provider_not_supported` / `skipped_no_wordpress_post` /
  `success` / `failed`
- `seo_plugin_custom_endpoint_verified` (boolean)
- `seo_plugin_custom_endpoint_error`, `seo_plugin_custom_endpoint_attempted_at`

성공 시 `seo_plugin_actual_write_status`/`_verified`/`_warning`(Phase
2-12 컬럼)도 함께 `success`/`true`/`null`로 갱신된다.

## publish_logs 저장 구조

`target = 'wordpress_seo_custom_endpoint'`.

성공:
```json
{
  "actual": true,
  "provider": "rank_math",
  "endpoint": "ai-pipeline/v1/seo-meta",
  "updatedKeys": ["rank_math_title", "rank_math_description", "rank_math_focus_keyword"],
  "verified": true
}
```

실패:
```json
{
  "actual": true,
  "provider": "rank_math",
  "statusCode": 403,
  "reasonCandidate": ["사용자 권한 부족 (edit_post 권한 필요)", "..."],
  "verified": false
}
```

## Supabase 확인 SQL

```sql
-- pipeline_logs는 event_name 컬럼 기준으로 조회한다.
select event_name, status, message, details_json, created_at
from pipeline_logs
where event_name like 'seo_plugin_custom_endpoint_%'
order by created_at desc
limit 30;

-- custom endpoint 결과 확인 (target = wordpress_seo_custom_endpoint)
select article_id, target, status, external_post_id, post_url, error_message, details_json, created_at
from publish_logs
where target = 'wordpress_seo_custom_endpoint'
order by created_at desc
limit 10;

-- article에 저장된 상태 확인
select id, title, seo_plugin_custom_endpoint_status, seo_plugin_custom_endpoint_verified,
       seo_plugin_custom_endpoint_error, seo_plugin_custom_endpoint_attempted_at,
       seo_plugin_actual_write_status, seo_plugin_actual_write_verified
from articles
where id = '<article_id>';
```

## WordPress 관리자에서 확인하는 방법

1. WordPress 관리자 화면 → **글(Posts)** → 해당 draft를 연다.
2. Rank Math 메타박스에서 SEO 제목/메타 설명/포커스 키워드가 반영되었는지
   확인한다.
3. 글 상태가 여전히 **초안(Draft)**인지 확인한다.

## 보안 주의사항

- `permission_callback`은 절대 `'__return_true'`를 사용하지 않으며, 대상
  글에 대한 `edit_post` 권한을 명시적으로 확인한다.
- Application Password, Authorization header, Basic Auth 문자열, API key는
  요청/응답/로그 어디에도 포함되지 않는다.
- `publish_logs.details_json`에는 기사 본문 전체나 WordPress 원본 응답
  본문 전체를 저장하지 않는다.
- WordPress post status는 이번 단계에서도 변경하지 않는다(이 endpoint는
  post meta만 갱신하며 status 필드 자체를 다루지 않는다).
- 브라우저 자동화(headless browser 등)는 사용하지 않는다.
- WordPress 보안 설정/플러그인 정책을 우회하지 않는다 — 권한이 없으면
  403을 그대로 반환한다.
- `.env.local`은 절대 커밋하지 않는다.

## 오류 대응

| 상태 | 원인 후보 |
|---|---|
| 401 | username 또는 Application Password 오류 |
| 403 | 사용자 권한 부족(edit_post 필요) / REST API 쓰기 권한 제한 / 보안 플러그인 차단 |
| 404 | `WORDPRESS_SEO_CUSTOM_ENDPOINT_PATH` 오류 / 플러그인이 활성화되지 않음 |
| 5xx | WordPress 서버 오류 / custom plugin 코드 오류 가능성 |
| network error | 사이트 접근 불가 / SSL 문제 / 방화벽 또는 보안 플러그인 문제 |
| verified:false | plugin이 저장 직후 재조회에 실패 — WordPress 쪽 meta 저장 자체를 재확인 필요 |

## 다음 단계 제안

- Yoast/AIOSEO 전용 custom endpoint(또는 통합 endpoint에 provider 분기 추가).
- custom plugin의 자동 배포/버전 관리 절차 마련.
- article 공개(published) 흐름 설계(MVP 이후 범위).
