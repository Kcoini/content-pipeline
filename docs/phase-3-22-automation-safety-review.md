# Phase 3-22: Automation Safety Review

## 목적

Phase 3-1~3-21이 만든 article/blog/social/rewrite/metrics/A/B
test/platform API publishing preparation 전체 workflow를 대상으로,
"실제 API 게시나 자동화 확장을 시작하기 전에" 안전장치가 실제로
작동하는지 점검한다. 이번 단계는 **점검 단계**다 — 새로운 자동
게시 기능을 켜지 않으며, 발견된 문제도 자동으로 고치지 않는다.

## Phase 3-21 이후 왜 필요한가

Phase 3-21은 platform capability matrix, readiness checker,
eligibility guard, dry-run payload builder 등 "실제 API 게시로
가는 준비 구조"를 만들었다. 준비 구조가 늘어날수록 feature flag,
approval/guard 정합성, 로그에 민감정보가 섞여 들어갈 위험도 함께
늘어난다. Phase 3-22는 그 구조 전체를 대상으로,

- feature flag가 여전히 안전한 기본값(false/dry-run only)을
  유지하는지
- approval/guard/dry-run/handoff 조건이 실제로 정합적인지
  (예: 승인되지 않았는데 게시 준비 완료로 표시된 항목은 없는지)
- pipeline_logs에 API key/토큰/전체 payload가 남지 않는지
- 생성된 콘텐츠에 금지 표현(협박/공포조장/광고클릭유도/과장수익/
  개인정보/명예훼손)을 걸러내는 장치가 실제로 연결되어 있는지

를 하나의 화면(`/dashboard/automation-safety`)에서 확인할 수 있게
한다.

## 점검 범위(Automation Safety Review Scope)

`AutomationSafetyCategory` 10개 카테고리로 나눠 점검한다:
`feature_flags`, `approval_gates`, `publish_guards`, `api_publish`,
`logging_security`, `content_safety`, `data_integrity`, `rollback`,
`manual_workflow`, `environment`.

### feature flag 안전성

`lib/social/feature-flag-safety-auditor.ts`의
`auditPublishingFeatureFlags()`가 다음을 점검한다:

- `PLATFORM_API_PUBLISHING_ENABLED`, `X_API_PUBLISH_ENABLED`,
  `THREADS_API_PUBLISH_ENABLED`, `INSTAGRAM_API_PUBLISH_ENABLED`,
  `NAVER_BLOG_API_PUBLISH_ENABLED`, `NAVER_CAFE_API_PUBLISH_ENABLED`,
  `WORDPRESS_API_PUBLISH_ENABLED`, `SOCIAL_PUBLISH_ENABLED` — 모두
  기본값 false를 유지해야 하며, `true`로 설정된 경우 critical
  경고를 반환한다.
- `PLATFORM_API_DRY_RUN_ONLY` — 기본값 true를 유지해야 하며,
  `false`로 설정된 경우 critical 경고를 반환한다.
- **환경변수의 실제 값은 절대 반환하지 않는다.** 설정 여부
  (`configured`)와 안전 여부(`status`/`severity`)만 반환한다.

### approval gate / publish guard 안전성

`lib/social/publish-workflow-safety-auditor.ts`의
`auditPublishWorkflowSafety()`가 전체 `social_posts`를 조회해
아래 정합성 위반 항목을 찾는다(감사만 하며 자동 수정하지 않는다):

- `approval_status !== 'approved'`인데 `platform_publish_ready = true`
- `quality_status !== 'ready'`인데 `platform_publish_ready = true`
- `approval_status`가 `rejected`/`revoked`인데 export가 진행된 항목
- `publish_status = 'published'`인데 `manual_post_status`가
  기록되지 않은 항목
- `manual_post_status = 'posted'`인데 `publish_status`가
  `published`가 아닌 항목
- `api_publish_eligible_for_actual_publish = true`인 항목
  (Phase 3-21 기준 항상 없어야 한다)
- `platform_publish_ready = true`인데 `platform_publish_guard_status`가
  `ready`가 아닌 항목
- `handoff_status = 'completed'`인데
  `platform_publish_dry_run_status`가 `ready`가 아닌 항목
