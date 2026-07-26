# Phase 2-16: Human Approval Before Public Publish

## 목적

Phase 2-15 Publish Quality Gate를 통과한 article에 대해, 사람이 승인
버튼을 직접 눌렀을 때만 "WordPress public publish 승인" 상태를 저장하는
승인 게이트다. 이 단계는 승인 상태만 저장하며, 실제 공개 게시(WordPress
post status를 `publish`로 바꾸는 동작)는 어떤 경우에도 수행하지 않는다.

## Phase 2-15와의 관계

Phase 2-15(`publish_quality_gate_status`, `publish_ready`)가 콘텐츠/설정
자체의 품질을 검증하는 게이트라면, Phase 2-16은 그 위에 "사람의 최종
승인"이라는 별도 게이트를 하나 더 추가한다. 승인은 다음 조건이 모두
충족되어야만 가능하다.

- `publish_quality_gate_status = 'ready_to_publish'`
- `publish_ready = true`
- WordPress draft post가 존재 (`publish_logs.target='wordpress'`,
  `status='success'`, `external_post_id` 존재, 최신 1건)

Phase 2-15가 아직 실행되지 않았거나 `needs_revision`/`blocked` 상태라면
승인 자체가 차단된다.

## Migration

`db/migrations/024_phase-2-16-human-approval-before-public-publish.sql`

```sql
alter table articles
  add column if not exists public_publish_approval_status text not null default 'not_requested';
alter table articles
  add column if not exists public_publish_approved boolean not null default false;
alter table articles
  add column if not exists public_publish_approved_at timestamptz;
alter table articles
  add column if not exists public_publish_approved_by text;
alter table articles
  add column if not exists public_publish_approval_error text;
alter table articles
  add column if not exists public_publish_approval_notes text;
notify pgrst, 'reload schema';
```

## approval status 정의 (`public_publish_approval_status`)

| 상태 | 의미 |
|---|---|
| `not_requested` | 아직 승인을 시도하지 않음 |
| `approved` | 승인 완료 (`public_publish_approved=true`) |
| `revoked` | 승인이 취소됨 |
| `blocked` | 승인 조건 미충족으로 차단됨 |
| `failed` | 승인/취소 처리 자체가 예외로 실패 (Runtime Error로 터지지 않고 안전하게 처리됨) |

## 승인 가능 조건

`lib/publish/public-publish-approval-service.ts`의 `approvePublicPublish()`가
다음을 모두 확인한다. 하나라도 위반하면 즉시 차단된다.

- `article.status`가 `reviewed` 또는 `published`
- `publish_quality_gate_status = 'ready_to_publish'`
- `publish_ready = true`
- `publish_blocked_reason`이 비어 있음
- WordPress draft post id 존재
- `target_keyword` 존재
- 인용된 출처 존재

이미 `public_publish_approval_status='approved'` && `public_publish_approved=true`인
상태에서 다시 승인을 시도하면 위 조건 검사를 하지 않고 곧바로
**duplicate**로 처리한다 (`articles`는 갱신하지 않고 `public_publish_approved_at`도
덮어쓰지 않는다).

## 승인 불가(차단) 조건

- `publish_ready != true`
- `publish_quality_gate_status != 'ready_to_publish'`
- WordPress draft post id 없음
- `article.status`가 reviewed/published가 아님
- `publish_blocked_reason` 존재
- `target_keyword` 또는 출처가 없음

차단되면 `articles.public_publish_approval_status='blocked'`,
`public_publish_approved=false`, `public_publish_approval_error`에 안전한
사유 요약이 저장된다.

## 승인 취소 방식

`revokePublicPublishApproval()`은 현재 `public_publish_approval_status='approved'`
&& `public_publish_approved=true`인 경우에만 취소를 수행한다. 승인된 상태가
아니면 `not_approved`로 처리하고 안전하게 실패를 반환한다 (Runtime Error
없음). 취소 시 `public_publish_approval_status='revoked'`,
`public_publish_approved=false`로 저장하며, `public_publish_approval_notes`에
취소 사유(reason)를 기록한다.

## Phase 2-17 guard 조건

`lib/publish/public-publish-guards.ts`의 `assertCanPublicPublish(articleId)`는
다음을 모두 만족해야 통과하며, 하나라도 미충족이면
`PublicPublishNotAllowedError`를 던진다. 이 함수는 이번 단계에서 실제
publish를 실행하지 않고, Phase 2-17에서 사용할 가드로만 미리 준비한다.

- `publish_ready = true`
- `publish_quality_gate_status = 'ready_to_publish'`
- `public_publish_approval_status = 'approved'`
- `public_publish_approved = true`
- WordPress draft post id 존재

## articles 저장 필드

