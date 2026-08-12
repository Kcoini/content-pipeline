# Phase 3-11: Rewrite Application & Versioning Workflow

## 목적

Phase 3-10에서 생성된 `social_post_rewrite_suggestions`를 실제
`social_posts`에 반영할 수 있게 하되, 기존 row를 직접 덮어쓰지 않고
versioning 구조로 관리한다. 실제 재게시, 실제 플랫폼 API 게시, 자동
A/B 테스트, 자동 성과 비교는 이 단계에서 하지 않는다.

## Phase 3-10과의 관계

Phase 3-10이 "제안을 만들고 사람이 승인"까지였다면, Phase 3-11은
"승인된 제안을 실제로 반영"하는 단계다. 단, `suggestion_status='approved'`
가 되어도 기존 글은 바뀌지 않는다 — 적용(apply)하는 순간 **새
`social_posts` row(새 버전)** 가 생기고, 기존 row는 그대로 남는다.

## rewrite suggestion을 바로 덮어쓰지 않는 이유

1. 기존에 이미 게시된 글의 실제 게시 기록(`post_url`, `manual_posted_at`
   등)이 보존되어야 한다 — 덮어쓰면 "무엇을 언제 게시했는지"의 이력이
   사라진다.
2. 개선안이 실제로 더 나은지는 적용 직후엔 알 수 없다 — 되돌릴 수
   있어야 한다.
3. 새 버전은 quality gate/approval/export 등 기존 파이프라인 전체를
   다시 거쳐야 하는데, 이는 원본을 그대로 두고 별도 row로 처리하는
   편이 안전하다.

## versioning 구조

`social_posts`에 버전 메타데이터 컬럼을 추가했다: `parent_social_post_id`
(바로 이전 버전), `root_social_post_id`(최초 원본), `version_number`,
`version_label`, `version_status`(current/archived/superseded/draft/
rejected), `is_rewrite_version`, 그리고 rewrite 적용 관련 컬럼
(`rewrite_source_suggestion_id`, `rewrite_applied_from_social_post_id`,
`rewrite_applied_at`, `rewrite_applied_by`, `rewrite_application_notes`).
기존(마이그레이션 이전) row는 모두 `version_number=1`이며,
`root_social_post_id`가 비어 있으면 이 migration이 자기 자신의 id로
보정한다.

## social_post_versions 테이블 설명

`social_posts`의 요약 컬럼과 별개로, 버전이 생성될 때마다
`social_post_versions`에 이력 row를 남긴다. 이 테이블은 "언제, 누가,
어떤 제안으로부터, 무엇이 바뀌었는지"(`change_summary`)를 기록하는
감사(audit) 로그에 가깝다. migration 실행 시 기존 social_post 각각에
대해 "버전 1(원본)" 이력을 소급 생성한다.

## parent_social_post_id와 root_social_post_id의 차이

- `parent_social_post_id`: **바로 이전** 버전의 id. v3의 parent는 v2다.
- `root_social_post_id`: **최초** 원본의 id. v3의 root도 v1이고, v2의
  root도 v1이다.

버전 체인 전체를 한 번에 조회하려면 `root_social_post_id`로 조회하고
(`listRewriteVersionsByRoot`), 바로 이전 버전만 알고 싶으면
`parent_social_post_id`를 따라간다.

## version_number 규칙

새 버전을 만들 때 `version_number`는 같은 `root_social_post_id`를 가진
모든 social_posts 중 **현재 최대 버전 번호 + 1**로 계산한다
(`rewrite-application-service.ts`가 `listRewriteVersionsByRoot()`로
조회해 계산). 버전 번호는 절대 재사용되지 않는다.

## rewrite application workflow

`lib/social/rewrite-application-service.ts`의
`applyRewriteSuggestion(suggestionId, appliedBy?, notes?)`가 담당한다.

1. suggestion과 원본 social post를 조회
2. 적용 가능 조건 확인(아래 참고) — 실패하면 `application_status='blocked'`
   로 저장하고 종료(새 버전을 만들지 않음)
3. 원본과 suggestion을 병합해 새 콘텐츠 필드 계산(제목/본문/캡션/
   해시태그/스레드/카드/문체 — suggestion에 값이 있으면 그것을,
   없으면 원본 값을 그대로 사용)
4. `version_number` 계산 후 `createRewriteVersion()`으로 새
   `social_posts` row 생성(모든 파이프라인 상태는 테이블 기본값으로
   초기화됨)
5. `social_post_versions`에 이력 row 추가
6. 원본 social post의 `version_status`를 `superseded`로 변경(원본
   내용은 그대로, 상태만 바뀜)
7. suggestion을 `suggestion_status='applied'`, `application_status='applied'`,
   `applied_social_post_id=새 버전 id`로 갱신

