# Phase 3 Environment Variables

이 문서는 Phase 3 관련 환경변수의 **이름과 용도만** 정리한다.
실제 값은 절대 이 문서에 쓰지 않는다 — 값은 `.env.local`에만
저장하며, `.env.local`은 항상 git에서 제외된다(`.gitignore`).
아래 이름들은 모두 `.env.example`에도 정의되어 있다(값은 비워둠).

## AI 생성 관련

| 변수 | 용도 |
| --- | --- |
| `ANTHROPIC_API_KEY` | 서버 코드에서만 사용하는 Claude API 키. 기사 생성/social post 생성/rewrite 제안 AI 호출에 재사용된다. |
| `SOCIAL_AI_GENERATION_ENABLED` | true이면 social post 생성 시 실제 Claude API를 호출하고, false(기본값)면 mock 생성을 사용한다. |
| `SOCIAL_AI_MODEL` | 실제 AI 생성 시 사용할 모델명(비워두면 안전한 기본값 사용). |
| `SOCIAL_AI_MAX_TOKENS` / `SOCIAL_AI_TEMPERATURE` | 실제 AI 생성 파라미터(비워두면 기본값 사용). |
| `SOCIAL_REWRITE_AI_ENABLED` | true이면 rewrite 제안 생성 시 실제 Claude API 호출을 시도하고, false(기본값)면 rule-based/mock suggestion만 생성한다. |
| `SOCIAL_REWRITE_AI_MODEL` / `SOCIAL_REWRITE_AI_MAX_TOKENS` / `SOCIAL_REWRITE_AI_TEMPERATURE` | 실제 rewrite AI 호출 파라미터(비워두면 기본값 사용). |

## WordPress 관련

| 변수 | 용도 |
| --- | --- |
| `WORDPRESS_BASE_URL` | WordPress 사이트 REST API 기본 URL. |
| `WORDPRESS_USERNAME` | WordPress REST API 인증용 사용자명. |
| `WORDPRESS_APP_PASSWORD` | WordPress Application Password(서버 코드 전용, 절대 노출 금지). |
| `WORDPRESS_PUBLISH_ENABLED` | true이면 실제 WordPress REST API로 draft를 생성한다(공개 게시 아님, 항상 draft 상태로 강제). false(기본값)면 dry-run으로 처리한다. |
| `WORDPRESS_MEDIA_UPLOAD_ENABLED` | 미디어 업로드 준비 플래그(기본 false, 실제 업로드는 아직 미구현 stub). |
| `SEO_PLUGIN_WRITE_ENABLED` | true이면 SEO plugin metadata 실제 write를 시도한다(draft post 대상). |
| `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED` | true이면 표준 REST 대신 custom endpoint로 SEO metadata를 저장한다. |

## Platform API Publishing Preparation (Phase 3-21)

| 변수 | 용도 |
| --- | --- |
| `PLATFORM_API_PUBLISHING_ENABLED` | 모든 플랫폼의 실제 API 게시를 여는 공통 스위치(기본 false). false면 어떤 플랫폼도 actual publish로 진행하지 않는다. |
| `PLATFORM_API_DRY_RUN_ONLY` | true(기본값)이면 위 스위치가 켜져 있어도 dry-run까지만 허용한다. |
| `WORDPRESS_API_PUBLISH_ENABLED` | WordPress API 게시 준비 개별 플래그(기본 false). |
| `NAVER_BLOG_API_PUBLISH_ENABLED` | Naver Blog API 게시 준비 개별 플래그(기본 false). |
| `NAVER_CAFE_API_PUBLISH_ENABLED` | Naver Cafe API 게시 준비 개별 플래그(기본 false). |
| `X_API_PUBLISH_ENABLED` | X(Twitter) API 게시 준비 개별 플래그(기본 false). |
| `THREADS_API_PUBLISH_ENABLED` | Threads API 게시 준비 개별 플래그(기본 false). |
| `INSTAGRAM_API_PUBLISH_ENABLED` | Instagram API 게시 준비 개별 플래그(기본 false). |
| `X_API_BEARER_TOKEN` / `THREADS_API_ACCESS_TOKEN` / `INSTAGRAM_API_ACCESS_TOKEN` / `NAVER_BLOG_API_CLIENT_ID` / `NAVER_BLOG_API_CLIENT_SECRET` / `NAVER_CAFE_API_CLIENT_ID` / `NAVER_CAFE_API_CLIENT_SECRET` | OAuth/토큰 저장용 이름만 예약됨(아직 실제로 사용되지 않음, readiness checker가 "설정 여부"만 확인). |

## Automation Safety Review (Phase 3-22)

| 변수 | 용도 |
| --- | --- |
| `SOCIAL_PUBLISH_ENABLED` | 향후 자동 게시 기능을 위해 예약된 공통 스위치 이름(기본 false). 현재 어떤 코드도 이 값으로 동작을 분기하지 않으며, automation safety review가 "기본값 false 유지"만 점검한다. |

## 트렌드/기사 URL 수집 관련 (Phase 1, 참고용)

| 변수 | 용도 |
| --- | --- |
| `TREND_COLLECTION_ENABLED` | true이면 실제 네이버/다음 트렌드 API를 사용한다. |
| `ARTICLE_SEARCH_ENABLED` | true이면 실제 네이버/카카오 검색 API를 사용한다. |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 네이버 검색/트렌드 API 인증 정보. |
| `KAKAO_REST_API_KEY` | 카카오 REST API(다음 뉴스 트렌드) 인증 정보. |

## 주의사항

- `.env.local`은 어떤 이유로도 읽거나 문서에 값을 복사하지 않는다.
- API key, access token, refresh token, Authorization header,
  Application Password의 **실제 값**은 이 저장소 어디에도 커밋하지
  않는다.
- 새 환경변수를 추가할 때는 반드시 `.env.example`에 이름과 기본값
  (빈 문자열 또는 `false`)만 추가한다.
- automation safety review는 이 문서의 flag들이 실제로 안전한
  기본값을 유지하는지 자동으로 점검한다
  (`/dashboard/automation-safety`, [`phase-3-22-automation-safety-review.md`](./phase-3-22-automation-safety-review.md)).

## 관련 문서

- 안전 체크리스트: [`phase-3-safety-checklist.md`](./phase-3-safety-checklist.md)
- 아키텍처: [`phase-3-architecture.md`](./phase-3-architecture.md)
