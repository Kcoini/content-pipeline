# Phase 3-17: Navigation Return Flow & Deep Links

## 목적

Phase 3-16에서 `/articles/[id]`를 `/blog`, `/social`, `/rewrite`,
`/performance`로 분리한 뒤, 각 페이지에서 작업(품질검사/승인/export/
rewrite 적용/metrics 입력 등)을 하고 나면 항상 기사 개요 페이지로
돌아가 버려서 방금 있던 화면을 다시 찾아가야 했다. 이번 단계는 **새
기능이 아니라 navigation UX 개선**이다 — 작업 후 원래 있던 페이지로
돌아오고(returnTo), 특정 글/제안/버전/비교 결과로 바로 이동할 수 있게
(deep link) 만든다.

## Phase 3-16과의 관계

Phase 3-16이 만든 5개 route(`/articles/[id]`, `/blog`, `/social`,
`/rewrite`, `/performance`)와 `ArticleWorkflowNavigation` 탭 구조는
그대로 유지한다. 이번 단계는 그 위에 "돌아가기"와 "바로가기" 계층만
얹었다 — route 구조, 데이터 조회 서비스(`article-*-page-service.ts`),
서버 액션 이름과 business logic은 전혀 바꾸지 않았다.

## returnTo가 필요한 이유

`/blog`에서 글 하나의 품질검사를 실행하면, 기존에는 항상
`/articles/[id]`(개요)로 리다이렉트됐다 — 개요 페이지는 더 이상
social_post 카드를 보여주지 않으므로(Phase 3-16) 사용자는 다시 `/blog`
탭을 눌러야 했다. `returnTo`는 "이 작업이 끝나면 어디로 돌아갈지"를
action에 전달하는 표준 방법이다.

## deep link가 필요한 이유

"이 글의 성과를 보고 싶다", "이 rewrite 버전의 재승인 상태를 보고
싶다" 같은 요청에 답하려면 페이지 이동만으로는 부족하고, 그 페이지
안에서 정확히 어떤 카드를 봐야 하는지까지 표시해야 한다. deep link
query parameter(`socialPostId` 등)와 강조 표시(highlight)가 그 역할을
한다.

## 표준 query parameter

공통: `returnTo`, `highlight`, `section`

| 페이지 | 전용 parameter |
|---|---|
| `/blog`, `/social` | `socialPostId` |
| `/rewrite` | `rewriteSuggestionId`, `rewriteVersionId`, `comparisonId`(version 비교) |
| `/performance` | `metricsTargetId`, `socialPostId`, `comparisonId`(rewrite 성과 비교) |

`comparisonId`는 이름은 같지만 `/rewrite`에서는
`SocialPostVersionComparison`(원본 vs rewrite 버전 콘텐츠 비교, Phase
3-12)을, `/performance`에서는 `RewritePerformanceComparison`(원본 vs
rewrite metrics 비교, Phase 3-14)을 가리킨다 — 서로 다른 테이블의
비교 결과이며 페이지 컨텍스트로 구분한다.

## 안전한 returnTo 규칙 (`lib/navigation/return-to.ts`)

- `getSafeReturnTo(value, fallback)`: value가 안전하면 그대로, 아니면
  fallback을 반환한다.
- `isSafeInternalReturnTo(value)`: `/articles/[id]`,
  `/articles/[id]/blog`, `/social`, `/rewrite`, `/performance`
  (query/hash 포함 가능)만 허용한다. `http://`, `https://`,
  `//`(protocol-relative), `javascript:`, `data:`, 그 외 알 수 없는
  내부 경로(`/dashboard` 등)는 모두 차단하고 false를 반환한다.
- `buildReturnTo(pathname, searchParams)`: 현재 페이지 상태를 가리키는
  returnTo 문자열을 만든다.
- `appendReturnTo(url, returnTo)`: returnTo가 안전할 때만 url에
  query로 붙인다.

이 네 함수 어디에도 실제 `redirect()` 호출이 없다 — 순수 문자열
계산만 하며, 최종 redirect는 항상 server action 쪽 책임이다.

## page별 deep link 규칙 (`lib/navigation/article-deep-links.ts`)

`buildArticleOverviewUrl`/`buildArticleBlogUrl`/`buildArticleSocialUrl`/
`buildArticleRewriteUrl`/`buildArticlePerformanceUrl`이 기본 URL을
만들고, `buildSocialPostDeepLink`/`buildRewriteSuggestionDeepLink`/
`buildRewriteVersionDeepLink`/`buildMetricsDeepLink`/
`buildComparisonDeepLink`가 특정 카드로 가는 deep link를 만든다.
`buildSocialPostDeepLink`는 `getPlatformGroup()`(Phase 3-16)으로
platform이 blog(`wordpress_blog`/`naver_blog`)인지 판단해 `/blog` 또는
`/social`로 보낸다. 모든 함수가 `URLSearchParams`로 query를 조립하고,
`returnTo`는 `isSafeInternalReturnTo`를 통과할 때만 포함한다.

