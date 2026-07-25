# Phase 2-3: WordPress Category, Tag, SEO Metadata

## 목적

article generation 이후 WordPress 게시 준비를 위해 카테고리, 태그, SEO 제목,
메타 설명, slug, 내부 링크 후보를 생성·저장·표시할 수 있게 한다. 실제
WordPress 사이트 연결(Phase 2-2의 `WORDPRESS_PUBLISH_ENABLED=true`)이 없어도
metadata 생성과 dry-run이 항상 동작해야 한다.

## WordPress metadata 생성 흐름

```
/articles/[id] (draft 또는 reviewed 모두 가능)
  → "WordPress metadata 생성" 버튼 클릭
  → generateWordPressMetadataAction (서버 액션)
  → lib/publish/wordpress-metadata-service.ts: generateWordPressMetadata(articleId)
      1. article 조회 (없으면 실패 반환)
      2. theme 조회 (keywords 등 재료 확보)
      3. article_mode/키워드/제목/본문 헤딩 기반 규칙으로 category/tag/SEO metadata 생성
         (실제 WordPress API 호출 없음, AI 호출도 없음 — 순수 규칙 기반)
      4. articles.seo_title/meta_description/slug/target_keyword/secondary_keywords/
         wp_category_names/wp_tag_names/wp_metadata_status='generated' 저장
      5. articles.format_metadata.wordpress에도 요약 저장
      6. pipeline_logs에 시작/성공/실패 이벤트 기록
  → revalidatePath(`/articles/${articleId}`)
  → /articles/[id]의 "WordPress Metadata" 섹션에서 결과 확인
```

metadata 생성은 `article.status`와 무관하게(draft 상태에서도) 실행할 수 있다.
WordPress 실제 게시(Phase 2-2의 `publishArticleToWordPressDraft`)만 여전히
`reviewed` 상태를 요구한다.

## article_mode별 metadata 차이

| 모드 | 카테고리 | 태그 | SEO 제목 | 메타 설명 | target_keyword | 내부 링크 |
|---|---|---|---|---|---|---|
| `general_news` | 1~2개 | 3~5개 | article.title 그대로 | 리드문/본문 앞부분 기반 | 선택 | 선택 |
| `source_based_explainer` | 1~2개 | 5~8개 | article.title 그대로 | 핵심 설명 앞부분 기반 | 선택 | 권장 |
| `monetized_blog` | 1~2개 | 6~10개 | `seo_title` 우선(Phase 2-1에서 생성된 값) | `meta_description` 우선 | 필수 | 필수(이미 존재) |

`seo_title`/`meta_description`이 이미 채워져 있으면(주로 `monetized_blog`) 그
값을 그대로 사용하고, 없으면 `article.title`/본문 앞부분에서 안전하게 생성한다
(`lib/publish/wordpress-metadata-service.ts`의 `resolveSeoTitle`/
`resolveMetaDescription`).

## category와 tag 설계 원칙

- **카테고리는 넓게**: 복지, 의료, 정책, IT, 금융, 부동산, 교육, 생활정보,
  블로그 운영 등 큰 분류 중 1~2개만 선택한다.
- **태그는 구체적으로**: theme.keywords, `target_keyword`, `secondary_keywords`,
  본문의 `##`/`###` 헤딩에서 추출한 구체적인 용어를 태그 후보로 사용한다.
- 이름 매칭은 키워드 사전(`CATEGORY_KEYWORD_MAP`)과의 부분 일치로 수행하며,
  일치하는 카테고리가 없으면 모드별 기본 카테고리(`생활정보` 또는
  `블로그 운영`)로 대체한다.
- 태그 후보가 모드별 최소 개수에 못 미치면 모드별 padding 후보
  (`TAG_PAD_POOL`)로 보충한다.
- 이번 단계는 **이름 기반 추천**만 수행하며 실제 WordPress API를 호출하지
  않는다(AI 호출도 하지 않는다) — 결정적이고 테스트 가능한 규칙 기반 로직이다.

## SEO title과 meta description 원칙

- `seo_title`이 이미 있으면(Phase 2-1 monetized_blog 생성 결과) 그대로 사용한다.
- 없으면 `article.title`을 그대로 사용한다 (과장 금지 원칙 유지).
- `meta_description`이 이미 있으면 그대로 사용한다.
- 없으면 본문에서 AD_SLOT marker/markdown 헤딩/특수기호를 제거한 순수 텍스트
  앞부분을 최대 160자로 잘라 사용한다.

