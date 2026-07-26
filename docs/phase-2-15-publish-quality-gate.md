# Phase 2-15: Publish Quality Gate

## 목적

WordPress 공개 게시(공개 publish) 전에 반드시 통과해야 하는 품질검사
게이트다. article/WordPress draft/SEO metadata/featured image/출처 인용/
AD_SLOT marker/콘텐츠 안전성/로깅 안전성을 종합 점검해 checklist·점수·
`publish_ready` 여부를 산출한다. 이 단계는 검증만 수행하며, 실제 공개
게시(`WordPress post status`를 `publish`로 바꾸는 동작)는 어떤 경우에도
수행하지 않는다.

## 사전 조건

- Phase 2-9 WordPress Draft Publish Stabilization 완료
- Phase 2-13 Custom WordPress SEO Metadata Endpoint 완료
- Phase 2-14 WordPress Final Draft Payload Review 완료 (없어도 게이트는
  동작하며, 해당 항목은 `warning`으로 처리된다)
- `publish_logs`는 `details_json` 컬럼을, `pipeline_logs`는 `event_name`
  컬럼을 사용한다.

## Migration

`db/migrations/023_phase-2-15-publish-quality-gate.sql`

```sql
alter table articles
  add column if not exists publish_quality_gate_status text not null default 'not_checked';
alter table articles
  add column if not exists publish_quality_gate_score numeric;
alter table articles
  add column if not exists publish_quality_gate_summary jsonb not null default '{}'::jsonb;
alter table articles
  add column if not exists publish_quality_gate_error text;
alter table articles
  add column if not exists publish_quality_gate_checked_at timestamptz;
alter table articles
  add column if not exists publish_ready boolean not null default false;
alter table articles
  add column if not exists publish_blocked_reason text;
notify pgrst, 'reload schema';
```

## Gate 상태 정의 (`publish_quality_gate_status`)

| 상태 | 의미 |
|---|---|
| `not_checked` | 아직 게이트를 실행하지 않음 |
| `ready_to_publish` | score ≥ 85, fail 항목 없음, critical blocked 없음 |
| `needs_revision` | fail 항목이 있거나 score가 85 미만 (critical blocked는 아님) |
| `blocked` | critical severity를 가진 `blocked` 항목이 하나 이상 존재 |
| `failed` | 게이트 실행 자체가 예외로 실패 (안전하게 처리되어 Runtime Error로 터지지 않음) |

`publish_ready`는 `ready_to_publish`일 때만 `true`다.

## checklist 항목

`lib/publish/publish-quality-gate-service.ts`가 총 28개 항목을 점검한다.
각 항목은 `{ key, label, status, message, severity }` 형태이며
`status`는 `pass`/`warning`/`fail`/`blocked` 중 하나, `severity`는
`low`/`medium`/`high`/`critical` 중 하나다.

### A. 기본 항목
- `title_present`, `content_present`: 제목/본문 존재 (없으면 `blocked`, critical)
- `status_reviewed`: `article.status`가 `reviewed` 또는 `published` (아니면 `blocked`, critical)
- `content_length`: article_mode별 최소 단어 수(monetized_blog≥600, source_based_explainer≥500, general_news≥400) 및 chars/paragraphs/headings 정보 포함

### B. WordPress draft 항목
- `wordpress_draft_exists`: `publish_logs.target='wordpress'`, `status='success'`, `external_post_id` 존재 (없으면 `blocked`, critical)
- `wordpress_status_draft`: 이 파이프라인은 draft만 생성하고 공개 publish를 절대 수행하지 않으므로 항상 `pass`
- `final_draft_review`: `wordpressFinalDraftReviewStatus`가 `failed`→`blocked`(high), `not_reviewed`/`missing_wordpress_draft`→`warning`, `reviewed`(실패 항목 있음)→`warning`, `reviewed`(실패 항목 없음)→`pass`

