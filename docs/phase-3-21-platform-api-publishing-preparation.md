# Phase 3-21: Platform API Publishing Preparation

## 목적

Phase 3-7~3-20이 만든 approval/export/dry-run/handoff/manual
posting/metrics/A/B test 구조 위에, 향후 실제 플랫폼 API 게시를
"안전하게" 연결할 수 있는 **준비 구조**만 만든다. 이번 단계는 실행이
아니다 — 어떤 플랫폼에도 실제로 게시하지 않으며, 모든 API publish는
기본 disabled 상태를 유지한다.

## Phase 3-7~3-20과의 관계

- Phase 3-6(Platform Publishing Guard)/3-7(Dry-run & Handoff)/
  3-8(Manual Posting)의 `platform_publish_guard_status`/
  `platform_publish_dry_run_status`/`handoff_status`/
  `manual_post_status` 컬럼과 로직은 전혀 바꾸지 않았다 —
  `checkPlatformApiPublishEligibility()`가 이 값들을 **읽기만** 한다.
- Phase 3-9(Manual Metrics)의 `social_post_metrics`도 그대로
  재사용한다 — 이 단계는 metrics를 자동 수집하지 않는다.
- Phase 3-20(A/B Testing Draft Structure)과 마찬가지로 "실행 전 준비
  단계"라는 같은 패턴을 따른다 — draft/준비 구조를 먼저 만들고,
  실제 실행은 명시적으로 별도 Phase에서 활성화한다.
- WordPress는 Phase 2-2/2-8부터 이미 실제 draft API 연동이
  있다(`WORDPRESS_PUBLISH_ENABLED`, `lib/publish/publish-service.ts`).
  이번 단계의 `WORDPRESS_API_PUBLISH_ENABLED`/`wordpressApiPublishAdapter`
  는 그 코드를 대체하지 않는, 완전히 별도의 "준비 상태 확인" 경로다.

## 왜 actual publish 전에 preparation phase가 필요한지

X/Threads/Instagram/Naver 같은 플랫폼은 OAuth 인증, 앱 심사, media
업로드 규격, rate limit 등 실제 게시 전에 확인해야 할 조건이 많다.
이 조건들을 코드로 미리 구조화해두면(capability matrix, readiness
checker, eligibility guard, 표준화된 dry-run payload) 나중에 실제
API를 연결할 때 "무엇이 준비됐고 무엇이 빠졌는지"를 즉시 알 수
있다 — 그리고 그 전까지는 실수로라도 실제 게시가 일어나지 않도록
구조적으로 막아둔다(feature flag 이중 체크 + OAuth 미구현 시 항상
`blocked`).

## feature flags 설명

`.env.example`에 정의됨(실제 값은 `.env.local`에만, 커밋 금지).

- `PLATFORM_API_PUBLISHING_ENABLED`(기본 false): 모든 플랫폼의
  actual publish를 여는 공통 스위치. false면 어떤 플랫폼도 진행하지
  않는다.
- `PLATFORM_API_DRY_RUN_ONLY`(기본 true): true면 위 스위치가 켜져
  있어도 dry-run까지만 허용한다.
- `WORDPRESS_API_PUBLISH_ENABLED`/`NAVER_BLOG_API_PUBLISH_ENABLED`/
  `NAVER_CAFE_API_PUBLISH_ENABLED`/`X_API_PUBLISH_ENABLED`/
  `THREADS_API_PUBLISH_ENABLED`/`INSTAGRAM_API_PUBLISH_ENABLED`
  (모두 기본 false): 플랫폼별 개별 스위치. 공통 스위치와 **모두**
  true여야 의미가 있다.
- `X_API_BEARER_TOKEN`/`THREADS_API_ACCESS_TOKEN`/
  `INSTAGRAM_API_ACCESS_TOKEN`/`NAVER_BLOG_API_CLIENT_ID`/
  `NAVER_BLOG_API_CLIENT_SECRET`/`NAVER_CAFE_API_CLIENT_ID`/
  `NAVER_CAFE_API_CLIENT_SECRET`: 이번 단계에서 실제로 사용되지
  않는다(OAuth flow/token storage 미구현) — readiness checker가
  "설정 여부"만 확인하기 위해 이름만 미리 정의해뒀다.

## platform capability matrix 설명

`lib/social/platform-api-capabilities.ts`의 `getPlatformApiCapability(platform)`.
DB/환경변수를 전혀 조회하지 않는 **정적** 데이터다 — "이 플랫폼이
이론적으로 무엇을 지원하는지"만 나타내며 실제 연결 완료를 의미하지
않는다.

