# Phase 3-5: Manual Export & Copy Workflow

## 목적

Phase 3-4에서 review/edit/approval까지 완료된 `social_posts`를 플랫폼별
수동 게시용 형식으로 export하고, 사용자가 각 항목을 복사해서 직접
플랫폼에 붙여넣을 수 있는 workflow를 완성한다. 실제 X/Threads/Instagram/
네이버 API 게시, 자동 public publish, 성과 분석, 자동 재작성은 이
단계에서 하지 않는다.

## Phase 3-4와의 관계

Phase 3-4가 "승인"까지였다면, Phase 3-5는 "승인된 글을 실제로 각
플랫폼에 붙여넣을 수 있는 형태로 정리"하는 단계다. `quality_status='ready'`
이고 `approval_status='approved'`인 social post만 manual export를 생성할
수 있다. export는 실제 게시가 아니므로 `publish_status`를 `published`로
바꾸는 경로는 어디에도 없다 — 대신 export 전용 트랙인 `export_status`
(`not_exported`/`ready`/`exported`/`blocked`/`failed`)를 새로 둔다.

## manual export가 필요한 이유

이 프로젝트는 실제 플랫폼 API 연동(X/Threads/Instagram/네이버) 없이
동작하므로, 사람이 각 플랫폼 편집기에 직접 복사해서 붙여넣어야 한다.
플랫폼마다 요구하는 형식(제목+본문 분리, plain text, thread 배열, 캡션+
카드뉴스 등)이 달라 그대로 복사하면 어색하거나 정책을 위반할 수 있다.
manual export는 이 형식 변환과 주의사항 안내를 자동화한다.

## 플랫폼별 export format

`lib/social/social-export-builder.ts`의 `buildManualExportPayload(post)`가
담당한다. 필수 콘텐츠가 없으면 `ok: false`와 `error`를 반환하고 저장하지
않는다.

| 플랫폼 | exportFormat | 반환 필드 |
|---|---|---|
| wordpress_blog | `wordpress_markdown` | exportTitle, exportBody, exportHashtags |
| naver_blog | `naver_blog_markdown_copy` | exportTitle, exportBody, exportHashtags |
| naver_cafe | `naver_cafe_plain_text_copy` | exportTitle, exportBody |
| x | `x_thread_copy` | exportThreadItems, exportText(전체 스레드), exportHashtags |
| threads | `threads_plain_text_copy` | exportBody, exportHashtags |
| instagram | `instagram_caption_card_copy` | exportCaption, exportHashtags, exportCardItems |

### naver_blog export 방식

제목/본문/태그를 각각 별도 필드로 분리해 UI에서 따로 복사할 수 있게
한다. 안내: "네이버 블로그 편집기에 붙여넣기 전 이미지/링크/서식을
확인하세요."

### naver_cafe export 방식

plain text(제목+본문)만 제공한다(태그 없음 — 카페 특성상 해시태그를
쓰지 않음). 안내: "카페 규칙과 홍보성 게시 제한을 반드시 확인하세요",
"질문형/토론형 마무리 문장이 있는지 다시 확인하세요", "링크를 남발하지
마세요."

### x thread export 방식

`thread_items`를 order 순으로 정렬해 배열로 제공하고, 각 항목을 UI에서
개별 복사할 수 있게 한다. 전체 스레드를 한 번에 복사할 수 있도록
`n/N 텍스트` 형식의 `exportText`도 함께 생성한다. 280자를 초과하는
항목이 있으면 `warnings`에 담아 반환한다(저장은 막지 않고 경고만).

### threads export 방식

본문 + 해시태그만 제공한다. 안내: "Threads에서는 지나친 해시태그보다
자연스러운 문장을 우선하세요."

### instagram caption/card export 방식

caption + 해시태그 + `card_items`(슬라이드별 heading/body)를 제공한다.
`media_requirements.requiresImage`가 `true`로 명시되어 있지 않으면
warning을 반환한다. 안내: "실제 게시에는 이미지 또는 카드뉴스 디자인이
필요합니다."

### wordpress_blog manual export 방식

제목 + 본문(+해시태그, 있으면)을 제공한다. WordPress는 이미 Phase 2의
자동 게시 workflow가 있으므로, 이 manual export는 어디까지나 보조
기능이라는 안내를 함께 표시한다.

