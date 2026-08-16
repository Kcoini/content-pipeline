# Phase 3-18: Social Post Detail Route & Pagination

## 목적

Phase 3-16에서 article 하위 페이지(blog/social/rewrite/performance)를
분리하고, Phase 3-17에서 returnTo/deep link를 도입했다. 이번 단계는
그 위에 두 가지를 더한다 — social_post 하나를 자세히 볼 수 있는
`/social-posts/[id]` **읽기 전용** 상세 페이지, 그리고 목록이 길어질 때
화면을 가볍게 유지하는 **query parameter 기반 pagination**이다. 둘 다
새 기능이라기보다 기존 정보를 더 잘 찾아보게 하는 UX 정리에 가깝다.

## Phase 3-16/3-17과의 관계

- route 구조(overview/blog/social/rewrite/performance)와 navigation은
  그대로 유지한다. `/social-posts/[id]`는 이 5개 페이지를 대체하지
  않고, "카드 하나를 자세히 보고 싶을 때"만 들르는 보조 페이지다.
- returnTo 안전성 검증(`lib/navigation/return-to.ts`)과 deep link
  helper(`lib/navigation/article-deep-links.ts`)를 그대로 재사용한다
  — 이번 단계는 `buildSocialPostDetailUrl()` 하나만 추가했다.
