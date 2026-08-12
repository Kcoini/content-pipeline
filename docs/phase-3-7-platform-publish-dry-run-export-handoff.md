# Phase 3-7: Platform Publish Dry-run & Export Handoff

## 목적

Phase 3-6에서 `platform_publish_guard_status='ready'`가 된 `social_posts`
에 대해, 실제 외부 플랫폼 게시 API를 호출하지 않고 플랫폼별 "게시 직전
payload"를 dry-run으로 생성하고, 사람이 그 payload를 최종 확인
(handoff)했는지 기록하는 workflow를 추가한다. 실제 X/Threads/Instagram/
네이버 게시, WordPress public publish 변경, 성과 분석, 자동 재작성은 이
단계에서 하지 않는다.

## Phase 3-6과의 관계

Phase 3-6이 "게시해도 되는가?"를 판정했다면, Phase 3-7은 "게시할 때
실제로 무엇을 붙여넣어야 하는가?"를 준비하는 단계다.
`platform_publish_guard_status='ready'`이고 `platform_publish_ready=true`
인 social post만 dry-run을 생성할 수 있다. dry-run은 Phase 3-5의 manual
export와 비슷해 보이지만, export가 "형식 변환"에 가깝다면 dry-run은
"게시 직전 최종 payload + 체크리스트"에 초점을 맞춘다.

## dry-run이 필요한 이유

여러 단계(quality/approval/export/guard)를 통과했더라도, 실제로 어떤
필드를 어떤 순서로 어디에 붙여넣어야 하는지는 플랫폼마다 다르다.
`buildPlatformPublishDryRunPayload()`가 플랫폼별로 게시 직전에 필요한
필드(제목/본문/캡션/스레드/카드뉴스)와 체크리스트를 하나의 payload로
묶어, 사람이 실제 게시 화면을 열기 전 마지막으로 검토할 수 있게 한다.

## handoff가 필요한 이유

dry-run이 payload를 "만드는" 단계라면, handoff는 사람이 그 payload를
"확인했다"는 사실 자체를 기록하는 단계다. 이후 실제 게시 API가
연동되더라도, "누가 언제 어떤 payload를 최종 확인했는지"를 추적할 수
있어야 하기 때문이다.

## 실제 게시와 dry-run의 차이

| 항목 | dry-run/handoff (Phase 3-7) | 실제 게시(미구현) |
|---|---|---|
| 외부 API 호출 | 없음 | 있음(향후 단계) |
| `publish_status` | 절대 `published`로 바뀌지 않음 | `published`로 전환 |
| 결과 저장 위치 | `platform_publish_dry_run_*`, `handoff_*` | `external_post_id`, `post_url` |
| 되돌릴 수 있는지 | 언제든 재생성 가능("Dry-run 재생성") | 플랫폼 정책에 따라 제한적 |

## handoff completed의 의미

`handoff_status='completed'`는 **"사람이 dry-run payload를 최종 확인하고
수동 게시할 준비를 마쳤다"**는 뜻이다. **실제 외부 게시가 완료되었다는
뜻이 아니며**, 이 단계의 어떤 함수도 `publish_status`를 `published`로
바꾸지 않는다.

## 플랫폼별 dry-run payload 구조

`lib/social/platform-publish-dry-run-builder.ts`의
`buildPlatformPublishDryRunPayload(post)`가 담당한다.

| 플랫폼 | type | 주요 필드 |
|---|---|---|
| wordpress_blog | `wordpress_manual_or_existing_workflow` | title, contentPreviewLength, excerpt, hashtags |
| naver_blog | `manual_copy_handoff` | title, body, hashtags, recommendedImages, finalChecklist |
| naver_cafe | `manual_copy_handoff` | title, body, finalChecklist, caution |
| x | `x_thread_dry_run` | threadItems, itemLengths, totalItems, hashtags, linkPolicy, finalChecklist |
| threads | `threads_post_dry_run` | body, hashtags, finalChecklist |
| instagram | `instagram_caption_card_handoff` | caption, hashtags, cardItems, mediaRequirements, finalChecklist |