- 재승인 없이 재export된 rewrite version
  (`rewrite_reexport_status = 'exported'`이면서
  `rewrite_reapproval_status !== 'approved'`)

각 위반 항목은 개수/샘플 id/심각도만 반환하며, 수정 SQL은
**문서/참고용 예시로만** 제공한다(자동 실행하지 않는다).

### API publish 안전성

Phase 3-21의 adapter/readiness checker/eligibility guard는 이번
단계에서 코드를 바꾸지 않았다. 대신 다음을 확인했다:

- 모든 platform adapter의 publish 함수는 실제 API 호출 없이
  disabled/not implemented 결과만 반환한다(코드 검토로 확인).
- readiness checker는 환경변수 이름과 설정 여부만 반환하고,
  값 자체는 절대 반환하지 않는다(Phase 3-21에서부터 유지).
- `api_publish_eligible_for_actual_publish`가 `true`인 social_post는
  `auditPublishWorkflowSafety()`가 critical 위반으로 탐지한다.

### 로깅 보안

`lib/social/logging-security-auditor.ts`의
`auditRecentPipelineLogsForSensitiveData()`가 최근 `pipeline_logs`의
`message`/`details_json`을 검사한다.

탐지 대상 패턴: API key, access_token, refresh_token,
Authorization/Bearer, Application Password, client_secret,
export_payload, dry_run_payload, handoff_payload, 그리고
지나치게 긴 텍스트(500자 이상 — full post_body/caption을 통째로
저장했을 가능성).

**중요**: 매칭된 값 자체는 절대 반환하지 않는다. 반환하는 것은
`logId`, `eventName`, `createdAt`, `findingType`, `severity`
뿐이다.

### 콘텐츠 안전성

`lib/social/content-safety-auditor.ts`의 `auditContentSafetyRules()`가
두 가지를 확인한다:

1. 금지 표현 검사기(`checkForbiddenPatterns`,
   `lib/social/platform-publishing-rules.ts`)가 존재하고, rewrite
   적용/재승인/버전 비교/게시 가드 서비스에 실제로 연결되어
   있는지(정적 확인).
2. 최근 social_posts 일부를 표본으로 `checkForbiddenPatterns()`를
   실행해 위협/공포조장/허위단정/광고클릭유도/과장수익/개인정보
   패턴이 남아있는지 확인한다. 결과는 `socialPostId`와 발견 개수만
   반환하며, 콘텐츠 원문은 절대 포함하지 않는다.

### 데이터 무결성

이번 단계는 데이터를 수정하지 않으므로 별도 automated check 없이
기존 구조를 재확인했다:

- 원본 article은 어떤 workflow에서도 삭제되지 않는다.
- rewrite version은 새 row로 저장되고 원본 social_post를
  덮어쓰지 않는다(Phase 3-11~3-13).
- metrics는 항상 수동 입력이다(Phase 3-9, 자동 수집 없음).
- A/B 테스트(Phase 3-20)는 기존 approval workflow를 우회하지
  않고, 자동 게시 기능과 분리되어 있다.

## Rollback / Recovery 기준

| 상황 | 대응 |
| --- | --- |
| 잘못된 draft가 생성됨 | `publish_status = 'not_published'`이면 삭제하거나 archive 처리 가능 |
| 잘못된 수동 게시 결과가 기록됨 | `manual_post_status` 수정은 반드시 수동 확인 후 진행 |
| 잘못된 published 상태 | 실제 외부 플랫폼의 게시 상태를 먼저 확인한 뒤 DB 값을 수정 |
| API 실제 게시 flag가 실수로 true가 됨 | ① feature flag를 즉시 false로 되돌린다 ② Vercel 환경변수를 확인한다 ③ 토큰 회전(rotation)을 검토한다 ④ `pipeline_logs`에 민감정보가 남았는지 확인한다 |
| 로그에서 민감정보가 발견됨 | 로그 삭제/마스킹 정책을 적용하고, 관련 토큰을 회전하며, 회귀 테스트를 추가한다 |

이 표는 문서화가 목적이며, 이번 단계가 자동으로 실행하는 복구
절차는 없다.

## UI: `/dashboard/automation-safety`

- 전체 상태(safe/warning/blocked/failed), blocker/warning 개수,
  카테고리별 상태, checklist, findings, recommendations를
  표시한다.
