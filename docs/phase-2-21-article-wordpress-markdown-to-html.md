# Phase 2-21: 원본 article WordPress 전송 시 Markdown → HTML 변환

## 문제

`source_based_explainer` article을 WordPress에 전송하면, 공개 화면에서
Markdown 문법(`# 제목`, `## 소제목`, `| 표 | 표 |`, `- 목록` 등)이 변환되지
않고 그대로 노출되는 문제가 있었다.

## 원인

`article.content`는 `lib/ai/article-writer.ts`에서 항상 Markdown 형식으로
생성된다(`## 리드문`, `## 핵심 내용`, 표 등). 이는 `source_based_explainer`
뿐 아니라 `monetized_blog`/`general_news` 등 모든 article mode에 공통이다.

반면 `lib/publish/publish-service.ts`의 `publishArticleToWordPressDraft()`는
`wordpress_blog` 카드 전송 경로(`options.contentOverride`)에서만 이미
`convertMarkdownToWordPressHtml()`(`lib/wordpress/markdown-to-wordpress-html.ts`)로
변환된 content를 받았고, 원본 article 전송 경로(`contentOverride` 없이
`article.content`를 그대로 사용하는 경우)는 변환 없이 Markdown 원문을 그대로
WordPress REST API `content`에 실어 보내고 있었다. 이것이 공개 화면에서
Markdown 문법이 그대로 보이는 근본 원인이다.

## 목표와 원칙

- **source_based_explainer 전용이 아니라, 원본 article WordPress 전송
  경로 전체(article mode 무관)에 적용한다** — `article.content`는 어떤
  mode든 Markdown이므로, mode를 구분하지 않고 "이 문자열이 HTML인가
  아닌가"만으로 변환 여부를 판단한다.
- `wordpress_blog`의 기존 Markdown → HTML 변환 유틸
  (`convertMarkdownToWordPressHtml`, `lib/wordpress/markdown-to-wordpress-html.ts`)을
  그대로 재사용한다 — 변환 로직을 중복 구현하지 않는다.
- **naver_blog는 전혀 건드리지 않는다.**
- **DB schema 변경 없음.**
- **실제 public publish 로직(`publishWordPressPost`) 변경 없음** — 이번
  수정은 WordPress Draft 생성/업데이트(`createDraftPost`/새로 추가한
  `updateDraftPostContent`)에만 적용된다.
- 저장/검토용 본문(`article.content`, DB, 화면 표시)은 계속 Markdown
  그대로 둔다 — **WordPress로 전송하는 content만** HTML로 변환한다.
- 변환된 HTML은 반드시 sanitize를 거친다 — script/iframe/on* 이벤트 속성은
  제거되고, 출처 링크/표/목록/h2·h3 구조는 그대로 유지된다.
- `wordpress_blog`의 `contentOverride` 경로는 건드리지 않는다 — 그 경로는
  `lib/social/wordpress-blog-content-override-builder.ts`에서 이미 변환 및
  표 스타일링까지 끝낸 HTML을 넘기므로, 여기서 다시 변환/재-sanitize하면
  표 스타일 wrapper(`<div style="...">`)가 sanitize에 의해 벗겨질 위험이
  있다.

## 조치

### 1) 변환/판별 유틸 추가 (`lib/wordpress/markdown-to-wordpress-html.ts`)

기존 `convertMarkdownToWordPressHtml()`은 그대로 두고, 두 함수를 새로
추가했다:

- `looksLikeHtmlContent(content)`: `<h1|h2|h3|h4|p|ul|ol|table|blockquote|pre>`
  같은 블록 태그 여는 형태가 있으면 HTML로 간주한다.
- `ensureWordPressHtmlContent(content)`: 이미 HTML로 보이면
  `sanitizeWordPressHtml()`만 적용해서 반환(이중 변환 방지)하고, 그렇지
  않으면(=Markdown) `convertMarkdownToWordPressHtml()`로 변환한다.

파일 상단 주석도 "wordpress_blog 전용"에서 "wordpress_blog + article 고급
기능 공통, naver_blog는 여전히 제외"로 갱신했다.

### 2) `publishArticleToWordPressDraft()` 수정 (`lib/publish/publish-service.ts`)

