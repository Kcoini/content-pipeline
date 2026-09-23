# 환경변수 Inventory (OPS-02B)

- 작성일: 2026-09-23
- 방법: `app/`, `lib/`, `scripts/`에서 `process.env.XXX` 전수 검색(테스트
  파일 제외) 후 실제 사용처를 하나씩 확인했다. **실제 secret 값은 이
  문서 어디에도 없다** — 이름과 분류만 기록한다.

## 분류 기준

- **Required**: 이 값이 없으면 앱 핵심 기능(DB 연결 등)이 동작하지 않는다.
- **Required for X**: 특정 기능 flag가 켜져 있을 때만 필요하다.
- **Optional**: 없어도 안전한 기본값으로 동작한다.
- **Dev/Test only**: 실제 코드에서 프로덕션 경로로 쓰이지 않는다.
- **Dangerous flag**: `true`가 되면 실제 외부 side effect(게시 등)를
  유발할 수 있는 flag — production에서는 반드시 안전값(대부분 `false`)
  이어야 한다.

## 표

| 변수 | 목적 | 분류 | 사용처 | 안전 기본값 | Secret |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Required | `lib/supabase/client.ts`, `server.ts` | 없음(필수) | 아니오(공개 가능) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key | Required | `lib/supabase/client.ts` | 없음(필수) | 아니오(공개 가능 키) |
| `SUPABASE_SECRET_KEY` | Supabase 서버 전용 secret key | Required | `lib/supabase/server.ts` | 없음(필수) | **예** |
| `AI_GENERATION_ENABLED` | 기사 AI 생성 on/off | Optional | `lib/ai/ai-config.ts` | `false`(mock 생성으로 대체) | 아니오 |
| `AI_PROVIDER` | AI provider 선택 | Optional | `lib/ai/ai-config.ts` | `"anthropic"` | 아니오 |
| `ANTHROPIC_API_KEY` | Anthropic API 인증 | Required for AI_GENERATION_ENABLED=true | `lib/ai/anthropic-client.ts`, `ai-config.ts` | 없음(AI 기능에는 필수) | **예** |
| `SOCIAL_AI_GENERATION_ENABLED` | SNS 글 AI 생성 on/off | Optional | `lib/social/social-ai-generation-config.ts` | `false`(mock) | 아니오 |
| `SOCIAL_AI_MODEL` / `SOCIAL_AI_MAX_TOKENS` / `SOCIAL_AI_TEMPERATURE` | SNS 생성 모델 파라미터 | Optional | 위와 동일 파일 | 코드 내 기본값 사용 | 아니오 |
| `SOCIAL_REWRITE_AI_ENABLED` / `_MODEL` / `_MAX_TOKENS` / `_TEMPERATURE` | Rewrite AI 생성 설정 | Optional | `lib/social/social-rewrite-ai-config.ts` | `false`/코드 기본값 | 아니오 |
| `WORDPRESS_BASE_URL` | WordPress 사이트 URL | Required for WORDPRESS_PUBLISH_ENABLED=true | `lib/publish/wordpress-client.ts`(+SEO) | 없음(WordPress 기능에 필수) | 아니오(URL 자체는 낮은 민감도지만 내부 인프라 정보이므로 UI에 노출하지 않는다) |
| `WORDPRESS_USERNAME` | WordPress 인증 사용자명 | Required for WORDPRESS_PUBLISH_ENABLED=true | 위와 동일 | 없음 | **예**(계정 식별정보) |
| `WORDPRESS_APP_PASSWORD` | WordPress App Password | Required for WORDPRESS_PUBLISH_ENABLED=true | 위와 동일 | 없음 | **예** |
| `WORDPRESS_PUBLISH_ENABLED` | 실제 WordPress API 호출 on/off(Draft 포함) | **Dangerous flag** | `lib/publish/publish-service.ts`, `wordpress-client.ts`, `wordpress-media-preparation-service.ts` | `false`(dry-run) — fail-closed 확인됨(엄격한 `=== "true"` 비교) | 아니오 |
| `WORDPRESS_MEDIA_UPLOAD_ENABLED` | 대표 이미지 실제 업로드 on/off | Optional(WORDPRESS_PUBLISH_ENABLED=true일 때만 의미) | `lib/publish/wordpress-media-config.ts` | `false` | 아니오 |
| `WORDPRESS_MEDIA_MAX_SIZE_MB` | 업로드 허용 최대 용량 | Optional | `lib/publish/wordpress-media-config.ts` | 코드 기본값 | 아니오 |
| `SEO_PLUGIN_PROVIDER` | SEO plugin 종류 선택 | Optional | `lib/seo/seo-plugin-config.ts` | `"none"` 계열 기본값 | 아니오 |
| `SEO_PLUGIN_WRITE_ENABLED` | SEO plugin 실제 write on/off | **Dangerous flag**(WORDPRESS_PUBLISH_ENABLED=true와 함께여야 실제 반영) | `lib/seo/seo-plugin-writer.ts` | `false` | 아니오 |
| `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED` | Rank Math custom endpoint 사용 여부 | Optional | `lib/seo/wordpress-seo-custom-endpoint-client.ts` | `false` | 아니오 |
| `WORDPRESS_SEO_CUSTOM_ENDPOINT_PATH` | custom endpoint 경로 | Optional | 위와 동일 | 코드 기본 경로 | 아니오 |
| `ARTICLE_SEARCH_ENABLED` | 관련기사 검색 실제 API on/off | Optional | `lib/article-search/article-search-service.ts` | `false`(mock/테스트 데이터 모드) | 아니오 |
| `TREND_COLLECTION_ENABLED` | 트렌드 수집 실제 API on/off | Optional | `lib/trends/trend-service.ts` | `false` | 아니오 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 네이버 검색 API 인증 | Required for TREND_COLLECTION_ENABLED=true(네이버 소스) | `lib/trends/naver-client.ts` | 없음 | **예** |
| `KAKAO_REST_API_KEY` | 다음(카카오) 검색 API 인증 | Required for TREND_COLLECTION_ENABLED=true(다음 소스) | `lib/trends/daum-client.ts` | 없음 | **예** |
| `DAUM_SEARCH_MAX_PAGES` / `DAUM_SEARCH_PAGE_SIZE` | 다음 검색 수집 파라미터 | Optional | `lib/trends/daum-collection-config.ts` | 코드 기본값 | 아니오 |
| `IMAGE_GENERATION_ENABLED` | 이미지 실제 생성 on/off | Optional | `lib/images/image-generation-config.ts` | `false` | 아니오 |
| `IMAGE_GENERATION_PROVIDER` / `_DEFAULT_MODEL` / `_TIMEOUT_MS` | 이미지 생성 provider 설정 | Optional | 위와 동일 | 코드 기본값 | 아니오 |
| `OPENAI_API_KEY` | 이미지 생성 provider(OpenAI) 인증 | Required for IMAGE_GENERATION_ENABLED=true & provider=openai | `lib/images/providers/openai-image-provider.ts` | 없음 | **예** |
| `PLATFORM_API_PUBLISHING_ENABLED` | SNS 플랫폼 API 실제 게시 on/off | **Dangerous flag** | `lib/social/platform-api-readiness-checker.ts` | `false` — 이 프로젝트에는 실제 게시 호출 코드가 어디에도 구현되어 있지 않음(readiness 확인용 flag만 존재) | 아니오 |
| `PLATFORM_API_DRY_RUN_ONLY` | 플랫폼 API를 dry-run 전용으로 강제 | **Dangerous flag(반대 방향 — false가 위험)** | `lib/social/platform-api-readiness-checker.ts` | `true`(기본, `!== "false"`로 판정 — 명시적으로 `"false"`를 줘야 해제됨) | 아니오 |
| `WORDPRESS_API_PUBLISH_ENABLED`, `X_API_PUBLISH_ENABLED`, `THREADS_API_PUBLISH_ENABLED`, `INSTAGRAM_API_PUBLISH_ENABLED`, `NAVER_BLOG_API_PUBLISH_ENABLED`, `NAVER_CAFE_API_PUBLISH_ENABLED`, `SOCIAL_PUBLISH_ENABLED` | 플랫폼별 "미래" 실제 게시 flag(현재 코드로는 호출 경로가 없음) | **Dangerous flag(향후 대비)** | `lib/social/feature-flag-safety-auditor.ts`(이미 audit 로직 존재), `platform-api-capabilities.ts` | `false` | 아니오 |
| `X_API_BEARER_TOKEN` | X API 인증(readiness 확인용, 실제 게시 없음) | Optional | `lib/social/platform-api-readiness-checker.ts` | 없음 | **예** |

## 참고

- `OPS01_RESUME_ARTICLE_ID` / `OPS01_RESUME_THEME_ID`는 OPS-01 파일럿
  드라이버 스크립트(`scripts/ops-01/`) 전용 재개용 변수로, 앱 코드
  경로에는 전혀 쓰이지 않는다 — **Dev/Test only**로 분류하고 이 표에서
  제외했다.
- `.env.example`이 프로젝트에 없다 — OPS-02B backlog로 추가를 권장한다
  (실제 값 없이 변수 이름/설명만 담은 템플릿).