## server action redirect 방식 (`app/articles/[id]/actions.ts`)

이번 단계에서 손댄 것은 각 action의 **마지막 redirect 대상**뿐이다 —
서비스 호출(business logic)은 한 줄도 바꾸지 않았다.

- `redirectToSafeTarget(formData, fallbackUrl, message, isError)`:
  `formData.get("returnTo")`를 읽어 `getSafeReturnTo`로 검증하고, 안전한
  값이 있으면 그 경로로, 없으면 fallbackUrl(deep link)로
  `error=`/`publishMessage=` query를 붙여 redirect한다.
- `revalidateArticleWorkflowPaths(articleId)`: 5개 하위 페이지를 모두
  `revalidatePath`해 어느 페이지에서 action이 실행되어도 최신 상태를
  보여준다.
- fallback 계산은 action마다 다르다:
  - 새 social_post를 만드는 action(placeholder/social draft 생성)은
    생성된 post의 platform에 맞는 deep link로.
  - 기존 social_post를 다루는 action(품질검사/승인/export/manual
    posting 등)은 `result.socialPost`의 platform으로 만든 deep link로.
  - `runPlatformPublishingGuardAction`/`createPlatformPublishDryRunAction`/
    `completePlatformExportHandoffAction`은 `/social` 페이지에서만
    쓰이므로 항상 `/social`로.
  - `recordSocialPostMetricsAction`은 metrics를 입력한 뒤 바로 결과를
    볼 수 있도록 `/performance`로(각 카드의 metrics 입력 폼도 hidden
    returnTo를 `/performance` deep link로 미리 설정해둔다).
  - 새 rewrite suggestion/version/comparison을 만드는 action
    (`generatePerformanceRewriteSuggestionAction`,
    `applyRewriteSuggestionAction`, `compareRewriteVersionAction`,
    `compareRewritePerformanceAction`)은 결과 id가 있으면 그 id로 만든
    deep link로, 없으면(생성 실패) 관련 있는 기존 카드로.
  - WordPress 발행 파이프라인 action들(`publishToWordPressDraftAction`
    등, 개요 페이지 전용)은 이번 단계에서 건드리지 않았다 — 여전히
    항상 `/articles/${articleId}`로 돌아간다.

returnTo가 formData에 있으면 위 fallback보다 항상 우선한다 — 즉
사용자가 어느 페이지에서 액션을 실행했는지가 최우선 기준이다.

## highlighted card 동작 (`lib/navigation/highlight-target.ts`,
`components/navigation/deep-link-highlight.tsx`)

- `getHighlightClassName(itemId, targetId)`: itemId===targetId일 때만
  `ring-2 ring-indigo-500 ring-offset-2`를 반환한다(새 스타일 라이브러리
  없이 기존 Tailwind 유틸리티만 사용).
- `buildAnchorId(prefix, itemId)`: 기존 `social-post-{id}` anchor 규칙과
  호환되는 id를 만든다. 이 id를 카드 엘리먼트에 그대로 부여하면
  `#social-post-abc`처럼 URL hash로도 해당 카드로 스크롤 이동할 수
  있다(브라우저 기본 동작, 별도 스크롤 스크립트를 추가하지 않았다).
- `resolveHighlightWarning(targetId, existingIds)`: targetId가 있는데
  현재 페이지에 로드된 목록에 없으면 true — `DeepLinkNotice`가 "선택한
  항목을 찾을 수 없습니다. 필터 또는 페이지를 확인하세요."를 보여준다.
  있으면 "선택한 항목을 강조 표시했습니다."를 보여준다.

## cross-page link 구조

- blog/social 카드: "성과 보기 →"(`buildMetricsDeepLink`), rewrite
  version이면 "Rewrite 관리에서 보기 →"(`buildRewriteVersionDeepLink`),
  "기사 개요 →"(`buildArticleOverviewUrl`).
- rewrite suggestion 카드: 대상 원본 글로 "원본 글 열기 →"/"원본 성과
  보기 →".
- rewrite version 카드: parent가 있으면 "원본 글 열기 →", "성과 보기
  →", "기사 개요 →", 그리고 원래 있던 "추천 버전 성과 열기" 링크.
- performance 페이지: rewrite 성과 비교 실행 폼 옆에 최고 성과
  rewrite version으로 가는 "Rewrite 관리에서 보기 →" 링크를 추가했다.
- Phase 3-15에서 만든 공용 대시보드 테이블(`LowPerformancePostsTable`,
  `MetricsMissingPostsTable`, `RecentMetricsTable`,
  `RecentRewriteComparisonsTable`, `RewritePerformanceSummary`)이
  쓰던 `socialPostHref()`(`components/social-performance-dashboard/
  badges.tsx`)도 이번 단계에서 새 deep link helper를 쓰도록 갱신했다
  — 기존에는 더 이상 카드 목록을 보여주지 않는 개요 페이지
  anchor(`/articles/[id]?socialPostId=...#social-post-...`)를 가리키고
  있었다(Phase 3-16 이후로 사실상 깨져 있던 링크). 지금은
  platform/isRewriteVersion에 맞는 `/blog`, `/social`, `/rewrite`로
  간다. `/dashboard/blog`, `/dashboard/rewrite`도 같은 함수를 쓰므로
  함께 고쳐졌다.

