# Phase 2-6: WordPress Media Upload Preparation

## 목적

Phase 2-5에서 준비한 featured image metadata(prompt/alt text/caption/style)를
바탕으로, 나중에 실제 WordPress media upload와 `featured_media` 설정을 할 수
있도록 구조를 준비한다. 이번 단계에서는 실제 이미지 생성이나 실제 WordPress
media upload를 실행하지 않는다 — 업로드 payload 준비, dry-run 확인, media id
연결 구조만 만든다.

## Phase 2-5와의 관계

```
Phase 2-5: featured_image_prompt / alt_text / caption / style / aspect_ratio 준비
              │
              ▼
Phase 2-6: 위 정보를 WordPress media endpoint(/wp-json/wp/v2/media)에
           전달할 형태(filename, mimeType, title, description 등)로 변환하고
           저장한다 (WordPressMediaUploadPayload).
```

Phase 2-5의 metadata가 "이미지가 어떤 내용이어야 하는가"를 정의한다면,
Phase 2-6은 "그 정보를 WordPress에 실제로 올릴 때 어떤 요청 형태가 되어야
하는가"를 준비한다. 실제 이미지 파일은 이 단계에서도 존재하지 않을 수 있다
(`featured_image_source_type='none'`이 기본값이며, 이 상태에서도 dry-run
payload는 만들 수 있다).

## media upload payload 구조

`lib/publish/wordpress-media-types.ts`의 `WordPressMediaUploadPayload`:

```ts
{
  articleId: string;
  sourceType: "none" | "generated_url" | "external_url" | "local_file" | "uploaded";
  sourceUrl?: string;
  localPath?: string;
  filename: string;
  mimeType: string;
  altText: string;
  caption: string;
  title: string;
  description: string;
  aspectRatio: string;
  shouldSetAsFeatured: boolean;
  dryRun: boolean;
  wordpressMediaId?: number;
  wordpressUrl?: string;
}
```

`lib/publish/wordpress-media-preparation-service.ts`의
`prepareWordPressMediaUpload(articleId)`가 article의 featured image
metadata(Phase 2-5)로부터 이 payload를 만들어 `articles.featured_image_
upload_payload`(jsonb)에 저장하고, `featured_image_upload_status`를
`'prepared'`로 전환한다.

## filename 생성 규칙

`lib/publish/wordpress-media-config.ts`의 `getDefaultImageFilename()`:

- slug가 있으면: `{slug}-featured.{ext}` (예: `long-term-care-guide-featured.webp`)
- slug가 없으면: `article-{id 앞 8자}-featured.{ext}` (예: `article-a1b2c3d4-featured.webp`)
- 확장자는 기본 `webp`이며, `jpg`/`jpeg`/`png` 중 하나로 지정할 수 있다.
- 파일명은 **한글을 포함하지 않는 ASCII 안전 문자열**로 만든다
  (`lib/seo/slugify.ts`의 `slugify(source, { allowKorean: false })`) — URL
  slug와 달리 파일명은 서버/파일시스템 인코딩 문제를 피하기 위해 항상
  ASCII로 제한한다.
- 전체 길이는 80자를 넘지 않도록 자른다.

## alt text/caption을 WordPress media에 사용하는 방식

WordPress media 객체에는 `alt_text`, `caption`, `title`, `description` 필드가
있다. Phase 2-6은 이를 다음과 같이 매핑한다:

| WordPress media 필드 | 소스 |
|---|---|
| `alt_text` | `article.featuredImageAltText` (Phase 2-5) |
| `caption` | `article.featuredImageCaption` (Phase 2-5) |
| `title` | `featuredImageAltText` 우선, 없으면 `seoTitle`/`title` |
| `description` | `featuredImageCaption`과 동일 |

실제 이미지 파일이 없어도 이 텍스트 필드들은 항상 준비할 수 있다.

## dry-run mode 동작

- **payload 준비 자체**는 `WORDPRESS_PUBLISH_ENABLED`/`WORDPRESS_MEDIA_UPLOAD_
  ENABLED` 값과 무관하게 항상 동작한다 (실제 API 호출이 없기 때문).
- **업로드 dry-run 확인**(`confirmWordPressMediaUploadDryRun`)은
  `lib/publish/wordpress-client.ts`의 `uploadMediaToWordPress` stub을
  호출한다:
  - `WORDPRESS_MEDIA_UPLOAD_ENABLED=false`(기본값) → `skipped` 반환,
    실제 fetch 호출 없음, `featured_image_upload_status='skipped'`
  - `WORDPRESS_MEDIA_UPLOAD_ENABLED=true`이지만 `WORDPRESS_PUBLISH_
    ENABLED=true`가 아니면 → `dry_run` 반환, 실제 fetch 호출 없음,
    `featured_image_upload_status='dry_run'`
  - 두 플래그가 모두 true여도 → 실제 파일 업로드는 아직 구현되지 않아
    `failed` 반환 (안전장치)
