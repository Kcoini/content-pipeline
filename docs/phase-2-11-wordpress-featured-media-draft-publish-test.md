# Phase 2-11: WordPress Featured Media Draft Publish Test

## 목적

Phase 2-10에서 실제 업로드된 WordPress media id(`articles.featured_image_
wordpress_media_id`)를 WordPress draft post의 `featured_media` 필드에
연결한다. 이번 단계에서도 실제 공개(publish)는 수행하지 않으며, WordPress
post status는 항상 `draft`로 유지된다. SEO plugin 실제 write, Tistory/Naver/
custom publishing은 여전히 범위 밖이다.

## 사전 조건

- Phase 2-9 WordPress Draft Publish Stabilization 완료.
- Phase 2-10 WordPress Media Upload Actual Test 완료(또는 진행 중) —
  `articles.featured_image_wordpress_media_id`/`featured_image_wordpress_url`에
  값이 저장되어 있어야 실제 연결을 시도할 수 있다.
- WordPress draft post가 이미 생성되어 있어야 한다(`publish_logs.target=
  'wordpress'`, `status='success'`, `external_post_id`가 있는 기록).

## `.env.local` 설정

```
WORDPRESS_BASE_URL=https://example-blog.com
WORDPRESS_USERNAME=content-bot
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
WORDPRESS_PUBLISH_ENABLED=true
WORDPRESS_MEDIA_UPLOAD_ENABLED=true
SEO_PLUGIN_WRITE_ENABLED=false
```

## featured_media 연결 방식

새 draft를 생성할 때와, 이미 만들어진 draft를 갱신할 때 두 가지 경로가 있다.

### 새 draft가 없을 때(create)

`lib/publish/publish-service.ts`의 `publishArticleToWordPressDraft`가 담당한다.
`resolveFeaturedMediaForPublish`가 `article.featuredImageWordpressMediaId`가
있으면 그 값을 `createDraftPost`의 `featuredMedia`로 전달하고, 없으면
`featured_media` 필드 자체를 보내지 않는다. 성공 시 `publish_logs.details_json`에
다음 요약이 저장된다.

```json
{
  "actual": true,
  "dryRun": false,
  "wordpressStatus": "draft",
  "featuredMedia": {
    "included": true,
    "mediaId": 42,
    "mediaUrl": "https://example-blog.com/wp-content/uploads/photo.webp",
    "mode": "create_draft"
  }
}
```

media id가 없으면 `featuredMedia.included=false`, `mediaId=null`로 기록된다.

### 기존 draft가 있을 때(update)

`lib/publish/wordpress-featured-media-service.ts`의
`attachFeaturedMediaToDraft(articleId)`가 담당한다.

1. `article.featuredImageWordpressMediaId`가 유효한 양의 정수인지 확인한다.
2. `publish_logs`에서 `target='wordpress'`, `status='success'`,
   `external_post_id is not null`인 기존 draft를 찾는다
   (`getSuccessfulWordPressDraft`, Phase 2-9에서 만든 중복 방지 조회 함수 재사용).
3. (선택적 사전 검증) `GET /wp-json/wp/v2/media/{mediaId}`로 media item이
   실제로 존재하는지 확인한다 — 실패하면 연결을 중단한다.
4. `POST /wp-json/wp/v2/posts/{postId}`에 `{ "status": "draft", "featured_media":
   mediaId }`만 전송한다(`lib/publish/wordpress-client.ts`의
   `updateDraftFeaturedMedia`). status는 입력값과 무관하게 항상 `"draft"`로
   고정된다.
5. 성공하면 `articles.wordpress_featured_media_attach_status='attached'`와
   `publish_logs`(target=`wordpress_featured_media`, status=`success`)를
   저장한다.

## media id 없음 처리

`article.featuredImageWordpressMediaId`가 없거나 0 이하/정수가 아니면:

- 실제 API를 호출하지 않는다.
- `articles.wordpress_featured_media_attach_status = 'skipped_no_media_id'`로
  저장한다.
- `pipeline_logs`에 `wordpress_featured_media_attach_skipped_no_media_id`를
  기록한다.