적용 가능 조건: suggestion 존재, `suggestion_status='approved'`,
`application_status!='applied'`(중복 적용 방지), 원본 social post 존재,
suggestion 텍스트에 금지 표현(협박/공포조장/광고클릭유도/과장수익 등)
없음. `suggestion_status`가 `blocked`/`rejected`/`failed`이면 애초에
`approved` 조건에서 걸러진다.

## 새 버전 생성 후 초기화되는 상태

새로 생성된 `social_posts` row는 다음 컬럼이 모두 초기값으로
시작한다(DB 기본값을 그대로 사용하므로 서비스 코드가 명시적으로
설정하지 않아도 보장된다).

| 컬럼 | 초기값 |
|---|---|
| quality_status | not_checked |
| approval_status | not_requested |
| publish_status | not_published |
| export_status | not_exported |
| platform_publish_guard_status | not_checked |
| platform_publish_ready | false |
| platform_publish_dry_run_status | not_created |
| handoff_status | not_started |
| manual_post_status | not_recorded |
| performance_status | not_measured |
| rewrite_suggestion_status | not_created |

## Quality Gate와 Approval을 다시 거쳐야 하는 이유

새 버전은 내용이 바뀐 "새 글"이나 다름없다. 기존에 원본이 통과했던
quality gate/승인/export/guard/dry-run/handoff/manual posting 결과를
그대로 물려받으면, 바뀐 내용이 실제로 정책을 지키는지 확인하지 않은 채
게시 가능한 것처럼 보이게 된다. 그래서 이 단계는 의도적으로 아무것도
자동 실행하지 않는다 — UI에는 "Quality Gate 재실행 필요" 안내만
표시하고, 실행 여부는 사람이 결정한다(기존 Phase 3-4~3-8의 버튼을
새 버전 카드에서도 그대로 사용할 수 있다 — 새 버전도 같은
`social_posts` 테이블의 row이므로 목록에 자동으로 나타난다).

## 원본 게시 기록 보존 원칙

`applyRewriteSuggestion()`의 어떤 단계도 원본 row에 `update`를
호출하지 않는다(단 하나의 예외: `version_status`를 `superseded`로
바꾸는 것 — 내용 필드는 전혀 건드리지 않는다). `post_url`,
`manual_posted_at`, `manual_post_url`, `published_at` 등 원본의 실제
게시 기록은 새 버전이 생겨도 그대로 남는다.

## 로그 보안 원칙

`pipeline_logs.details_json`에는 suggestionId/originalSocialPostId/
newSocialPostId/articleId/platform/toneStyle/suggestedToneStyle/
rootSocialPostId/parentSocialPostId/versionNumber/changedFieldCount/
changedFields(필드명 배열만)/hashtagCount/threadItemCount/cardItemCount/
reasonCode **만** 저장한다. full original post_body/full original
caption/full suggested rewrite text/full new post_body/full new
caption/full export text/API key/auth token/Authorization header/
Application Password/image binary는 **어디에도** 저장하지 않는다.

## 아직 하지 않는 것

- 기존 게시글 자동 수정
- 실제 플랫폼 재게시
- 실제 API 게시
- 자동 A/B 테스트
- 자동 성과 수집
- 원본 social_post 삭제
- 기존 social_post 내용 직접 덮어쓰기

## 다음 단계 제안

- 새 버전에 대한 Quality Gate 자동 실행 옵션(현재는 수동 버튼만 존재)
- 버전 간 diff(무엇이 실제로 바뀌었는지 나란히 비교) UI
- 여러 버전의 성과를 비교하는 화면(Phase 3-9 metrics와 연동)
- 특정 버전을 `archived`/`rejected`로 정리하는 버전 관리 UI
- root 기준으로 "최신 current 버전"만 기본 노출하는 목록 필터

## Supabase 확인 SQL

```sql
-- rewrite application 확인
select
  id,
  article_id,
  platform,
  tone_style,
  parent_social_post_id,
  root_social_post_id,
  version_number,
  version_label,
  version_status,
  is_rewrite_version,
  rewrite_source_suggestion_id,
  quality_status,
  approval_status,
  publish_status,
  export_status,
  manual_post_status,
  performance_status,
  created_at,
  updated_at
from social_posts
order by updated_at desc
limit 20;

-- version history 확인
select
  id,
  social_post_id,
  article_id,
  root_social_post_id,
  parent_social_post_id,
  version_number,
  version_label,
  version_status,
  platform,
  tone_style,
  rewrite_source_suggestion_id,
  applied_by,
  applied_at,
  created_at
from social_post_versions
order by created_at desc
limit 20;

-- suggestion application 확인
select
  id,
  social_post_id,
  applied_social_post_id,
  suggestion_status,
  application_status,
  application_error,
  application_notes,
  updated_at
from social_post_rewrite_suggestions
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
where event_name like 'social_rewrite_application_%'
   or event_name = 'social_rewrite_version_created'
order by created_at desc
limit 50;
```
