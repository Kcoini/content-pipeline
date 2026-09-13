# Phase 4-18: 블로그/기사형 글 카드에도 공통 본문 표시·inline 수정·복사 적용

## 문제

Phase 4-14/4-15에서 SNS/커뮤니티 글 목록 카드(`/articles/[id]/social`)에
게시용 본문 전체 표시(짧으면 전체, 길면 접기/펼치기), inline 본문
수정(저장/저장 후 자동 검토/저장 후 승인), 본문 복사 기능을 이미
만들었다. 하지만 블로그 글/기사형 글 카드(`/articles/[id]/blog`)에는
이 기능이 없어서:

- 선택된 wordpress_blog 글이나 naver_blog/news_article/opinion_column
  글 카드에서 본문을 `(post.excerpt || post.postBody).slice(0, 140)`로
  140자만 잘라 보여줬다.
- 본문 전체를 확인하려면 상세 페이지(`/social-posts/[id]`)로
  이동해야 했다.
- 이 카드에는 본문 복사 버튼도, 카드 안 inline 수정도 없었다.

## 해결

새 컴포넌트/서비스를 만들지 않고, Phase 4-14/4-15에서 이미 만든
공통 조각을 blog 페이지의 카드 렌더링에 그대로 재사용했다:

- `getSocialPostDisplayBody(post)`(`lib/social/social-post-display.ts`)
  — 플랫폼별 실제 게시용 본문 필드 우선순위(naver_cafe/wordpress_blog/
  naver_blog는 postBody 우선, instagram은 caption 우선 등)를 이미
  정확히 반영하고 있어 새로 만들 필요가 없었다.
- `getSocialPostEditableField(post.platform)`
  (`lib/social/social-post-inline-edit-service.ts`) — 저장 대상 필드
  (postBody/caption/null)를 이미 `PLATFORM_WRITING_CONFIGS` 기준으로
  판단하고 있어, wordpress_blog/naver_blog/naver_cafe/news_article/
  opinion_column 모두 별도 매핑 없이 바로 지원됐다.
- `<SocialPostBodyPanel>`(`components/social/social-post-body-panel.tsx`)
  — 읽기 모드(`ExpandableText`로 1,200자 기준 접기/펼치기 +
  `CopyPostBodyButton`) ↔ 편집 모드(textarea + 저장 후 승인/저장 후
  자동 검토/저장만 하기/취소)를 이미 구현하고 있었다.
- `saveSocialPostInlineEditAction`(`app/articles/[id]/actions.ts`)과
  `saveSocialPostBodyAndProcess()`(`lib/social/social-post-inline-edit-service.ts`)
  — 저장 → (선택 시) 자동 검토 → (선택 시, 검토 통과 시에만) 승인
  순서를 이미 보장하고 있었다.

`app/articles/[id]/blog/page.tsx`의 "선택된 글/다른 platform" 상세
렌더링 분기(wordpress_blog가 선택됐거나 naver_blog/news_article/
opinion_column일 때 렌더링되는 쪽)에서, 기존 raw slice 문단을
`<SocialPostBodyPanel>` 호출로 교체했다:

```tsx
{(() => {
  const displayBody = getSocialPostDisplayBody(post);
  if (!displayBody) {
    return <p>게시용 본문이 아직 없습니다 — ...</p>;
  }
  return (
    <SocialPostBodyPanel
      articleId={article.id}
      socialPostId={post.id}
      returnTo={selfReturnTo}
      displayBody={displayBody}
      editable={getSocialPostEditableField(post.platform) !== null}
      saveAction={saveSocialPostInlineEditAction}
    />
  );
})()}
```

이 분기는 이미 wordpress_blog(선택된 글)/naver_blog/news_article/
opinion_column을 모두 커버하므로, 별도 조건 분기 없이 4개 platform이
전부 이번 변경의 혜택을 받는다. compact 카드(선택되지 않은
wordpress_blog 글)는 Phase 4-16에서 정한 대로 요약만 보여주는
용도이므로 이번 변경 대상이 아니다(전체 본문 확인·수정·복사는
"이 글 선택" 이후 상세 영역에서 한다는 기존 원칙과 일치한다).

## 안전 원칙

- 자동 public publish는 추가하지 않았다.
- 승인은 여전히 저장 → 자동 검토 → (통과 시) 승인 순서로만
  진행된다(`saveSocialPostBodyAndProcess`, 기존 로직 그대로 재사용).
- full body/caption/prompt/AI 응답은 로그에 남기지 않는다(기존
  `logInlineEditEvent`가 이미 메타데이터만 기록).
- 민감정보는 이번에도 노출하지 않는다.

## 이번 작업에서 하지 않은 것 (범위)

- Rewrite 카드(`/articles/[id]/rewrite`)는 원본/재작성 버전의
  제목만 보여줄 뿐 본문 미리보기 자체가 없다 — 이번 범위에
  포함하지 않았다(스펙 17번 문단의 3차 항목).
- 상태별 primary 버튼 정리(품질검사/승인/export를 한 버튼으로
  묶는 것)는 blog 카드에서는 Phase 4-13의 "WordPress 게시 준비"
  요약 카드가 이미 담당하고 있어 이번에 추가로 손대지 않았다.
- 새 로그 이벤트(`post_card_*`)는 추가하지 않았다 — 기존
  `social_post_inline_edit_*`/`social_post_body_*` 이벤트가 카드
  유형과 무관하게 이미 이 흐름 전체를 기록하고 있어 그대로
  재사용했다(중복 이벤트 종류를 늘리지 않았다).

## 테스트

- `app/articles/[id]/blog/page.test.ts`: 새 describe 1개(3개 테스트)
  추가 — `SocialPostBodyPanel` 사용 여부, raw slice 제거 여부, 빈
  본문 안내 문구 존재 여부를 정적 소스 검사로 확인. 183 → 186개
  테스트 통과.
- 전체 `npx vitest run`: 244 files / 3125 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류. `npm run build`: 성공.

## 관련 문서

- [`phase-4-14-social-post-list-inline-body.md`](./phase-4-14-social-post-list-inline-body.md) — `ExpandableText`/`getSocialPostDisplayBody`의 원출처
- [`phase-4-15-social-post-inline-edit-copy.md`](./phase-4-15-social-post-inline-edit-copy.md) — `SocialPostBodyPanel`/`CopyPostBodyButton`/저장 후 검토·승인 흐름의 원출처
- [`phase-4-16-wordpress-blog-list-detail-split.md`](./phase-4-16-wordpress-blog-list-detail-split.md) — 이번에 손댄 "선택된 글/다른 platform" 렌더링 분기의 구조
- [`wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md)
- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)
