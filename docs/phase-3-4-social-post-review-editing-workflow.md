# Phase 3-4: Social Post Review & Editing Workflow

## 목적

Phase 3-3에서 생성된 `social_posts`를 사람이 직접 확인, 수정, 재검수,
승인/반려/승인취소할 수 있는 review & editing workflow를 추가한다. 실제
X/Threads/Instagram/네이버 게시, public publish, 플랫폼 API 연동, 성과
분석, 자동 재작성은 이 단계에서 하지 않는다.

## Phase 3-3과의 관계

Phase 3-3이 "초안을 만드는" 단계였다면, Phase 3-4는 "만들어진 초안을
사람이 다듬고 승인하는" 단계다. 생성 로직(`social-draft-generation-service.ts`,
mock/AI 생성, quality gate 최초 실행)은 그대로 유지하며, 그 위에 편집/재검수/
승인 상태 전이만 추가한다.

## social_posts 수정 규칙

`saveSocialPostRevision()`(repository)과 `editSocialPostContent()`(service,
`lib/social/social-post-service.ts`)를 통해 편집한다. platform은 변경할 수
없다. 수정 가능한 필드: post_title/post_body/caption/excerpt/hashtags/
thread_items/card_items/media_requirements/platform_metadata/export_payload/
review_notes(그리고 tone_style은 선택적으로 허용).

편집 시 항상 다음이 함께 반영된다:

- `edited_at` = now(), `edited_by` = 수정자
- `revision_count` = 기존 값 + 1
- `quality_status` = `not_checked` (재검수 강제)
- `approval_status` = `not_requested` (재승인 강제 — approved였더라도 되돌림)
- `approved_at`/`approved_by` = null, `rejection_reason` = null
- `publish_status`는 `published`가 아닌 한 `not_published`로 되돌림
- 이미 `publish_status='published'`인 post는 수정 자체를 거부한다
  (`saveSocialPostRevision`이 예외를 던진다)

## revision_count 규칙

편집할 때마다 1씩 증가하며 절대 감소하지 않는다. 몇 번 고쳤는지 UI에서
바로 확인할 수 있도록 social post 카드 상단에 노출한다.

## Quality Gate 재실행

`rerunSocialPostQualityGate()`(`lib/social/social-post-service.ts`, 기존
`runSocialPostQualityGateAndSave`와 동일한 함수를 재검수 문맥에서 사용하기
위한 이름)가 저장된 최신 콘텐츠로 `runSocialPostQualityGate()`를 다시
실행하고 결과를 `social_posts`(quality_status/quality_score/quality_summary)
와 `social_post_quality_runs`에 반영한다. `updateSocialPostQuality()`
(repository)가 이 시점에 `last_quality_checked_at`도 함께 갱신한다.

## 승인 요청/승인/반려/승인취소

`lib/social/social-post-approval-service.ts`가 담당한다.

- **승인 요청** (`requestApproval`): `approval_status='pending_review'`로
  전환한다. publish_status가 blocked/published면 요청할 수 없다.
- **승인** (`approveSocialPost`): 다음을 모두 만족해야 승인할 수 있다.
  - `quality_status === 'ready'`
  - `publish_status`가 `blocked`/`published`가 아님
  - `approval_status`가 이미 `approved`가 아님
  - post_title/post_body/caption/thread_items/card_items 중 콘텐츠가 존재
  - platform/tone_style이 유효한 값
  - quality gate 체크리스트에 `blocked`/`fail` 항목이 없음(협박/공포조장/
    허위단정/광고클릭유도/과장수익표현 등)
  승인 성공 시 `social_posts.approval_status='approved'`,
  `approved_by`/`approved_at` 기록, `social_post_approvals`에 `approved`
  이력을 남긴다.
- **반려** (`rejectSocialPost`): 반려 사유(reason)가 필수다.
  `approval_status='rejected'`, `rejection_reason` 저장,
  `approved_by`/`approved_at`은 null 처리. `social_post_approvals`에
  `rejected` 이력을 남긴다.
