# 환경변수 정리

이 문서는 content-pipeline이 사용하는 환경변수를 정리한다. **실제 값은
이 문서에 절대 쓰지 않는다** — 모든 예시는 placeholder(`...`, `xxxx`)만
사용한다. 실제 값은 로컬 `.env.local`에만 저장하며, `.env.local`은
`.gitignore`에 의해 **git에 커밋되지 않는다** (커밋 금지).

실제로 채워야 할 값의 placeholder 목록은 `.env.example`을 그대로
복사해서 `.env.local`로 사용하면 된다.

```bash
cp .env.example .env.local
```

## Supabase

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL. 브라우저에 노출되어도 되는 값. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable(anon) key. 브라우저 클라이언트(`lib/supabase/client.ts`)에서 사용. |
| `SUPABASE_SECRET_KEY` | Supabase secret key. **서버 코드에서만** 사용(`lib/supabase/server.ts`). `NEXT_PUBLIC_` 접두사가 없으므로 브라우저 번들에 포함되지 않는다. 절대 client component에 노출하지 않는다. |

## Anthropic

| 변수 | 설명 |
|---|---|
| `ANTHROPIC_API_KEY` | 기사 생성/평가에 사용하는 Anthropic API key. 서버 코드에서만 사용한다. |
| `AI_PROVIDER` | 기본값 `anthropic`. |
| `AI_GENERATION_ENABLED` | `true`이면 실제 AI 생성을 사용하고, `false`(기본값)이면 mock generator를 사용한다. |

## Naver/Daum (트렌드/기사 검색)

| 변수 | 설명 |
|---|---|
| `NAVER_CLIENT_ID` | 네이버 검색 API client id. |
| `NAVER_CLIENT_SECRET` | 네이버 검색 API client secret. |
| `KAKAO_REST_API_KEY` | 카카오 REST API key (다음 뉴스 트렌드). |
| `TREND_COLLECTION_ENABLED` | `true`이면 실제 네이버/다음 API를 사용하고, `false`(기본값)이면 mock 데이터를 사용한다. |
| `ARTICLE_SEARCH_ENABLED` | `true`이면 실제 네이버/카카오 검색 API로 기사 URL 후보를 수집하고, `false`(기본값)이면 mock 데이터를 사용한다. |

## WordPress

| 변수 | 설명 |
|---|---|
| `WORDPRESS_BASE_URL` | WordPress 사이트 URL (예: `https://your-site.example`). |
| `WORDPRESS_USERNAME` | WordPress Application Password 사용자명. |
| `WORDPRESS_APP_PASSWORD` | WordPress Application Password. **절대 로그/문서/화면에 실제 값을 남기지 않는다.** WordPress 관리자 > 사용자 > 프로필 > "응용 프로그램 비밀번호"에서 발급한다. |
| `WORDPRESS_PUBLISH_ENABLED` | `true`이면 실제 WordPress REST API를 호출해 draft를 생성하고, `false`(기본값)이면 dry-run으로 처리한다. `true`여도 draft 생성 단계의 post status는 항상 `draft`로 강제된다 (Phase 2-17의 별도 공개 게시 승인 없이는 `publish`로 바뀌지 않는다). |
| `WORDPRESS_MEDIA_UPLOAD_ENABLED` | `true`이면 실제 media upload API를 호출하고, `false`(기본값)이면 dry-run으로 처리한다. |

## SEO

| 변수 | 설명 |
|---|---|
| `SEO_PLUGIN_PROVIDER` | 허용 값: `none`/`yoast`/`rank_math`/`aioseo`. 잘못된 값이면 `none`으로 대체된다. |
| `SEO_PLUGIN_WRITE_ENABLED` | `true`이면 표준 REST posts meta로 실제 SEO metadata write를 시도한다. |
| `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED` | `true`이면 표준 REST 대신 custom endpoint(Rank Math 전용, Phase 2-13)로 SEO metadata를 직접 저장한다. |
| `WORDPRESS_SEO_CUSTOM_ENDPOINT_PATH` | custom endpoint 경로. 기본값 `/wp-json/ai-pipeline/v1/seo-meta`. |

## Image

| 변수 | 설명 |
|---|---|
| `IMAGE_GENERATION_PROVIDER` | 허용 값: `mock`/`openai`/`custom`. 기본값은 안전한 `mock`. |
| `IMAGE_GENERATION_ENABLED` | `true`이면 실제 provider API를 호출하고, `false`(기본값)이면 mock으로 대체한다. |
| `IMAGE_GENERATION_DEFAULT_MODEL` | 실제 provider 호출 시 기본 모델명 (예: `dall-e-3`). 비워두면 provider 기본값 사용. |
| `IMAGE_GENERATION_TIMEOUT_MS` | 실제 provider 호출 타임아웃(ms). 기본값 `30000`. |
| `OPENAI_API_KEY` | `IMAGE_GENERATION_PROVIDER=openai`일 때만 사용. 서버 코드에서만 사용한다. |

## 안전 기본값 원칙

위 `*_ENABLED` 플래그는 모두 기본값이 `false`(또는 `none`/`mock`)이다.
운영 환경에서 실제 API를 사용하려면 명시적으로 `true`/실제 provider로
바꿔야 하며, 그 경우에도 공개 게시(publish)는 Phase 2-16 Human Approval을
거쳐야만 Phase 2-17에서 실행할 수 있다.

## .env.local 관리 원칙

- `.env.local`은 `.gitignore`에 의해 커밋되지 않는다 (`.env*`는 무시되고
  `.env.example`만 예외적으로 추적된다).
- `.env.example`에는 실제 값을 절대 채우지 않고 placeholder/기본값만
  둔다.
- API key/Application Password를 교체(rotate)할 때는
  `docs/security-checklist.md`의 절차를 따른다.
