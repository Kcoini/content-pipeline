# Phase 2-19: Manual Featured Image Source Setup

## 목적

AI 이미지 생성 기능(Phase 2-7 `IMAGE_GENERATION_PROVIDER=openai` 등)을
아직 실제로 연결하지 않았기 때문에, 사용자가 대표 이미지(featured
image) source를 직접 설정할 수 있게 한다. 지원 방식은 3가지다.

1. 로컬 컴퓨터 이미지 업로드
2. 인터넷 이미지 URL 입력
3. 이미 WordPress Media Library에 있는 media id 직접 지정

이 단계에서는 AI 이미지 생성 actual integration을 구현하지 않는다.

## 배경 문제

Publish Quality Gate(Phase 2-15)에서 `monetized_blog` 글이 featured
image 없음으로 `needs_revision`이 되는 문제가 있었다.
`featured_image_upload_status=skipped`, `featured_image_wordpress_media_id
=null` 상태에서는 Human Approval(Phase 2-16)과 Public Publish(Phase
2-17)로 진행할 수 없었다. 이 단계는 AI 이미지 생성 없이도 대표 이미지를
준비할 수 있는 경로를 추가해 이 문제를 해소한다.

## AI 이미지 생성 전 임시 운영 방식

AI 이미지 생성이 연결되기 전까지는 다음 순서로 대표 이미지를 준비한다.

1. Featured Image Preparation(Phase 2-5)에서 alt text/caption/style 등
   메타데이터를 준비한다 (선택 사항, 게시를 막지 않음).
2. 이 문서의 3가지 방식 중 하나로 실제 이미지 source를 설정한다.
3. WordPress Media Upload(Phase 2-6/2-10)에서 실제 업로드를 실행한다
   (기존 WordPress media 지정 방식은 업로드를 건너뛴다).
4. Featured Media Attach(Phase 2-11)로 WordPress draft post에 연결한다.

## 1. 로컬 이미지 업로드 방식

article 상세 페이지 "대표 이미지 Source 직접 설정" 섹션의 A번에서 파일을
선택하고 "대표 이미지 파일 저장" 버튼을 누른다.

- 허용 확장자: jpg, jpeg, png, webp (MIME type 기준: `image/jpeg`,
  `image/png`, `image/webp`)
- 최대 파일 크기: 5MB (기본값, `WORDPRESS_MEDIA_MAX_SIZE_MB`로 재정의 가능)
- 서버가 파일을 받아 `lib/images/featured-image-local-storage.ts`가 로컬
  디스크(`.uploads/featured-images/`, git에 커밋되지 않음)에 저장하고,
  `lib/images/featured-image-manual-source-service.ts`의
  `saveLocalUploadSource()`가 다음을 저장한다.
  - `featured_image_source_type = 'local_upload'`
  - `featured_image_local_path` = 저장 경로
  - `featured_image_filename`, `featured_image_mime_type`
  - `featured_image_upload_status = 'prepared'`
  - `featured_image_upload_error = null`
- image binary 자체는 DB나 로그에 저장하지 않는다(경로 문자열만 저장).

**주의(운영 환경)**: 이 구현은 로컬/단일 서버 배포를 전제로 한다. Vercel
등 서버리스 환경에서는 파일시스템이 영속적이지 않으므로, 운영 환경에서는
Supabase Storage 등으로 교체하는 것을 권장한다 ("다음 단계 제안" 참고).

## 2. 인터넷 이미지 URL 방식

B번 입력창에 이미지 URL을 입력하고 "이미지 URL 저장" 버튼을 누른다.
filename/mimeType은 선택 입력이다.

검증 규칙:

- URL은 `http://` 또는 `https://`로 시작해야 한다.
- `/mock/...` 같은 상대경로는 거부한다.
- mimeType을 직접 입력하면 `image/jpeg`/`image/png`/`image/webp` 중
  하나여야 하며, 아니면 거부한다.
- mimeType을 입력하지 않으면 URL/filename의 확장자로 추론한다
  (`lib/publish/wordpress-media-config.ts`의 `inferMimeTypeFromFilename()`
  재사용). 확장자가 없는 URL은 `image/webp`로 간주되므로, 정확한 형식을
  보장하려면 mimeType을 직접 입력하는 것을 권장한다.

저장 시:

- `featured_image_source_type = 'external_url'`
- `featured_image_source_url` = 입력 URL
- `featured_image_filename` = 입력값 또는 slug 기반 자동 생성
- `featured_image_upload_status = 'prepared'`

## 3. 기존 WordPress Media Library media id 사용 방식

C번 입력창에 WordPress Media Library에 이미 존재하는 media id(필수)와
media URL(선택)을 입력하고 "기존 media id 저장" 버튼을 누른다.

저장 시:

- `featured_image_source_type = 'wordpress_media_existing'`
- `featured_image_wordpress_media_id` = 입력 media id
- `featured_image_wordpress_url` = 입력 URL
- `featured_image_upload_status = 'uploaded'`

