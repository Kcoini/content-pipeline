# Phase 4-16: 블로그 글쓰기 페이지 "목록 + 선택 상세" 구조

## 문제

`/articles/[id]/blog`에서 wordpress_blog 글이 여러 개 생성되면:

- 각 글 카드 안에 "WordPress 게시 준비" 패널(완료됨/남은 작업/primary
  action/고급 작업 등, Phase 4-13)이 그대로 반복돼 페이지가 매우
  길어졌다.
- 카드마다 6개 탭(글 내용/미리보기/품질·승인/WordPress 반영/대표
  이미지/체크리스트)이 전부 반복돼 "어떤 글을 게시할지" 비교·판단하기
  어려웠다.
- 기본 탭("글 내용")이 저장된 markdown 원문(`##`, `**`,
  `<div class="summary-box">`)을 그대로 보여줘서, 사용자가 실제
  게시될 모습을 확인하기 전에 raw 문법을 먼저 보게 됐다.
- 기본 화면에 platform raw select와 "placeholder 초안 생성" 같은
  개발자/테스트용 기능이 항상 노출되어 있었다.

## 해결

### 1) "목록 + 선택 상세" 구조

wordpress_blog 글마다 반복하던 상세 렌더링(WordPress 게시 준비
패널 + 탭 전체)을 삭제하지 않고, **선택된 글 1개에만** 보이게
했다. 선택은 새 query parameter를 만들지 않고 기존 `socialPostId`
(하이라이트/딥링크에도 쓰이는 값)를 재사용한다 — 각 action이 실행
후 `socialPostId=<postId>`로 돌아오는 기존 흐름과 자연스럽게
맞는다.

```ts
const selectedWordpressBlogPostId =
  targetSocialPostId && wordpressBlogPostsOnPage.some((post) => post.id === targetSocialPostId)
    ? targetSocialPostId
    : (wordpressBlogPostsOnPage[0]?.id ?? null);
```

선택된 값이 없거나 이 페이지의 wordpress_blog 글이 아니면 이
페이지의 첫 번째 wordpress_blog 글을 기본 선택한다. 페이지네이션과
연동되어, 선택된 글이 다른 페이지에 있으면 기존 "다른 page로
이동" 안내(Phase 3-18)가 그대로 동작한다.

각 글의 `<li>` 렌더링은 다음 조건으로 나뉜다(기존 코드/기능은
삭제하지 않고 그대로 뒀다 — 조건만 추가):

```tsx
{post.platform === "wordpress_blog" && post.id !== selectedWordpressBlogPostId ? (
  /* compact 카드 (신규) */
) : (
  /* 기존 상세 렌더링 그대로(헤더 + WordPress 게시 준비 패널 + 6개 탭 등) */
)}
```

### 2) compact 카드

선택되지 않은 wordpress_blog 글은 다음만 보여준다:

- 배지: "WordPress 블로그"(`PLATFORM_LABELS.wordpress_blog`), 문체
  (`TONE_STYLE_CONFIGS[post.toneStyle].label`) — raw `post.platform`/
  `post.toneStyle` 문자열을 그대로 쓰지 않는다.
- 제목
- 본문 길이 + 완료된 작업 요약(`getWordPressPublishPrepState`의
  `completedItems`, Phase 4-13과 동일한 함수를 재사용 — 상세
  화면의 계산과 카드 요약이 서로 다른 로직으로 어긋나지 않는다)
- 남은 작업 1줄(`remainingItems`)
- [이 글 선택](`socialPostId` 변경 링크), [미리보기](같은 링크 +
  `tab=preview`), [삭제](기존 archive action 그대로)

WordPress 게시 준비 패널·SEO metadata·대표 이미지·체크리스트 같은
상세 내용은 compact 카드 어디에도 없다 — 선택된 글의 상세 영역에서만
볼 수 있다.

### 3) 기본 탭을 "게시용 미리보기"(렌더링된 HTML)로 변경

`lib/social/wordpress-blog-card-tabs.ts`:

- 탭 순서를 `preview`(게시용 미리보기) → `content`(편집용 원문) →
  나머지 순으로 바꿨다.
- `DEFAULT_TAB`을 `"content"`에서 `"preview"`로 바꿨다.
- 라벨을 "WordPress 미리보기"/"글 내용"에서 "게시용 미리보기"/
  "편집용 원문"으로 바꿔 역할을 명확히 했다.

