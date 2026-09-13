# Phase 4-10: WordPress 게시 준비 자동화 (승인 → Draft 클릭 수 줄이기)

## 목표

WordPress 블로그 글 생성 후 WordPress **Draft**(공개 게시 아님) 업로드까지
사용자가 눌러야 하는 버튼 수를 줄인다. "업로드"는 이 문서 전체에서 항상
WordPress Draft 생성/업데이트를 의미하며, 실제 공개(public) 게시는 이번
작업에서도 어떤 단계에서도 추가하지 않았다.

## 기존 상태 (이번 작업 전)

`prepareWordPressBlogPostForPublishing()`
(`lib/social/wordpress-blog-publish-preparation-orchestrator.ts`)이 이미
아래 순서를 한 버튼("WordPress에 반영하기")으로 실행하고 있었다:

1. `quality_status === "ready"` 확인 (실행 아님, 확인만)
2. `approval_status === "approved"` 확인 (실행 아님, 확인만)
3. WordPress Draft 생성/업데이트 (`publishArticleToWordPressDraft`)
4. SEO metadata 업데이트 (`updateWordPressSeoMetadataFromBlogPost`)
5. 대표 이미지 연결 (media id 있으면)
6. Publish guard 실행

문제점 두 가지가 있었다:

- **Rank Math 등 SEO plugin의 실제 반영**(custom endpoint 포함,
  `lib/seo/seo-plugin-actual-write-service.ts`)이 이 오케스트레이터
  안에 없었다 — 별도 버튼으로 따로 눌러야 했다.
- 대표 이미지 연결이 실패하면(media id는 있는데 API 호출만 실패한
  경우) 전체 파이프라인이 그 자리에서 멈췄다 — 이미 Draft/SEO
  metadata는 반영된 상태인데도 "실패"로만 표시됐다.
- "승인"과 "게시 준비 실행"이 별도 버튼이라, 검토를 마친 뒤에도
  최소 두 번 클릭이 필요했다.

## 이번 작업으로 바뀐 것

### 1) SEO plugin 반영 단계 추가 (`seo_plugin`)

오케스트레이터에 `seo_plugin` 단계를 추가해
`writeSeoPluginMetadataToWordPress(articleId)`를 SEO metadata 업데이트
직후에 자동으로 실행한다. 이 함수는 내부적으로 provider가
`rank_math`이고 custom endpoint가 켜져 있으면 custom endpoint를
우선 사용하므로, 이 한 단계로 "Rank Math SEO 반영"과 "custom endpoint
SEO 반영" 요구사항을 모두 만족한다.

이 단계는 **실패해도 전체 파이프라인을 막지 않는다** — SEO plugin
미설정(provider=none)이 흔한 정상 상태이기 때문이다:

- 성공 → `status: "success"`
- 메시지에 "건너뜁니다"가 포함(provider=none, feature flag off, focus
  keyword 없음 등 정상적인 건너뜀) → `status: "skipped"`
- 그 외 실패(예: API 호출 자체가 실패) → `status: "warning"`
  (중단하지 않고 다음 단계로 진행)

### 2) 대표 이미지 연결 실패를 부분 성공(partial success)으로 처리

기존에는 `attachFeaturedMediaToDraft` 실패 시 그 자리에서
`return`해 전체를 실패로 만들었다. 이제는 실패해도 `status:
"warning"`으로 기록하고 계속 진행한다 — 본문/SEO는 이미 Draft에
반영된 상태를 그대로 유지하고, 대표 이미지만 "확인 필요"로 남긴다.

### 3) `partialSuccess` 필드 추가

`PrepareWordPressBlogPostForPublishingResult`에 `partialSuccess:
boolean` 필드를 추가했다. `success === true`이면서 `seo_plugin` 또는
`featured_image` 단계가 `warning`으로 끝났을 때만 `true`다.
`success === false`면 항상 `false`다 — 실패는 부분 성공이 아니다.

### 4) 통합 함수 `approveAndPrepareWordPressBlogPostForPublishing`

`approveSocialPost()`로 승인한 뒤 곧바로
`prepareWordPressBlogPostForPublishing()`을 실행하는 새 함수를
추가했다. 승인 자체가 실패하면(이미 처리됨 등) 게시 준비 단계는
시도하지 않는다.

- 서버 액션: `approveAndPrepareWordPressBlogPostForPublishingAction`
  (`app/articles/[id]/actions.ts`)
- UI 버튼: "승인하고 WordPress Draft 만들기"
  (`app/articles/[id]/blog/page.tsx`, 기존 "WordPress에 반영하기"
  버튼 바로 아래) — `post.approvalStatus !== "approved"`일 때만
  보이고, `quality_status !== "ready"`이거나 원본 article이 아직
  승인(`article.status === "reviewed"`)되지 않았으면 비활성화되며
  사유를 `title` 속성으로 안내한다.