- 기존 `effectiveContent`(원본, `contentOverride?.content ?? article.content`)는
  **그대로 유지**한다 — 빈 본문 검사와 `resolveExcerptFromContent()`(엑서프트
  생성)는 여전히 Markdown 원문 기준으로 동작해야 하기 때문이다
  (`resolveExcerptFromContent`는 Markdown 문법 문자(`#*_>`|-`)를 제거하는
  방식이라 HTML을 넣으면 `<p`/`</p` 같은 태그 조각이 그대로 남는다).
- WordPress로 실제 전송하는 content만 별도 변수(`wordPressContent`)로
  분리했다:
  - `options.contentOverride`가 있으면(=wordpress_blog 카드 경로) 기존
    그대로 `effectiveContent`를 사용한다(변경 없음).
  - 없으면(=원본 article 전송 경로) `ensureWordPressHtmlContent(effectiveContent)`로
    변환한 값을 사용한다.
- `createDraftPost({ content: wordPressContent, ... })`로 전달한다.

### 3) 기존 Draft/Post의 content를 새로 갱신하는 기능 추가 (Phase 2-21 신규)

이번 수정 이전에 Markdown 원문이 그대로 전송된 기존 WordPress
draft/post가 있을 수 있다. 이를 새 post를 만들지 않고 같은 post의 content만
교체하도록 다음을 추가했다:

- `updateDraftPostContent(postId, { title?, content?, excerpt? })`
  (`lib/publish/wordpress-client.ts`): `updateDraftFeaturedMedia`와 동일한
  패턴으로 `POST /wp-json/wp/v2/posts/{postId}`를 호출하되, **status는
  입력값과 무관하게 항상 `"draft"`로 고정 전송**한다. 이미 공개(publish)
  상태였던 post라도 이 호출만으로는 공개 상태가 바뀌지 않는다.
- `updateArticleWordPressDraftContent(articleId)`
  (`lib/publish/publish-service.ts`): `getSuccessfulWordPressDraft()`로
  기존 post id를 찾고, `article.content`를 `ensureWordPressHtmlContent()`로
  변환해 `updateDraftPostContent()`로 갱신한다. 결과를 `publish_logs`에
  기록한다(기존 `wordpress_publish_completed`/`wordpress_publish_failed`
  이벤트 재사용, 새 로그 이벤트 타입 추가 없음).
- `updateArticleWordPressDraftContentAction`
  (`app/articles/[id]/actions.ts`)과, `/articles/[id]` 페이지의 "원본
  article WordPress 전송" 성공 배너 아래 "Draft 내용 업데이트
  (Markdown→HTML 재변환)" 보조 버튼(`app/articles/[id]/page.tsx`)에서
  이 서비스를 사용한다.
- 이 버튼은 새 WordPress post를 만들지 않는다. 실제 공개 여부 변경은
  이 기능의 책임이 아니며, 반드시 WordPress 관리자 화면에서 사용자가
  직접 확인해야 한다는 안내 문구를 버튼 아래에 표시한다.

### 4) WordPress 전송 안내 문구 추가

- "WordPress Draft 생성" 버튼과 "Draft 내용 업데이트" 버튼 모두 아래에
  "WordPress 전송 시 Markdown은 HTML로 변환됩니다." 안내 문구를 추가했다
  (전용 미리보기 토글 UI까지는 이번 단계에서 구현하지 않음 — 최소 요건인
  안내 문구로 충분하다고 판단했다).

## 변환 방식 요약

- `#`(본문 최상위 h1) → `<h2>` (post_title이 이미 별도로 전송되므로 중복
  방지를 위해 한 단계 낮춘다), `##` → `<h2>`, `###` → `<h3>`, `####` →
  `<h4>`.
- 문단 → `<p>`, 목록(`-`/`1.`) → `<ul>`/`<ol>` + `<li>`.
- Markdown 표(`| A | B |` / `|---|---|`) → `<table><thead>...<tbody>...`
  (기존 `convertMarkdownToWordPressHtml`의 표 스타일링까지 그대로 적용됨).
- 굵게/기울임 → `<strong>`/`<em>`, 링크 → `<a href="...">`.
- sanitize 허용 태그: h2,h3,h4,p,ul,ol,li,table,colgroup,col,thead,tbody,
  tr,th,td,strong,em,a,blockquote,code,pre,br,hr — script/iframe/on*
  이벤트 속성은 제거되고, 모든 링크에는 `rel="nofollow noopener noreferrer"`
  + `target="_blank"`가 강제된다(기존 `convertMarkdownToWordPressHtml`
  정책 그대로).

## 영향 범위 확인

- **wordpress_blog**: `contentOverride` 경로는 그대로 유지되어 영향 없음
  (`options.contentOverride`가 있으면 변환 로직을 타지 않는다).
- **naver_blog**: 이번 수정 대상 파일(`publish-service.ts`,
  `wordpress-client.ts`, `markdown-to-wordpress-html.ts`)을 전혀
  참조하지 않으므로 영향 없음.
- **article mode**: `source_based_explainer`/`monetized_blog`/`general_news`
  모두 같은 `publishArticleToWordPressDraft()` 경로를 공유하므로 자동으로
  동일하게 적용된다(mode별 분기 없음).

## 테스트

- `lib/wordpress/markdown-to-wordpress-html.test.ts`: `looksLikeHtmlContent`/
  `ensureWordPressHtmlContent` 신규 테스트(마크다운 판별, 이미 HTML인 경우
  이중 변환 방지, sanitize 적용, 빈 값 처리).
- `lib/publish/publish-service.test.ts`: `article.content`가 Markdown일 때
  h2/h3/표/목록/링크로 정확히 변환되는지, 이미 HTML이면 이중 변환하지
  않는지, `contentOverride`가 있으면 그대로 전달되는지(wordpress_blog
  영향 없음 확인), `updateArticleWordPressDraftContent`의 성공/실패/
  dry-run/기존 draft 없음 케이스.
- `lib/publish/wordpress-client.test.ts`: `updateDraftPostContent`가
  status="draft"를 항상 고정 전송하는지, 인증 정보가 노출되지 않는지 등.
- `app/articles/[id]/actions.test.ts`, `app/articles/[id]/page.test.ts`:
  새 action/버튼/안내 문구에 대한 정적 소스 검사.
- 전체 `npm run lint`(0 errors), `npm run test`(2397/2397 통과),
  `npx tsc --noEmit -p .`(기존 baseline 37건 유지, 신규 0건),
  `npm run build`(성공) 확인.

## 관련 문서

- `docs/article-generation-source-based-explainer.md`
- `docs/article-generation-monetized-blog.md`
- `docs/phase-3-operation-manual.md`
- `docs/phase-2-2-wordpress-draft-publish.md`