`app/articles/[id]/blog/page.tsx`의 preview 탭 본문 미리보기는 이제
`postPreview.bodyPreviewText`(raw markdown 슬라이스)가 아니라, 실제
Draft 생성 때 쓰는 것과 **동일한** `convertMarkdownToWordPressHtml()`
(`lib/wordpress/markdown-to-wordpress-html.ts`, 이미 sanitize를
포함하고 있어 `dangerouslySetInnerHTML`로 렌더링해도 안전하다)로
변환한 HTML을 보여준다 — 새 렌더러를 만들지 않고 이미 검증된 변환
로직을 재사용했다. `content` 탭("편집용 원문")은 기존처럼 raw
markdown을 그대로 보여준다(원문 확인/복사용).

### 4) 블로그 글 생성 영역 단순화

기본 화면: 문체 select(친화적 라벨, `TONE_STYLE_CONFIGS`) + [WordPress
블로그 글 생성] 버튼 1개(platform은 hidden input으로 `wordpress_blog`
고정). "고급 옵션" 접힘 안에 기존 platform raw select, "선택한
platform으로 블로그 글 생성", "placeholder 초안 생성", "rewrite
포함" 체크박스를 그대로 남겼다 — 기능 삭제 없음.

## 안전 원칙

- 자동 public publish는 추가하지 않았다.
- WordPress에는 여전히 Draft 생성/업데이트까지만 반영한다(변경 없음).
- `convertMarkdownToWordPressHtml()`은 기존에 검증된 sanitize 로직을
  그대로 재사용했다 — 새 HTML sanitizer를 만들지 않았다.
- 민감정보는 이번에도 노출하지 않는다.

## 테스트

- `lib/social/wordpress-blog-card-tabs.test.ts`: 탭 순서/라벨/기본값
  변경 반영(16개 통과).
- `app/articles/[id]/blog/page.test.ts`: 새 describe 3개(목록+선택
  상세 구조, 게시용 미리보기 기본 탭, 생성 영역 단순화) 추가, 기존
  4개 테스트를 새 탭 이름/구조에 맞게 갱신. 179개 테스트 통과.
- (3차 추가) `app/articles/[id]/blog/page.test.ts`: 선택된 글 상세
  영역의 platform/tone_style 배지, 성과 상태 라벨 변환을 검사하는
  describe 1개(2개 테스트) 추가. 181개 테스트 통과.
- 전체 `npx vitest run`: 237 files / 3050 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류. `npm run build`: 성공.

## 3차: 선택한 글 상세 영역의 raw status 한국어 라벨 변환 (추가 작업)

1차/2차 완료 이후, compact 카드에는 이미 적용돼 있던 friendly label
변환이 "선택된 글/다른 platform 상세 영역"(카드가 통째로 펼쳐지는
쪽, wordpress_blog가 아니거나 선택된 글일 때 렌더링되는 분기)에는
아직 반영돼 있지 않았다. 이번에 추가로:

- platform/tone_style 배지: `{post.platform}`/`{post.toneStyle}`
  raw 문자열을 그대로 보여주던 것을, compact 카드와 동일하게
  `PLATFORM_LABELS[post.platform]`/`TONE_STYLE_CONFIGS[post.toneStyle]?.label`
  로 바꿨다(alt/원본 값은 `title` 속성에만 남겨 hover 시 확인
  가능). `font-mono`도 raw 값 전용 스타일이라 제거했다.
- 성과 상태: `performance: {post.performanceStatus}` raw 문자열
  대신, 기존에 이미 있던 공용 변환 유틸
  `describeStatusValue()`(`lib/social/status-labels.ts`, Phase 3-24)
  를 재사용해 `성과: {describeStatusValue(post.performanceStatus)}`
  로 바꿨다 — 새 라벨 표를 만들지 않았다.

`상세 상태 보기`/`내부 상태값 보기` 같은 기존 접힘 영역의 raw
값(quality/approval/publish/export/manual_post 등)은 원래도 기본
화면에 노출되지 않고 있어(Phase 4-6/4-7/4-13) 그대로 두었다.

## 이번 작업에서 하지 않은 것 (범위)

3차 항목 중 성과 보기/기사 개요 링크 재배치는 이번 작업에서 하지
않았다 — 1차 구조 변경으로 이 링크들이 더 이상 wordpress_blog 글마다
반복되지 않고(선택된 글 1개 + 다른 platform 글에만 나타남) 중복
문제가 크게 줄었다고 판단했다. 필요하면 이후 별도 작업으로 진행한다.

## 관련 문서

- [`wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md)
- [`phase-4-13-wordpress-publish-prep-simplification.md`](./phase-4-13-wordpress-publish-prep-simplification.md) — compact 카드가 재사용하는 `getWordPressPublishPrepState`의 출처
- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)