- **승인 취소** (`revokeApproval`): `approval_status==='approved'`인
  post에만 적용된다. 취소 사유(reason)가 필수다.
  `approval_status='revoked'`, `revoked_at`/`revoked_reason` 저장,
  `approved_by`/`approved_at`은 null 처리. `social_post_approvals`에
  `revoked` 이력을 남긴다.

## 플랫폼별 preview

`lib/social/social-post-preview-formatters.ts`의 `formatSocialPostPreview()`가
플랫폼에 맞는 사람이 읽기 좋은 미리보기를 만든다.

| 플랫폼 | 미리보기 |
|---|---|
| wordpress_blog | 제목 + 본문 + excerpt |
| naver_blog | 제목 + 본문 + 해시태그 |
| naver_cafe | 제목 + 본문, 질문/토론 유도 문장 강조 |
| x | thread_items를 번호별 + 글자 수와 함께 표시 |
| threads | 본문 + 해시태그 |
| instagram | caption + 해시태그 + card_items(slide 형태) |

## export_payload 재생성

`editSocialPostContent()`가 저장 직전에 수정된 콘텐츠를 기준으로
`buildExportPayload()`(`lib/social/social-export-builder.ts`, Phase 3-1에서
만든 기존 함수를 그대로 재사용)를 호출해 `export_payload`/`export_format`을
다시 계산하고, 콘텐츠 수정과 함께 한 번에 저장한다. 즉 수정할 때마다
manual export용 미리보기도 최신 상태로 유지된다.

## 로그 보안 원칙

`pipeline_logs.details_json`에는 socialPostId/articleId/platform/toneStyle/
qualityStatus/qualityScore/approvalStatus/publishStatus/revisionCount/
changedFields/hashtagCount/threadItemCount/cardItemCount/postBodyLength/
captionLength/reasonCode **만** 저장한다. full post_body/full caption/full
prompt/article 본문 전체/API key/auth token/Authorization header/
Application Password/image binary는 **어디에도** 저장하지 않는다
(`changedFields`는 어떤 필드가 바뀌었는지 필드명만 담고, 값 자체는 담지
않는다).

## 아직 하지 않는 것

- 실제 X 게시
- 실제 Threads 게시
- 실제 Instagram API 게시
- 실제 네이버 블로그/카페 자동 게시
- 실제 public publish
- 플랫폼 API 연결
- 성과 분석
- 자동 재작성 (AI가 스스로 다시 쓰는 기능은 포함하지 않음 — 사람이 직접
  텍스트를 고친다)

## 다음 단계 제안

- 승인된 social post의 manual export 경험 고도화(다운로드/복사 UX)
- quality gate의 문체 정합성 검사를 AI 기반으로 고도화
- 여러 social post를 한 번에 검토/승인하는 batch review UI
- social post 버전 이력(diff) 조회 기능
- 실제 플랫폼 게시 API 연동 검토(항상 사람의 명시적 승인 전제)

## Supabase 확인 SQL

```sql
-- social_posts 확인
select
  id,
  article_id,
  platform,
  tone_style,
  post_title,
  quality_status,
  quality_score,
  approval_status,
  publish_status,
  revision_count,
  edited_at,
  approved_by,
  approved_at,
  created_at
from social_posts
order by updated_at desc
limit 20;

-- approval logs 확인
select
  social_post_id,
  article_id,
  platform,
  approval_status,
  approved_by,
  approval_notes,
  created_at
from social_post_approvals
order by created_at desc
limit 20;

-- quality runs 확인
select
  social_post_id,
  article_id,
  platform,
  tone_style,
  status,
  score,
  created_at
from social_post_quality_runs
order by created_at desc
limit 20;

-- pipeline logs 확인 (event_name 기준)
select
  event_name,
  status,
  message,
  details_json,
  created_at
from pipeline_logs
where event_name like 'social_%'
order by created_at desc
limit 50;
```
