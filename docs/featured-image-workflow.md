# Featured Image Workflow (대표 이미지 처리 구조)

대표 이미지 처리를 3단계 워크플로우로 명확히 분리한 문서다. AI 이미지
생성 actual integration은 아직 연결하지 않았으며, 이 워크플로우는 그
전까지의 운영 방식이자, AI 생성이 연결된 이후에도 계속 유지되는 구조다.

```
Step 1. Featured Image Source Setup
        (외부 URL / 로컬 업로드 / 기존 WordPress media 지정)
   ↓
Step 2. WordPress Media Upload
        (실제 WordPress Media Library에 업로드, 또는 이미 있으면 skip)
   ↓
Step 3. WordPress Featured Media Attach
        (업로드된 media를 기존 WordPress draft post에 연결)
```

## AI 이미지 생성 전 운영 방식

1. (선택) Featured Image Preparation(Phase 2-5)에서 alt text/caption/style
   메타데이터를 준비한다.
2. **Step 1**에서 이미지 source를 3가지 방식 중 하나로 설정한다.
3. **Step 2**에서 WordPress Media Library에 실제 업로드한다(기존 media
   지정 방식은 이 단계를 건너뛴다).
4. **Step 3**에서 업로드된 media를 WordPress draft post에 연결한다.

## Step 1: Source Setup

`lib/images/featured-image-source-service.ts`가 담당한다. article 상세
페이지의 "Step 1. 대표 이미지 Source 설정" 섹션에서 실행한다.

### external URL 사용 방식

`saveExternalImageUrl(articleId, { url, filename?, mimeType? })`

- URL은 `http://` 또는 `https://`로 시작해야 한다. `/mock/...` 같은
  상대경로는 `featured_image_source_status='invalid'`로 거부한다.
- mimeType을 입력하지 않으면 URL/filename 확장자로 추론한다
  (jpg/jpeg/png/webp 권장, 그 외는 `image/webp`로 간주).
- 성공 시 `featured_image_source_type='external_url'`,
  `featured_image_source_status='prepared'`,
  `featured_image_upload_status='prepared'`로 저장된다.

### local upload 사용 방식

`saveLocalImageUpload(articleId, file)`

- jpg/jpeg/png/webp만 허용하며 최대 5MB(기본값, `WORDPRESS_MEDIA_MAX_
  SIZE_MB`로 재정의 가능)를 초과하면 거부한다.
- `lib/images/featured-image-local-storage.ts`가 실제 디스크 write를
  전담한다(`.uploads/featured-images/`, git에 커밋되지 않음). image
  binary는 DB나 로그에 저장하지 않는다(경로 문자열만 저장).
- 성공 시 `featured_image_source_type='local_upload'`,
  `featured_image_source_status='prepared'`,
  `featured_image_upload_status='prepared'`로 저장된다.

**주의(운영 환경)**: 이 구현은 로컬/단일 서버 배포를 전제로 한다.
Vercel 등 서버리스 환경에서는 파일시스템이 영속적이지 않으므로, 업로드
직후 곧바로 Step 2(WordPress Media Upload)를 실행하거나 Supabase
Storage로 교체하는 것을 권장한다.

### existing WordPress media id 사용 방식

`saveExistingWordPressMedia(articleId, { mediaId, mediaUrl? })`

- media id는 0보다 큰 정수여야 한다(아니면 invalid 처리).
- 성공 시 `featured_image_source_type='wordpress_media_existing'`,
  `featured_image_source_status='prepared'`,
  `featured_image_upload_status='uploaded'`로 저장된다 — Step 2(업로드)를
  건너뛰고 바로 Step 3(attach)로 넘어갈 수 있다.

## upload와 attach의 차이

- **Upload(Step 2)**: 이미지 파일 자체를 WordPress Media Library에
  새로 등록해 media id를 발급받는 과정. `lib/publish/wordpress-media-
  upload-service.ts`의 `uploadFeaturedImageToWordPress(articleId)`가
  담당한다.
- **Attach(Step 3)**: 이미 발급된 media id를 특정 WordPress draft
  post의 featured_media로 연결하는 과정(같은 media를 다른 글에도 재사용
  가능). `lib/publish/wordpress-featured-media-service.ts`의
  `attachFeaturedMediaToDraft(articleId)`가 담당한다.
- `wordpress_media_existing` source는 Step 2 없이도 media id가 이미
  존재하므로 곧바로 Step 3만 실행하면 된다.

### Step 2 skip 사유 (details_json.reason)

| reason | 의미 |
|---|---|
| `WORDPRESS_MEDIA_UPLOAD_ENABLED=false` | 업로드 기능 자체가 비활성화됨(기본값) |
| `no_valid_image_source` | source가 전혀 설정되지 않음 |
| `mock_url_not_uploadable` | 생성된 이미지 URL이 mock/상대경로임 |
| `invalid_image_source_url` | 저장된 외부 URL이 유효하지 않거나 source_status='invalid' |
| `existing_wordpress_media_no_upload_needed` | source_type='wordpress_media_existing'이라 업로드가 필요 없음 |