- "Safety Review 실행", "최근 로그 보안 점검", "게시 workflow
  점검", "feature flag 점검" 버튼이 있다 — 모두 페이지를
  재검증(새로고침)할 뿐, 데이터를 변경하지 않는다.
- 실제 게시 버튼, 자동 수정 버튼은 **없다**.
- 페이지 상단에 "이 페이지는 점검 전용이며 데이터를 자동
  수정하지 않습니다."라는 안내를 항상 표시한다.
- `/dashboard`에 "Automation Safety" 링크를 추가했다.

## 저장하지 않음(DB 변경 없음)

이번 단계는 결과를 DB에 저장하지 않는다. `runAutomationSafetyReview()`는
매 호출마다 최신 상태를 계산해 반환하는 순수 조회 함수이며, 페이지는
`force-dynamic`으로 매 로드마다 새로 계산한다. 필요해지면 나중에
`automation_safety_review_runs` 테이블(id, status, summary jsonb,
blocker_count, warning_count, critical_count, findings jsonb,
recommendations jsonb, checked_by, checked_at, created_at)을
추가해 이력을 저장할 수 있다.

## 로그 이벤트

`pipeline_logs.event_name`에 다음을 추가했다(`lib/repositories/log-repository.ts`):

- `automation_safety_review_started`
- `automation_safety_review_completed`
- `automation_safety_review_failed`
- `automation_safety_feature_flags_audited`
- `automation_safety_logging_audited`
- `automation_safety_publish_workflow_audited`
- `automation_safety_content_rules_audited`

`details_json`에는 `status`, `blockerCount`, `warningCount`,
`criticalCount`, `findingCount`, `checkedCategories`, `reasonCode`만
기록한다. API key, access token, refresh token, Authorization
header, Application Password, full post_body/caption/export_payload/
dry-run payload/API payload, 매칭된 민감정보 원문은 **절대 기록하지
않는다**.

## 이번 단계에서 하지 않은 것

- 실제 API 게시, 자동 게시 활성화, 외부 API 호출, OAuth 구현
- 자동 metrics 수집, 자동 A/B 테스트 실행, 자동 rewrite 적용
- 발견된 문제의 자동 수정(모든 auditor는 read-only이며 fix SQL은
  문서 예시로만 제공)
- 기존 DB 데이터 삭제, 기존 publish workflow 변경
- 결과 영속화(선택적 DB migration은 이번 단계에서 생략)

## 확인 방법

1. `/dashboard/automation-safety` 접속
2. "Safety Review 실행" 클릭 → 전체 상태/카테고리별 상태 확인
3. feature flag 감사 결과 확인 (실제 값이 아닌 상태만 표시되는지)
4. 로깅 보안 감사 결과 확인 (finding이 있어도 원문이 아닌 종류만
   표시되는지)
5. 게시 workflow 감사 결과 확인 (승인/가드 불일치 항목이 있는지)
6. 콘텐츠 안전 감사 결과 확인 (금지 표현 검사기가 연결되어
   있는지, 표본에서 위반이 있는지)
7. critical finding이 있다면 상세 메시지에 민감정보 원문이
   노출되지 않는지 재확인
8. 실제 게시 버튼이 어디에도 없는지 확인
9. recommendations 목록 확인

```sql
select event_name, status, message, details_json, created_at
from pipeline_logs
where event_name like 'automation_safety_%'
order by created_at desc
limit 50;
```

```sql
select id, article_id, platform, quality_status, approval_status, publish_status, manual_post_status,
  api_publish_preparation_status, api_publish_eligible_for_actual_publish, updated_at
from social_posts
where api_publish_eligible_for_actual_publish = true
order by updated_at desc;
```

## 다음 단계 제안

- 이번 단계의 점검 결과를 DB에 저장(`automation_safety_review_runs`)해
  이력/추세를 확인할 수 있게 한다.
- CI에서 `runAutomationSafetyReview()`를 정기 실행해 critical
  finding 발생 시 알림을 보내는 구조를 추가한다.
- 실제 OAuth 연동 및 API 게시를 시작할 플랫폼을 하나 선정해,
  이번 단계의 checklist를 통과 기준으로 삼아 별도 Phase로
  진행한다.