## navigation 컴포넌트 보강

`components/articles/article-workflow-navigation.tsx`의
`ArticleWorkflowNavigation`은 이제 `returnTo?: string | null` prop을
받는다. 5개 탭 링크 자체에는 returnTo를 붙이지 않는다(스펙 요구사항 —
"각 하위 페이지 링크에 returnTo를 무조건 넣지는 않음"). 대신:

- `active !== "overview"`이면 "← 기사 개요로 돌아가기" 버튼을 표시한다.
- `returnTo`가 `getSafeReturnTo`를 통과하면 "↩ 이전 작업 위치로
  돌아가기" 버튼을 표시한다(안전하지 않으면 버튼 자체가 없다).

`getArticleWorkflowTabs()`는 Phase 3-16과 동일하게 유지했다(기존
테스트 그대로 통과).

## 안내 문구

각 하위 페이지 상단 배너에 "작업 후 이 페이지로 돌아오도록 returnTo가
적용됩니다." 또는 "특정 글이나 비교 결과로 이동하면 해당 카드가 강조
표시됩니다." 한 줄만 추가했다 — 개발자용 문구를 나열하지 않았다.

## 로깅/보안 원칙

- `lib/navigation/*`의 어떤 함수도 `logEvent`를 호출하지 않는다.
- action에서 returnTo/deep link 관련 정보를 `pipeline_logs`/
  `logEvent` details에 남기지 않는다 — 기존 로깅(articleId/socialPostId/
  platform/상태값만 기록)을 그대로 유지했다.
- returnTo는 검증(`getSafeReturnTo`)을 통과한 값만 redirect 인자로
  쓴다 — 외부 URL로는 어떤 경로로도 redirect되지 않는다.

## 아직 하지 않는 것

- `/social-posts/[id]` 전용 상세 라우트 (deep link는 여전히 `/blog`,
  `/social`, `/rewrite`, `/performance` + query parameter 조합이다)
- 페이지네이션
- 차트
- 외부 API 자동화(자동 게시/자동 metrics 수집/자동 rewrite 실행)
- DB 구조 변경, `social_posts` 등 기존 테이블/타입 변경
- 신규 server action 추가(기존 action의 redirect 대상만 조정했다)

## 다음 단계 제안

- deep link로 이동했을 때 해당 카드로 자동 스크롤하는 것을 anchor(#)
  대신 `scrollIntoView` 기반으로 부드럽게 만들기(현재는 브라우저 기본
  hash 이동에 의존)
- `/social-posts/[id]` 전용 라우트가 생기면 `buildSocialPostDeepLink`
  등 deep link helper의 반환값만 그 라우트로 바꾸면 되도록(호출부는
  이미 helper를 통해서만 URL을 만들므로) 이번 설계를 그대로 재사용
- rewrite suggestion/version/comparison 3단계를 한 화면에서 잇는 진짜
  "타임라인" UI(현재는 페이지 하나에 목록 3개가 나열되어 있다)

## 확인 방법

1. `/articles/[id]/blog?socialPostId=[id]` 접속 → 해당 블로그 글
   카드가 강조(ring)되고 "선택한 항목을 강조 표시했습니다." 안내가
   보이는지 확인
2. `/articles/[id]/social?socialPostId=[id]` 접속 → 해당 SNS/커뮤니티
   글 카드가 강조되는지 확인
3. `/articles/[id]/rewrite?rewriteSuggestionId=[id]` 접속 → 해당
   suggestion 카드가 강조되는지 확인
4. `/articles/[id]/rewrite?rewriteVersionId=[id]` 접속 → 해당 rewrite
   version 카드가 강조되는지 확인
5. `/articles/[id]/performance?metricsTargetId=[id]` 접속 → 관련
   metrics/low performance/metrics missing 행이 강조되는지 확인
6. `/blog`에서 품질검사 버튼 실행 → 그 글이 강조된 채 다시 `/blog`로
   돌아오는지 확인
7. `/blog`에서 metrics 입력 실행 → `/performance`(해당 post 강조)로
   이동하는지 확인
8. `/rewrite`에서 개선안 적용 실행 → 새로 만들어진 rewrite version이
   강조된 채 `/rewrite`에 남는지 확인
9. 존재하지 않는 id로 `?socialPostId=없는id` 접속 → "선택한 항목을
   찾을 수 없습니다. 필터 또는 페이지를 확인하세요." 경고가 보이는지
   확인
10. `returnTo=https://example.com`을 붙여 접속하거나 action을 실행해도
    개요/해당 페이지로만 이동하고 example.com으로는 이동하지 않는지
    확인