### Step 3 조건

- `featured_image_wordpress_media_id`가 존재해야 한다(없으면
  `skipped_no_media_id`).
- WordPress draft post가 이미 생성되어 있어야 한다(없으면 "먼저
  WordPress 초안 생성" 안내를 표시하고 attach를 시도하지 않는다). 단,
  WordPress 초안을 새로 생성할 때 media id가 이미 있으면
  `publish-service.ts`가 자동으로 featured_media에 포함시킨다.

## Quality Gate와 Public Publish guard 차이

두 검증은 서로 다른 엄격도를 가진다.

- **Publish Quality Gate**(`lib/publish/publish-quality-gate-service.ts`의
  `featured_image_present` 항목)는 "완전히 없음"과 "준비는 됐지만
  업로드/연결 전"을 구분한다.
  - **pass**: `featured_image_wordpress_media_id` 존재 또는
    `wordpress_featured_media_attach_status='attached'`
  - **warning**: `featured_image_source_status='prepared'` 또는
    `featured_image_upload_status='prepared'` (source는 준비됐지만
    WordPress 업로드/연결 전)
  - **fail** (monetized_blog만 해당): `featured_image_source_status
    ='none'`이고 media id 없음, 또는 `featured_image_upload_status`가
    `failed`/`skipped`이고 media id 없음
  - warning 상태로도 점수 계산상 `ready_to_publish`에 도달할 수 있다
    (다른 항목들과의 합산 점수에 따라 다름).

- **Public Publish guard**(`lib/publish/public-publish-guards.ts`의
  `checkPublicPublishGuard`)는 Quality Gate와 무관하게 **항상**
  `featured_image_wordpress_media_id` 존재 또는
  `wordpress_featured_media_attach_status='attached'`를 직접 확인한다.
  이 조건이 없으면 Quality Gate가 `ready_to_publish`였더라도 공개
  게시(publish)를 차단한다. 즉 "source만 준비된 warning 상태"만으로는
  절대 실제 공개 게시로 이어질 수 없다.

## Supabase 확인 SQL

```sql
select
  id,
  title,
  article_mode,
  featured_image_source_type,
  featured_image_source_status,
  featured_image_source_error,
  featured_image_manual_source_saved_at,
  featured_image_source_url,
  featured_image_local_path,
  featured_image_filename,
  featured_image_mime_type,
  featured_image_upload_status,
  featured_image_upload_error,
  featured_image_wordpress_media_id,
  featured_image_wordpress_url,
  wordpress_featured_media_attach_status,
  wordpress_featured_media_attach_error
from articles
where id = '<article_id>';

select event_name, status, message, details_json, created_at
from pipeline_logs
where event_name like 'featured_image_%'
   or event_name like 'wordpress_media_upload_%'
   or event_name like 'wordpress_featured_media_attach_%'
order by created_at desc
limit 50;

select article_id, target, status, details_json, created_at
from publish_logs
where target in ('featured_image_manual_source', 'wordpress_media', 'wordpress_featured_media')
order by created_at desc
limit 20;
```

## 오류별 대응

| 오류 | 원인 | 대응 |
|---|---|---|
| "이미지 URL은 http:// 또는 https://로 시작해야 합니다" | 상대경로(`/mock/...`)나 `ftp://` 등 | 실제 접근 가능한 http/https URL 입력 |
| "허용되지 않는 이미지 형식입니다" | mimeType이 jpg/png/webp가 아님 | 형식 변환 후 재시도하거나 올바른 mimeType 입력 |
| "파일 크기가 너무 큽니다" | 5MB(기본값) 초과 | 이미지 압축 또는 `WORDPRESS_MEDIA_MAX_SIZE_MB` 조정 |
| "WordPress media id를 올바른 양의 정수로 입력해야 합니다" | media id 누락/0 이하 | WordPress Media Library에서 실제 id 확인 후 입력 |
| Step 2가 `no_valid_image_source`로 skip됨 | Step 1을 아직 실행하지 않음 | Step 1에서 source를 먼저 설정 |
| Step 3가 "먼저 WordPress 초안 생성" 안내를 표시함 | WordPress draft post가 아직 없음 | WordPress 초안 생성을 먼저 실행(media id가 있으면 자동 포함됨) |
| Quality Gate는 pass인데 Public Publish가 차단됨 | 없음(guard가 항상 media id/attached를 직접 재확인하므로 이 조합은 발생하지 않음) | Quality Gate의 pass 조건도 media id/attached 기준이므로 정상 동작 |
| Quality Gate가 warning인데 공개하려 함 | source만 준비되고 업로드/연결 전 | Step 2/3를 마저 실행해 media id를 확보해야 공개 게시 가능 |