- `publish_logs`에 `target='wordpress_featured_media'`, `status='skipped'`,
  `details_json.reason='no_media_id'`로 기록한다.
- UI의 "대표 이미지 초안 글에 연결" 버튼은 비활성화되고 경고 문구가 표시된다.

기존 draft 자체가 없는 경우(아직 `WordPress 초안 생성`을 실행하지 않은 경우)에는
`wordpress_featured_media_existing_draft_not_found`를 기록하고, 사용자에게
먼저 draft를 생성하라는 안내 메시지를 반환한다 — 이 경우 새 post를 만들지
않는다(중복 draft 방지, Phase 2-9 원칙 유지).

## WordPress 관리자에서 확인하는 방법

1. WordPress 관리자 화면 → **글(Posts)** → 해당 draft를 연다.
2. 우측 사이드바의 **대표 이미지(Featured Image)**에 방금 연결한 이미지가
   표시되는지 확인한다.
3. 글 상태가 여전히 **초안(Draft)**인지 확인한다(공개되지 않았는지).
4. **미디어(Media)** 메뉴에서 해당 media item이 이 글에 연결되어 있는지
   확인할 수 있다(media item 상세 화면의 "이 항목을 사용하는 곳" 유사 정보).

## Supabase 확인 SQL

```sql
-- pipeline_logs는 event_name 컬럼 기준으로 조회한다.
select event_name, status, message, details_json, created_at
from pipeline_logs
where event_name like 'wordpress_featured_media_%'
   or event_name like 'wordpress_media_item_validation_%'
order by created_at desc
limit 30;

-- featured_media 연결 결과 확인 (target = wordpress_featured_media)
select article_id, target, status, external_post_id, post_url, error_message, details_json, created_at
from publish_logs
where target = 'wordpress_featured_media'
order by created_at desc
limit 10;

-- article에 저장된 연결 상태 확인
select id, title, featured_image_wordpress_media_id, featured_image_wordpress_url,
       wordpress_featured_media_attach_status, wordpress_featured_media_attached_at,
       wordpress_featured_media_attach_error
from articles
where id = '<article_id>';

-- 기존 draft(중복 방지에도 사용하는 동일 조건) 확인
select article_id, external_post_id, post_url, created_at
from publish_logs
where target = 'wordpress' and status = 'success' and external_post_id is not null
order by created_at desc;
```

## 오류 코드별 대응

| 상태 | 원인 후보 |
|---|---|
| 401 | username 또는 Application Password 오류 / Application Password 복사 오류 / 보안 플러그인 인증 차단 가능성 |
| 403 | 사용자 권한 부족 / REST API 쓰기 권한 제한 / 보안 플러그인 차단 가능성 |
| 404 (post) | post id가 존재하지 않거나 삭제됨 / WORDPRESS_BASE_URL 오류 |
| 404 (media) | media id가 존재하지 않거나 삭제됨 — 다시 업로드해야 한다 |
| 5xx | WordPress 서버 오류 / 플러그인 충돌 가능성 |
| network error | 사이트 접근 불가 / SSL 문제 / 방화벽 또는 보안 플러그인 문제 |

## 보안 주의사항

- Application Password, Authorization header, Basic Auth 문자열, API key는
  어떤 응답/로그/UI에도 노출되지 않는다.
- 이미지 binary는 이 단계에서 다루지 않는다(이미 Phase 2-10에서 업로드된 media
  id만 참조).
- `publish_logs.details_json`에는 기사 본문 전체를 저장하지 않는다.
- WordPress 원본 오류 응답 본문 전체는 저장하지 않는다(안전한 요약 메시지와
  `statusCode`만 저장).
- WordPress post status는 이번 단계에서도 항상 `draft`로 강제된다 — 공개 게시는
  수행하지 않는다.
- `.env.local`은 절대 커밋하지 않는다.

## 다음 단계 제안

- SEO plugin(Yoast/Rank Math/AIOSEO) 실제 write 연동.
- UI에 강제 재생성(force republish) 버튼 추가.
- 여러 이미지(본문 내 삽입 이미지 등) 업로드 및 연결 지원.
