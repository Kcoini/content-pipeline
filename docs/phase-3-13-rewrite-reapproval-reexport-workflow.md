# Phase 3-13: Rewrite Re-approval & Re-export Workflow

## 목적

Phase 3-12에서 `recommended_for_repost=true`가 된 rewrite version
`social_posts`를 다시 Quality Gate/Approval/Manual Export/Platform
Guard/Dry-run/Handoff 흐름으로 보낼 수 있게 한다. `recommended_for_repost=true`
는 어디까지나 "추천"일 뿐, 이 단계의 어떤 함수도 자동으로 승인하거나
게시하지 않는다.

## Phase 3-12와의 관계

Phase 3-12가 "이 rewrite version이 원본보다 나아 보인다"는 판단을
내렸다면, Phase 3-13은 "그 판단을 실제로 재게시 파이프라인에 태우는"
단계다. rewrite version은 Phase 3-11에서 만들어질 때 이미
`quality_status='not_checked'`, `approval_status='not_requested'` 등으로
초기화되어 있으므로, 이 단계는 그 초기화된 상태를 다시 "새 글과 동일한
절차"로 진행시키는 역할을 한다.

## 추천된 rewrite version도 재승인이 필요한 이유

`recommended_for_repost=true`는 비교 알고리즘(rule-based)의 판단일
뿐이다. 실제 정책 위반 여부, 시의성, 맥락은 사람만 판단할 수 있다.
그래서 추천되었더라도 `rewrite_reapproval_status`가 `pending_review`를
거쳐 사람이 명시적으로 `approveRewriteReapproval()`을 호출해야만
`approved`가 된다.

## rewrite_reapproval_status 설명

- `not_requested`: 아직 재승인을 요청하지 않음(기본값)
- `pending_review`: 재승인 요청됨, 사람의 승인/반려 대기 중
- `approved`: 재승인 완료 — 동시에 `approval_status='approved'`로도
  맞춰진다
- `rejected`: 재승인 반려됨
- `revoked`: 재승인이 취소됨(승인 후 취소한 경우)
- `blocked`/`failed`: 요청/승인 시도 자체가 조건 미충족 또는 예외로
  실패함

## rewrite_reexport_status 설명

- `not_started`: 아직 재export하지 않음(기본값)
- `ready`: 재export 준비 완료(`prepareRewriteReexport()`)
- `exported`: 재export payload 생성 완료(`generateRewriteReexportPayload()`)
  — 동시에 `export_status`도 `'exported'`로 맞춰진다
- `blocked`/`failed`: 조건 미충족 또는 payload 검증 실패

## rewrite_republish_workflow_status 설명

`rewrite-republish-workflow-service.ts`가 재승인/재export/guard/dry-run/
handoff/manual posting 상태를 종합해 "지금 어느 단계에 있는지" 하나의
값으로 요약한다. 우선순위는 다음과 같다(가장 진행된 단계부터 확인).

1. `rewrite_reapproval_status`가 rejected/revoked/blocked/failed →
   `blocked`
2. `rewrite_reexport_status`가 blocked/failed → `blocked`
3. `manual_post_status='posted'` → `manual_post_recorded`
4. `handoff_status='completed'` → `handoff_completed`
5. `handoff_status='ready'` → `handoff_ready`
6. `platform_publish_dry_run_status='ready'` → `dry_run_ready`
7. `platform_publish_guard_status='ready'` and
   `platform_publish_ready=true` → `guard_ready`
8. `rewrite_reexport_status='exported'` → `reexported`
9. `rewrite_reexport_status='ready'` → `reexport_ready`
10. `rewrite_reapproval_status='approved'` (export 시작 전) → `reapproved`
11. `rewrite_reapproval_status='pending_review'` → `reapproval_pending`
12. `rewrite_reapproval_status='not_requested'` → `ready_for_reapproval`
13. 그 외 → `not_started`

`is_rewrite_version=false`, `recommended_for_repost=false`,
`quality_status!='ready'` 같은 세부 사항은 이 열거형 상태 대신
`nextAction`/`warnings` 텍스트로 함께 전달된다(DB check 제약과 정확히
일치시키기 위함).

## 재승인 workflow

`lib/social/rewrite-reapproval-service.ts`.

- `requestRewriteReapproval()`: `is_rewrite_version=true`이고 아직
  게시/수동게시 기록이 없어야 요청 가능. `recommended_for_repost`/
  `version_comparison_status='rewrite_better'`/`quality_status='ready'`는
  "권장" 사항이라 없어도 요청 자체는 막지 않고 warning만 반환한다.
  성공 시 `rewrite_reapproval_status='pending_review'`,
  `approval_status='pending_review'`.
- `approveRewriteReapproval()`: `pending_review` 상태, `quality_status=
  'ready'`, 금지 표현 없음을 확인한 뒤 `rewrite_reapproval_status='approved'`,
  `approval_status='approved'`, `approved_by`/`approved_at`을 rewrite
  version 기준으로 새로 기록한다.
- `rejectRewriteReapproval()`/`revokeRewriteReapproval()`: 각각
  `rejected`/`revoked`로 전환하고 `approval_status`도 함께 맞춘다.
  revoke는 `approved` 상태에서만 가능하다.

## 재export workflow

`lib/social/rewrite-reexport-service.ts`.

