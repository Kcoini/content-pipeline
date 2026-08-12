# Phase 3-8: Platform Manual Posting Checklist & Result Recording

## 목적

Phase 3-7에서 `handoff_status='completed'`가 된 `social_posts`에 대해,
사용자가 실제 플랫폼(네이버 블로그/카페, X, Threads, Instagram,
WordPress)에 수동으로 게시한 결과(URL/시간/게시자/메모)를 시스템에
기록할 수 있게 한다. 실제 외부 플랫폼 게시 API 연동, 성과 분석, 자동
재작성은 이 단계에서 하지 않는다.

## Phase 3-7과의 관계

Phase 3-7이 "게시 직전 payload를 준비하고 사람이 확인했다"는 것까지
기록했다면, Phase 3-8은 "그래서 실제로 게시했는가?"라는 결과를
기록한다. `handoff_status='completed'`인 social post만 manual posting
결과를 기록할 수 있으며, quality/approval/export/guard/dry-run 조건도
모두 다시 확인한다(하나라도 무너졌으면 기록을 차단한다).

## manual posting result recording이 필요한 이유

이 프로젝트는 실제 플랫폼 API 연동 없이 동작하므로, "게시되었는지
여부"를 시스템이 자동으로 알 방법이 없다. 사람이 실제로 게시 버튼을
누른 뒤, 그 결과(성공/실패/보류)와 게시 URL을 직접 입력해야 시스템이
`social_posts.publish_status`를 최신 상태로 유지할 수 있다.

## manual_post_status 설명

- `not_recorded`: 아직 기록하지 않음(기본값)
- `ready_to_record`: `prepareManualPostingRecord()`로 체크리스트를
  준비한 상태
- `posted`: 사람이 실제로 게시했다고 기록함 — **API 자동 게시가
  아니다**
- `skipped`: 사람이 게시를 보류/스킵하기로 함
- `failed`: 사람이 게시를 시도했지만 실패함
- `blocked`: 기록 가능 조건을 만족하지 못해 시스템이 기록을 거부함

## 수동 게시 체크리스트 구조

`lib/social/platform-manual-posting-checklist-builder.ts`의
`buildManualPostingChecklist(post)`가 공통 체크리스트(10개: Quality
Gate/Approval/Manual Export/Publishing Guard/Dry-run/Handoff 확인,
최종 내용/이미지·링크/정책 위반 확인, 게시 후 URL 기록 필요)와 플랫폼별
체크리스트를 합쳐 반환한다. `platform_publish_dry_run_status`가
`ready`가 아니거나 `platform_publish_ready`가 false이거나
`handoff_status`가 `completed`가 아니면 `warnings`에 담아 알려준다
(체크리스트 생성 자체를 막지는 않음 — 차단은 서비스 레이어에서
`checkRecordable()`이 담당한다).

## 플랫폼별 체크리스트

| 플랫폼 | 체크리스트 |
|---|---|
| wordpress_blog | 자동 게시 workflow와 중복 여부, 제목/본문/대표 이미지, SEO title/meta description, 공개 상태, 게시 URL 복사 |
| naver_blog | 제목, 본문 서식, 이미지 삽입, 태그/해시태그, 링크 정상 여부, 편집기 미리보기, 게시 URL 복사 |
| naver_cafe | 카페 규칙, 홍보성/도배성 문구, 외부 링크 과다, 질문형/토론형 마무리, 게시판 카테고리, 게시 URL 복사 |
| x | thread item 순서, 각 item 글자 수, 링크 미리보기, 해시태그 과다, 게시 URL 복사 |
| threads | 문장 자연스러움, 해시태그 과다, 링크/이미지, 게시 URL 복사 |
| instagram | 이미지/카드뉴스 준비, caption, hashtags, alt text, 게시 URL 복사 |

## 수동 게시 완료 기록 방식

`lib/social/platform-manual-posting-result-service.ts`의
`recordManualPostingResult(socialPostId, input)`이 담당한다.

1. `checkRecordable()`로 quality_status='ready', approval_status=
   'approved', export_status∈{ready,exported},
   platform_publish_guard_status='ready', platform_publish_ready=true,
   platform_publish_dry_run_status='ready', handoff_status='completed',
   publish_status가 blocked/failed가 아님을 모두 확인한다.
2. `manualPostUrl`이 비어 있으면 차단한다(완료 기록에는 URL이 필수).
3. `validateManualPostUrl()`로 URL 형식을 검사한다 — 명백히 URL이
   아니면 차단, 플랫폼 권장 도메인과 다르면 warning만 남기고 진행한다.
