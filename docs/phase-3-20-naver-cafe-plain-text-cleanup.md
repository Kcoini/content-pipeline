# Phase 3-20: naver_cafe plain text 정리 + 게시용 본문/관리 정보 분리

## 문제

1. naver_cafe 본문에 escape된 markdown 문법(`\## 제목`, `\*\*굵게\*\*`,
   `&#x20;`)이 그대로 노출됐다.
2. naver_cafe 글이 카페 글이라기보다 기사 요약문에 가까웠다.
3. export/dry-run/handoff payload 요약, 상태, 성과, Rewrite, A/B Test,
   API Publishing, metadata 등 내부 관리 정보가 본문 아래에 너무 많이
   노출되어 게시용 본문과 섞여 보였다.

## 원인 확인

`\## 제목`/`\*\*굵게\*\*`/`&#x20;`처럼 백슬래시로 escape된 markdown이나
HTML numeric entity를 코드가 직접 만들어내는 곳은 없었다(전체 코드베이스
검색 결과 그런 escape 유틸리티가 존재하지 않음). 즉 **naver_cafe 프롬프트가
markdown 사용을 명시적으로 금지하지 않아서, AI가 다른 플랫폼(wordpress_blog/
naver_blog)에서 쓰던 markdown 습관을 그대로 가져오면서 이런 잔여물을
스스로 출력한 것**이 원인이다. 프롬프트만으로는 100% 막을 수 없으므로,
저장/표시/export 시점에 항상 안전하게 정리하는 방어 로직이 필요하다.

내부 관리 정보 노출 문제는 원인이 달랐다 — `app/social-posts/[id]/page.tsx`
(상세 페이지) 자체가 원래 "social_post 하나의 상세 정보를 읽기 전용으로
보여주는" 디버깅/운영용 페이지였고, 게시용 본문 미리보기와 상태/성과/
Rewrite/A-B Test/API Publishing/메타데이터 섹션이 같은 화면에 나란히
펼쳐져 있어 구분이 안 됐다. 실제 export/dry-run/handoff/manual copy
payload 자체(`lib/social/social-export-builder.ts`,
`lib/social/platform-publish-dry-run-builder.ts`)에는 애초에 내부 상태값이
포함되어 있지 않았다 — 화면 표시 방식의 문제였다.

## 조치 (DB schema 변경 없음)

### 1) `sanitizeNaverCafePlainText()` 신규 (`lib/social/naver-cafe-plain-text-sanitizer.ts`)

- escape된 heading(`\##`)과 순수 heading(`##`) 마커를 모두 제거한다
  (마커만 삭제, 텍스트는 남긴다).
- escape된 bold(`\*\*`)와 순수 bold(`**`) 마커 쌍을 제거한다(마커만
  삭제, 텍스트는 남긴다).
- escape된 list bullet(`\-`)은 백슬래시만 벗기고 `-`는 그대로 둔다
  (plain text에서도 자연스러운 목록 표시이기 때문).
- `&#x20;` 등 흔한 HTML numeric entity를 실제 문자로 되돌린다.
- markdown link `[text](url)`를 "text (url)"로 풀어 쓴다.
- markdown table을 `/`로 구분한 한 줄 목록으로 바꾼다(구분행은 제거).
- 연속 공백/개행을 정리하고 앞뒤를 trim한다.
- 이미 깨끗한 텍스트에 다시 적용해도 안전하다(idempotent).

### 2) 적용 위치

- **저장 전**: `lib/social/social-draft-generation-service.ts` —
  naver_cafe 생성/재생성 직후(AI/mock 공통 경로) 저장 전에 적용한다.
  다른 플랫폼(wordpress_blog/naver_blog 등)은 markdown이 정상 형식이므로
  전혀 건드리지 않는다.
- **표시 전**: `lib/social/social-post-display.ts`(`getSocialPostDisplayBody`,
  목록 카드)와 `app/social-posts/[id]/page.tsx`(상세 페이지 본문
  미리보기) — 이미 저장된 기존 데이터도 항상 정리된 형태로 보여준다.
- **export/copy/handoff 전**: `lib/social/social-export-builder.ts`의
  `buildManualExportPayload`(실제 "Manual Export" 버튼이 쓰는 함수)와
  `buildExportPayload`(레거시 export 경로, `exportSocialPostDraft`/수정
  저장 흐름이 사용), `lib/social/platform-publish-dry-run-builder.ts`의
  `dryRunPayload`/`handoffPayload`(dry-run/handoff 버튼이 쓰는 함수) —
  모두 naver_cafe일 때 본문을 정리한다.

### 3) 프롬프트 개선 (`prompts/social/naver-cafe.md`)

markdown heading/HTML 태그/굵게(`**`)/표/markdown link 사용을 명시적으로
금지하고, plain text로만 작성하도록 새 섹션을 추가했다. 또한:

