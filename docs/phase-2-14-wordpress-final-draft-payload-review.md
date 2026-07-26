# Phase 2-14: WordPress Final Draft Payload Review

## 목적

WordPress draft post/featured media/Rank Math SEO metadata/category·tag/
출처 인용/AD_SLOT marker가 하나의 draft에 정상 반영되었는지 review checklist로
점검하고, 결과를 `articles`/`publish_logs`/`pipeline_logs`에 저장한다. 실제
WordPress API를 다시 호출하지 않고, 이전 단계(Phase 2-9~2-13)에서 이미
저장된 상태를 재집계하는 방식이다. 공개(publish)는 어떤 경우에도 수행하지
않는다.

## 사전 조건

- WordPress draft post가 이미 생성되어 있어야 한다(`publish_logs.target=
  'wordpress'`, `status='success'`, `external_post_id`가 있는 기록).
- 없으면 실제 점검을 시도하지 않고 `missing_wordpress_draft`로 처리한다.

## Migration (schema alignment)

`db/migrations/022_phase-2-14-wordpress-final-draft-payload-review.sql`에서
이미 다음 컬럼을 추가했다(이 기능 구현 전에 미리 준비해 둔 컬럼).

```sql
alter table articles
  add column if not exists wordpress_final_draft_review_status text not null default 'not_reviewed';

alter table articles
  add column if not exists wordpress_final_draft_review_score numeric;

alter table articles
  add column if not exists wordpress_final_draft_review_summary jsonb not null default '{}'::jsonb;

alter table articles
  add column if not exists wordpress_final_draft_review_error text;

alter table articles
  add column if not exists wordpress_final_draft_reviewed_at timestamptz;

-- 컬럼 추가 후 PostgREST가 새 컬럼을 인식하지 못하는 경우가 있어 schema cache를 갱신한다.
notify pgrst, 'reload schema';
```

## checklist 항목

`lib/publish/wordpress-final-draft-review-service.ts`가 다음 6개 항목을
점검한다. 각 항목은 `passed`/`failed`/`warning` 중 하나의 상태를 갖는다
(`warning`은 점수 계산에서 제외되는 "해당 없음/선택 사항" 항목이다).

| key | 항목 | 통과 조건 |
|---|---|---|
| `wordpress_draft` | WordPress draft post | 이미 성공한 draft가 있어야 이 함수가 실행되므로 항상 passed |
| `featured_media` | Featured media 연결 | `wordpressFeaturedMediaAttachStatus === 'attached'` |
| `seo_metadata` | Rank Math SEO metadata 반영 | `seoPluginActualWriteStatus==='success' && verified` 또는 `seoPluginCustomEndpointStatus==='success' && verified`. provider=none이면 warning |
| `category_tag` | Category/Tag | category와 tag가 모두 이름 또는 id로 존재 |
| `source_citation` | 출처 인용 | `citedSourceIds.length >= 3` |
| `ad_slot_marker` | AD_SLOT marker | monetized_blog 모드에서 `AD_SLOT_MARKERS` 전부가 본문에 존재. 다른 모드는 warning(해당 없음) |

`score`는 `warning`을 제외한 항목 중 `passed` 비율(0~100)이다.

## articles 저장 필드

- `wordpress_final_draft_review_status`: `not_reviewed` / `reviewed` /
  `missing_wordpress_draft` / `failed`
- `wordpress_final_draft_review_score` (numeric, 0~100)
- `wordpress_final_draft_review_summary` (jsonb — checklist 항목별
  key/label/status/detail과 failedItems/checkedAt만 저장, 기사 본문 전체는
  저장하지 않음)
- `wordpress_final_draft_review_error`, `wordpress_final_draft_reviewed_at`

## publish_logs 저장 구조

`target = 'wordpress_final_draft_review'`.

- 성공(검토 완료, 일부 항목 실패 포함): `status='success'`,
  `external_post_id`/`post_url`은 기존 draft 값 그대로, `details_json =
  { actual:false, score, checklist, failedItems }`.
- 기존 draft 없음: `status='skipped'`, `details_json = { actual:false,
  reason: 'missing_wordpress_draft' }`.
- 예외 발생: `status='failed'`, `error_message`는 안전한 메시지.

## pipeline_logs event_name

`event_name` 컬럼 기준으로 기록한다.

- `wordpress_final_draft_review_started`
- `wordpress_final_draft_review_completed` (checklist에 실패 항목이 있으면 status=failed, 없으면 status=success로 기록)
- `wordpress_final_draft_review_failed` (실행 자체 예외)
- `wordpress_final_draft_review_skipped_missing_draft`

## Supabase 확인 SQL

```sql
select event_name, status, message, details_json, created_at
from pipeline_logs
where event_name like 'wordpress_final_draft_review_%'
order by created_at desc
limit 30;

select article_id, target, status, external_post_id, post_url, error_message, details_json, created_at
from publish_logs
where target = 'wordpress_final_draft_review'
order by created_at desc
limit 10;

select id, title, wordpress_final_draft_review_status, wordpress_final_draft_review_score,
       wordpress_final_draft_review_summary, wordpress_final_draft_review_error,
       wordpress_final_draft_reviewed_at
from articles
where id = '<article_id>';
```

## UI

article 상세 페이지의 "WordPress Final Draft Payload Review" 섹션에서
score/마지막 검토 시간/항목별 결과(라벨 + 상태 배지 + 설명)를 확인할 수
있다. "Final draft payload 검토 실행"(WordPress draft가 없으면 비활성화)과
"검토 상태 확인" 버튼을 제공한다. 공개 게시 버튼은 만들지 않았다.

## 보안 주의사항

- 실제 WordPress API를 호출하지 않으므로 Application Password/Authorization
  header가 이 기능에서는 애초에 사용되지 않는다.
- `publish_logs.details_json`/`articles.wordpress_final_draft_review_summary`
  에는 checklist 항목의 key/label/status/detail 요약만 저장하고, 기사 본문
  전체는 저장하지 않는다.
- 공개(publish)는 어떤 경우에도 수행하지 않는다.

## 다음 단계 제안

- checklist 항목에 가중치를 두어 점수 계산을 정교화.
- 실패 항목에 대한 "바로가기" 링크(관련 섹션으로 스크롤)를 UI에 추가.
- article.status가 `published`로 전환되는 실제 공개 흐름 설계(MVP 이후 범위).
