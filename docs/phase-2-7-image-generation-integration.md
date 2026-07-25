# Phase 2-7: Image Generation Integration

## 목적

Phase 2-5에서 준비한 featured image prompt/alt text/caption/style/aspect
ratio를 바탕으로 실제 또는 mock 이미지 생성 결과를 `articles`에 저장하고,
article 상세 화면에서 확인할 수 있게 한다. 기본 provider는 `mock`이며, 실제
provider(`openai`, `custom`) 연동은 안전한 구조만 준비한다 — 실제 WordPress
media upload는 이번 단계에서도 하지 않는다.

## featured image preparation과의 관계

```
Phase 2-5: featured_image_prompt / alt_text / caption / style / aspect_ratio 준비
              │
              ▼
Phase 2-7: 위 prompt로 실제(또는 mock) 이미지를 생성해
           generated_image_url / width / height / format 등을 저장한다.
              │
              ▼
Phase 2-6: generated_image_url이 있으면 featured_image_source_type을
           'generated_url'로 자동 갱신해 WordPress media upload payload에 반영한다.
```

Phase 2-5가 "어떤 이미지여야 하는가"를, Phase 2-7이 "그 프롬프트로 실제
생성한 결과"를 담당한다.

## provider 구조

`lib/images/image-generation-types.ts`의 공통 인터페이스:

```ts
interface ImageGenerationProviderClient {
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}
```

세 가지 구현체(`lib/images/providers/`):

| provider | 파일 | 동작 |
|---|---|---|
| `mock` | `mock-image-provider.ts` | 실제 API 호출 없이 결정적인 placeholder 결과 반환 |
| `openai` | `openai-image-provider.ts` | 구조만 준비된 safe stub (아래 참고) |
| `custom` | `custom-image-provider.ts` | 자체 endpoint 연동을 위한 자리만 마련된 stub |

`lib/images/providers/index.ts`의 `getImageProviderClient(provider)`가
provider 이름에 맞는 client를 선택한다.

## mock mode와 real mode 차이

- **mock mode** (`IMAGE_GENERATION_PROVIDER=mock`, 기본값): 실제 외부 호출
  없이 `/mock/generated-images/{articleId}.webp` 형태의 placeholder URL과
  `aspect_ratio` 기반 기본 크기를 반환한다. `generated_image_status`는
  항상 `generated`가 된다.
- **real mode** (`openai`/`custom`, `IMAGE_GENERATION_ENABLED=true` 필요):
  - `IMAGE_GENERATION_ENABLED=false`이면 real provider도 mock으로 안전하게
    대체되며(`metadata.disabled: true`), 결과는 `provider="openai"`/
    `"custom"`으로 표시되지만 실제 API는 호출되지 않는다.
  - `IMAGE_GENERATION_ENABLED=true`여도 실제 이미지 생성 API 호출은 이번
    단계에서 구현하지 않았으므로 항상 `failed`를 반환한다 (safe stub —
    Phase 2-4/2-6과 동일한 원칙).
  - provider가 예외를 던져도 각 provider 내부에서 try/catch로 잡아 항상
    `ImageGenerationResult`를 반환한다 — 시스템 전체가 Runtime Error로
    터지지 않는다.

## image generation request 구조

`lib/images/image-generation-types.ts`의 `ImageGenerationRequest`:

```ts
{
  articleId: string;
  provider: "mock" | "openai" | "custom";
  model?: string;
  prompt: string;              // featured_image_prompt (Phase 2-5)
  negativePrompt?: string;     // 아래 참고
  aspectRatio: string;
  width?: number;
  height?: number;
  style?: string;               // featured_image_style
  altText?: string;
  caption?: string;
  articleMode: ArticleMode;
  targetKeyword?: string;
  dryRun: boolean;              // !IMAGE_GENERATION_ENABLED
  outputFormat?: string;
}
```

negative prompt는 모든 모드에 공통으로 적용된다
(`lib/images/image-generation-service.ts`의 `NEGATIVE_PROMPT_BASE`):

```
text overlay, watermark, logo, distorted hands, extra fingers, blurry face, unreadable text
```

이는 Phase 2-5의 avoid list(`no text in image`, `no celebrity likeness` 등)와
함께 이미지 안전 정책의 두 번째 계층 역할을 한다 — 로고 생성 금지, 유명인/
실존인물 지양, 과장·선정적 썸네일 금지, 의료/금융/법률 주제의 공포 조장
이미지 금지 원칙은 Phase 2-5 prompt에서 이미 반영되어 있다.

## generated image 저장 구조

`articles` 테이블에 저장되는 필드(성공 시):

