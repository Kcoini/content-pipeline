# Phase 2-8: Actual WordPress Connection Test

## 목적

Phase 2-2~2-7에서 만든 dry-run 기반 WordPress draft publish 기능을 실제
WordPress 사이트와 안전하게 연결해서 테스트한다. 이번 단계에서는 **draft(초안)
생성까지만** 허용하며, 실제 공개(publish)는 어떤 경로로도 수행하지 않는다.
Media upload의 실제 연결 테스트는 다음 단계로 미룬다
(`WORDPRESS_MEDIA_UPLOAD_ENABLED=false`가 기본값이며, 이 단계에서는 안전한
skip 동작만 확인한다).

## WordPress 사전 준비 (Prerequisites)

1. WordPress 5.6 이상 (Application Passwords 기본 내장 버전).
2. REST API가 비활성화되어 있지 않은지 확인 (`/wp-json/` 접속 가능해야 함).
3. draft를 생성할 수 있는 권한을 가진 사용자 계정 (관리자 또는 편집자/기여자
   중 글쓰기 권한이 있는 역할).
4. 사이트가 `http://`만 지원한다면 인증 정보가 평문으로 전송되므로 운영 환경
   에서는 반드시 `https://`를 사용할 것을 권장한다 (연결 테스트가 경고를
   표시한다).

## Application Password 발급 절차

1. WordPress 관리자 화면 로그인 → **사용자(Users) → 프로필(Profile)** 이동.
2. 페이지 하단 **응용 프로그램 비밀번호(Application Passwords)** 섹션으로 이동.
3. "새 응용 프로그램 이름" 입력 (예: `content-pipeline`) 후 **새 응용 프로그램
   비밀번호 추가** 클릭.
4. 발급된 비밀번호(공백 포함 문자열)를 **즉시 복사** — 재확인이 불가능하므로
   다시 발급해야 한다.
5. 이 값을 `.env.local`의 `WORDPRESS_APP_PASSWORD`에 저장한다 (공백 포함 그대로
   붙여넣어도 되고 제거해도 무방 — Basic Auth 인코딩 시 문제 없음).

## `.env.local` 설정 (실제 값 예시 — 실제로는 각자 값으로 채운다)

```
WORDPRESS_BASE_URL=https://example-blog.com
WORDPRESS_USERNAME=content-bot
WORDPRESS_APP_PASSWORD=abcd 1234 efgh 5678 ijkl 9012
WORDPRESS_PUBLISH_ENABLED=true
WORDPRESS_MEDIA_UPLOAD_ENABLED=false
SEO_PLUGIN_WRITE_ENABLED=false
```

**`.env.local`은 절대 git에 커밋하지 않는다** (`.gitignore`에 이미 포함되어야
함). `.env.example`에는 실제 값을 절대 넣지 않고 키 이름과 기본값(`false`)만
남겨둔다.

## dry-run vs 실제 테스트 차이

| 구분 | `WORDPRESS_PUBLISH_ENABLED=false` (기본값) | `WORDPRESS_PUBLISH_ENABLED=true` |
|---|---|---|
| WordPress API 호출 | 없음 | 있음 (draft 생성, 연결 테스트, category/tag 조회) |
| `publish_logs.status` | `dry_run` | `success` 또는 `failed` |
| post 실제 생성 | 안 됨 | WordPress에 실제 draft로 생성됨 |
| category/tag 동기화 | 건너뜀 (`wordpress_category_tag_sync_skipped_dry_run`) | 이름 기반으로 실제 조회/생성 시도 |
| 연결 테스트 버튼 | 여전히 실제로 호출됨 (연결 테스트는 publish 여부와 무관하게 항상 실제 요청을 보냄) | 동일 |

연결 테스트(`WordPress 연결 테스트` 버튼)는 `WORDPRESS_PUBLISH_ENABLED`와
무관하게 항상 실제 `GET /wp-json/wp/v2/users/me` 요청을 보낸다 — 이 요청은
읽기 전용이며 아무 것도 생성/변경하지 않으므로 안전하다.

## 왜 draft만 허용하는지

- WordPress REST API의 `POST /wp-json/wp/v2/posts`는 `status` 필드로 공개
  여부를 결정하는데, 이 필드를 사람이 실수로 `publish`로 바꾸거나 외부에서
  조작하더라도 실제로 공개되지 않도록 `lib/publish/wordpress-client.ts`의
  `createDraftPost`가 `status: "draft"`를 **입력값과 무관하게 항상 강제**한다.
- Human Approval 원칙(`CLAUDE.md`)에 따라 기사 공개는 사람의 명시적 승인 없이
  자동화되어서는 안 된다. Draft 생성까지만 자동화하고, 실제 공개는 WordPress
  관리자 화면에서 사람이 직접 검토 후 수행한다.

## category/tag sync 방식

1. `article.wpCategoryNames`/`wpTagNames`(Phase 2-3에서 생성된 이름 목록)를
   사용한다.
2. `lib/publish/wordpress-client.ts`의 `getOrCreateCategoryByName`/
   `getOrCreateTagByName`이 이름으로 기존 항목을 조회하고, 없으면 새로
   생성해서 id를 반환한다.