### C. SEO 항목
- `seo_title_present`, `meta_description_present`: monetized_blog에서 없으면 `blocked`(critical), 그 외 모드는 `fail`(high)
- `slug_present`: 없으면 `warning`
- `target_keyword_present`: 없으면 `blocked`(critical)
- `target_keyword_in_seo_title`, `target_keyword_in_meta_description`: 포함되지 않으면 `warning`

### D. Rank Math custom endpoint 항목
- `seo_metadata_custom_endpoint`: provider=rank_math에서 `custom_endpoint_status='success' && verified=true`→`pass`, `success`이지만 미검증→`warning`, 그 외→`fail`
- `seo_metadata_actual_write`: actual write 또는 custom endpoint 중 하나라도 검증되면 `pass`, 아니면 `fail`

### E. Category/Tag 항목
- `category_present`: 없으면 `fail`(high)
- `tag_present`: 없으면 monetized_blog는 `fail`, 그 외는 `warning`

### F. Featured Image 항목
- `featured_image_present`: monetized_blog에서 없으면 `fail`, 그 외는 `warning`
- `featured_media_attached`: `wordpressFeaturedMediaAttachStatus==='attached'`가 아니면 `warning`

### G. Source/Citation 항목
- `source_citation_exists`: 인용 출처가 0개면 `blocked`(critical)
- `source_reference_in_content`: 본문에 출처 표기 패턴이 없으면 `warning`

### H. AD_SLOT/수익화 항목 (monetized_blog만 강하게 점검)
- `ad_slot_marker_present`: marker 누락 시 `warning`
- `ad_slot_marker_not_excessive`: marker가 중복 삽입된 것으로 보이면 `warning`
- `monetization_banned_phrases`: "광고 클릭"/"수익 보장"/"무조건 돈 버는" 등 문구 발견 시 `blocked`(critical)

### I. Safety/Compliance 항목
- `content_safety_banned_phrases`: 근거 없는 단정/보장성 표현 발견 시 `fail`
- `content_safety_secret_exposure`: auth/password/API key로 의심되는 문자열 발견 시 `blocked`(critical)
- `content_safety_pii`: 주민등록번호/전화번호 형식 패턴 발견 시 `fail`
- `content_safety_copyright_risk`: 문장 구분 없는 매우 긴 단락(원문 그대로 복사 의심) 발견 시 `warning`

### J. Logging safety 항목
- `logging_safety`: `publish_logs.details_json`에 본문 전체/인증정보를 저장하지 않음을 확인하는 고정 `pass` 항목 (실제 저장 로직 자체가 안전하게 구현되어 있음을 명시)

## 점수 계산

`pass=1, warning=0.5, fail=0, blocked=0`의 합을 전체 항목 수로 나눠
0~100 점수로 환산한다 (항목 제외 없이 전체 28개 항목을 분모로 사용).

- critical severity의 `blocked` 항목이 하나라도 있으면 무조건 `blocked`
- 그렇지 않고 score ≥ 85 및 `fail` 항목 없음 → `ready_to_publish`
- 그 외 (score < 85 이거나 `fail` 항목 존재) → `needs_revision`
- 실행 자체 예외 → `failed`

## Critical blocked 조건 (요약)

제목/본문 없음, 승인 상태 아님, WordPress draft 없음, target_keyword 없음,
출처 없음, monetized_blog에서 SEO title/meta description 없음, 인증정보
노출 의심, 광고 클릭 유도/수익 보장 문구 존재 — 위 조건 중 하나라도
해당하면 전체 상태가 `blocked`로 확정된다.

## articles 저장 필드

`savePublishQualityGateResult()`가 다음을 갱신한다.

- `publish_quality_gate_status`, `publish_quality_gate_score`
- `publish_quality_gate_summary` (jsonb — checklist 항목별 key/label/status/message/severity와 pass/warning/fail/blocked count, score, qualityGateStatus, publishReady, checkedAt만 저장. 기사 본문 전체는 저장하지 않음)
- `publish_quality_gate_error`, `publish_quality_gate_checked_at`
- `publish_ready` (boolean), `publish_blocked_reason`