버튼 설명에 "검토 완료(reviewed)만으로는 Draft가 만들어지지 않으며,
이 버튼을 눌러야 승인까지 함께 처리됩니다"라고 명시해 `reviewed`
(검토 완료)와 `approved`(Draft 생성 허용 조건)를 혼동하지 않게 했다.

## 클릭 수 변화

- 이전: 품질검사 → 승인 요청 → 승인 → WordPress에 반영하기 (SEO
  plugin은 별도 버튼) = 최소 4~5회
- 이후: 품질검사(자동 통과 시 생략 가능) → **승인하고 WordPress
  Draft 만들기** (승인 + Draft + SEO metadata + SEO plugin + 대표
  이미지 + publish guard를 한 번에) = 최소 2회

이미 승인된 글은 기존 "WordPress에 반영하기" 버튼만으로 재실행할 수
있다(통합 버튼은 `approvalStatus === "approved"`가 되면 화면에서
사라진다).

## 안전 원칙 (변경 없음)

- 실제 공개(public) 게시는 이 작업에서도 추가하지 않았다 — WordPress
  post status는 항상 draft로 남는다.
- `approval_status`가 `approved`가 아니면(`reviewed`만으로는 부족)
  Draft 생성이 차단된다 — 통합 버튼도 내부적으로 이 조건을 그대로
  거친다(승인 자체가 실패하면 게시 준비를 시도하지 않는다).
- quality gate가 `ready`가 아니면 여전히 차단된다(변경 없음).
- 이미 공개(`publish`) 상태인 WordPress 글을 자동으로 재작성하지
  않는다 — `publishArticleToWordPressDraft`가 기존 draft를 찾아
  업데이트할 때도 새로 만들지 않고 같은 `wordpress_post_id`를
  재사용하는 기존 로직을 그대로 사용했다(이번 작업에서 변경하지
  않음).
- 개발자용 raw 상태값(provider enum, HTTP status 등)은 여전히
  `<details>` 접힘 영역 안에만 노출한다(Phase 4-6/4-7 원칙 유지).

## 테스트

- `lib/social/wordpress-blog-publish-preparation-orchestrator.test.ts`:
  seo_plugin 단계의 success/skipped/warning 분류, seo_auto_generate
  단계가 필드 존재 여부에 따라 skip/success/warning으로 나뉘는지,
  대표 이미지 연결 실패가 더 이상 파이프라인을 막지 않고
  `partialSuccess: true`로 끝나는지,
  `approveAndPrepareWordPressBlogPostForPublishing`이 승인 성공/실패
  각각에서 올바르게 동작하는지 검사. 26개 테스트 통과.
- `app/articles/[id]/actions.test.ts`: 새 액션이 통합 함수를
  호출하고 raw 런타임 에러를 `describeUnexpectedError`로 감싸는지,
  기존 액션들과 동일하게 `redirectToSafeTarget`/`buildArticleBlogUrl`
  패턴을 따르는지 검사.
- `app/articles/[id]/blog/page.test.ts`: 통합 버튼이 primary 버튼
  뒤에 있는지, 승인 전에만 보이는지, 비활성화 조건이 소스에
  존재하는지, 부분 성공 복구 흐름 패널이 성공 실행에만 조건부로
  보이는지 정적 검사. 162개 테스트 통과.
- 전체 `npx vitest run`: 231 files / 2946 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만
  존재.
- `npm run lint`: 0 오류. `npm run build`: 성공.

## 3차: SEO 정보 자동 생성/보완 (`seo_auto_generate`)

1차/2차 완료 후 이어서 진행했다. 오케스트레이터에 `seo_auto_generate`
단계를 draft 생성 직후, 기존 `seo_metadata` 단계 이전에 추가했다.

- wordpress_blog 글 자신의 `seoTitle`/`metaDescription`/`targetKeyword`
  중 **하나라도 없으면**, 이미 존재하던 결정론적 생성기
  (`generateWordPressBlogMetadata` — "SEO Metadata 재생성" 버튼이
  쓰는 함수와 동일)를 자동으로 호출해 채운다. 이 함수는 새 AI
  API를 호출하지 않고 wordpress_blog 자신의 title/body/excerpt에서만
  값을 도출하므로, 사실/숫자/날짜/기관명을 지어내지 않는다
  (`geoSummary.keyFacts`/`caveats`는 항상 빈 배열로 시작).
- 세 필드가 **이미 모두 있으면**(사람이 직접 채운 값 포함) 아무것도
  건드리지 않고 `status: "skipped"`로 표시한다.
