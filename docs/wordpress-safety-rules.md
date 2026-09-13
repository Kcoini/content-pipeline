# WordPress 게시 관련 안전 규칙

WordPress 블로그 글의 게시 준비/자동화 작업을 할 때 지켜야 하는
안전 원칙을 모은 문서다. 일반적인 Phase 3 안전 원칙(승인 게이트,
API 게시 비활성화, 로그 보안)은 [`phase-3-safety-checklist.md`](./phase-3-safety-checklist.md)를
따르며, 이 문서는 WordPress에 특화된 부분만 다룬다.

## 1. "업로드" = WordPress Draft, 공개 게시 아님

이 코드베이스에서 WordPress 관련 "업로드/반영/게시 준비" 기능은
모두 **WordPress Draft 생성/업데이트**를 의미한다. 실제 공개
(public) 게시는:

- 별도의 명시적 승인 흐름(`approvePublicPublish`,
  `publishApprovedArticleToWordPress`)을 통해서만 가능하다.
- 자동화 오케스트레이터(`prepareWordPressBlogPostForPublishing`,
  `approveAndPrepareWordPressBlogPostForPublishing`,
  Phase 4-10)는 이 API들을 호출하지 않는다 — 관련 테스트가
  `not.toMatch(/publishApprovedArticleToWordPress|approvePublicPublish/)`로
  이를 고정한다.

## 2. `reviewed` ≠ `approved`

- `article.status === "reviewed"`: 원본 기사가 검토를 마쳤다는
  뜻이다. WordPress Draft 반영의 전제조건 중 하나이지만, 이것만으로
  Draft가 만들어지지는 않는다.
- `social_post.approval_status === "approved"`: 이 wordpress_blog
  글 자체가 승인됐다는 뜻이다. `prepareWordPressBlogPostForPublishing`이
  Draft 생성 전에 반드시 확인하는 조건이다 — `pending_review`나
  `not_requested` 상태에서는 Draft를 만들지 않는다.

두 조건은 독립적이며, 둘 다 만족해야 Draft 생성이 진행된다. UI는
"검토 완료(reviewed)만으로는 Draft가 만들어지지 않는다"는 점을
버튼 설명 문구로 명시한다(Phase 4-10).

## 3. quality gate가 통과하지 못하면 차단

`quality_status !== "ready"`면 Draft 생성/업데이트를 시도하지
않는다. 이 조건은 자동 실행(오케스트레이터)에서도 동일하게
적용되며 우회할 수 없다.

## 3-1. 자동 보완은 "원본을 그대로 재사용해 안전하게 도출 가능한 값"만 대상으로 한다

`seo_auto_generate` 단계(Phase 4-10 3차)는 SEO 필드가 비어 있을 때
자동으로 채우지만, 새 AI 호출이나 새로운 사실 생성 없이
wordpress_blog 글 자신의 title/body/excerpt에서 결정론적으로만
값을 도출한다(`generateWordPressBlogMetadata`). 본문(post_body)
자체를 자동으로 다시 쓰는 기능은 만들지 않았다 — quality gate를
통과한 시점에는 이미 본문 품질 문제가 없어야 하고, 본문을 자동으로
고치는 것은 사실을 지어낼 위험이 가장 크기 때문이다. 앞으로 새
자동 보완 단계를 추가할 때도 이 기준(원본 재사용 vs. 새로 생성)을
먼저 확인한다.

## 4. 부가 단계 실패는 "부분 성공"으로 처리하되, 핵심 단계 실패는 전체를 막는다

Phase 4-10부터 아래와 같이 구분한다:

- **핵심 단계**(quality 확인, approval 확인, Draft 생성/업데이트,
  SEO metadata 업데이트, publish guard): 실패하면 그 단계에서
  전체 파이프라인이 멈춘다.
- **부가 단계**(SEO plugin 실제 반영, 대표 이미지 연결): 실패해도
  전체를 막지 않는다 — 이미 반영된 Draft/SEO metadata는 그대로
  유지하고, 실패한 항목만 "확인 필요(warning)"로 표시한다
  (`partialSuccess: true`).

이 구분을 바꿀 때는(예: 새 부가 단계 추가) 반드시 "실패해도 안전한
단계인가"를 먼저 판단하고, 위험하면 핵심 단계로 분류해 차단하도록
한다.

## 5. 기존 공개(published) WordPress 글은 자동으로 재작성하지 않는다

`publishArticleToWordPressDraft`는 기존 draft를 찾아 같은
`wordpress_post_id`를 재사용해 업데이트하지만, WordPress 쪽에서
이미 공개(`publish`) 상태로 전환된 글을 자동으로 덮어쓰는 로직은
추가하지 않는다. 공개 여부 확인/전환은 WordPress 관리자 화면에서
사람이 직접 한다.

## 6. 개발자용 raw 상태값은 기본 화면에 노출하지 않는다

provider enum, HTTP status, 원문 에러 메시지 등은 `<details>` 접힘
영역 안에만 두고, 기본 화면에는 사용자 친화적 한국어 요약만
보여준다(Phase 4-6/4-7 원칙, [`wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md) 참고).

## 7. raw 런타임 에러 메시지를 그대로 사용자에게 보여주지 않는다

"Cannot read properties of undefined..." 같은 JS 런타임 에러가
그대로 노출되지 않도록 `describeUnexpectedError()`
(`lib/errors/describe-unexpected-error.ts`)로 감싼다(Phase 4-9).
새로운 WordPress 관련 action을 추가할 때도 이 패턴을 따른다.

## 관련 문서

- [`phase-3-safety-checklist.md`](./phase-3-safety-checklist.md)
- [`phase-4-10-wordpress-auto-publishing-preparation.md`](./phase-4-10-wordpress-auto-publishing-preparation.md)
- [`wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md)
- [`phase-2-23-wordpress-draft-approval-status-clarity.md`](./phase-2-23-wordpress-draft-approval-status-clarity.md)
