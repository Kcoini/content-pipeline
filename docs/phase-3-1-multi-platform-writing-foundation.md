# Phase 3-1: Multi-platform Writing Schema & Foundation

## 목적

기존 WordPress article 기반 시스템 위에, 하나의 article을 여러 플랫폼
(WordPress 블로그, 네이버 블로그, 네이버 카페, X, Threads, Instagram)용
글로 변환하는 멀티 플랫폼 자동 글쓰기 시스템의 **기본 구조**를 추가한다.

이 단계에서는 다음을 하지 **않는다**.

- 실제 AI를 이용한 플랫폼별 글 생성 (지금은 구조 테스트용 placeholder만 생성)
- 실제 SNS/블로그 게시 API 연동 (X/Threads/Instagram/네이버)
- 실제 자동 게시 (모든 플랫폼이 `allowAutoPublish=false`로 고정)

대신 스키마·타입·검증 규칙·quality gate skeleton·manual export 구조를
먼저 준비해, 이후 단계에서 실제 AI 생성/게시 기능을 얹을 수 있는 기반을
만든다.

## 전체 구조

```
article (기존 WordPress 파이프라인의 기사)
   ↓ buildSocialWritingContext (compact context, 원문 전체 아님)
social_posts (플랫폼×문체별 글 초안 1개)
   ↓ runSocialPostQualityGateAndSave
social_post_quality_runs (quality gate 실행 이력)
   ↓ decideSocialPostApproval (사람 승인/거부, 반드시 필요)
social_post_approvals (승인/거부 이력)
   ↓ exportSocialPostDraft (승인된 것만, manual export)
social_posts.export_payload (사람이 복사해서 수동으로 게시)
```

실제 외부 플랫폼 게시는 이 흐름의 어디에도 없다 — 마지막 단계는 항상
"사람이 복사해서 직접 게시"로 끝난다.

## 지원 플랫폼

`wordpress_blog`, `naver_blog`, `naver_cafe`, `x`, `threads`, `instagram`
6개. 각 플랫폼의 지원 필드/제한/export 형식은
`lib/social/platform-writing-config.ts`에 정의되어 있다.

## 지원 문체

`explanatory`(설명형), `informational`(정보형), `persuasive`(설득형),
`warning`(주의환기형), `loss_aversion`(손실회피형), `curiosity`(호기심형),
`comparison`(비교형), `story`(스토리형) 8개.
`lib/social/tone-style-config.ts`에 정의되어 있다.

## 협박형을 사용하지 않는 이유

"불안을 조장해서 행동을 유도하는" 접근은 사용자 신뢰를 해치고, 플랫폼
정책 위반과 법적 위험(허위·과장 광고)으로 이어질 수 있다. 그래서 이
시스템은 애초에 `threat`(협박형) 문체를 타입 레벨에서 지원하지 않는다
(`ToneStyle`에 포함되지 않음). 위험이나 손실을 알려야 할 때는
`warning`/`loss_aversion`처럼 **사실에 기반해 위험을 인지시키되 공포를
조장하거나 협박하지 않는** risk-aware 방식만 사용한다.

`lib/social/tone-style-config.ts`의 `PROHIBITED_TONE_STYLES`에
참고용으로 금지 문체 목록(`threat`/`fearmongering`/`harassment`/
`scam-like persuasion`/`guaranteed income claim`)을 명시해 두었다.

## social_posts 테이블

article 하나를 플랫폼×문체 조합별로 변환한 글 초안 하나를 저장한다.
주요 컬럼:

- `platform`/`tone_style`: 허용된 값만 저장 가능 (DB check constraint +
  repository 레벨 이중 검증)
- `post_title`/`post_body`/`caption`/`excerpt`/`hashtags`: 텍스트 필드
- `thread_items`/`card_items`: X 스레드, Instagram 카드뉴스처럼 여러
  항목으로 구성된 콘텐츠 (jsonb 배열)
- `quality_status`/`quality_score`/`quality_summary`: quality gate 결과
- `approval_status`/`approved_by`/`approved_at`: 사람 승인 상태
- `publish_status`/`external_post_id`/`post_url`: 게시 상태 (이 단계에서는
  `not_published`/`exported`까지만 실제로 사용됨)
- `export_format`/`export_payload`: manual export 결과

## social_post_quality_runs

`social_posts` 하나에 대해 quality gate를 실행할 때마다 기록을 남긴다
(재실행 이력 추적용). `checklist`/`warnings`/`failures`/`blocked_reasons`를
모두 jsonb로 저장한다.

## social_post_approvals

승인/거부 시도마다 이력을 남긴다 (누가, 언제, 어떤 결정을 했는지).
`social_posts.approval_status`는 최신 상태만 반영하고, 이 테이블이 전체
이력을 보관한다.

## Platform Writing Config

`lib/social/platform-writing-config.ts`가 플랫폼별로 다음을 정의한다.

- 지원 필드 (title/body/caption/hashtags/threads/images)
- 필수 이미지 여부(`requiresImage`)
- 권장 길이(`preferredLength`)와 최소/최대 길이
- export 형식(`exportFormat`: html_or_markdown / markdown_copy /
  plain_text_copy / thread_json / caption_and_card_items)
- 공통 금지 표현(`prohibitedPatterns`)
- **`requiresHumanApproval: true`, `allowAutoPublish: false`가 모든
  플랫폼에 고정되어 있다** — 이 값은 이번 단계에서 바꿀 수 없다.

