# Phase 4-6: 글쓰기/게시 준비 화면에서 개발자·운영자용 상세 정보 숨김

## 문제

`/articles/[id]`의 WordPress SEO 반영 영역("SEO Plugin Actual Write",
"Custom Endpoint (Rank Math 전용)")이 기본 화면에 그대로 펼쳐져 있어,
글을 작성·검토·승인하는 일반 사용자 흐름에서 `SEO_PLUGIN_PROVIDER`,
`SEO_PLUGIN_WRITE_ENABLED`, `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED`,
custom endpoint path 같은 내부 환경변수/설정값이 그대로 노출되고
있었다.

## 확인 결과: 대부분의 다른 글쓰기 페이지는 이미 이 원칙을 따르고 있었다

이번 phase를 시작하기 전에 `app/articles/[id]/blog|social|rewrite`,
`app/social-posts/[id]`, `app/dashboard`, `app/dashboard/*`를 모두
점검했다. 결과:

- `/articles/[id]/social`: `quality_status`/`approval_status`/
  `export_status`/`platform_publish_guard_status`/dry-run/handoff/API
  readiness/성과가 이미 `<details>` "상세 상태 보기 / 보조 작업
  (관리자용, 기본 접힘)" 안에 있었다.
- `/articles/[id]/rewrite`: `rewriteReapprovalStatus`/
  `rewriteReexportStatus`/`rewriteRepublishWorkflowStatus`가 이미
  `<details>` "내부 상태값 보기 (관리자용, 기본 접힘)" 안에서
  `describeStatusField`/`describeStatusValue`로 변환되어 있었고,
  disabled 버튼에는 이미 이유가 표시되고 있었다.
- `/articles/[id]/blog`: WordPress 반영 탭의 raw DB 상태값
  (`quality_status` 등)은 이미 `<details>` "내부 상태값 보기" 안에
  있었다. 다만 **같은 카드 안의 "SEO Plugin Metadata" 블록**(provider
  select, raw `seoPluginWriteStatus` 값)은 기본 화면에 그대로
  노출되어 있어 이번 phase에서 함께 정리했다.
- `/social-posts/[id]`: DB field name/payload/dry-run/API readiness는
  이미 별도 "raw" 탭(`?tab=raw`, 기본 탭은 "preview")에서만 보이는
  구조였다 — 이미 기본 화면과 분리되어 있었다.
- `/dashboard`, `/dashboard/*`: raw env/provider/endpoint 노출 없음.

실제로 원칙을 위반하고 있던 곳은 `/articles/[id]`(Phase 2-12/2-13)와
`/articles/[id]/blog`의 SEO Plugin Metadata 블록, 이 두 곳뿐이었다.

## 1. `/articles/[id]`: SEO Plugin Actual Write / Custom Endpoint

`lib/seo/seo-plugin-status-summary.ts`(신규)의
`summarizeSeoPluginWriteStatus()`가 다음을 "SEO 정보 준비 → 반영 →
확인" 5단계 중 하나로 요약한다(새 DB 컬럼 없음 — 항상 article 필드로
부터 순수 함수로 계산):

| 상태 | 조건 | primary action |
|---|---|---|
| `not_ready` | SEO 제목/설명/Focus Keyword 중 하나라도 없음 | [SEO 정보 생성] |
| `ready_to_write` | 셋 다 준비됨, 아직 반영 시도 전 | [SEO 정보 반영하기] |
| `written_unconfirmed` | 반영 시도(success/needs_custom_endpoint)했지만 verified=false | [반영 상태 확인] |
| `confirmed` | actualWriteVerified 또는 customEndpointVerified 중 하나라도 true | [WordPress Draft 보기] |
| `error` | actualWriteStatus 또는 customEndpointStatus가 failed | [다시 시도] |

기본 화면(`app/articles/[id]/page.tsx`)에는 이 요약만 보여준다 —
SEO 제목/메타 설명/Focus Keyword 준비 여부, WordPress Draft 연결
여부, 다음 작업 한 문장, primary action 버튼 1개. 헤더도 영어
"SEO Plugin Actual Write"가 아니라 "SEO 정보 반영 상태"로 바꿨다.

기존 내용(provider/env flag/endpoint path/post id/raw verified/
"SEO plugin metadata 실제 반영 테스트"/"Custom Endpoint (Rank Math
전용)"/"Rank Math custom endpoint로 SEO 반영" 버튼)은 **삭제하지
않고** `<details>` "SEO 반영 상세 보기"(기본 닫힘) 안으로 그대로
옮겼다 — 두 액션(actual write, custom endpoint write)과 그 버튼도
접힘 안에서 그대로 동작한다.

## 2. `/articles/[id]/blog`: SEO Plugin Metadata 블록

wordpress_blog 카드의 "WordPress 반영" 탭 안, "SEO Plugin Metadata"
블록도 raw `provider`/`SEO Plugin update status`(raw enum)를 기본
화면에 보여주고 있었다. 제목을 "SEO 정보 반영 상태"로 바꾸고, 그
아래 한 줄 요약(`seoPluginWriteFriendlyLabel` — "SEO 정보가
반영되었습니다."/"반영에 실패했습니다."/"아직 반영되지 않았습니다.")
만 기본으로 보이게 했다. provider 값/raw status/provider 변경
select/반영 버튼은 `<details>` "SEO 반영 상세 보기"로 옮겼다 —
기능(`updateWordPressSeoPluginMetadataFromBlogPostAction`)은 그대로다.

## 3. 원칙 재확인 (변경하지 않은 것)

- SEO metadata actual write / custom endpoint 기능 자체는 유지한다.
- WordPress는 Draft 생성/업데이트까지만 자동화한다 — 이 phase가
  public publish 경로를 새로 열지 않는다.
- DB schema는 변경하지 않았다 — `seoWriteSummary`는 기존 article
  필드로부터 매 렌더링마다 다시 계산되는 파생 값이다.
- 버튼 클릭 후 무반응 상태를 만들지 않는다 — primary action이
  disabled일 때는 항상 이유(`primaryActionDisabledReason`)를 `title`
  속성과 화면 텍스트로 함께 보여준다.

## 테스트

- `lib/seo/seo-plugin-status-summary.test.ts`: 5개 상태 전이 규칙
  (not_ready/ready_to_write(+draft 없음 disabled 사유)/
  written_unconfirmed/confirmed(양쪽 채널)/error(우선순위 포함)).
- `app/articles/[id]/page.test.ts`: 기본 화면에 raw env 이름/
  `Custom Endpoint`/`SEO Plugin Actual Write` 문자열이 없음, 요약
  카드 항목 표시, 5개 primary action 존재, 접힘 안에는 기존 raw
  값/기존 액션이 그대로 남아 있음, disabled 사유 표시.
- `app/articles/[id]/blog/page.test.ts`: 같은 원칙(요약 → 접힘)이
  SEO Plugin Metadata 블록에도 적용됐는지 검증.
- 전체 `npx vitest run`: 225 files / 2875 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류(경고 0 — 사용하지 않게 된 status
  label/style map은 접힘 영역의 배지로 재사용해 정리했다).
- `npm run build`: 성공.

## 관련 문서

- [`wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md) — "카드 안 정보는 핵심 요약 → 상세(접기) 순으로 배치한다" 원칙, 이번 phase가 그대로 따른 기존 규칙
- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md) — raw enum/DB status 미노출 원칙
- [`ui-review-agent-checklist.md`](./ui-review-agent-checklist.md) — "raw enum이 노출되지 않는가" 체크 항목