## 승인된 글만 export 가능한 이유

`lib/social/social-manual-export-service.ts`의 `generateManualExport()`가
다음을 모두 만족해야 export를 생성한다.

- `approval_status === 'approved'` (rejected/revoked/pending_review/
  not_requested는 모두 차단)
- `quality_status === 'ready'` (blocked/needs_revision/failed/not_checked는
  모두 차단)
- `publish_status`가 `blocked`/`published`가 아님
- 콘텐츠(제목/본문/캡션/스레드/카드) 중 하나 이상 존재

조건을 만족하지 못하면 export를 만들지 않고 `export_status='blocked'`,
`export_error`에 사유를 저장한 뒤 `social_manual_export_blocked` 로그를
남긴다. export payload를 만든 뒤에도 `lib/social/social-export-validator.ts`
의 `validateManualExportPayload()`로 다시 한 번 검증한다 — 협박/광고클릭
유도/과장수익 등 금지 표현이 재검사에서 발견되면(`blocked`) 저장하지
않고 `export_status='blocked'`로, 그 외 검증 실패(`valid=false`)는
`export_status='failed'`로 저장한다. 통과하면 `export_status='exported'`,
`exported_at`/`exported_by`를 기록하고 `publish_status`도 `'exported'`로
갱신한다(`'published'`로는 절대 바뀌지 않는다).

## copy tracking 구조

`lib/social/social-copy-tracking-service.ts`의 `recordSocialPostCopied()`가
UI의 복사 버튼(`CopyToClipboardButton`, 클라이언트 컴포넌트)이 클립보드
복사를 마친 뒤 호출된다. `export_copy_count`를 1 증가시키고
`last_copied_at`을 갱신하며, `social_manual_export_copied` 로그를
남긴다. `copyTarget`(예: `title`/`body`/`caption`/`hashtags`/`thread_1`/
`card_1`/`all`)만 기록하고 복사된 텍스트 전문은 클라이언트에서 서버로
전송하지 않는다(클립보드 쓰기 자체가 브라우저에서 끝난다).

## 로그 보안 원칙

`pipeline_logs.details_json`에는 socialPostId/articleId/platform/
toneStyle/exportFormat/exportStatus/qualityStatus/approvalStatus/
publishStatus/errorCount/warningCount/threadItemCount/hashtagCount/
cardItemCount/exportTextLength/captionLength/postBodyLength(길이만)/
copyCount/reasonCode **만** 저장한다. full export text/full post_body/
full caption/full thread_items 텍스트/API key/auth token/Authorization
header/Application Password/image binary는 **어디에도** 저장하지 않는다.
단, `export_payload` 자체(JSON 구조)는 `social_posts` 테이블에는 정상
저장한다 — 로그와 DB 컬럼은 다른 보안 기준을 적용한다.

## 아직 하지 않는 것

- 실제 네이버 블로그/카페 자동 게시
- 실제 X/Threads API 게시
- 실제 Instagram API 게시
- 자동 public publish
- 성과 분석 (조회수/반응 수집 없음)
- 자동 재작성 (export는 기존 콘텐츠를 형식만 바꿀 뿐, AI가 다시 쓰지 않음)

## 다음 단계 제안

- 여러 social post를 한 번에 export하는 batch export
- export 이력(누가 언제 어떤 형식으로 export했는지) 조회 화면
- 클립보드 복사가 불가능한 환경(구형 브라우저 등)을 위한 다운로드
  대체 수단
- 실제 플랫폼 게시 API 연동 검토(항상 사람의 명시적 승인/게시 버튼
  클릭 전제)

## Supabase 확인 SQL

```sql
-- social_posts export 상태 확인
select
  id,
  article_id,
  platform,
  tone_style,
  quality_status,
  approval_status,
  publish_status,
  export_status,
  export_format,
  export_copy_count,
  exported_at,
  last_copied_at,
  export_error,
  updated_at
from social_posts
order by updated_at desc
limit 20;

-- export payload 확인
select
  id,
  platform,
  export_format,
  jsonb_typeof(export_payload) as export_payload_type,
  export_status,
  exported_at
from social_posts
where export_payload is not null
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
where event_name like 'social_manual_export_%'
order by created_at desc
limit 50;
```