## slug 생성 원칙

`lib/seo/slugify.ts`의 `slugify()`를 사용한다.

- 소스 우선순위: `target_keyword` > `article.title` > `theme.keywords[0]` >
  `theme.title`.
- 공백은 hyphen(-)으로, 허용되지 않는 특수문자는 제거한다.
- **한글 음절은 기본적으로 유지한다** (`allowKorean: true`가 기본값). 한글을
  완전히 제거하면 한글 제목의 slug가 비어버리는 경우가 많고, WordPress/브라우저
  모두 UTF-8 slug를 percent-encoding으로 안전하게 처리하기 때문이다. 영문
  `target_keyword`가 있으면 그쪽이 slug 소스로 우선 선택되므로 자연스럽게
  영문 slug가 만들어진다.
- 최대 길이(기본 60자)를 넘으면 자르고 끝에 남은 hyphen을 제거한다.
- 결과가 비어있으면 `article-<id 앞 8자>` 형태의 fallback을 사용한다
  (`articleIdSlugFallback`).

## dry-run mode에서의 동작

- **metadata 생성 자체는 `WORDPRESS_PUBLISH_ENABLED` 값과 무관하게 항상
  실제 WordPress API 호출 없이 동작한다.** 카테고리/태그 이름 추천, SEO
  제목/설명/slug 생성 모두 로컬 규칙 기반이기 때문이다.
- `WORDPRESS_PUBLISH_ENABLED=false` 상태에서 Phase 2-2의
  `publishArticleToWordPressDraft`를 실행하면, `wp_category_names`/
  `wp_tag_names`가 있어도 `findOrCreateCategory`/`findOrCreateTag`(실제 API
  호출)는 전혀 호출되지 않는다 (`wordpress_category_tag_sync_skipped_dry_run`
  이벤트만 기록). dry-run `publish_logs.details`에는 `categoryNames`/
  `tagNames`(이름만)가 포함된다.

## 실제 WordPress 연결 시 category/tag ID 동기화 방식

`WORDPRESS_PUBLISH_ENABLED=true`이고 `article.wpCategoryIds`/`wpTagIds`가
비어 있는데 이름(`wpCategoryNames`/`wpTagNames`)만 있으면,
`publishArticleToWordPressDraft`가 게시 직전에 다음을 수행한다:

1. `wordpress_category_tag_sync_started` 이벤트 기록
2. 각 이름에 대해 `findOrCreateCategory`/`findOrCreateTag` 호출
   (`/wp-json/wp/v2/categories`, `/wp-json/wp/v2/tags` — 이름으로 검색 후 없으면
   생성)
3. 얻은 ID를 `createDraftPost`의 `categories`/`tags`에 넘겨 post 생성
4. `wordpress_category_tag_sync_completed` 이벤트 기록 (실패해도
   `wordpress_category_tag_sync_failed`만 기록하고 카테고리/태그 없이 게시를
   계속한다 — 동기화 실패가 게시 자체를 막지 않는다)

`article.wpCategoryIds`/`wpTagIds`가 이미 채워져 있으면(예: 이전에 동기화된
경우) 재동기화 없이 그대로 사용한다.

## SEO plugin 연동은 아직 하지 않는다는 점

이번 단계는 WordPress **기본** post의 `title`, `excerpt`, `slug`,
`categories`, `tags`까지만 준비한다. RankMath, Yoast, All in One SEO 같은
SEO 플러그인의 전용 meta box/REST API 연동(포커스 키워드, SEO 점수, 소셜
공유 이미지 등)은 이번 단계에서 구현하지 않으며, 다음 단계로 미룬다.

## 다음 단계 제안

- RankMath/Yoast REST API 연동 (플러그인별 meta 필드 매핑)
- 카테고리 키워드 사전(`CATEGORY_KEYWORD_MAP`)을 설정 파일로 분리해 운영 중
  손쉽게 확장할 수 있게 하기
- 네이버 블로그/티스토리용 metadata 변환(카테고리 체계가 다름)
- WordPress draft publish 실행 시 `wp_metadata_status`가 `reviewed`가
  아니면 좀 더 눈에 띄는 경고 UI 제공
