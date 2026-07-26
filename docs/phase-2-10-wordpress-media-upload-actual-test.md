# Phase 2-10: WordPress Media Upload Actual Test

## 목적

Phase 2-9에서 안정화한 WordPress draft publish 흐름을 바탕으로, 실제
WordPress Media Library에 이미지 1개를 업로드하는 기능을 테스트한다. 이번
단계에서도 공개(publish)는 절대 수행하지 않으며, post status는 항상 draft로
유지된다. SEO plugin 실제 write, Tistory/Naver/custom publishing은 여전히
범위 밖이다.

## 사전 조건

- Phase 2-9 WordPress Draft Publish Stabilization 완료.
- WordPress 연결 테스트(Phase 2-8) 성공.
- WordPress draft post 생성 성공(Phase 2-2/2-9).
- article에 실제 업로드 가능한 이미지 source가 있어야 한다 — 즉 다음 중 하나가
  http/https 절대 URL이거나, 로컬 파일 경로가 존재해야 한다.
  - `generated_image_url` (상태가 `generated`/`reviewed`일 때)
  - `featured_image_source_url`
  - `featured_image_local_path`

## `.env.local` 설정

```
WORDPRESS_BASE_URL=https://example-blog.com
WORDPRESS_USERNAME=content-bot
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
WORDPRESS_PUBLISH_ENABLED=true
WORDPRESS_MEDIA_UPLOAD_ENABLED=true
SEO_PLUGIN_WRITE_ENABLED=false
```

`WORDPRESS_MEDIA_UPLOAD_ENABLED=false`(기본값)이면 실제 업로드를 전혀 시도하지
않는다. `.env.example`에는 실제 값을 넣지 않으며, `.env.local`은 절대 커밋하지
않는다.

## 지원 sourceType

`lib/publish/wordpress-media-upload-service.ts`의 `resolveUploadSource()`가
다음 우선순위로 source를 결정한다.

1. `generated_image_status`가 `generated` 또는 `reviewed`이고
   `generated_image_url`이 http/https 절대 URL이면 → `generated_url`
2. 아니면 `featured_image_source_url`이 http/https 절대 URL이면 →
   `external_url`
3. 아니면 `featured_image_local_path`가 있으면 → `local_file`
4. 모두 해당하지 않으면 → `none` (`wordpress_media_upload_skipped_no_source`)

## mock URL은 실제 업로드 불가

mock 이미지 생성 provider(`IMAGE_GENERATION_PROVIDER=mock`)가 만드는 URL은
`/mock/generated-images/{articleId}.webp`처럼 **상대경로**다. `isRealHttpUrl()`이
http/https로 시작하는 절대 URL만 허용하므로, mock URL은 candidate에서
자동으로 제외된다. 다른 유효한 source도 없다면:

- 후보 자체가 없으면 → `wordpress_media_upload_skipped_no_source`
- mock/상대경로만 있으면(즉 후보는 있었지만 사용할 수 없으면) →
  `wordpress_media_source_invalid`

두 경우 모두 실제 fetch를 호출하지 않고 안전하게 종료한다.

## WordPress Media REST API 사용 방식

`lib/publish/wordpress-client.ts`의 `uploadMediaToWordPress()`:

1. `WORDPRESS_BASE_URL`을 normalize(trailing slash 제거)한다.
2. `WORDPRESS_USERNAME`/`WORDPRESS_APP_PASSWORD`가 없으면 실제 fetch 없이
   안전하게 실패를 반환한다.
3. `image/jpeg`/`image/png`/`image/webp`만 허용하며, 그 외 MIME type은 실제
   fetch 없이 `failed`를 반환한다.
4. source가 URL이면 `fetch(sourceUrl)`로 이미지를 다운로드하고, `local_file`이면
   `node:fs/promises`의 `readFile`로 로컬 파일을 읽는다.
5. `POST {baseUrl}/wp-json/wp/v2/media`에 binary를 `Content-Type`/
   `Content-Disposition: attachment; filename="..."` 헤더와 함께 전송한다.
6. 성공하면 응답에서 `id`/`source_url`(또는 `link`)/`mime_type`/`media_type`/
   `title.rendered`만 추려서 반환한다.
7. 성공 직후 `POST {baseUrl}/wp-json/wp/v2/media/{id}`로 alt text/caption을
   갱신한다 (아래 참고). 이 요청이 실패해도 업로드 성공 자체는 무효화되지
   않는다 (warning으로만 기록).

