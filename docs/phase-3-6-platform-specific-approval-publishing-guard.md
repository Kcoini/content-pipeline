# Phase 3-6: Platform-specific Approval & Publishing Guard

## 목적

Phase 3-5에서 manual export까지 가능해진 `social_posts`에 대해, 실제
플랫폼 게시 API 연결 전 단계로 플랫폼별 "게시 가능 조건"과 "차단 규칙"을
검사하는 Publishing Guard를 추가한다. 실제 X/Threads/Instagram/네이버
게시, public publish, 성과 분석, 자동 재작성은 이 단계에서 하지 않는다.

## Phase 3-5와의 관계

Phase 3-5가 "형식 변환 + 복사"였다면, Phase 3-6은 "게시해도 되는지
마지막으로 점검"하는 단계다. `runPlatformPublishingGuard()`는
`quality_status`/`approval_status`/`export_status`/`publish_status`를
모두 종합해서 플랫폼별 게시 가능 여부를 재확인하고, 플랫폼마다 다른
위험 신호(키워드 도배, 홍보성 문구, 공격적 표현 등)를 추가로 검사한다.
이 결과는 실제 게시 여부를 결정하는 데 참고할 뿐, 이 단계 자체가 게시를
수행하지는 않는다.

## Publishing Guard가 필요한 이유

`quality_status`(콘텐츠 자체 품질)와 `approval_status`(사람의 승인)와
`export_status`(export 형식 완료)는 각각 다른 시점에 다른 기준으로
평가된다. 이 세 가지가 모두 통과했더라도, 시간이 지나 정책이 바뀌었거나
수정 과정에서 새로운 문제가 생겼을 수 있다. Publishing Guard는 실제
게시 버튼을 누르기 직전 시점에 이 모든 조건을 한 번에 재확인하는
안전장치다.

## 공통 게시 가능 조건 (hard gate)

`lib/social/platform-publishing-guard-service.ts`의
`buildCommonGateChecklist()`가 다음을 모두 검사하며, 하나라도 실패하면
즉시 `status='blocked'`로 판정한다(needs_revision으로 완화되지 않는다).

- platform/tone_style이 유효한 값
- `quality_status === 'ready'`
- `approval_status === 'approved'`
- `export_status`가 `ready` 또는 `exported`
- `publish_status`가 `blocked`/`published`/`failed`가 아님
- 콘텐츠(제목/본문/캡션/스레드/카드) 존재
- `export_payload`가 비어 있지 않음
- 금지 표현(협박/공포조장/허위단정/광고클릭유도/과장수익/개인정보/API
  key·token 노출 의심)이 없음
- 플랫폼별 위험 신호(`checkPlatformSpecificRisks`)가 없음
- 플랫폼이 요구하는 핵심 필드(플랫폼별 표 참고)가 채워져 있음

## 플랫폼별 게시 가능 조건 / blocked 조건

hard gate를 통과한 뒤에만 플랫폼별 "soft" 체크리스트(주로
`needs_revision` 수준)를 평가한다. `lib/social/platform-publishing-rules.ts`
의 `checkPlatformSpecificRisks()`가 담당하는 것은 blocked 수준, 나머지는
`platform-publishing-guard-service.ts`의 `buildPlatformSoftChecklist()`가
담당하는 needs_revision 수준이다.

| 플랫폼 | 필수(blocked) | needs_revision(경고) |
|---|---|---|
| wordpress_blog | post_title/post_body 존재 | excerpt 없음, 본문이 짧음, title이 너무 일반적 |
| naver_blog | post_title/post_body 존재, 키워드 도배 없음 | 해시태그 없음, 검색형 제목 아님, [mock]/[placeholder] 흔적 |
| naver_cafe | post_title/post_body 존재, 홍보성 문구 없음 | 질문/토론 유도 문장 부족, 링크 과다 |
| x | thread_items 존재, 공격적/낚시성 표현 없음 | 글자수 초과 item(fail), hook 약함, item 개수/해시태그 과다 |
| threads | post_body 존재 | 길이 초과, 대화형 요소(질문 등) 부족 |
| instagram | caption 존재 | 해시태그 없음, card_items/media_requirements 불명확, caption 길이 부적절 |