- 자동 생성 자체가 실패해도(예: post_title/post_body가 비어 있음)
  `status: "warning"`으로만 남기고 전체 파이프라인을 막지 않는다 —
  뒤의 `seo_metadata` 단계가 여전히 필드가 없으면 그 단계에서 다시
  분명하게 실패로 안내한다.

### 왜 "본문 자동 보완"은 만들지 않았는가

quality gate(`runSocialPostQualityGate`)가 확인하는 항목(소제목
구조, FAQ 개수, 표/체크리스트 존재, 상투적 도입부 등)은 대부분
**본문 자체를 다시 쓰는** 것을 요구한다. 이 오케스트레이터가
실행되려면 이미 `quality_status === "ready"`(quality gate 통과)가
전제조건이므로, 이 시점에는 자동으로 고쳐야 할 "본문 품질 문제"가
남아있지 않다 — 있다면 애초에 quality gate에서 막혔어야 한다.
본문을 새로 써서 자동으로 "보완"하는 기능은 사실을 지어낼 위험이
가장 큰 영역이라 이번 작업에서 의도적으로 만들지 않았다. 대신
SEO 메타데이터처럼 **원본 콘텐츠를 그대로 재사용해 안전하게
도출 가능한 값**만 자동 생성 대상으로 삼았다.

## 4차: 대표 이미지 등 부분 성공 항목의 복구 흐름 UI

`partialSuccess: true`(Draft는 만들어졌지만 SEO plugin 반영이나
대표 이미지 연결이 `warning`으로 끝난 경우)일 때, "WordPress 반영"
탭에 복구 안내 패널을 추가했다:

- 어떤 단계가 확인이 필요한지, 그 단계의 실제 메시지를 그대로
  보여준다.
- 그 문제를 해결할 수 있는 탭(대표 이미지 문제 → "대표 이미지" 탭,
  SEO 관련 문제 → "WordPress 반영" 탭)으로 바로 이동하는 링크를
  제공한다.
- 대표 이미지는 재업로드하지 않고 "이미지 없이 진행"(waiver)을
  선택해도 Draft를 그대로 유지할 수 있다는 점을 안내 문구로
  명시한다.
- 확인 후에는 기존 "WordPress에 반영하기" 버튼을 다시 눌러
  재시도하면 된다 — 별도의 새 재시도 버튼을 추가하지 않고 기존
  버튼을 재사용한다(중복 버튼 방지 원칙).

### 여러 draft 후보 중 선택 UI를 만들지 않은 이유

`getSuccessfulWordPressDraft(articleId)`(`lib/repositories/publish-repository.ts`)는
article 하나당 가장 최근 성공 기록 **하나만** 조회하도록 이미
설계되어 있다(`order by created_at desc limit 1`). 즉 이
아키텍처에서는 article 1개 ↔ 추적되는 draft 1개가 항상 성립하며,
"여러 draft 후보 중 선택"이 필요한 모호한 상황 자체가 발생하지
않는다. 새로 선택 UI를 만드는 대신 이 설계를 그대로 유지했다 —
여러 후보를 만들 수 있게 바꾸는 것은 오히려 중복 게시/혼동
위험을 늘린다.

## 이번 작업에서 하지 않은 것 (범위 축소, 최종)

- 본문(post_body) 자체를 자동으로 다시 쓰는 "자동 보완" 기능 —
  위 "왜 본문 자동 보완은 만들지 않았는가" 참고.
- Markdown→HTML 변환 규칙 자체의 재검토(기존
  `buildWordPressBlogContentOverride`가 이미 처리 중이며 이번
  작업에서 변경하지 않음).
- 여러 draft 후보 선택 UI — 위 이유로 불필요하다고 판단.

## 후속: 화면 단순화 (Phase 4-13)

이 문서가 다루는 오케스트레이터/통합 함수는 그대로 유지한 채,
"WordPress에 반영하기"/"승인하고 WordPress Draft 만들기" 두 버튼을
화면에서 하나의 "WordPress 게시 준비" 요약 카드로 합쳤다. 자세한
내용은 [`phase-4-13-wordpress-publish-prep-simplification.md`](./phase-4-13-wordpress-publish-prep-simplification.md) 참고.

## 관련 문서

- [`wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md)
- [`phase-3-operation-manual.md`](./phase-3-operation-manual.md)
- [`wordpress-safety-rules.md`](./wordpress-safety-rules.md)
- [`phase-4-13-wordpress-publish-prep-simplification.md`](./phase-4-13-wordpress-publish-prep-simplification.md)
- [`phase-2-23-wordpress-draft-approval-status-clarity.md`](./phase-2-23-wordpress-draft-approval-status-clarity.md) — `reviewed`/`approved` 구분의 원래 출처