- Phase 2-2 WordPress draft publish dry-run(`WORDPRESS_PUBLISH_ENABLED=false`)
  에서는 `publish_logs.details.featuredImageUpload`에 다음 요약이 포함된다
  (prompt 전체나 이미지 파일은 포함하지 않는다):

```json
{
  "uploadStatus": "prepared",
  "sourceType": "none",
  "filename": "long-term-care-guide-featured.webp",
  "mimeType": "image/webp",
  "altText": "...",
  "caption": "...",
  "shouldSetAsFeatured": true,
  "wordpressMediaId": null,
  "wouldAttachAsFeatured": false
}
```

## 왜 실제 media upload를 아직 하지 않는지

- 실제 업로드는 이미지 파일 자체(생성된 이미지 또는 다운로드한 외부 이미지)가
  필요한데, Phase 2-5까지는 prompt만 존재하고 실제 이미지 파일이 없다.
- WordPress media endpoint는 `multipart/form-data`로 바이너리를 전송해야
  하므로, JSON 기반의 기존 `createDraftPost`/`findOrCreateCategory` 등과
  구현 방식이 다르다 — 별도의 파일 read/streaming 처리가 필요하다.
- 사람이 먼저 payload(파일명, alt text, caption 등)를 검토한 뒤 실제 업로드로
  넘어가는 것이 안전하다 (Human Approval 원칙과 일관, Phase 2-5와 동일한
  이유).
- `lib/publish/wordpress-client.ts`의 `uploadMediaToWordPress`는 이 확인이
  끝나기 전까지 항상 `skipped`/`dry_run`/`failed`만 반환하는 safe stub이다.

## featured_media 연결 구조

1. `lib/images/featured-image-uploader.ts`의 `resolveExistingFeaturedMediaId`가
   `article.featuredImageWordpressMediaId`가 있으면 그대로 반환한다 (Phase 2-5에서
   이미 준비된 구조).
2. `lib/publish/publish-service.ts`의 `resolveFeaturedMediaForPublish`가 이 값을
   가져와 `createDraftPost`의 `featuredMedia`로 전달한다
   (`lib/publish/wordpress-client.ts`의 `CreateDraftPostInput.featuredMedia`가
   WordPress post의 `featured_media` 필드로 매핑된다).
3. media id가 없으면(현재 항상 없음) `featured_media`를 아예 보내지 않고
   `wordpress_featured_media_skipped_no_media_id` 이벤트만 기록한다.
4. media id가 있으면(향후 업로드 구현 후) `wordpress_featured_media_prepared`
   이벤트를 기록하고 실제로 `featured_media`를 post payload에 포함한다.

즉 Phase 2-6은 실제 업로드를 구현하지 않지만, **업로드가 구현된 순간부터는
아무 것도 추가로 바꾸지 않아도** media id가 자동으로 WordPress post에
연결되는 구조를 이미 완성해 두었다.

## 실제 WordPress 연결 후 필요한 작업

1. `lib/publish/wordpress-client.ts`의 `uploadMediaToWordPress` 내부를 실제
   구현으로 교체한다 (이미지 파일을 읽어 `multipart/form-data`로
   `/wp-json/wp/v2/media`에 POST).
2. 업로드 성공 시 반환된 media id/url을 `articles.featured_image_wordpress_
   media_id`/`featured_image_wordpress_url`에 저장하고
   `featured_image_upload_status`를 `'uploaded'`로 전환한다.
3. 실제 이미지 생성 API(Phase 2-5 prompt 사용)와 연결해 `featured_image_
   source_type`을 `'generated_url'` 등으로 갱신한다.
4. 이후 흐름은 이미 준비되어 있으므로 별도 변경이 필요 없다 — `publish-
   service.ts`가 자동으로 media id를 인식해 `featured_media`로 전달한다.

## 다음 단계 제안

- 실제 이미지 생성 API 연동 (Phase 2-5 prompt 사용)
- `uploadMediaToWordPress`의 실제 구현 (파일 read/multipart upload)
- 업로드된 이미지에 대한 사람 검토 단계 추가 (생성/업로드된 이미지가 정책과
  일치하는지 최종 확인)