필수 콘텐츠(제목/본문, thread_items, caption 등)가 없으면 `ok: false`와
`error`를 반환하고 저장하지 않는다. x는 280자를 초과하는 thread item이
있으면, instagram은 `media_requirements.requiresImage`가 명시되지
않았으면 `warnings`에 담아 반환한다(저장 자체를 막지는 않음).

## 플랫폼별 handoff checklist

모든 플랫폼 payload에는 공통 체크리스트(`baseFinalChecklist`)가 포함된다.

- 최종 내용을 다시 한 번 확인하세요.
- 이미지/링크가 올바른지 확인하세요.
- 플랫폼 정책 위반 가능성이 없는지 확인하세요.

여기에 플랫폼별 안내가 추가된다.

- wordpress_blog: 기존 WordPress 자동 게시 workflow(초안/SEO/대표이미지)가
  이미 있는지 확인
- naver_blog: 편집기에 붙여넣기 전 이미지/링크/서식 확인
- naver_cafe: 카페 규칙, 홍보성 문구, 링크 남발 확인
- x: 각 item의 글자 수 확인
- threads: 문장이 자연스러운지 확인
- instagram: 이미지 또는 카드뉴스 디자인이 준비되었는지 확인

## 로그 보안 원칙

`pipeline_logs.details_json`에는 socialPostId/articleId/platform/
toneStyle/qualityStatus/approvalStatus/exportStatus/publishStatus/
platformPublishGuardStatus/platformPublishReady/dryRunStatus/
handoffStatus/threadItemCount/hashtagCount/cardItemCount/
postBodyLength(길이만)/captionLength(길이만)/checklistCount/warningCount/
reasonCode **만** 저장한다. full dry-run payload/full handoff payload/
full post_body/full caption/full export text/full thread item text/API
key/auth token/Authorization header/Application Password/image binary는
**어디에도** 저장하지 않는다. 단, `platform_publish_dry_run_payload`/
`handoff_payload` 자체(JSON 구조)는 `social_posts` 테이블에는 정상
저장한다 — 로그와 DB 컬럼은 다른 보안 기준을 적용한다.

## 아직 하지 않는 것

- 실제 네이버 블로그/카페 자동 게시
- 실제 X/Threads API 게시
- 실제 Instagram API 게시
- 실제 WordPress public publish 연동 변경 (기존 Phase 2 workflow는
  그대로 유지)
- 실제 성과 분석 (조회수/반응 등 수집 없음)
- 자동 재작성 (dry-run/handoff는 콘텐츠를 고치지 않는다 — 문제가 있으면
  Phase 3-4 편집 화면에서 사람이 직접 수정)

## 다음 단계 제안

- `handoff_status='completed'`인 social post만 모아 보여주는 "게시 대기
  목록" 화면(`listHandoffReadySocialPostsByArticle` 활용)
- 실제 플랫폼 게시 API 연동 검토(항상 handoff completed를 필수 선행
  조건으로 사용, 사람의 명시적 게시 버튼 클릭 전제)
- dry-run payload를 플랫폼 앱/웹으로 바로 열 수 있는 딥링크 지원
- handoff 이력(누가 언제 확인했는지) 조회 화면

## Supabase 확인 SQL

```sql
-- dry-run 상태 확인
select
  id,
  article_id,
  platform,
  tone_style,
  quality_status,
  approval_status,
  export_status,
  publish_status,
  platform_publish_guard_status,
  platform_publish_ready,
  platform_publish_dry_run_status,
  handoff_status,
  platform_publish_dry_run_created_at,
  handoff_completed_at,
  updated_at
from social_posts
order by updated_at desc
limit 20;

-- dry-run payload 확인
select
  id,
  platform,
  platform_publish_dry_run_status,
  jsonb_typeof(platform_publish_dry_run_payload) as dry_run_payload_type,
  handoff_status,
  jsonb_typeof(handoff_payload) as handoff_payload_type
from social_posts
where platform_publish_dry_run_status != 'not_created'
order by platform_publish_dry_run_created_at desc
limit 20;

-- pipeline logs 확인
select
  event_name,
  status,
  message,
  details_json,
  created_at
from pipeline_logs
where event_name like 'social_platform_publish_dry_run_%'
   or event_name like 'social_platform_handoff_%'
order by created_at desc
limit 50;
```