이 외에 협박/공포조장/허위단정/광고클릭유도/과장수익 표현은 플랫폼과
무관하게 공통 hard gate에서 이미 blocked 처리된다.

## platform_publish_guard_status 설명

- `not_checked`: 아직 guard를 실행하지 않음(기본값)
- `ready`: hard gate 통과 + soft 체크리스트 점수 85점 이상, fail 항목 없음
- `needs_revision`: hard gate는 통과했지만 fail 항목이 있거나 점수가
  85점 미만
- `blocked`: hard gate(공통 조건 또는 플랫폼 필수 필드/위험 신호) 중
  하나라도 실패
- `failed`: guard 실행 자체가 예외로 실패(콘텐츠 문제가 아니라 시스템
  오류)

## platform_publish_ready 의미

`platform_publish_ready = true`는 **"게시 가능 조건을 통과했다"**는
뜻이지 **"실제로 게시되었다"**는 뜻이 아니다. 이 값이 true여도
`publish_status`는 바뀌지 않으며, 실제 플랫폼 게시 API는 어디에서도
호출되지 않는다.

## 실제 게시와의 차이

| 항목 | Publishing Guard (Phase 3-6) | 실제 게시(미구현) |
|---|---|---|
| 외부 API 호출 | 없음 | 있음(향후 단계) |
| 결과 저장 위치 | `platform_publish_guard_*`, `platform_publish_ready` | `publish_status='published'`, `external_post_id`, `post_url` |
| 되돌릴 수 있는지 | 언제든 재실행 가능 | 플랫폼 정책에 따라 제한적 |
| 사람의 최종 확인 | 필요(권장) | 필수(게시 버튼은 이 단계에 없음) |

## 로그 보안 원칙

`pipeline_logs.details_json`에는 socialPostId/articleId/platform/
toneStyle/qualityStatus/approvalStatus/exportStatus/publishStatus/
guardStatus/guardScore/ready/warningCount/failureCount/blockedCount/
hashtagCount/threadItemCount/cardItemCount/postBodyLength(길이만)/
captionLength(길이만) **만** 저장한다. full post_body/full caption/full
export text/full thread item text/API key/auth token/Authorization
header/Application Password/image binary는 **어디에도** 저장하지 않는다.

## 아직 하지 않는 것

- 실제 네이버 블로그/카페 자동 게시
- 실제 X/Threads API 게시
- 실제 Instagram API 게시
- 실제 public publish
- 실제 성과 분석 (조회수/반응 등 수집 없음)
- 자동 재작성 (guard가 needs_revision을 반환해도 AI가 자동으로 고치지 않음 — 사람이 Phase 3-4 편집 화면에서 직접 수정)

## 다음 단계 제안

- guard가 `ready`인 social post만 노출하는 "게시 대기 목록" 화면
  (`listPublishingReadySocialPostsByArticle` 활용)
- 실제 플랫폼 게시 API 연동 검토(항상 사람의 명시적 승인/게시 버튼
  클릭 전제, 이 guard 통과를 필수 선행 조건으로 사용)
- guard 체크리스트를 AI 기반 평가로 보강(문체/맥락 적합성 등)
- 여러 social post를 한 번에 재검사하는 batch guard 실행

## Supabase 확인 SQL

```sql
-- social_posts guard 상태 확인
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
  platform_publish_guard_score,
  platform_publish_ready,
  platform_publish_blocked_reason,
  platform_publish_guard_checked_at,
  updated_at
from social_posts
order by updated_at desc
limit 20;

-- guard summary 확인
select
  id,
  platform,
  platform_publish_guard_status,
  platform_publish_guard_score,
  platform_publish_guard_summary
from social_posts
where platform_publish_guard_status != 'not_checked'
order by platform_publish_guard_checked_at desc
limit 20;

-- pipeline logs 확인
select
  event_name,
  status,
  message,
  details_json,
  created_at
from pipeline_logs
where event_name like 'social_platform_publish_guard_%'
order by created_at desc
limit 50;
```