Authorization header, Application Password, 응답 원본 본문 전체, 이미지
binary는 어떤 경우에도 반환값이나 로그에 포함되지 않는다.

## alt text/caption 저장 방식

업로드 성공 후 다음 값으로 media item metadata를 갱신한다.

| WordPress media 필드 | 소스 |
|---|---|
| `alt_text` | `article.featuredImageAltText` |
| `caption` | `article.featuredImageCaption` |
| `description` | `article.featuredImageCaption` 우선, 없으면 `seo_title` 또는 `title` |
| `title` | `article.seoTitle` 우선, 없으면 `article.title` |

## articles 테이블 반영

업로드 성공 시 (`lib/repositories/article-repository.ts`의
`saveFeaturedImageUploadResult`):

- `featured_image_upload_status = 'uploaded'`
- `featured_image_wordpress_media_id = <media id>`
- `featured_image_wordpress_url = <source_url>`
- `featured_image_source_type = 'uploaded'`
- `featured_image_upload_error = null`
- `featured_image_upload_attempted_at = now()`

업로드 실패 시:

- `featured_image_upload_status = 'failed'`
- `featured_image_upload_error = <safe error message>`
- `featured_image_upload_attempted_at = now()`

## Supabase 확인 SQL

```sql
-- pipeline_logs는 event_name 컬럼 기준으로 조회한다.
select event_name, status, message, details_json, created_at
from pipeline_logs
where event_name like 'wordpress_media_%'
order by created_at desc
limit 30;

-- 실제 media 업로드 결과 확인 (target = wordpress_media)
select article_id, target, status, external_post_id, post_url, error_message, details_json, created_at
from publish_logs
where target = 'wordpress_media'
order by created_at desc
limit 10;

-- article에 저장된 업로드 결과 확인
select id, title, featured_image_upload_status, featured_image_wordpress_media_id,
       featured_image_wordpress_url, featured_image_source_type, featured_image_upload_error,
       featured_image_upload_attempted_at
from articles
where id = '<article_id>';
```

## WordPress 관리자에서 확인하는 방법

1. WordPress 관리자 화면 → **미디어(Media)** 메뉴로 이동한다.
2. 방금 업로드한 이미지가 목록에 있는지 확인한다 (파일명은
   `{slug}-featured.{ext}` 또는 `article-{id 앞 8자}-featured.{ext}` 형식).
3. 이미지를 클릭해 **대체 텍스트(alt text)**와 **캡션**이 올바르게 채워졌는지
   확인한다.
4. 연결된 draft post(있는 경우)에서 대표 이미지로 설정되어 있는지 확인한다.

## 오류 코드별 대응

| 상태 | 원인 후보 |
|---|---|
| 401 | username 또는 Application Password 오류 / Application Password 복사 오류 / 보안 플러그인 인증 차단 가능성 |
| 403 | 사용자 권한 부족 / REST API 쓰기 권한 제한 / 보안 플러그인 차단 가능성 |
| 404 | WORDPRESS_BASE_URL 오류 / `/wp-json` 경로 접근 불가 / REST API 차단 가능성 |
| 5xx | WordPress 서버 오류 / 플러그인 충돌 가능성 |
| network error | 사이트 접근 불가 / SSL 문제 / 방화벽 또는 보안 플러그인 문제 |
| 허용되지 않는 MIME type | image/jpeg, image/png, image/webp 이외 형식 — 업로드 전에 이미지 형식을 변환해야 한다 |
| mock/상대경로 이미지 | 실제 이미지 생성(Phase 2-7 실제 provider) 또는 외부 URL을 먼저 준비해야 한다 |

## 보안 주의사항

- Authorization header, Application Password, API key는 어떤 응답/로그/UI에도
  노출되지 않는다.
- 이미지 binary는 로그에 저장되지 않는다 (`publish_logs.details_json`에는
  파일명/MIME type/media id 등 메타데이터만 저장).
- WordPress 원본 오류 응답 본문 전체는 저장하지 않는다 (`statusCode`와 안전한
  요약 메시지만 저장).
- WordPress post status는 이번 단계에서도 항상 draft로 강제된다 — 공개 게시는
  수행하지 않는다.
- `.env.local`은 절대 커밋하지 않는다.

## 다음 단계 제안

- SEO plugin(Yoast/Rank Math/AIOSEO) 실제 write 연동.
- 여러 이미지(본문 내 삽입 이미지 등) 업로드 지원.
- 업로드된 이미지의 WordPress 미디어 라이브러리 정리/삭제 기능.