## publish_logs 저장 구조

`target = 'publish_quality_gate'`.

- `ready_to_publish` / `needs_revision`: `status='success'`,
  `external_post_id`/`post_url`은 기존 draft 값, `error_message=null`,
  `details_json = { actual:false, publishAction:false, qualityGateStatus,
  qualityGateScore, passCount, warningCount, failCount, blockedCount,
  publishReady, topWarnings, topFailures }`.
- `blocked`: `publish_logs.status`에 `blocked` 값이 없으므로
  `status='failed'`로 저장하고 `details_json.qualityGateStatus='blocked'`,
  `details_json.blockedReasons`에 안전한 사유 요약을 담는다.
  `error_message`에도 안전한 blocked 요약을 저장한다.
- 실행 자체 실패: `status='failed'`, `error_message`는 안전한 오류 메시지.

절대 저장하지 않는 값: 기사 본문 전체, Authorization header, Application
Password, HTTP Basic Auth 문자열, API key, WordPress raw response.

## pipeline_logs event_name

- `publish_quality_gate_started`
- `publish_quality_gate_completed` (ready_to_publish)
- `publish_quality_gate_needs_revision`
- `publish_quality_gate_blocked`
- `publish_quality_gate_failed`

## Supabase 확인 SQL

```sql
select event_name, status, message, details_json, created_at
from pipeline_logs
where event_name like 'publish_quality_gate_%'
order by created_at desc
limit 30;

select article_id, target, status, external_post_id, post_url, error_message, details_json, created_at
from publish_logs
where target = 'publish_quality_gate'
order by created_at desc
limit 10;

select id, title, publish_quality_gate_status, publish_quality_gate_score,
       publish_quality_gate_summary, publish_quality_gate_error,
       publish_quality_gate_checked_at, publish_ready, publish_blocked_reason
from articles
where id = '<article_id>';
```

## UI

article 상세 페이지의 "Publish Quality Gate" 섹션에서 게이트 상태 배지,
score, `publish_ready` 여부, 마지막 검사 시간, 차단 사유, checklist
전체(라벨 + 상태 배지 + 메시지)를 확인할 수 있다. "Publish Quality Gate
실행"(WordPress draft가 없으면 비활성화)과 "결과 새로고침" 버튼을
제공한다. 공개 게시(공개) 버튼은 만들지 않았으며, `publish_ready=true`인
경우에도 "다음 단계에서 사용자 승인을 거쳐야 공개 게시가 가능하다"는
안내만 표시할 뿐 실제 공개는 수행하지 않는다. 인증정보는 화면에
표시하지 않으며, checklist 요약에도 본문 전체를 표시하지 않는다.

## 보안 주의사항

- `publish_logs.details_json`/`articles.publish_quality_gate_summary`에는
  checklist 항목 요약(key/label/status/message/severity)과 카운트/점수만
  저장하고, 기사 본문 전체나 WordPress raw response는 저장하지 않는다.
- 인증정보(Authorization header, Application Password, Basic Auth 문자열,
  API key)는 로그·화면 어디에도 저장·노출하지 않는다.
- 실행 중 예외가 발생해도 안전하게 `failed` 상태로 처리되며 Runtime
  Error로 터지지 않는다.
- 공개(publish)는 이 게이트에서 어떤 경우에도 수행하지 않는다.

## 다음 단계 제안

- `publish_ready=true`인 기사에 대해 사용자 승인을 받는 별도의 공개 승인
  플로우 설계 (실제 WordPress publish 전환은 여전히 MVP 이후 범위).
- checklist 항목별 가중치 도입으로 점수 계산 정교화.
- 안전성 검사(금지 문구/PII/저작권 위험) 패턴을 외부 설정 파일로 분리.
