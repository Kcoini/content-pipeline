# Phase 2-12: SEO Plugin Actual Metadata Test

## 목적

Phase 2-4에서 준비한 SEO plugin metadata payload(`seo_title`/`meta_description`/
`target_keyword`)를 실제 WordPress draft post에 반영하는 테스트를 한다.
이번 단계에서는 SEO plugin provider 하나만 선택해서(Rank Math / Yoast /
AIOSEO 중 하나) actual write를 테스트한다. 공개(publish)는 절대 수행하지
않고, 이미 생성된 WordPress draft post의 SEO metadata만 업데이트한다.

## 사전 조건

- Phase 2-4 SEO plugin metadata mapping 완료 (`seo_title`/`meta_description`/
  `target_keyword`/`seo_plugin_payload` 준비됨).
- Phase 2-8/2-9 WordPress 실제 draft publish 및 안정화 완료.
- WordPress draft post가 이미 생성되어 있어야 한다(`publish_logs.target=
  'wordpress'`, `status='success'`, `external_post_id`가 있는 기록).

## provider 선택 방법

`SEO_PLUGIN_PROVIDER` 환경변수로 테스트할 provider를 하나만 지정한다.
`none`/`yoast`/`rank_math`/`aioseo` 중 하나이며, 잘못된 값이면 `none`으로
안전하게 대체된다(`lib/seo/seo-plugin-config.ts`). 여러 plugin을 동시에
write하지 않으며, 실행 중 provider를 바꾸려면 `.env.local`을 수정하고
서버를 재시작해야 한다.

## `.env.local` 설정

```
SEO_PLUGIN_PROVIDER=rank_math
SEO_PLUGIN_WRITE_ENABLED=true
WORDPRESS_PUBLISH_ENABLED=true
WORDPRESS_MEDIA_UPLOAD_ENABLED=false
```

## Rank Math / Yoast / AIOSEO 차이

`lib/publish/wordpress-client.ts`의 `updateSeoPluginMetadata`가 provider별로
다음 post meta key 후보를 사용한다.

| Provider | title | description | focus keyword |
|---|---|---|---|
| Rank Math | `rank_math_title` | `rank_math_description` | `rank_math_focus_keyword` |
| Yoast | `_yoast_wpseo_title` | `_yoast_wpseo_metadesc` | `_yoast_wpseo_focuskw` |
| AIOSEO | `_aioseo_title` | `_aioseo_description` | `_aioseo_keywords` |

요청 payload는 항상 `{"status": "draft", "meta": {...}}` 형태이며, status는
입력값과 무관하게 항상 `"draft"`로 고정된다.

## 왜 actual write가 실패하거나 반영 확인이 안 될 수 있는지

WordPress REST API는 기본적으로 **등록(register_meta)되고 `show_in_rest`가
true인 meta key만** `POST /wp-json/wp/v2/posts/{id}`의 `meta` 필드로 읽고 쓸
수 있다. Yoast/Rank Math/AIOSEO는 버전과 설정에 따라 이 조건을 만족하지
않는 protected meta key를 사용하는 경우가 있다. 이 경우:

- HTTP 요청 자체는 200 OK로 성공할 수 있다(WordPress가 알 수 없는 meta key를
  조용히 무시하기 때문).
- 그러나 실제로 plugin UI/DB에는 값이 반영되지 않을 수 있다.

이 때문에 이번 단계는 **write 요청 성공만으로 실제 반영을 단정하지 않는다.**

## protected post meta와 REST API 노출 문제 / 반영 검증 방식

write 직후 `GET /wp-json/wp/v2/posts/{postId}?context=edit`로 다시 조회해
(`verifySeoPluginMetadata`), 응답의 `meta` 필드에 방금 시도한 key가 실제로
존재하는지 확인한다.

- 모든 key가 존재하면 → `verified: true`, `seo_plugin_actual_write_status
  = 'success'`.
- 하나라도 없으면 → `verified: false`, warning 문구
  ("SEO meta may have been accepted but is not exposed in REST response")와
  함께 `seo_plugin_actual_write_status = 'needs_custom_endpoint'`로 기록된다.

## custom endpoint가 필요한 경우

다음 경우 표준 REST posts meta update만으로는 충분하지 않을 수 있다.

- SEO plugin이 protected meta key를 사용하고 `register_meta`로 REST에
  노출하지 않은 경우.
- plugin이 post meta가 아닌 별도 테이블/직렬화 구조로 저장하는 경우
  (예: 일부 AIOSEO 버전).
- 사이트에 보안 플러그인이 REST API의 meta 갱신을 차단하는 경우.