- action 실행은 여전히 `app/articles/[id]/actions.ts`만 담당한다.
  `/social-posts/[id]`에는 어떤 `<form action={...}>`도 없다 — 작업이
  필요하면 하위 페이지로 이동해서 실행해야 한다(spec: "read 중심 상세
  페이지").

## `/social-posts/[id]` 상세 페이지의 역할

social_post 한 건의 모든 상태(품질/승인/게시/export/guard/dry-run/
handoff/manual posting/성과/rewrite 관련 상태 전부)를 한 화면에서
읽기 전용으로 확인한다. 버전 체인(`social_post_versions`), 최근
metrics 10개, 이 글에서 만들어진 rewrite suggestion 목록, 최근 version
비교/성과 비교 요약도 함께 보여준다. 데이터는
`lib/social/social-post-detail-service.ts`의 `getSocialPostDetail()`
하나가 조회하며, 이 파일의 어떤 함수도 데이터를 변경하지 않는다.

## article 하위 페이지와 상세 페이지의 차이

| | article 하위 페이지(blog/social/rewrite/performance) | `/social-posts/[id]` |
|---|---|---|
| 목적 | 여러 글을 훑어보고 작업(승인/export/재승인 등)을 실행 | 글 하나를 자세히 확인(읽기 전용) |
| action 폼 | 있음 (기존 actions.ts 재사용) | 없음 |
| 목록 | pagination 적용 | 해당 없음(단건) |
| 이동 | 서로 하이라이트/returnTo로 오가는 deep link | "상세 보기" 버튼으로 도착, "이전 위치로 돌아가기"로 복귀 |

## returnTo 처리 방식

- `/social-posts/[id]`는 `searchParams.returnTo`를 읽고
  `getSafeReturnTo(returnTo, buildArticleOverviewUrl(articleId))`를
  적용한다 — 안전하지 않으면 기사 개요로 돌아간다.
- 상단 "← 기사 개요로"/"← 이전 위치로" 링크는 이 값을 그대로 쓴다.
- `SocialPostDetailNavigation`의 "↩ 이전 위치로 돌아가기" 버튼은
  원본 `returnTo`(검증 전)를 넘겨받아 컴포넌트 내부에서 다시
  `getSafeReturnTo(returnTo, "")`를 적용한다 — 안전한 값이 있을 때만
  버튼이 보인다("returnTo가 안전하면 표시").
- 하위 페이지의 "상세 보기" 버튼은 항상
  `buildSocialPostDetailUrl(socialPostId, selfReturnTo)` 형태로 현재
  카드를 강조한 채 돌아올 수 있는 returnTo를 함께 실어 보낸다. 예:
  `/social-posts/abc?returnTo=%2Farticles%2F123%2Fblog%3FsocialPostId%3Dabc%26highlight%3Dabc`

## pagination query parameter

공통: `page`, `perPage`

- `page` 기본값 1, 1보다 작거나 정수가 아니면 1로 보정
- `perPage` 허용값 10/20/50, 그 외 값이면 10으로 보정
- 기존 query(returnTo, socialPostId, includeRewriteVersions 등)는
  page 이동 시 그대로 유지된다 — `buildPageUrl()`이 URLSearchParams로
  기존 값을 복사한 뒤 `page`만 덮어쓴다.

`lib/navigation/pagination.ts`가 모든 계산(파싱/offset/totalPages/
clamp/배열 자르기/URL 생성/target이 속한 page 계산)을 담당하는 순수
함수 모음이다. `components/navigation/pagination-controls.tsx`는 이
helper로 만든 링크를 렌더링만 하는 서버 컴포넌트다(client component
없음).

## perPage 기준

허용값은 10/20/50 세 가지뿐이다. UI에서는 `<select>` + `<form
method="get">`(기존 "rewrite 포함" 체크박스와 같은 패턴)로 선택하며,
perPage를 바꾸면 항상 `page=1`로 리셋한다(엉뚱한 위치에 남지 않도록).

## page별 적용 범위

| 페이지 | pagination 대상 | 기본 perPage |
|---|---|---|
| `/blog` | 필터링된 blog social_post 목록(`posts`) | 10 |
| `/social` | 필터링된 social/community social_post 목록(`posts`) | 10 |
| `/rewrite` | `rewriteVersions`만(스펙 안내에 따라 suggestions/originalPosts는 우선 제외) | 10 |
| `/performance` | `dashboard.recentMetrics`만(`recentMetricsPage`) | 10 |

`/performance`의 `lowPerformancePosts`/`metricsMissingPosts`는 이번
단계에서 별도 pagination을 적용하지 않고 기존처럼(Phase 3-15 그대로)
전체 표시한다 — dashboard 계산 로직(Phase 3-15)은 건드리지 않았고,
필요하면 다음 단계에서 별도 pagination을 추가할 수 있게 서비스가
`dashboard` 객체를 그대로 노출한다.

## deep link와 pagination 충돌 처리 방식

`socialPostId`/`rewriteVersionId` 같은 deep link target이 현재
page(예: page=1)에 없을 수 있다(전체 목록에서는 뒤쪽 page에 있는
경우). 각 service(`article-blog-page-service.ts` 등)가
`findItemPage()`로 **필터링은 됐지만 자르기 전** 전체 목록에서 target의
위치를 계산해 `targetPage`(또는 `versionPagination`/`metricsTargetPage`)
로 반환한다. page.tsx는:

1. target이 현재 page에 있으면 `DeepLinkNotice`로 강조 확인 메시지를
   보여준다.
2. target이 있지만 현재 page에 없고 다른 page에서 찾았으면(
   `targetPage !== pagination.page`) "선택한 항목이 현재 page에
   없습니다. 해당 항목이 있는 N page로 이동 →" 링크를 보여준다.
3. target이 어디에도 없으면(필터 밖이거나 삭제됨) `DeepLinkNotice`가
   "선택한 항목을 찾을 수 없습니다" 경고만 보여준다(Phase 3-17과 동일).

## 상세 페이지에서 보여주는 정보

id/article_id/article title/platform/content_group/content_type/
tone_style/is_rewrite_version/version_number/parent_social_post_id/
root_social_post_id/post_title/excerpt/post_body preview/caption
preview/hashtags/thread_items preview/card_items preview/
quality_status·score/approval_status/publish_status/export_status/
platform_publish_guard_status/platform_publish_dry_run_status/
handoff_status/manual_post_status/post_url/performance_status/
latest_performance_score/latest_metrics_recorded_at/최근 metrics
10개/rewrite_suggestion_status/version_comparison_status/
recommended_for_repost/rewrite_reapproval_status/
rewrite_reexport_status/rewrite_republish_workflow_status/
rewrite_performance_comparison_status/버전 체인/이 글에서 생성된
rewrite suggestion 목록/created_at·updated_at.

(`manual_repost_candidate`라는 필드는 현재 `SocialPost` 타입에 존재하지
않아 표시하지 않는다 — 스펙의 "있으면 표시" 조건에 해당하지 않는다.)

## 기본으로 숨기는 정보

`export_payload`/`platform_publish_dry_run_payload`/`handoff_payload`
원문은 기본적으로 렌더링하지 않는다 — `<details>`로 접힌 "요약"
섹션에서 각 payload의 **키 개수**만 보여준다. `post_body`/`caption`도
300자 넘으면 미리보기만 보여주고, "전체 본문 펼치기"를 눌러야 전체가
보인다(펼치기 전에는 DOM에 없다가 details가 열릴 때만 렌더링되는 게
아니라 React 트리에는 있지만 `<details>` 닫힘 상태로 화면에 숨겨진다
— 브라우저 기본 동작).

## 로깅

`social_post_detail_view_loaded` 이벤트를 `pipeline_logs`에 1건
기록한다. `details_json`에는 socialPostId/articleId/platform/
toneStyle/isRewriteVersion/contentGroup/hasReturnTo만 저장한다 —
full post_body/caption/export_payload/API key/auth token/
Authorization header/Application Password/image binary는 절대
저장하지 않는다(`app/social-posts/[id]/page.test.ts`의 정적 검사로도
확인한다).

## 아직 하지 않는 것

- modal detail (항상 전용 라우트 페이지로 이동한다)
- infinite scroll (항상 page/perPage query parameter 기반)
- 차트
- 외부 API 연결
- 자동 metrics 수집, 자동 rewrite 실행, 자동 게시
- `lowPerformancePosts`/`metricsMissingPosts`에 대한 별도 pagination
- DB 구조 변경(모든 조회는 기존 repository 함수만 사용)

## 다음 단계 제안

- `lowPerformancePosts`/`metricsMissingPosts`에도 pagination 적용
- rewrite 페이지의 suggestions 목록에도 필요해지면 별도
  `suggestionPage` pagination 적용(현재는 versions만 적용)
- `/social-posts/[id]`에 최근 rewrite suggestion/version 비교 diff를
  나란히 보여주는 뷰 추가
- `PaginationControls`의 perPage 선택 폼을 client component로 바꿔
  선택 즉시 반영(현재는 "적용" 버튼 클릭 필요)

## 확인 방법

1. `/articles/[id]/blog` 접속 → 목록 하단에 pagination(현재 page/전체
   page/총 개수/이전·다음)이 보이는지 확인
2. 카드의 "상세 보기 →" 클릭 → `/social-posts/[socialPostId]`로
   이동하는지 확인
3. 상세 페이지에서 "← 이전 위치로" 또는 "↩ 이전 위치로 돌아가기" 클릭
   → 원래 `/articles/[id]/blog?...`로 돌아오는지 확인
4. `/articles/[id]/social`에서도 2-3과 동일하게 확인
5. `/articles/[id]/rewrite`에서 rewrite version 카드의 "상세 보기 →"
   확인, 상세 페이지에서 "parent version 보기"/"root version 보기"
   링크(있는 경우) 확인
6. `/articles/[id]/performance`에서 Recent Metrics 표의 "상세" 링크로
   social post 상세 이동 확인
7. `?page=2&perPage=20` 같은 query를 직접 붙여 page/perPage가 정상
   반영되는지 확인
8. 존재하지 않는 `socialPostId`로 접속해 "선택한 항목을 찾을 수
   없습니다" 경고, 다른 page에 있는 경우 "해당 항목이 있는 N page로
   이동" 링크가 보이는지 확인
9. `/social-posts/[id]?returnTo=https://example.com`처럼 외부 URL을
   붙여도 example.com으로 이동하지 않고 기사 개요로 fallback되는지
   확인