3. 조회/생성에 실패하면(예: 권한 부족, 네트워크 오류) 예외를 삼키고
   `wordpress_category_sync_failed`/`wordpress_tag_sync_failed` 이벤트를
   **warning**으로 기록한 뒤 빈 배열로 계속 진행한다 — **draft 생성 자체를
   막지 않는다**.
4. 성공적으로 resolve된 id는 `articles.wp_category_ids`/`wp_tag_ids`에
   저장되어 다음 게시 시 재사용할 수 있다 (저장 자체가 실패해도 draft 생성은
   막지 않는다).

## media upload가 선택 사항인 이유

- 실제 업로드는 이미지 파일을 읽어 `multipart/form-data`로 전송해야 하며,
  Phase 2-7까지 준비된 이미지 생성 결과(`generated_image_url`/`local_path`)에
  의존한다 — 이미지가 아직 생성되지 않았거나 재검토가 필요한 상태에서 업로드가
  선행되면 안 된다.
- 기본값 `WORDPRESS_MEDIA_UPLOAD_ENABLED=false`를 유지해, 준비되지 않은
  환경에서는 항상 안전하게 건너뛴다 (`wordpress_media_upload_skipped_disabled`).
- `true`로 설정하고 생성된 이미지가 있으면 실제 업로드를 시도하되, 실패해도
  draft 생성 자체는 계속 진행된다 (`wordpress_media_upload_failed` 기록 후
  `featured_media` 없이 draft 생성).

## 연결 테스트 방법

1. `.env.local`에 `WORDPRESS_BASE_URL`/`WORDPRESS_USERNAME`/
   `WORDPRESS_APP_PASSWORD`를 설정한다.
2. article 상세 페이지의 **WordPress Connection Test** 섹션에서
   **WordPress 연결 테스트** 버튼을 클릭한다.
3. 성공 시: `WordPress 연결 성공 (username, displayName)` 형태의 메시지가
   표시된다.
4. 실패 시: safe error message와 상태 코드별 원인 후보가 표시된다 (아래 표
   참고). Application Password/Authorization header는 어떤 경우에도 화면에
   표시되지 않는다.

## Supabase 검증 SQL

```sql
-- 최근 연결/게시 관련 pipeline_logs 확인
select event, status, message, created_at
from pipeline_logs
where event like 'wordpress_%'
order by created_at desc
limit 20;

-- 최근 WordPress publish_logs 확인 (details_json에 본문/인증정보 없는지 확인)
select id, article_id, target, status, external_post_id, post_url,
       error_message, details_json, created_at
from publish_logs
where target = 'wordpress'
order by created_at desc
limit 10;

-- article에 저장된 실제 category/tag id 확인
select id, title, wp_category_ids, wp_tag_ids
from articles
where wp_category_ids is not null and array_length(wp_category_ids, 1) > 0;
```

## 오류 코드별 트러블슈팅

| 상태 코드 | 주요 원인 후보 |
|---|---|
| 401 Unauthorized | Application Password가 잘못됨 / 사용자명이 틀림 / Application Password가 삭제·재발급됨 |
| 403 Forbidden | 해당 사용자에게 글쓰기 권한이 없음 / 보안 플러그인(Wordfence 등)이 REST API 인증을 차단함 / 서버 방화벽이 Basic Auth header를 제거함 |
| 404 Not Found | `WORDPRESS_BASE_URL`이 잘못됨 (오타, 프로토콜 누락) / REST API가 비활성화됨 / 사이트가 서브디렉터리에 설치되어 있는데 base URL에 반영 안 됨 |
| 500/5xx | WordPress 서버 내부 오류 / 플러그인 충돌 / PHP 오류 (WordPress 관리자에게 서버 로그 확인 요청 필요) |

## 보안 노트

- Application Password, Authorization header는 어떤 응답/로그/UI에도
  포함되지 않는다 (`testWordPressConnection`은 `baseUrl`/`username`/
  `displayName`/`statusCode`/`errorMessage`/`likelyCauses`/`warnings`만
  반환).
- `publish_logs.details_json`에는 기사 본문 전체가 저장되지 않는다 (요약
  정보만 저장).
- `pipeline_logs`의 어떤 이벤트에도 `authorization`/`app_password` 관련
  문자열이 포함되지 않도록 테스트로 고정되어 있다
  (`lib/publish/publish-service.test.ts`).
- `.env.example`에는 실제 값이 절대 들어가지 않으며, `.env.local`은 커밋
  대상에서 제외된다.
- WordPress post의 `status`는 입력값과 무관하게 항상 `draft`로 강제된다.

## 다음 단계 제안

- 실제 media upload 연결 테스트 (Phase 2-6에서 준비한 payload를 실제
  `multipart/form-data`로 전송).
- SEO plugin(Yoast/Rank Math/AIOSEO) 실제 write 연동 (`SEO_PLUGIN_WRITE_
  ENABLED=true` 실제 endpoint 확인).
- 여러 WordPress 사이트 동시 지원 (현재는 단일 사이트 환경변수 기준).