| 컬럼 | 설명 |
|---|---|
| `generated_image_status` | `not_generated → generating → generated → reviewed` (또는 `failed`) |
| `generated_image_provider` | 실제로 결과를 만든 provider |
| `generated_image_model` | 사용된 모델명 (mock은 `mock-image-generator-v1`) |
| `generated_image_prompt` / `negative_prompt` | 실제로 사용된 prompt |
| `generated_image_url` / `local_path` | 결과 이미지 위치 |
| `generated_image_width` / `height` / `format` | 이미지 크기/포맷 |
| `generated_image_metadata` | provider 응답 요약 (jsonb) |
| `generated_image_error` | 실패 시 오류 메시지 |
| `generated_image_requested_at` / `completed_at` / `reviewed_at` | 시각 기록 |

`format_metadata.generated_image`에도 `{status, provider, model, image_url,
width, height, format}` 요약을 함께 저장한다.

## review 흐름

article 상세 페이지의 "Image Generation" 섹션에서 "생성 결과 검토 완료"를
누르면:

1. `generated_image_status = 'reviewed'`
2. `generated_image_reviewed_at = now()`
3. `pipeline_logs`에 `generated_image_reviewed` 기록

검토는 WordPress 게시의 필수 조건이 아니며, 미검토 상태라도 게시를 막지
않는다 (Phase 2-5/2-6과 동일한 원칙).

## WordPress media upload preparation과의 연결

`lib/publish/wordpress-media-preparation-service.ts`의
`prepareWordPressMediaUpload`가 다음 규칙으로 source를 자동 결정한다:

1. `featured_image_source_type`이 이미 `'none'`이 아니면 그대로 사용한다
   (사용자가 다른 source를 설정했다면 덮어쓰지 않는다).
2. `'none'`이고 `generated_image_url`이 있으면 `featured_image_source_type`을
   `'generated_url'`로, `generated_image_local_path`가 있으면 `'local_file'`로
   자동 갱신하고 `wordpress_media_source_updated_from_generated_image` 이벤트를
   기록한다.
3. 이 정보는 `featured_image_upload_payload`에도 반영되어 WordPress media
   upload dry-run 확인에 사용된다.

Phase 2-2 WordPress draft publish dry-run details에는 `generatedImage` 요약이
포함된다 (prompt 전체나 이미지 파일은 포함하지 않는다):

```json
{
  "status": "generated",
  "provider": "mock",
  "model": "mock-image-generator-v1",
  "imageUrl": "/mock/generated-images/article-1.webp",
  "width": 1536,
  "height": 864,
  "format": "webp"
}
```

## 실제 provider 연결 시 확인할 점

- `openai-image-provider.ts`/`custom-image-provider.ts`의 `실제 API 호출은
  구현하지 않는다` 부분만 교체하면 되도록 구조를 준비해 두었다.
- 실제 이미지 생성 API(예: OpenAI Images API)는 응답으로 URL 또는 base64를
  반환하는데, base64인 경우 파일 저장(local_path) 처리가 추가로 필요하다.
- `OPENAI_API_KEY`는 서버 코드에서만 사용하며 절대 로그/오류 메시지에
  포함하지 않는다 (현재 코드는 키의 존재 여부만 확인하고 값 자체는 다루지
  않는다).
- `IMAGE_GENERATION_TIMEOUT_MS`(기본 30000ms)를 실제 fetch 호출의 timeout으로
  사용해야 한다 (현재는 자리만 마련되어 있고 실제 호출이 없어 사용되지
  않는다).
- 생성된 이미지가 정책(Phase 2-5 avoid list, negative prompt)을 실제로
  준수하는지는 API가 보장하지 않으므로, 사람의 검토(review 흐름)를 거치는
  것을 권장한다.

## 실패 시 확인 방법

- article 상세 페이지의 "Image Generation" 섹션에 `generated_image_error`가
  표시된다.
- `pipeline_logs`에서 `image_generation_failed` 이벤트로 실패 이력을 추적할
  수 있다 (provider, 오류 메시지 포함).
- provider가 disabled fallback으로 처리된 경우(`IMAGE_GENERATION_ENABLED=
  false`이고 provider가 mock이 아닌 경우)에는 `image_generation_skipped_
  disabled` 이벤트가 대신 기록된다 (실패가 아니라 의도된 건너뜀임을 명확히
  구분한다).

## 다음 단계 제안

- `openai-image-provider.ts`의 실제 OpenAI Images API 연동
- 생성된 이미지의 실제 파일 다운로드/저장(local_path) 처리
- Phase 2-6의 `uploadMediaToWordPress` 실제 구현과 연결해 생성된 이미지를
  실제로 WordPress에 업로드
- 생성된 이미지 미리보기에 대한 재생성/승인 UI 개선 (여러 후보 중 선택 등)