이번 단계에서는 WordPress 쪽에 custom plugin/endpoint를 만들지 않는다.
필요한 경우 다음 단계에서 다음과 같은 방향을 검토할 수 있다.

- WordPress 관리자 계정에 소규모 mu-plugin을 배포해 `register_meta`로 필요한
  key의 `show_in_rest`를 true로 만들거나,
  REST 인증된 사용자만 호출 가능한 custom REST route(`register_rest_route`)를
  추가해 plugin 내부 update 함수(`update_post_meta` 또는 plugin 전용 API)를
  직접 호출하게 한다.
- 이 문서는 그 설계를 위한 참고 자료로 유지한다.

## articles 저장 필드

- `seo_plugin_actual_write_status`: `not_attempted` / `skipped_disabled` /
  `skipped_provider_none` / `skipped_no_wordpress_post` / `success` /
  `failed` / `needs_custom_endpoint`
- `seo_plugin_actual_write_provider`, `seo_plugin_actual_write_post_id`
- `seo_plugin_actual_write_error`, `seo_plugin_actual_write_attempted_at`
- `seo_plugin_actual_write_verified` (boolean), `seo_plugin_actual_write_warning`

## Supabase 확인 SQL

```sql
-- pipeline_logs는 event_name 컬럼 기준으로 조회한다.
select event_name, status, message, details_json, created_at
from pipeline_logs
where event_name like 'seo_plugin_actual_write_%'
order by created_at desc
limit 30;

-- SEO plugin 실제 write 결과 확인 (target = wordpress_seo_plugin)
select article_id, target, status, external_post_id, post_url, error_message, details_json, created_at
from publish_logs
where target = 'wordpress_seo_plugin'
order by created_at desc
limit 10;

-- article에 저장된 write 상태 확인
select id, title, seo_plugin_actual_write_status, seo_plugin_actual_write_provider,
       seo_plugin_actual_write_post_id, seo_plugin_actual_write_verified,
       seo_plugin_actual_write_warning, seo_plugin_actual_write_error,
       seo_plugin_actual_write_attempted_at
from articles
where id = '<article_id>';
```

## WordPress 관리자에서 확인하는 방법

1. WordPress 관리자 화면 → **글(Posts)** → 해당 draft를 연다.
2. 사용 중인 SEO plugin의 메타박스(Rank Math/Yoast/AIOSEO 편집 패널)에서
   SEO 제목/메타 설명/포커스 키워드가 반영되었는지 확인한다.
3. 반영되지 않았다면 plugin 설정에서 해당 meta key가 REST API에 노출되도록
   등록되어 있는지 확인이 필요하다(플러그인/개발자 문서 참고).
4. 글 상태가 여전히 **초안(Draft)**인지 확인한다(공개되지 않았는지).

## 오류 대응

| 상태 | 원인 후보 |
|---|---|
| 401 | username 또는 Application Password 오류 / 보안 플러그인 인증 차단 가능성 |
| 403 | 사용자 권한 부족 / REST API 쓰기 권한 제한 |
| 404 | post id가 존재하지 않거나 삭제됨 / WORDPRESS_BASE_URL 오류 |
| 5xx | WordPress 서버 오류 / 플러그인 충돌 가능성 |
| network error | 사이트 접근 불가 / SSL 문제 / 방화벽 또는 보안 플러그인 문제 |
| 반영 미확인(needs_custom_endpoint) | protected meta key가 REST에 노출되지 않음 — custom endpoint 검토 필요 |

## 보안 주의사항

- Application Password, Authorization header, Basic Auth 문자열, API key는
  어떤 응답/로그/UI에도 노출되지 않는다.
- `publish_logs.details_json`에는 기사 본문 전체를 저장하지 않는다.
- WordPress 원본 오류 응답 본문 전체는 저장하지 않는다(안전한 요약 메시지와
  `statusCode`만 저장).
- WordPress post status는 이번 단계에서도 항상 `draft`로 강제된다.
- 브라우저 자동화(headless browser 등)는 사용하지 않는다 — 표준 REST API
  호출만 사용한다.
- WordPress 플러그인 약관이나 보안 설정을 우회하지 않는다 — REST API가
  거부하면 그대로 실패로 처리하고 우회를 시도하지 않는다.
- `.env.local`은 절대 커밋하지 않는다.

## 다음 단계 제안

- `needs_custom_endpoint` 케이스를 위한 mu-plugin/custom REST route 설계 및
  구현.
- article.status가 `published`로 전환되는 실제 공개 흐름 설계(MVP 이후 범위).
- 여러 WordPress 사이트/provider 조합에 대한 회귀 테스트 확장.
