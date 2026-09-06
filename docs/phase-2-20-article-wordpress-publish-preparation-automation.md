# Phase 2-20: 기사 개요 고급 기능 — WordPress 게시 준비 자동화

## 문제

`/articles/[id]`의 "고급 기능: 원본 article WordPress 전송" 섹션에서
사용자가 WordPress Metadata 생성 → SEO Plugin Metadata 생성 → 대표
이미지 준비 → 이미지 생성 → Quality Gate 확인까지 각각 버튼을 여러 번
눌러야 했다.

## 목표와 원칙

- 이 흐름을 자동화하되, **실제 WordPress 공개(public) 게시는 어떤
  경우에도 자동 실행하지 않는다** — WordPress Draft 생성/업데이트까지만
  자동화 대상이다.
- `wordpress_blog` 흐름(`/articles/[id]/blog`)과 `naver_blog`는 전혀
  건드리지 않는다 — 이 작업은 `/articles/[id]` 원본 article 전송 경로
  전용이다.
- DB schema 변경 없음 — 기존 컬럼/JSON metadata(`format_metadata` 등)를
  그대로 사용한다.

## 조치

### 1) 오케스트레이터 추가 (`lib/publish/article-wordpress-publish-preparation-orchestrator.ts`)

`prepareArticleWordPressPublishing(articleId, { overwrite? })`가 아래
순서로 기존 서비스 함수를 그대로 호출한다(새 외부 API 호출 로직 없음):

1. **WordPress Metadata**: `wpMetadataStatus === "not_ready"`(또는
   `overwrite`)이면 `generateWordPressMetadata()` 호출. 이미 값이 있으면
   덮어쓰지 않고 건너뛴다.
2. **SEO Plugin Metadata**: `seoPluginProvider === "none"` 이거나 아직
   생성되지 않았으면 **기본 Rank Math**로 `generateSeoPluginPayload(articleId,
   "rank_math")`를 호출한다. 이미 다른 provider(Yoast 등)가 설정돼
   있으면 그 값을 존중하고 덮어쓰지 않는다.
3. **대표 이미지 prompt 준비**: `featuredImageStatus === "not_ready"`이면
   `prepareFeaturedImage()` 호출.
