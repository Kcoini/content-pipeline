# Phase 2-4: SEO Plugin Metadata Mapping

## 목적

Phase 2-3에서 생성한 SEO title/meta description/slug/target keyword/secondary
keywords 등을 WordPress SEO 플러그인(Yoast/Rank Math/AIOSEO)별 metadata
payload로 변환하는 구조를 만든다. 실제 plugin write는 이번 단계에서 구현하지
않으며, mapping payload 생성·저장·검토까지만 지원한다.

## 지원 provider

| provider | 설명 |
|---|---|
| `none` | SEO plugin을 사용하지 않음. WordPress 기본 post title/excerpt/slug만 사용 |
| `yoast` | Yoast SEO용 payload 준비 |
| `rank_math` | Rank Math SEO용 payload 준비 |
| `aioseo` | All in One SEO용 payload 준비 |

기본값은 항상 안전한 `none`이며, `SEO_PLUGIN_PROVIDER` 값이 위 4개 중 하나가
아니면 `none`으로 자동 대체되고 경고가 로그에 남는다
(`lib/seo/seo-plugin-config.ts`의 `validateSeoPluginProvider`).

## 왜 실제 plugin write를 바로 하지 않는지

- Yoast/Rank Math/AIOSEO의 SEO 필드(제목, 설명, focus keyword 등)는 REST API로
  직접 쓸 수 있는지 여부가 **사이트/플러그인 버전/설정에 따라 다르다.**
  - Yoast는 조회용으로 `yoast_head`/`yoast_head_json`을 제공하지만, 외부에서
    `_yoast_wpseo_*` post meta를 실제로 "쓰는" 것은 해당 meta가
    `register_post_meta`로 REST API에 노출되어 있어야 가능하다 (기본 설정에서는
    보장되지 않는다).
  - Rank Math, AIOSEO도 유사하게 버전/설정에 따라 저장 구조(post meta 단일 키 vs
    직렬화된 배열 vs 전용 테이블)가 다르다.
- 검증되지 않은 key로 실제 write를 시도하면 사이트마다 실패하거나, 최악의 경우
  플러그인이 기대하지 않는 형식으로 데이터를 덮어써 SEO 설정이 깨질 수 있다.
- 따라서 이번 단계는 **"이 사이트에 어떤 값을 어떤 key로 넣을 예정인지"를 먼저
  준비하고 사람이 검토**하는 데 집중한다. 실제 write는 각 사이트에서 커스텀
  REST endpoint(또는 `register_meta`로 노출을 확인한 필드)를 준비한 뒤 안전하게
  연결한다.

## Yoast / Rank Math / AIOSEO의 metadata 저장 방식 차이

| plugin | 후보 post meta key | 비고 |
|---|---|---|
| Yoast | `_yoast_wpseo_title`, `_yoast_wpseo_metadesc`, `_yoast_wpseo_focuskw` | REST 노출 여부는 사이트 설정에 따라 다름 |
| Rank Math | `rank_math_title`, `rank_math_description`, `rank_math_focus_keyword` | 버전에 따라 키 이름이 달라질 수 있음 |
| AIOSEO | `_aioseo_title`, `_aioseo_description`, `_aioseo_keywords` | AIOSEO 4.x는 전용 테이블(`wp_aioseo_posts`)을 사용할 수도 있음 |

이 표의 key는 **잠재적 후보**이며, 실제 정답으로 단정하지 않는다.
`lib/seo/plugin-mappers/*.ts`의 각 mapper는 이 후보들을 `rawPluginMeta`에
채워 넣고 `writeMode: "prepared_only"`로 표시한다.

## 현재는 mapping payload와 dry-run 중심이라는 점

`generateSeoPluginPayload(articleId, providerOverride?)`
(`lib/seo/seo-plugin-metadata-service.ts`)는:

1. article 조회
2. provider 결정 (인자 > `SEO_PLUGIN_PROVIDER` 환경변수 > `none`)
3. `lib/seo/plugin-mappers/index.ts`의 `mapSeoPluginPayload`로 payload 생성
4. `articles.seo_plugin_provider`, `seo_plugin_payload`,
   `seo_plugin_metadata_status='generated'`, `seo_plugin_metadata_generated_at`
   저장
5. `pipeline_logs`에 시작/성공/실패 이벤트 기록