이 경우 `uploadFeaturedImageToWordPress()`(Phase 2-10) 호출 시
`featured_image_source_type='wordpress_media_existing'`이고 media id가
존재하면 실제 업로드를 다시 시도하지 않고 즉시 성공(uploaded)으로
처리한다(`wordpress_media_upload_skipped_existing_media` 이벤트). 곧바로
Featured Media Attach(Phase 2-11) 단계로 넘어갈 수 있다.

## 저작권 주의사항

- **사용 권한이 있는 이미지만 사용해야 한다.** UI에 다음 안내를
  표시한다: "AI 이미지 생성 기능을 연결하기 전까지는 로컬 이미지 업로드
  또는 인터넷 이미지 URL을 사용하세요. 사용 권한이 있는 이미지만 사용해야
  합니다."
- 인터넷 URL 입력 옆에는 다음 안내를 표시한다: "뉴스 기사, 포털, 타인의
  블로그 이미지 등 권한이 불분명한 이미지는 사용하지 마세요."
- 무료 라이선스(CC0)/직접 촬영/구매한 스톡 이미지 등 권한이 명확한
  이미지만 사용한다.

## Quality Gate와의 관계

Publish Quality Gate(Phase 2-15)의 `featured_image_present` 항목이 다음
기준으로 바뀌었다.

- **pass**: `featured_image_wordpress_media_id`가 존재하거나
  `wordpress_featured_media_attach_status='attached'`
- **warning**: `featured_image_source_type`이 `external_url` 또는
  `local_upload`이고 `featured_image_upload_status='prepared'` (source는
  준비되었지만 아직 WordPress에 업로드되지 않은 상태)
- **fail** (monetized_blog만 해당): `featured_image_source_type='none'`이고
  media id가 없거나, `featured_image_upload_status`가 `skipped`/`failed`이고
  media id가 없는 경우

이렇게 하면 "이미지 source만 준비된 상태"와 "완전히 없는 상태"를
구분해서 점수에 반영할 수 있다. `local_upload`/`external_url`로 source를
저장하기만 해도 `needs_revision` 사유였던 fail이 warning으로 완화된다
(`ready_to_publish` 도달을 위해서는 여전히 WordPress 업로드까지 완료하는
것을 권장한다).

## Public Publish guard와의 관계

Phase 2-17의 `checkPublicPublishGuard()`는 변경하지 않았다. 여전히
Publish Quality Gate가 `ready_to_publish` 상태여야 승인/공개 게시가
가능하며, `ready_to_publish`에 도달하려면 (score ≥ 85 및 fail 항목 없음)
featured image가 최소한 warning 이하 상태여야 한다. 즉 media id 존재
또는 attached 상태가 여전히 실질적으로 요구된다 — source만 준비된
warning 상태로는 다른 항목들과 함께 점수를 깎아 `ready_to_publish`
도달을 어렵게 만들 수 있으므로, 실제 공개 전에는 WordPress 업로드까지
완료하는 것을 권장한다.

## Supabase 확인 SQL

```sql
select
  id,
  title,
  featured_image_source_type,
  featured_image_source_url,
  featured_image_local_path,
  featured_image_filename,
  featured_image_mime_type,
  featured_image_upload_status,
  featured_image_upload_error,
  featured_image_wordpress_media_id,
  featured_image_wordpress_url
from articles
where id = '<article_id>';

select event_name, status, message, details_json, created_at
from pipeline_logs
where event_name like 'featured_image_%source%' or event_name like 'featured_image_manual_source%'
order by created_at desc
limit 30;

select article_id, target, status, details_json, created_at
from publish_logs
where target = 'featured_image_manual_source'
order by created_at desc
limit 10;
```

## 오류 대응

| 증상 | 원인 | 대응 |
|---|---|---|
| "이미지 URL은 http:// 또는 https://로 시작해야 합니다" | 상대경로(`/mock/...`) 또는 `ftp://` 등 비허용 스킴 | 실제 접근 가능한 http/https URL을 입력 |
| "허용되지 않는 이미지 형식입니다" | mimeType이 jpg/png/webp가 아님 | 다른 형식으로 변환 후 재업로드하거나 올바른 mimeType 입력 |
| "파일 크기가 너무 큽니다" | 5MB(기본값) 초과 | 이미지를 압축하거나 `WORDPRESS_MEDIA_MAX_SIZE_MB` 조정 |
| "WordPress media id를 올바른 양의 정수로 입력해야 합니다" | media id 누락/0 이하 | WordPress Media Library에서 실제 id를 확인 후 입력 |
| 로컬 업로드 파일이 사라짐(운영 환경) | 서버리스 환경의 파일시스템 비영속성 | 업로드 직후 곧바로 WordPress media upload를 실행하거나, Supabase Storage로 교체 (다음 단계 제안 참고) |

## 다음 단계 제안

- 실제 AI 이미지 생성 provider(OpenAI 등) actual integration 연결.
- 로컬 업로드 저장소를 Supabase Storage로 교체해 서버리스 배포에서도
  영속적으로 동작하도록 개선.
- 이미지 라이선스/출처를 기록하는 필드 추가(저작권 추적 강화).
- 업로드된 이미지의 실제 치수(width/height)를 검증해 WordPress
  권장 비율(예: 16:9)과 다르면 경고 표시.