4. **이미지 생성 또는 자동 waiver**:
   - 이미 media id가 있거나 이미 waiver가 적용돼 있으면 건너뛴다.
   - `IMAGE_GENERATION_ENABLED=true`이면 `generateFeaturedImage()`를
     시도한다. 성공하면 그대로 두고, 실패하면 자동으로 waiver를
     적용한다.
   - `IMAGE_GENERATION_ENABLED=false`이면 애초에 시도하지 않고 바로
     자동 waiver를 적용한다(가짜 mock 이미지를 실제 준비된 것처럼
     남기지 않기 위해서다).
   - waiver 사유는 새 사유 코드 `auto_generation_unavailable`("자동
     이미지 생성 비활성화 또는 실패 (자동 적용)")을 사용한다 — 사람이
     선택하는 기존 4개 사유(내부 검토용/나중에 수동/텍스트 중심/적절한
     이미지 없음)와 구분된다.
5. **Quality Gate**: 규칙 기반(결정적) 검사라 매번 다시 실행해도
   안전하므로 항상 `runPublishQualityGate()`를 실행한다.
6. **승인**: 건드리지 않는다 — `not_requested`/`draft` 상태를 그대로
   둔다. 승인은 사람이 별도로 "승인하기" 버튼을 눌러야 한다.

각 단계 결과는 `steps` 배열(`success`/`skipped`/`warning`/`failed`)로
반환되고, 전체 성공 여부(`success`)는 WordPress Metadata 생성처럼
치명적인 단계가 실패하지 않는 한 `true`다 — **이미지 관련 실패는 절대
`success: false`를 만들지 않는다**(이미지 없음은 warning이지 blocked가
아니라는 원칙).

### 2) 새 서버 액션 (`app/articles/[id]/actions.ts`)

`prepareArticleWordPressPublishingAction`이 위 오케스트레이터를
호출하고, `overwrite` 체크박스 값을 formData에서 읽는다. 결과 메시지는
기존 패턴 그대로 `publishMessage`/`error` query로 redirect한다.

### 3) UI (`app/articles/[id]/page.tsx`)

"고급 기능" `<details>` 안, 기존 `WordPressPublishingPanel` 요약 카드
바로 아래에 새 섹션을 추가했다:

- **"WordPress 게시 준비 자동 실행"** 버튼(primary, indigo) — 클릭
  한 번으로 위 5단계를 모두 실행한다.
- 상태 요약 목록: WordPress Metadata / SEO Plugin Metadata(provider
  포함) / 대표 이미지(준비됨·자동 생성됨·이미지 없음으로 진행 가능·
  준비 안 됨) / Quality Gate / 승인 상태 / WordPress Draft.
- "이미 생성된 항목도 다시 생성(덮어쓰기)" 체크박스(secondary, 작은
  텍스트) — `overwrite=true`를 넘긴다.
- 안내 문구: "WordPress 게시 준비를 자동으로 실행합니다. 제목, SEO
  Metadata, Rank Math 설정, 대표 이미지 준비를 한 번에 처리합니다.
  대표 이미지가 없더라도 Draft 업로드는 가능합니다. 공개 게시는
  하지 않습니다."

기존 개별 섹션(WordPress Metadata/SEO Plugin Metadata/Featured Image
Preparation/Image Generation/Featured Image Workflow/WordPress Draft
등)은 그대로 유지하고, 안내 문구만 "자동 실행이 사용하는 개별 기능 —
검토하거나 특정 항목만 다시 생성하고 싶을 때 쓰는 고급 옵션"으로
바꿨다. 이 섹션들은 애초에 페이지 상단의 "고급 기능"
`<details>`(기본 접힘) 안에 있어 이미 이차적인 위치였다.

### 4) 이미지 없음 기본 허용 — 이미 구현되어 있었음(변경 불필요)

코드를 확인한 결과, **WordPress Draft 생성 자체(`publishArticleToWordPressDraft`)는
featured image 유무를 전혀 확인하지 않는다** — media id가 없으면 그냥
`featuredMedia: undefined`로 두고 draft를 생성한다. 이미지 부재로 인한
차단은 `publish-quality-gate-service.ts`의 `checkFeaturedImagePresent()`에만
있었는데, 이미 waiver 상태(`getArticleWordPressFeaturedImageWaiverState`)를
확인해 waived=true면 `fail`이 아니라 `warning`으로 처리하고 있었다(이전
Phase에서 이미 구현됨). 즉 이번 작업은 **새 guard 로직을 추가한 것이
아니라, 이미 있던 waiver 지원 guard에 자동 waiver 적용 흐름을 연결한
것**이다.

### 5) 로그

오케스트레이터 자체가 남기는 요약 레벨 이벤트(개별 서비스는 각자
`wordpress_metadata_generation_*`/`seo_plugin_metadata_generation_*`/
`featured_image_preparation_*`/`image_generation_*` 이벤트를 이미
남긴다):

- `article_wordpress_prepare_started` / `article_wordpress_prepare_completed`
- `article_wordpress_metadata_generated`
- `article_wordpress_seo_metadata_generated`
- `article_wordpress_seo_provider_defaulted_rank_math`
- `article_wordpress_image_prompt_generated`
- `article_wordpress_image_generation_attempted`
- `article_wordpress_image_generation_skipped`
- `article_wordpress_featured_image_waived`(기존 이벤트 재사용)

API key/Authorization header/WordPress app password/이미지 바이너리/
전체 본문은 어떤 로그에도 남기지 않는다(details에는 provider명, 단계
성공/실패 여부 등 요약 값만 담는다).

## 지키지 않은 것 / 변경하지 않은 것

- 실제 WordPress 공개 게시(`publishApprovedArticleToWordPress`)는
  전혀 호출하지 않는다.
- `wordpress_blog`/`naver_blog` 흐름은 코드 한 줄도 건드리지 않았다.
- DB schema 변경 없음.
- 기존 개별 버튼(생성/검토/재생성 등)은 모두 그대로 동작한다 — 자동
  실행은 그 위에 추가된 "한 번에 실행" 진입점일 뿐이다.

## 테스트

- `lib/publish/article-wordpress-publish-preparation-orchestrator.test.ts`:
  전체 성공 흐름, 이미 생성된 항목 skip, provider 기본값(Rank Math)
  적용/보존, 이미지 생성 비활성화·실패 시 자동 waiver, media id/이미
  waiver 있으면 재시도 안 함, WordPress Metadata 실패 시 조기 중단,
  overwrite 옵션, Quality Gate blocked여도 전체 실행은 완료로 처리,
  완료 로그, 민감정보 미포함 검사.
- `lib/publish/article-wordpress-featured-image-waiver-service.test.ts`:
  새 사유 코드(`auto_generation_unavailable`) 허용 여부.
- `app/articles/[id]/actions.test.ts`, `app/articles/[id]/page.test.ts`:
  새 action/버튼/상태 요약 정적 소스 검사.

`npm run lint`, `npx vitest run`(전체), `npx tsc --noEmit -p .`(baseline
37 유지), `npm run build` 모두 통과 확인.
