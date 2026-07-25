# Phase 2-5: Featured Image Preparation

## 목적

수익형 블로그 글과 WordPress 게시를 위해 대표 이미지(featured image) **준비
정보**를 생성한다. 실제 이미지 생성이나 WordPress media upload는 이번
단계에서 구현하지 않으며, 이미지 생성 AI에 전달할 prompt와 alt text/
caption/style/aspect ratio만 만들고 저장·표시·검토할 수 있게 한다.

## Featured Image Preparation 흐름

```
/articles/[id] (draft 또는 reviewed 모두 가능)
  → "대표 이미지 정보 준비" 버튼 클릭
  → prepareFeaturedImageAction (서버 액션)
  → lib/images/featured-image-preparation-service.ts: prepareFeaturedImage(articleId)
      1. article 조회 (없으면 실패 반환)
      2. theme 조회 (제목/키워드 재료 확보)
      3. article_mode별 규칙으로 prompt/alt text/caption/style/aspect ratio 생성
         (실제 이미지 생성 API 호출 없음 — 순수 규칙 기반)
      4. articles.featured_image_* 컬럼에 저장 (status='prepared')
      5. format_metadata.featured_image에도 요약 저장
      6. pipeline_logs에 시작/성공/실패 이벤트 기록
  → revalidatePath(`/articles/${articleId}`)
  → /articles/[id]의 "Featured Image Preparation" 섹션에서 결과 확인
```

준비는 `article.status`와 무관하게(draft 상태에서도) 실행할 수 있다.
WordPress 실제 게시(Phase 2-2의 `publishArticleToWordPressDraft`)만 여전히
`reviewed` 상태를 요구한다.

## article_mode별 이미지 전략

| 모드 | 전략 | 기본 style |
|---|---|---|
| `general_news` | 신뢰감 있는 뉴스형 이미지. 사건을 상징적으로 표현하고, 특정 실제 인물이나 과도하게 감정적인 이미지는 금지 | `clean editorial news photo` |
| `source_based_explainer` | 설명형 이미지. 구조/흐름/비교/개념을 인포그래픽 느낌으로 단순하게 시각화 | `simple explanatory editorial illustration` |
| `monetized_blog` | 클릭하고 싶지만 과장되지 않은 썸네일. 독자의 문제 상황을 시각적으로 보여주되 선정적·충격적 이미지는 금지 | `clickable but trustworthy blog thumbnail` |

기본 aspect ratio는 모든 모드에서 `16:9`다.

## prompt 생성 원칙

`featured_image_prompt`는 다음 구성 요소를 포함한다 (`lib/images/
featured-image-preparation-service.ts`의 `buildPrompt`):

- 주제 (target_keyword 또는 제목 기반)
- 시각적 장면 (article_mode별 장면 묘사)
- 독자 대상
- 분위기 (article_mode별 목표 감정)
- 색감/스타일
- 구도 (aspect ratio, 초점)
- 피해야 할 요소 (avoid list)

예 (monetized_blog):

> A clickable but trustworthy blog thumbnail showing a relatable scene
> showing a person facing a real-life situation related to "요양원 요양병원
> 차이", with helpful visual cues like a checklist or documents on a table.
> Audience: general readers interested in "요양원 요양병원 차이". Mood:
> curious but reassured. Color/style: clickable but trustworthy blog
> thumbnail, warm and clean color palette. Composition: 16:9 aspect ratio,
> balanced composition, clear focal point. Avoid: no real people's names or
> depictions, no celebrity likeness, no brand logos or trademarks, no text
> in image, no sensational, shocking, or fear-inducing imagery, no
> advertisement-style click-bait phrases.

### 공통 금지 요소 (모든 모드)

- 실제 인물의 이름이나 모습을 묘사하지 않는다
- 유명인의 얼굴을 생성하지 않는다
- 브랜드 로고나 상표를 넣지 않는다
- 이미지 안에 텍스트를 넣지 않는다

### 모드별 추가 금지 요소

- `general_news`: 실제 사건을 조작해서 묘사하지 않는다, 과도하게 감정적이거나 선정적인 이미지 금지
- `monetized_blog`: 선정적·충격적·공포 조장 이미지 금지, 광고 클릭 유도 문구 금지
- `source_based_explainer`: 지나치게 복잡하거나 어수선한 사진 구성 금지

## alt text 생성 원칙

`buildAltText()`가 article_mode별 템플릿(`ALT_TEXT_TEMPLATE_BY_MODE`)으로
target_keyword(또는 제목)를 자연스럽게 포함한 한 문장을 만든다. 140자를
넘으면 잘라낸다. "이미지", "사진" 같은 불필요한 말은 넣지 않는다.