## Tone Style Config

`lib/social/tone-style-config.ts`가 문체별로 다음을 정의한다.

- 라벨/설명
- 글쓰기 가이드(guidance) — 어떻게 써야 하는지
- 금지 표현(prohibitedPatterns) — 공통 금지 표현에 문체별로 몇 개 추가

## Quality Gate Skeleton

`lib/social/social-quality-gate.ts`의 `runSocialPostQualityGate()`가
rule-based 검사를 수행한다 (AI 기반 정교한 평가는 이후 단계).

검사 항목: platform 유효성, tone_style 유효성, 콘텐츠 존재 여부, 협박
표현, 광고 클릭 유도 표현, 허위 수익 보장 표현, 개인정보 노출 의심,
플랫폼별 필수 필드, 해시태그 존재(지원 플랫폼만), 권장 길이.

- **blocked**: 위 항목 중 하나라도 `blocked`로 판정되면 전체 상태가
  `blocked`. (협박/광고 클릭 유도/허위 수익 보장/개인정보 의심/빈 글/
  invalid platform·tone_style)
- **needs_revision**: `blocked`는 없지만 `warning`(너무 짧음, 해시태그
  없음, 필수 필드 일부 누락)이 있는 경우.
- **ready**: 모든 항목 통과.

## Manual Export 전략

`lib/social/social-export-builder.ts`의 `buildExportPayload()`가
플랫폼별로 사람이 복사해서 바로 사용할 수 있는 형태를 만든다.

| 플랫폼 | 형식 | 내용 |
|---|---|---|
| wordpress_blog | html_or_markdown | title + body |
| naver_blog | markdown_copy | title + markdown 본문(해시태그 포함) + hashtags |
| naver_cafe | plain_text_copy | title + 순수 텍스트 본문 |
| x | thread_json | thread_items 배열 + hashtags |
| threads | plain_text_copy | 순수 텍스트 본문 + hashtags |
| instagram | caption_and_card_items | caption + hashtags + card_items |

`exportSocialPostDraft()`는 `approval_status='approved'`가 아니면 export
자체를 거부한다 — 승인 없이는 export payload도 만들어지지 않는다.

## 아직 하지 않는 것

- 실제 AI 글 생성 (현재는 `[placeholder]` 문구만 들어간 draft)
- 실제 SNS 게시 (X/Threads/Instagram API 연동 없음)
- 실제 네이버 블로그/카페 자동 게시
- 실제 WordPress 외 플랫폼으로의 자동 발행
- 성과 데이터(조회수/좋아요 등) 수집 — 스키마 상 여지는 남겨뒀지만 이번
  단계에서 구현하지 않음

## pipeline_logs event_name

`event_name` 컬럼 기준으로 기록된다.

- `social_post_created`
- `social_post_generation_started` / `_completed` / `_failed` (향후 실제
  AI 생성 연동 시 사용할 이벤트, 이번 단계에서는 미발행)
- `social_post_placeholder_generation_started` / `_completed` / `_failed`
- `social_quality_gate_started` / `_completed` / `_blocked` / `_failed`
- `social_approval_started` / `_completed` / `_rejected`
- `social_export_completed`

## publish_logs

`target='social_draft'`(placeholder 생성 시), `target='social_export'`
(manual export 완료 시)만 사용한다. 실제 플랫폼 게시 로그는 아직 없다
(다음 단계 이후).

## Supabase 확인 SQL

```sql
select
  id,
  article_id,
  platform,
  tone_style,
  post_title,
  quality_status,
  approval_status,
  publish_status,
  generated_at,
  created_at
from social_posts
order by created_at desc
limit 20;

select
  social_post_id,
  platform,
  tone_style,
  status,
  score,
  created_at
from social_post_quality_runs
order by created_at desc
limit 20;

select event_name, status, message, details_json, created_at
from pipeline_logs
where event_name like 'social_%'
order by created_at desc
limit 30;
```

## UI

article 상세 페이지의 "Multi-platform Writing" 섹션에서:

- platform/tone_style 선택 후 "새 플랫폼 글 초안 생성 준비" 버튼으로
  placeholder draft 생성
- "목록 새로고침" 버튼
- 각 social post 카드에 platform/tone_style/quality/approval/publish
  상태 배지, 제목/캡션 미리보기, 생성·수정 시각
- "상세 보기"를 펼치면 본문/thread_items/card_items/해시태그와 함께
  Quality Gate 실행/승인/거부/Manual Export 버튼 (승인은
  quality_status='ready'일 때만, export는 approval_status='approved'일
  때만 활성화)
- 실제 게시 버튼은 존재하지 않는다.

## 다음 단계 제안

- 실제 AI(Anthropic 등)를 이용한 플랫폼별 글 실제 생성 연동
  (`social_post_generation_*` 이벤트를 실제로 발행)
- 플랫폼별 quality gate를 rule-based에서 AI 기반 평가로 고도화
- X/Threads/Instagram 등 실제 게시 API 연동 검토 (사람 승인 이후에도
  여전히 "발행 버튼을 사람이 직접 누르는" 구조 유지)
- social post 성과 데이터(조회수/반응) 저장 스키마 추가
- article 승인 → social post 일괄 생성 파이프라인 자동화(단, 항상 사람
  승인 게이트를 거치도록 설계)