- 글 길이를 700~1,200자로 권장(기존 300~3,000자 안전선은 유지).
- 제목은 질문형/공감형으로.
- 본문 마지막에 선택지형/구체적 질문 3~5개 포함.
- 권장 구조(공감형 도입 → 핵심 이슈 2~3문단 → 생활 영향 정리 → 내가
  확인하려는 것 → 회원들에게 묻는 질문 → 댓글 유도 마무리)를 명시.
- export/dry-run/handoff payload에 내부 관리 정보나 localhost 링크,
  metadata를 포함하지 않는다는 원칙을 프롬프트에도 명시했다(실제
  payload 빌더가 이미 지키고 있는 원칙을 프롬프트에도 남겨 일관성을
  유지한다).

### 4) quality gate 강화 (`lib/social/social-quality-gate.ts`)

naver_cafe 전용 검사에 추가:

- `naver_cafe_no_markdown_escape`: escape된 markdown/HTML entity가
  남아 있으면 **fail**(needs_revision 강제) — ready로 통과하지 않는다.
- `naver_cafe_no_localhost_link`: 본문에 localhost/127.0.0.1 링크가
  있으면 **blocked**.
- `naver_cafe_no_internal_status_leak`: 본문에 `quality_status` 등
  내부 관리 상태값 이름이 그대로 섞여 있으면 **blocked**.
- `naver_cafe_discussion_cue`(기존 항목 강화): 질문이 2개 이상이면
  pass, 1개면 warning, 0개면 **fail**(댓글 유도 질문이 전혀 없으면
  ready로 보지 않는다).

### 5) 게시용 본문과 관리 정보 분리 (`app/social-posts/[id]/page.tsx`)

상세 페이지에서 "상태"/"성과"/"Rewrite 관련 상태"/"A/B Test"/
"API Publishing"/"메타데이터" 섹션과 기존 "export/dry-run/handoff
payload 요약"을 하나의 `<details>` "관리 정보 보기 (관리자용)" 아코디언
으로 묶고 기본 접힘 처리했다. 이 변경은 naver_cafe만이 아니라 모든
플랫폼에 동일하게 적용된다(단순 화면 구조 변경이며, 어떤 서버 액션
로직도 바꾸지 않아 다른 플랫폼 흐름에 영향이 없다). 게시용 본문
미리보기(post_title + post_body)는 위쪽에 그대로 남아 바로 보인다.

## 기존 데이터 처리

기존 DB의 naver_cafe post_body를 일괄 수정하지 않았다. 대신 화면 표시
(`getSocialPostDisplayBody`, 상세 페이지)와 export/copy/handoff
payload 생성 시점에 항상 `sanitizeNaverCafePlainText()`를 거치므로,
이미 escape된 markdown이 저장된 기존 글도 볼 때마다/내보낼 때마다
정리된 형태로 나온다. 새로 생성되는 글은 저장 시점에 이미 정리된 값이
DB에 들어간다.

## 영향 범위 확인

- **wordpress_blog**: 변경 없음(markdown→HTML 변환은 Phase 2-21의
  `convertMarkdownToWordPressHtml`을 그대로 사용, naver_cafe 정리
  로직과 무관).
- **naver_blog**: 변경 없음(markdown 원문 그대로 저장/export).
- **x/threads/instagram**: caption/threadItems 기반 흐름 변경 없음.
- **DB schema**: 변경 없음.

## 테스트

- `lib/social/naver-cafe-plain-text-sanitizer.test.ts`: 사용자가 보고한
  실제 예시 포함, heading/bold/entity/link/table/공백/개행 처리,
  idempotent 확인.
- `lib/social/social-draft-generation-service.test.ts`: AI가 escape된
  markdown을 생성해도 저장 전 정리됨, naver_blog는 영향받지 않음.
- `lib/social/social-post-display.test.ts`,
  `app/social-posts/[id]/page.test.ts`: 화면 표시가 정리된 본문을
  사용함, 관리 정보 accordion 분리 확인.
- `lib/social/social-export-builder.test.ts`,
  `lib/social/platform-publish-dry-run-builder.test.ts`: export/
  dry-run/handoff payload가 정리된 본문만 담고 내부 상태값/localhost가
  없음을 확인.
- `lib/social/social-quality-gate.test.ts`: markdown escape/localhost/
  내부 상태값 노출 시 fail/blocked 처리, 질문 2개 이상 요구.
- `lib/social/social-prompt-files.test.ts`: naver-cafe.md 프롬프트에
  새 규칙이 실제로 포함됐는지 확인.
- 전체 `npm run lint`(0 errors), `npm run test`(2485/2485 통과),
  `npx tsc --noEmit -p .`(기존 baseline 37건 유지, 신규 0건),
  `npm run build`(성공) 확인.

## 관련 문서

- `docs/phase-3-1-multi-platform-writing-foundation.md`
- `docs/phase-3-operation-manual.md`
- `docs/ui-ux-governance-rules.md`
- `docs/phase-2-21-article-wordpress-markdown-to-html.md`(wordpress_blog
  Markdown→HTML 변환, naver_cafe와는 별개 메커니즘)