예: `요양원 요양병원 차이 선택 기준을 비교하는 모습과 체크리스트를 표현한 일러스트`

## caption 생성 원칙

`buildCaption()`은 `meta_description`이 있으면 그 첫 문장을 그대로 사용해
글의 핵심 메시지와 자연스럽게 연결하고, 없으면 article_mode별 템플릿
(`CAPTION_TEMPLATE_BY_MODE`)으로 대체한다. 광고성 문구는 포함하지 않는다.

## 왜 이미지 안에 글자를 넣지 않는지

- AI 이미지 생성 모델은 이미지 안의 글자를 정확하게 렌더링하지 못하는 경우가
  많아(깨진 글자, 오탈자) 오히려 품질을 떨어뜨린다.
- 제목/핵심 메시지는 alt text와 caption으로 충분히 전달할 수 있다 (SEO에도
  이 편이 유리하다 — 검색엔진은 이미지 내 텍스트보다 alt text를 신뢰한다).
- `lib/images/featured-image-config.ts`의 `COMMON_AVOID_LIST`에
  `"no text in image"`가 항상 포함되도록 강제한다.

## 왜 실제 이미지 생성/업로드를 아직 하지 않는지

- 실제 이미지 생성 API(예: DALL·E, Midjourney, Stable Diffusion 등)를
  호출하려면 별도의 API key, 비용 관리, 생성 결과 검수 절차가 필요하다.
- WordPress media upload는 실제 파일을 다루므로 저장 위치, 용량 제한,
  실패 시 재시도 등 별도 구현이 필요하다.
- 사람이 먼저 prompt/alt text/caption을 검토하고 승인한 뒤에 실제 생성으로
  넘어가는 것이 안전하다 (Human Approval 원칙과 일관됨).
- `lib/images/featured-image-uploader.ts`의 `resolveExistingFeaturedMediaId`는
  이미 업로드된 media id가 있으면 그대로 사용하는 구조만 제공하며, 실제
  업로드 로직은 아직 없다 (safe stub).

## dry-run mode에서의 동작

- Featured Image Preparation 자체는 `WORDPRESS_PUBLISH_ENABLED` 값과 무관하게
  항상 동작한다 (실제 이미지 생성이나 업로드가 없기 때문).
- `WORDPRESS_PUBLISH_ENABLED=false` 상태에서 Phase 2-2의
  `publishArticleToWordPressDraft`를 실행하면, `publish_logs.details`에
  featured image 요약이 포함된다:

```json
{
  "featuredImage": {
    "status": "prepared",
    "altText": "...",
    "caption": "...",
    "style": "...",
    "aspectRatio": "16:9"
  }
}
```

  prompt 전체나 이미지 파일은 details에 저장하지 않는다.

- `WORDPRESS_PUBLISH_ENABLED=true`인 실제 게시에서도, `featured_image_
  wordpress_media_id`가 없으면(현재 항상 없음) `featured_media`를 post
  payload에 포함하지 않고 `featured_image_upload_skipped_not_implemented`와
  `wordpress_featured_image_skipped_no_media` 이벤트만 기록한다.

## 나중에 WordPress media upload와 featured_media로 연결하는 방식

1. 실제 이미지 생성 API를 연동해 `featured_image_prompt`로 이미지를 생성한다.
2. 생성된 이미지를 `/wp-json/wp/v2/media`에 업로드해 media id를 받는다.
3. `articles.featured_image_wordpress_media_id`/`featured_image_wordpress_url`에
   저장하고 `featured_image_status`를 `'uploaded'`로 전환한다.
4. `lib/images/featured-image-uploader.ts`의 `resolveExistingFeaturedMediaId`가
   이 media id를 자동으로 찾아 반환하므로, `lib/publish/publish-service.ts`의
   `createDraftPost` 호출에 `featuredMedia`로 그대로 전달된다 (이미 구조가
   준비되어 있다 — `lib/publish/wordpress-client.ts`의 `CreateDraftPostInput.
   featuredMedia`가 WordPress post의 `featured_media` 필드로 매핑된다).

## 다음 단계 제안

- 실제 이미지 생성 API 연동 (사람이 승인한 prompt만 실제로 생성)
- WordPress media upload 구현 및 `featured_image_status='uploaded'` 전환
- 이미지 생성 결과에 대한 사람 검토 단계 추가 (생성된 이미지가 prompt/정책과
  일치하는지 확인)