- `public_publish_approval_status`: `not_requested`/`approved`/`revoked`/`blocked`/`failed`
- `public_publish_approved` (boolean)
- `public_publish_approved_at` (최초 승인 시각. 중복 승인 시 덮어쓰지 않음)
- `public_publish_approved_by` (승인/취소한 사용자. 미상이면 `unknown`)
- `public_publish_approval_error` (차단/실패 시 안전한 오류 메시지)
- `public_publish_approval_notes` (승인/취소 메모. 기사 본문은 포함하지 않음)

## approval_logs 저장 방식

`target_type='article'`, `target_id=article_id` 구조를 그대로 재사용한다.

- 승인 성공: `action='public_publish_approved'`, `status='approved'`,
  `approved_by`, `notes`
- 승인 취소: `action='public_publish_approval_revoked'`, `status='revoked'`,
  `approved_by`(취소자), `notes`(취소 사유)
- 차단/중복/실패 시에는 `approval_logs`에 새 행을 남기지 않는다 (실제 상태
  변경이 없으므로). 해당 시도는 `pipeline_logs`/`publish_logs`에만 기록된다.

## publish_logs 저장 구조

`target = 'public_publish_approval'`.

- 승인 성공: `status='success'`, `external_post_id`/`post_url`은 WordPress
  draft 값, `error_message=null`, `details_json = { actual:false,
  publicPublishAction:false, approvalStatus:'approved', publishReady:true,
  qualityGateStatus, approvedBy, hasNotes }`.
- 승인 차단: `status='failed'`, `error_message`는 안전한 차단 사유 요약,
  `details_json = { actual:false, publicPublishAction:false,
  approvalStatus:'blocked', reason, publishReady, qualityGateStatus }`.
- 중복 승인: `status='skipped'`, `details_json.approvalStatus='duplicate'`.
- 승인 취소: `status='success'`, `details_json = { actual:false,
  publicPublishAction:false, approvalStatus:'revoked', revokedBy, hasReason }`.
- 취소 불가(미승인 상태): `status='skipped'`,
  `details_json.approvalStatus='not_approved'`.
- 실행 자체 실패: `status='failed'`, `error_message`는 안전한 오류 메시지.

절대 저장하지 않는 값: 기사 본문 전체, Authorization header, Application
Password, HTTP Basic Auth 문자열, API key, WordPress raw response.

## pipeline_logs event_name

- `public_publish_approval_started`
- `public_publish_approval_completed`
- `public_publish_approval_blocked`
- `public_publish_approval_failed`
- `public_publish_approval_duplicate`
- `public_publish_approval_revoked`
- `public_publish_approval_revoke_failed`

## Supabase 확인 SQL

```sql
select event_name, status, message, details_json, created_at
from pipeline_logs
where event_name like 'public_publish_approval_%'
order by created_at desc
limit 30;

select article_id, target, status, external_post_id, post_url, error_message, details_json, created_at
from publish_logs
where target = 'public_publish_approval'
order by created_at desc
limit 10;

select target_type, target_id, action, status, approved_by, notes, created_at
from approval_logs
where target_type = 'article' and action like 'public_publish_%'
order by created_at desc
limit 10;

select id, title, publish_quality_gate_status, publish_ready,
       public_publish_approval_status, public_publish_approved,
       public_publish_approved_at, public_publish_approved_by,
       public_publish_approval_error, public_publish_approval_notes
from articles
where id = '<article_id>';
```

## UI 확인 방법

article 상세 페이지의 "Human Approval Before Public Publish" 섹션에서
Quality Gate 상태/publish_ready/승인 상태/승인 시각/승인자/메모/오류/
WordPress draft post id·URL을 확인할 수 있다. "공개 게시 승인"(조건
미충족 또는 이미 승인된 경우 비활성화), "공개 게시 승인 취소"(승인된
경우에만 활성화), "승인 상태 새로고침" 버튼을 제공한다. 실제 "공개
게시" 버튼은 만들지 않았으며, 승인 완료 상태에서는 "다음 단계에서 공개
게시가 가능하다"는 안내 문구만 표시한다.

## 보안 주의사항

- Authorization header, Application Password, HTTP Basic Auth 문자열, API
  key는 로그·화면 어디에도 저장·노출하지 않는다.
- `publish_logs.details_json`/`articles.public_publish_approval_notes`에는
  기사 본문 전체를 저장하지 않는다.
- 실행 중 예외가 발생해도 안전하게 `failed` 상태로 처리되며 Runtime
  Error로 터지지 않는다.
- 공개(publish)는 이 단계에서 어떤 경우에도 수행하지 않는다.

## 다음 단계 제안

- Phase 2-17에서 `assertCanPublicPublish()`를 실제 WordPress public
  publish 실행 직전 가드로 연결.
- 승인권자 역할(다중 사용자) 구분이 필요해지면 `public_publish_approved_by`를
  실제 로그인 사용자 식별자로 교체.
- 승인 만료(예: N일 경과 시 재승인 필요) 정책 검토.
