# Phase 2-17: WordPress Public Publish Test

## 목적

Phase 2-15 Publish Quality Gate와 Phase 2-16 Human Approval Before Public
Publish를 모두 통과한 article **1개**에 한해서만, WordPress draft post를
실제 `publish` 상태로 변경하는 공개 게시 테스트를 제공한다.

## 사전 조건

- Phase 2-15 Publish Quality Gate 완료 (`publish_ready=true`,
  `publish_quality_gate_status='ready_to_publish'`)
- Phase 2-16 Human Approval Before Public Publish 완료
  (`public_publish_approval_status='approved'`, `public_publish_approved=true`)
- WordPress draft post 존재 (`publish_logs.target='wordpress'`,
  `status='success'`, `external_post_id` 존재)

## 절대 자동 공개 게시가 아니다

- 이 기능은 사람이 article 상세 페이지에서 "WordPress 공개 게시 테스트
  실행" 버튼을 직접 클릭했을 때만 실행된다. 백그라운드 배치나 스케줄러,
  다른 파이프라인 단계에서 자동으로 호출하지 않는다.
- 버튼 클릭 시 브라우저 confirm 대화상자("이 작업은 WordPress 글을 실제
  공개 상태로 변경합니다. 계속할까요?")를 한 번 더 거쳐야 실제 제출된다.
- 여러 article을 한 번에 처리하는 일괄 publish 기능은 의도적으로 제공하지
  않는다 — `publishApprovedArticleToWordPress(articleId)`는 항상 article
  1개의 id만 받는다.
- guard(`checkPublicPublishGuard`)를 통과하지 못하면 WordPress API를 어떤
  경우에도 호출하지 않는다.

## Migration

`db/migrations/025_phase-2-17-wordpress-public-publish-test.sql`

```sql
alter table articles
  add column if not exists public_publish_status text not null default 'not_published';
alter table articles
  add column if not exists public_published boolean not null default false;
alter table articles
  add column if not exists public_published_at timestamptz;
alter table articles
  add column if not exists public_publish_post_id integer;
alter table articles
  add column if not exists public_publish_url text;
alter table articles
  add column if not exists public_publish_error text;
alter table articles
  add column if not exists public_publish_attempted_at timestamptz;
notify pgrst, 'reload schema';
```

## Guard 조건

`lib/publish/public-publish-guards.ts`의 `checkPublicPublishGuard(articleId)`가
다음을 모두 확인하고, WordPress draft post id/url을 포함한 안전한 요약을
반환한다 (예외를 던지지 않음). 하나라도 위반하면 `canPublish=false`이며,
호출자(`wordpress-public-publish-service.ts`)는 이 경우 WordPress API를
절대 호출하지 않는다.

1. article이 존재해야 한다.
2. `article.status`가 `reviewed` 또는 `published`여야 한다.
3. `publish_ready = true`
4. `publish_quality_gate_status = 'ready_to_publish'`
5. `public_publish_approval_status = 'approved'`
6. `public_publish_approved = true`
7. WordPress draft post id가 존재해야 한다.
8. 최신 `publish_logs`(`target='wordpress'`, `status='success'`,
   `external_post_id` 존재) 기록이 있어야 한다 (7과 동일한 조회를 재사용).
9. `publish_blocked_reason`이 없어야 한다.
10. `public_published=true`(이미 공개됨)이면 별도의 `alreadyPublished` 플래그로
    구분해 차단한다 (이 경우는 오류가 아니라 `skipped_already_published`로
    처리됨).

기존에 예외를 던지는 `assertCanPublicPublish(articleId)`도 그대로
유지하며, 내부적으로 `checkPublicPublishGuard`를 호출한다.

## WordPress API update 방식

`lib/publish/wordpress-client.ts`의 `publishWordPressPost(postId)`가
`POST /wp-json/wp/v2/posts/{postId}`에 `{ "status": "publish" }`만
전송한다. 응답에서 `id`/`status`/`link`/`slug`/`modified`/`date`만 추출해
반환하며, `status`가 `publish`가 아니면 실패로 처리한다. Authorization
header/Application Password는 어떤 경우에도 반환값이나 로그에 포함하지
않으며, WordPress raw response 전체도 보관하지 않는다.

## already published 처리

`public_published=true`이거나 guard가 `alreadyPublished=true`를 반환하면:

- 새 WordPress publish API를 호출하지 않는다.
- `articles.public_publish_status='skipped_already_published'`,
  `public_published=true`로 저장한다 (기존 공개 상태를 그대로 유지).
- `publish_logs`에 `target='wordpress_public_publish'`, `status='skipped'`,
  `details_json.reason='already_published'`로 기록한다.
- `pipeline_logs`에 `wordpress_public_publish_skipped_already_published`
  이벤트를 기록한다.

## articles 저장 필드

- `public_publish_status`: `not_published`/`published`/`blocked`/`failed`/`skipped_already_published`
- `public_published` (boolean)
- `public_published_at` (실제 공개 완료 시각)
- `public_publish_post_id` (공개된 WordPress post id)
- `public_publish_url` (공개된 WordPress post의 공개 URL)
- `public_publish_error` (차단/실패 시 안전한 오류 메시지)
- `public_publish_attempted_at` (성공/실패/차단 관계없이 마지막 시도 시각)

## publish_logs 저장 구조

`target = 'wordpress_public_publish'`.

- 성공: `status='success'`, `external_post_id`=WordPress post id,
  `post_url`=공개 URL, `error_message=null`,
  `details_json = { actual:true, publicPublishAction:true,
  wordpressStatus:'publish', guardPassed:true, approvalStatus:'approved',
  publishReady:true, qualityGateStatus:'ready_to_publish' }`.
- 차단(guard 실패): `status='failed'`, `error_message`는 안전한 차단 사유
  요약, `details_json = { actual:false, publicPublishAction:false,
  guardPassed:false, reason, publishReady, qualityGateStatus,
  approvalStatus }`.
- 이미 공개됨: `status='skipped'`, `error_message=null`,
  `details_json = { actual:false, publicPublishAction:false,
  reason:'already_published' }`.
- 실패(WordPress API 오류): `status='failed'`, `error_message`는 안전한
  오류 메시지, `details_json = { actual:true, publicPublishAction:true,
  statusCode, reasonCandidate }`.

절대 저장하지 않는 값: 기사 본문 전체, Authorization header, Application
Password, HTTP Basic Auth 문자열, API key, WordPress raw response.

## pipeline_logs event_name

- `wordpress_public_publish_started`
- `wordpress_public_publish_guard_passed`
- `wordpress_public_publish_guard_failed`
- `wordpress_public_publish_completed`
- `wordpress_public_publish_blocked`
- `wordpress_public_publish_skipped_already_published`
- `wordpress_public_publish_failed`

## UI 실행 방법

article 상세 페이지의 "WordPress Public Publish Test" 섹션에서
publish_ready/quality gate 상태/승인 상태/승인 여부/WordPress draft post
id/공개 상태/공개 여부/공개 시각/공개 URL/오류를 확인할 수 있다.

- "WordPress 공개 게시 테스트 실행 (실제 공개 게시)" 버튼은 5가지 조건
  (publish_ready=true, quality_gate=ready_to_publish, approval=approved,
  approved=true, WordPress draft 존재)을 모두 만족하고 아직 공개되지
  않은 경우에만 활성화된다.
- 버튼 클릭 시 "이 작업은 WordPress 글을 실제 공개 상태로 변경합니다.
  계속할까요?"라는 confirm 대화상자를 거쳐야 실제로 제출된다.
- "공개 게시 상태 새로고침" 버튼으로 최신 상태를 다시 조회할 수 있다.
- 여러 article을 한 번에 공개하는 버튼/기능은 만들지 않았다.
- 인증 정보나 기사 본문 전체는 화면에 표시하지 않는다.

## WordPress에서 확인하는 방법

WordPress 관리자(`/wp-admin/edit.php`)에서 해당 post를 열어 상태가
"게시됨(Published)"으로 바뀌었는지, `articles.public_publish_url`에
저장된 링크로 실제 접속되는지 확인한다.

## Supabase 확인 SQL

```sql
select event_name, status, message, details_json, created_at
from pipeline_logs
where event_name like 'wordpress_public_publish_%'
order by created_at desc
limit 30;

select article_id, target, status, external_post_id, post_url, error_message, details_json, created_at
from publish_logs
where target = 'wordpress_public_publish'
order by created_at desc
limit 10;

select id, title, publish_ready, publish_quality_gate_status,
       public_publish_approval_status, public_publish_approved,
       public_publish_status, public_published, public_published_at,
       public_publish_post_id, public_publish_url, public_publish_error,
       public_publish_attempted_at
from articles
where id = '<article_id>';
```

## blocked reason 대응

`public_publish_error`에 안전한 사유 요약이 저장된다. 대표적인 경우:

| 사유 | 대응 |
|---|---|
| `publish_ready가 true가 아닙니다` | Phase 2-15 Publish Quality Gate를 먼저 통과시킨다 |
| `publish_quality_gate_status=... (ready_to_publish가 아닙니다)` | Quality Gate를 재실행해 `ready_to_publish`로 만든다 |
| `public_publish_approval_status=... (approved가 아닙니다)` | Phase 2-16에서 공개 게시 승인을 받는다 |
| `public_publish_approved가 true가 아닙니다` | 승인이 완료되었는지 다시 확인한다 |
| `WordPress draft post id가 존재하지 않습니다` | WordPress 초안 생성(Phase 2-9)을 먼저 실행한다 |
| `publish_blocked_reason이 존재합니다: ...` | Quality Gate가 남긴 차단 사유를 먼저 해소한다 |
| `article.status=... (reviewed 또는 published가 아닙니다)` | 기사를 먼저 승인(`status='reviewed'`)한다 |

## 보안 주의사항

- Authorization header, Application Password, HTTP Basic Auth 문자열, API
  key는 로그·UI 어디에도 저장·노출하지 않는다.
- `publish_logs.details_json`에는 기사 본문 전체나 WordPress raw response
  전체를 저장하지 않는다.
- 실행 중 예외가 발생해도 안전하게 `failed` 상태로 처리되며 Runtime
  Error로 터지지 않는다.
- guard를 통과하지 못하면 WordPress API를 절대 호출하지 않는다.

## 롤백 방법 안내

이번 단계는 unpublish(공개 취소) 기능을 구현하지 않는다. 실수로 공개된
글을 되돌리려면 다음 중 하나를 사용한다.

1. **WordPress 관리자에서 직접 되돌리기**: `/wp-admin/edit.php`에서 해당
   글을 열어 상태를 "임시글(Draft)"로 변경한다.
2. **다음 단계에서 unpublish 기능 구현**: `publishWordPressPost`와 동일한
   패턴으로 `{ status: "draft" }`를 전송하는 `unpublishWordPressPost(postId)`를
   추가하고, `articles.public_publish_status`를 다시 `not_published`로
   되돌리는 서비스/guard/로그를 Phase 2-16~2-17과 동일한 방식으로 설계할
   수 있다 (이번 단계 범위 밖).

## 다음 단계 제안

- unpublish(공개 취소) 기능 구현 (관리자 실수 대비).
- 공개 게시 이후 WordPress 응답(link/slug)과 `articles` 저장값의 정합성을
  주기적으로 재검증하는 배치 검사 추가.
- 여러 article을 순차적으로(단, 반드시 개별 승인 확인 후) 처리할 수 있는
  운영자용 대시보드 뷰 검토 (일괄 자동 publish는 여전히 금지).