| platform | supportsApiPublishing | currentMode |
|---|---|---|
| wordpress_blog | true | draft_or_manual_existing (Phase 2-2 API 이미 있음) |
| naver_blog | false | manual_export |
| naver_cafe | false | manual_export |
| x | true | preparation_only |
| threads | true | preparation_only |
| instagram | true | preparation_only |

UI에는 `getPlatformApiModeLabel()`로 "준비 가능(기존 API 연동 있음)"
/ "수동 export 우선" / "현재 비활성화(준비 단계)" 세 문구만 보여준다.

## readiness check 설명

`lib/social/platform-api-readiness-checker.ts`의
`checkPlatformApiReadiness(platform)`. **환경변수 값은 절대 반환하지
않는다** — 이름과 "있다/없다"만 확인한다. 판정 순서:

1. `!capability.supportsDryRun` → `not_supported`
2. 공통 flag 또는 platform별 flag가 꺼져 있음 → `disabled`
3. 필요한 환경변수가 하나라도 없음 → `missing_config`
4. `capability.requiresOAuth === true`(x/threads/instagram) → 항상
   `blocked` — 이 프로젝트에는 아직 OAuth flow/token storage가
   없으므로, flag/env가 모두 준비돼 보여도 구조적으로 막는다.
5. `PLATFORM_API_DRY_RUN_ONLY`가 기본값(true) → `dry_run_ready`
6. 모든 조건 충족 + dry-run-only 해제 → `ready_for_future_test`
   (이 상태여도 실제 호출 코드는 이번 단계에 없다)

## adapter interface 설명

`lib/social/platform-publish-adapter.ts`의 `PlatformPublishAdapter`
interface: `buildDryRunPayload`/`validatePayload`/`checkReadiness`
(모두 필수, 외부 호출 없음), `publish?`(선택, 구현해도 항상
`disabledPublishResult()`를 반환). `lib/social/platform-adapters/`에
플랫폼별 skeleton 6개 + `index.ts` registry(`getPlatformPublishAdapter`)
가 있다. 어떤 adapter도 `fetch`를 사용하지 않는다(테스트로 확인).

## dry-run payload 설명

`lib/social/platform-api-publish-payload-builder.ts`의
`buildPlatformApiPublishDryRunPayload(socialPostId)`가 social_post를
조회해 adapter의 `buildDryRunPayload`+`validatePayload`를 호출하고,
표준 형태(`title`/`textPreview`/`captionPreview`/`hashtags`/
`mediaRequirements`/`payloadShape`/`validation`/`warnings`)로 감싼다.
`payloadShape`는 실제 API가 기대하는 필드 이름을 흉내 낼 뿐(예:
WordPress의 `title`/`content`/`status='draft'`) 실제 호출에 쓰이는
최종 object가 아니며 토큰/서명이 전혀 없다. `textPreview`/
`captionPreview`는 300자 이상이면 잘라서 만들지만, `payloadShape` 안
필드(`content`/`caption` 등)에는 전체 본문이 들어갈 수 있다 — 이
값은 UI에서 `<details>`로 접어 보여주며, **로그에는 절대 남기지
않는다**(preparation service가 로그에 넘기는 값은 카운트/상태값뿐).

## eligibility guard 설명

`lib/social/platform-api-publish-eligibility-guard.ts`의
`checkPlatformApiPublishEligibility(socialPostId)`. 기존
quality/approval/export/guard/dry-run/handoff/publish/manual-post
상태를 모두 확인해 `blockers`/`warnings`를 만들고, 두 결과를
반환한다:

- `eligibleForDryRun`: social_post가 존재하고 readiness가
  `not_supported`가 아니면 true — 나머지 blocker와 무관하게
  대체로 관대하다(탐색용).
- `eligibleForActualPublish`: 위 blocker가 하나도 없고, readiness가
  `dry_run_ready`/`ready_for_future_test`이고, `publishEnabled &&
  !dryRunOnly`일 때만 true. **`PLATFORM_API_PUBLISHING_ENABLED=false`
  이거나 `PLATFORM_API_DRY_RUN_ONLY=true`(기본값)인 한 항상
  false다.**

## UI 표시 기준

- `/social-posts/[id]`: "API Publishing (준비 단계)" 섹션 —
  readiness/eligibility 요약(`ApiReadinessSummary`), 마지막 저장된
  `api_publish_preparation_status`/시각, "API 게시 준비 상태 확인"
  버튼(→ `preparePlatformApiPublishingAction`, social_posts 요약
  컬럼만 갱신), "API Dry-run Payload 보기" 토글(→
  `ApiDryRunPayloadPreview`, 읽기 전용 계산이라 페이지 로드 시 바로
  보여줄 수 있다).
- `/articles/[id]/blog`, `/articles/[id]/social`: 각 카드에 readiness
  배지(`ApiReadinessBadge`, 순수 계산이라 DB write 없음) + 상세
  페이지로 가는 링크만 추가했다(버튼은 상세 페이지에 있음).