4. 통과하면 `manual_post_status='posted'`, `manual_post_url`,
   `manual_posted_at`(입력값 또는 now()), `manual_posted_by`,
   `manual_post_result_notes`를 저장하고, **동시에**
   `publish_status='published'`, `post_url`(=manualPostUrl),
   `published_at`(=manual_posted_at)을 갱신한다.

## 수동 게시 실패/스킵 기록 방식

`markManualPostingFailed()`/`markManualPostingSkipped()`는 각각
`manual_post_status='failed'`/`'skipped'`만 저장하고,
**`publish_status`는 절대 건드리지 않는다**(이미 `exported` 등 이전
상태를 그대로 유지). 실패 사유/스킵 사유는 `manual_post_error`/
`manual_post_result_notes`에 저장된다.

## posted와 API publish의 차이

| 항목 | manual_post_status='posted' (Phase 3-8) | 실제 API 자동 게시(미구현) |
|---|---|---|
| 트리거 | 사람이 URL을 입력해 결과를 기록 | 시스템이 API를 직접 호출 |
| 신뢰성 | 사람의 입력에 의존(오기록 가능) | API 응답으로 검증됨 |
| `publish_status` | `published`로 전환(기록 시점) | `published`로 전환(게시 시점) |
| 되돌리기 | 이번 단계에는 수정/취소 기능 없음(다음 단계 예정) | 플랫폼 정책에 따름 |

`manual_post_status`라는 별도 컬럼을 둔 이유가 바로 이 차이를 명확히
구분하기 위함이다 — `publish_status='published'`만 보고는 "AI가 API로
게시했는지 사람이 직접 게시했는지" 알 수 없으므로, 항상
`manual_post_status`를 함께 확인해야 한다.

## URL validation 기준

`lib/social/manual-posting-url-validator.ts`의 `validateManualPostUrl()`.

- URL 형식이 아니거나 http/https가 아니면 `blocked=true`
- 플랫폼별 권장 도메인(naver_blog: blog.naver.com/m.blog.naver.com,
  naver_cafe: cafe.naver.com, x: x.com/twitter.com, threads:
  threads.net, instagram: instagram.com)과 다르면 `warning`만
  반환하고 차단하지 않는다
- wordpress_blog는 `WORDPRESS_BASE_URL` 환경변수와 도메인이 다르면
  warning

## 로그 보안 원칙

`pipeline_logs.details_json`에는 socialPostId/articleId/platform/
toneStyle/qualityStatus/approvalStatus/exportStatus/publishStatus/
platformPublishGuardStatus/platformPublishReady/dryRunStatus/
handoffStatus/manualPostStatus/hasManualPostUrl/urlDomain(도메인만)/
checklistCount/warningCount/reasonCode **만** 저장한다. full post_body/
full caption/full export text/full dry-run payload/full handoff
payload/게시 URL 전체 경로가 아닌 도메인만/API key/auth token/
Authorization header/Application Password/image binary는 **어디에도**
저장하지 않는다.

## 아직 하지 않는 것

- 실제 네이버 블로그/카페 자동 게시
- 실제 X/Threads API 게시
- 실제 Instagram API 게시
- 자동 게시 API 연결
- 성과 분석 자동화 (조회수/반응 등 수집 없음)
- 자동 재작성

## 다음 단계 제안

- 잘못 기록한 manual posting 결과를 수정/취소하는 기능
- `listManualPostedSocialPostsByArticle()`를 활용한 "게시 완료 글 목록"
  화면
- 실제 플랫폼 게시 API 연동 검토(연동 후에는 `manual_post_status`와
  구분되는 `auto_post_status` 같은 별도 트랙 고려)
- 게시 URL 기반 성과 데이터 수집 파이프라인(사람이 입력한 URL을 시작점
  으로 활용)

## Supabase 확인 SQL

```sql
-- manual posting 상태 확인
select
  id,
  article_id,
  platform,
  tone_style,
  publish_status,
  post_url,
  manual_post_status,
  manual_post_url,
  manual_posted_at,
  manual_posted_by,
  manual_post_recorded_at,
  updated_at
from social_posts
order by updated_at desc
limit 20;

-- manual posting checklist 확인
select
  id,
  platform,
  manual_post_status,
  jsonb_array_length(manual_post_checklist) as checklist_count,
  manual_post_error
from social_posts
where manual_post_status != 'not_recorded'
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
where event_name like 'social_manual_posting_%'
order by created_at desc
limit 50;
```