- `prepareRewriteReexport()`: `rewrite_reapproval_status='approved'`
  등 조건을 확인하고 `rewrite_reexport_status='ready'`로 표시한다(아직
  실제 payload는 만들지 않음).
- `generateRewriteReexportPayload()`: 기존 Phase 3-5의
  `buildManualExportPayload()`/`validateManualExportPayload()`를
  재사용해 payload를 만들고, 검증을 통과하면
  `rewrite_reexport_status='exported'`, `export_status='exported'`,
  `export_payload`/`export_format`을 rewrite version **자신의** 컬럼에만
  저장한다. **원본 social_post의 export_payload는 이 함수가 절대
  건드리지 않는다.**

## 기존 export/guard/dry-run/handoff와의 관계

재export가 완료된 뒤부터는 **기존 Phase 3-6~3-8의 버튼을 그대로
재사용**한다 — Platform Publishing Guard 재실행, Publish Dry-run 생성,
Handoff 완료, Manual Posting Result 기록 모두 rewrite version에 대해
이미 정상 동작한다(이 phase들은 애초에 `is_rewrite_version`으로
분기하지 않고 `social_posts` row 하나를 대상으로 동작하도록 설계되어
있었기 때문에 별도 수정 없이도 rewrite version을 지원한다).

## 원본 게시 기록 보존 원칙

이 단계의 모든 서비스는 파라미터로 받은 `socialPostId`(rewrite
version)의 컬럼만 갱신한다. 원본의 `post_url`, `manual_posted_at`,
`published_at`, `export_payload` 등은 어떤 함수도 참조하지 않으므로
자동으로 보존된다 — rewrite version이 재게시되어도 원본의 게시
기록·성과 기록과는 완전히 분리된 채로 남는다.

## 자동 재게시하지 않는 이유

`recommended_for_repost=true`도, `rewrite_reapproval_status='approved'`도,
`rewrite_reexport_status='exported'`도 모두 "게시 가능성을 높이는
신호"일 뿐이다. 이 프로젝트의 핵심 원칙(Phase 3-1부터 유지)은 "사람의
명시적 승인 없이는 어떤 게시도 자동으로 일어나지 않는다"이며, 이
단계도 예외가 아니다 — 실제 플랫폼 게시 API는 여전히 연동되어 있지
않다.

## 로그 보안 원칙

`pipeline_logs.details_json`에는 socialPostId/articleId/platform/
toneStyle/rootSocialPostId/parentSocialPostId/versionNumber/
recommendedForRepost/versionComparisonStatus/qualityStatus/
approvalStatus/rewriteReapprovalStatus/rewriteReexportStatus/
rewriteRepublishWorkflowStatus/exportStatus/platformPublishGuardStatus/
platformPublishReady/dryRunStatus/handoffStatus/manualPostStatus/
nextAction/warningCount/blockedCount/reasonCode **만** 저장한다. full
post_body/full caption/full thread_items text/full card_items text/
full export_payload text/full handoff_payload text/API key/auth
token/Authorization header/Application Password/image binary는
**어디에도** 저장하지 않는다.

## 아직 하지 않는 것

- 실제 플랫폼 API 재게시
- 자동 원본 수정
- 자동 A/B 테스트
- 자동 성과 수집
- 네이버/X/Threads/Instagram API 연결

## 다음 단계 제안

- `listRewriteVersionsReadyForReapproval()`/`listRewriteVersionsReadyForReexport()`
  를 활용한 "재승인 대기/재export 대기" 대시보드
- 재승인 시 diff(원본 대비 무엇이 바뀌었는지)를 함께 보여주는 UI
- rewrite version이 실제로 게시된 뒤 성과가 원본보다 나았는지 추적하는
  피드백 루프(Phase 3-9 metrics와 연동)
- 여러 rewrite version(v2, v3, ...) 중 하나만 재승인 진행 중일 때 나머지
  버전을 자동으로 `archived` 처리하는 정책 검토

## Supabase 확인 SQL

```sql
-- rewrite republish workflow 확인
select
  id,
  article_id,
  platform,
  tone_style,
  version_number,
  is_rewrite_version,
  recommended_for_repost,
  version_comparison_status,
  quality_status,
  approval_status,
  rewrite_reapproval_status,
  rewrite_reexport_status,
  rewrite_republish_workflow_status,
  export_status,
  platform_publish_guard_status,
  platform_publish_ready,
  platform_publish_dry_run_status,
  handoff_status,
  manual_post_status,
  post_url,
  updated_at
from social_posts
where is_rewrite_version = true
order by updated_at desc
limit 20;

-- 재승인 대상 확인
select
  id,
  article_id,
  platform,
  tone_style,
  version_number,
  recommended_for_repost,
  version_comparison_status,
  quality_status,
  approval_status,
  rewrite_reapproval_status,
  rewrite_republish_workflow_status
from social_posts
where is_rewrite_version = true
  and recommended_for_repost = true
order by updated_at desc
limit 20;

-- pipeline logs 확인
select
  event_name,
  status,
  message,
  details_json,
  created_at
from pipeline_logs
where event_name like 'social_rewrite_reapproval_%'
   or event_name like 'social_rewrite_reexport_%'
   or event_name like 'social_rewrite_republish_workflow_%'
order by created_at desc
limit 50;
```