- `/dashboard/platform-api`: 6개 플랫폼의 capability + readiness를
  표로 한눈에 보여준다.
- **actual publish 버튼은 세 화면 어디에도 없다.**

## 보안 원칙

- 환경변수 **값**은 어떤 함수의 반환값에도, 어떤 로그에도, 어떤
  화면에도 나타나지 않는다 — readiness checker는 이름과 존재 여부만
  다룬다.
- UI는 `configured`/`missing`(개수+이름)/`disabled`/`not_supported`
  같은 상태값만 보여준다.
- API key/access token/refresh token/Authorization header/Application
  Password는 어떤 payload/로그에도 등장하지 않는다(adapter가 애초에
  이런 값을 다루지 않는다 — 아직 OAuth/토큰 저장소가 없다).

## logs에 저장하면 안 되는 것

`social_platform_api_publish_prepare_*`/`social_platform_api_readiness_checked`/
`social_platform_api_dry_run_payload_built` 이벤트의 `details_json`에는
socialPostId/articleId/platform/readinessStatus/preparationStatus/
eligibleForDryRun/eligibleForActualPublish/blockerCount/warningCount/
missingConfigCount(개수만, 이름 아님)/dryRunOnly/publishEnabled/
fallbackMode/reasonCode**만** 저장한다. full post_body/caption/
export_payload/full API payload/API key/access token/refresh token/
auth token/Authorization header/Application Password/image binary는
**어디에도** 저장하지 않는다 — 테스트(`platform-api-publishing-preparation-service.test.ts`)
로 로그 detail에 본문/토큰 문자열이 없는지 확인한다.

## 아직 하지 않는 것

- 실제 X/Threads/Instagram/Naver Blog/Naver Cafe API 게시
- 기존 WordPress public publish 변경(Phase 2-17 그대로 유지)
- OAuth flow 구현
- token storage 구현
- 외부 API 호출(fetch 없음 — 테스트로 확인)
- 자동 metrics 수집
- 자동 A/B 테스트 실행
- publish attempt 결과를 저장하는 전용 테이블(다음 Phase에서 추가 가능)

## 다음 단계 제안

- X/Threads/Instagram의 OAuth flow + token storage 구현(그 후에만
  readiness가 `blocked`를 벗어날 수 있다)
- 실제 publish attempt를 기록하는 `social_platform_api_publish_attempts`
  테이블과 `adapter.publish()`의 진짜 구현(여전히 명시적 opt-in 필요)
- Naver Blog/Cafe 공식 API가 열리면 capability.currentMode를
  `manual_export`에서 전환
- `/dashboard/platform-api`에 article별 준비 완료 개수 집계 추가

## 확인 SQL

```sql
select
  id,
  article_id,
  platform,
  tone_style,
  quality_status,
  approval_status,
  publish_status,
  manual_post_status,
  api_publish_preparation_status,
  api_publish_readiness_status,
  api_publish_eligible_for_dry_run,
  api_publish_eligible_for_actual_publish,
  api_publish_prepared_at,
  api_publish_blocked_reason,
  updated_at
from social_posts
order by updated_at desc
limit 50;
```

```sql
select
  event_name,
  status,
  message,
  details_json,
  created_at
from pipeline_logs
where event_name like 'social_platform_api_%'
order by created_at desc
limit 50;
```

## 확인 방법

1. `/dashboard/platform-api` 접속 → 6개 플랫폼의 capability/readiness
   표 확인(환경변수 값이 어디에도 보이지 않는지 확인)
2. `/social-posts/[id]` 접속 → "API Publishing (준비 단계)" 섹션에서
   readiness/eligibility 확인
3. "API 게시 준비 상태 확인" 클릭 → 상태가 저장되고 페이지에 반영되는지 확인
4. "API Dry-run Payload 보기" 클릭 → payloadShape/validation이
   표시되고, `<details>`로 접힌 원문을 펼쳐도 토큰/API key가 없는지 확인
5. `/articles/[id]/blog`, `/articles/[id]/social`에서 카드별 readiness
   배지가 보이는지 확인
6. `.env.local`에 아무 값도 설정하지 않은 상태에서 모든 플랫폼이
   `disabled`인지 확인
7. `PLATFORM_API_PUBLISHING_ENABLED=true` + 플랫폼별 flag + 필요한
   환경변수를 채워도, x/threads/instagram은 여전히 `blocked`(OAuth
   미구현)인지 확인
8. 위 확인 SQL로 `social_posts.api_publish_*` 컬럼과
   `pipeline_logs`가 기대대로 쌓이는지, 어떤 값에도 토큰/본문
   원문이 없는지 확인