실제 WordPress/plugin API는 이 흐름에서 전혀 호출되지 않는다. 따라서
`WORDPRESS_PUBLISH_ENABLED`/`SEO_PLUGIN_WRITE_ENABLED` 값과 무관하게 항상
동작한다.

## 환경변수

| 변수 | 설명 | 기본값 |
|---|---|---|
| `SEO_PLUGIN_PROVIDER` | `none`/`yoast`/`rank_math`/`aioseo` | `none` |
| `SEO_PLUGIN_WRITE_ENABLED` | `true`면 실제 plugin write 시도(현재는 safe stub이라 항상 실패), `false`면 시도 자체를 건너뜀 | `false` |

**중요**: `SEO_PLUGIN_WRITE_ENABLED=true`여도 `WORDPRESS_PUBLISH_ENABLED=true`가
아니면 실제 WordPress API는 호출되지 않는다
(`lib/seo/seo-plugin-writer.ts`의 `applySeoPluginMetadata`가 두 조건을 모두
확인한다).

## UI 사용 방법

`/articles/[id]`의 **SEO Plugin Metadata** 섹션에서:

1. provider를 선택하고(기본값은 현재 저장된 provider) **"SEO plugin metadata
   생성"**(또는 "다시 생성") 클릭 — 승인(reviewed) 여부와 무관하게 언제든
   가능하다.
2. 생성된 SEO title/meta description/focus keyword/secondary keywords와
   `rawPluginMeta` 후보를 확인한다.
3. 검토가 끝나면 **"검토 완료"**를 클릭한다 (`seo_plugin_metadata_status`가
   `reviewed`로 바뀐다). 이 검토는 WordPress 게시를 막는 필수 조건이 아니며,
   미검토 시 경고만 표시된다.

`WordPress 게시` 섹션에서 실제 게시(`WORDPRESS_PUBLISH_ENABLED=true`) 성공
시, provider가 `none`이 아니면 `applySeoPluginMetadata`가 호출되어
`seo_plugin_write_status`가 갱신된다(`skipped_provider_none` /
`skipped_dry_run` / `failed` 중 하나 — 실제 write가 구현되기 전까지는
`success`가 될 수 없다).

## 나중에 실제 WordPress 연결 후 확인할 사항

- 대상 WordPress 사이트에 설치된 SEO plugin의 정확한 버전과 REST API 노출
  설정(어떤 meta가 `register_meta`로 노출되어 있는지)
- 커스텀 endpoint 필요 여부 — 대부분의 경우 plugin 기본 REST API만으로는
  SEO 필드를 직접 쓸 수 없어 소규모 mu-plugin/커스텀 endpoint가 필요하다
- AIOSEO처럼 전용 테이블을 사용하는 plugin은 post meta 방식이 아예 통하지
  않을 수 있음
- 각 plugin의 canonical URL/OG/Twitter 필드가 실제로 어떤 key로 저장되는지
  (이번 단계의 `ogTitle`/`ogDescription`/`twitterTitle`/`twitterDescription`/
  `canonicalUrl`/`schemaType`은 공통 후보 필드일 뿐, plugin별 실제 key는
  다르다)

## 커스텀 endpoint가 필요할 수 있다는 점

WordPress 기본 REST API(`/wp-json/wp/v2/posts`)는 SEO plugin의 전용 meta
필드를 기본적으로 노출하지 않는 경우가 많다. 실제 write를 구현하려면:

1. 대상 사이트에 필요한 meta를 `register_post_meta(..., 'show_in_rest' => true)`로
   노출하거나,
2. 소규모 mu-plugin으로 커스텀 REST endpoint(`/wp-json/content-pipeline/v1/seo-meta`
   등)를 추가해 안전하게 write하는 방식을 권장한다.

`lib/seo/seo-plugin-writer.ts`의 `applySeoPluginMetadata`는 이런 확인이
끝난 뒤 내부 구현만 교체하면 되도록 인터페이스를 미리 준비해 두었다.

## 다음 단계 제안

- 실제 WordPress 사이트에 SEO plugin을 설치하고 REST 노출 설정을 확인한 뒤
  `applySeoPluginMetadata`의 실제 write 로직 구현
- provider별 canonical/OG/Twitter/schema 필드의 정확한 post meta key 조사 및
  매핑 보완
- 네이버 블로그/티스토리 SEO 필드 매핑(플랫폼마다 개념이 다름)
