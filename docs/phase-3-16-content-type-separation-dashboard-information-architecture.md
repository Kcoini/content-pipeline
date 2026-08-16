# Phase 3-16: Content Type Separation & Dashboard Information Architecture

## 목적

Phase 3-1~3-15를 거치며 article(원본 기사), social_posts(블로그/SNS/
커뮤니티/rewrite version), metrics/rewrite comparison(성과 데이터)이
한 화면·한 목록에 뒤섞여 표시되던 문제를 해결한다. 이 단계는 **새
데이터를 만들지 않고**, 이미 존재하는 `platform`/`is_rewrite_version`
값을 기준으로 콘텐츠를 분류해 화면 정보 구조(information
architecture)만 정리한다.

## 왜 Phase 3-15 직후 바로 필요한지

Phase 3-15에서 Social Performance Dashboard를 만들면서 article
상세/대시보드 화면에 노출되는 정보량(품질/승인/게시/재승인/재export/
재게시 workflow/성과/rewrite 비교 등)이 매우 많아졌다. 이 상태에서
새 기능을 더 쌓기 전에, 정보를 콘텐츠 유형별로 분리해 보여주는 기반을
먼저 정리해야 이후 단계(예: 차트, 실시간 analytics)를 얹기 쉬워진다.

## 기사글과 블로그글이 섞이는 문제

기존 article 상세 페이지는 "원본 기사"(articles 테이블)와 그 기사로
부터 파생된 "social_posts"(블로그/SNS/커뮤니티/rewrite)를 한 목록에서
순서 구분 없이 보여주었다. 사용자는 어떤 카드가 원본이고 어떤 카드가
파생 콘텐츠인지, 그리고 그 파생 콘텐츠가 블로그인지 SNS인지 rewrite
버전인지를 텍스트를 읽어야만 알 수 있었다.

## content_group 설명

`lib/social/content-type-classifier.ts`의 `classifyContentGroup()`.
플랫폼/is_rewrite_version만으로 계산되는 순수 함수이며 DB에 값을
저장하지 않는다.

- `original_article`: articles 테이블의 원본 글
- `blog`: `wordpress_blog`/`naver_blog` (non-rewrite)
- `community`: `naver_cafe` (non-rewrite)
- `social`: `x`/`threads`/`instagram` (non-rewrite)
- `rewrite`: `is_rewrite_version=true`인 모든 social_post (원래
  platform과 무관하게 우선 적용)
- `performance`: metrics/rewrite comparison 데이터
- `unknown`: 위 어디에도 해당하지 않는 경우

## content_type 설명

`classifyContentType()`. content_group보다 세분화된 타입으로,
rewrite version은 원래 platform이 blog/community/social 중 어디였는지에
따라 `rewrite_blog`/`rewrite_community`/`rewrite_social`로 나뉜다.
non-rewrite social_post는 `wordpress_blog`/`naver_blog`/`naver_cafe`/
`x_thread`/`threads_post`/`instagram_caption`으로 매핑된다.
`monetized_blog`는 향후 수익화 메타데이터가 추가될 때를 대비해 타입
목록에 정의만 해두었다(현재 classifier는 이 값을 반환하지 않는다).

## article detail 화면 구조 (최신: 별도 route로 분리됨)

이 섹션은 이번 라운드(`docs/phase-3-16-article-blog-social-page-separation.md`)에서
`/articles/[id]`를 실제 5개 route(`/articles/[id]`,
`/blog`, `/social`, `/rewrite`, `/performance`)로 분리하면서 아래
내용으로 대체되었다 — "탭 UI 대신 섹션+앵커 링크" 방식은 더 이상
사용하지 않는다. 상세 설계는 위 문서를 참고한다.

1. `app/articles/[id]/page.tsx`는 원본 기사 + 기존 WordPress 발행
   파이프라인(변경 없음) + "생성된 콘텐츠 요약" 카드(개수 요약) +
   4개 하위 route로 가는 이동 버튼만 제공한다. 더 이상 social_posts
   전체 목록이나 앵커 링크(`#social-post-{id}`)를 이 페이지에서 직접
   렌더링하지 않는다.
2. `components/articles/article-workflow-navigation.tsx`의
   `ArticleWorkflowNavigation`이 5개 route를 실제 탭(`aria-current`)
   으로 렌더링한다 — "다음 단계 제안"에 있던 "진짜 탭 UI로 전환"이
   이번 라운드에서 완료됐다.
3. 각 하위 route(`/blog`, `/social`, `/rewrite`)의 social_post
   카드 헤더에는 여전히 `ContentGroupBadge`를 사용해 content_group을
   표시한다.

## dashboard navigation 구조

- `/dashboard`: 메인 대시보드(테마/기사 생성) — Social Performance/
  Content/Blog/Rewrite Dashboard로 가는 링크 추가
- `/dashboard/social-performance`: 전체 성과 대시보드(Phase 3-15) +
  content group 필터 + 빠른 탭(전체 성과/블로그/SNS·커뮤니티/Rewrite/
  Metrics Missing/Low Performance)
- `/dashboard/content`: article 중심 운영 현황
- `/dashboard/blog`: 블로그 전용 목록
- `/dashboard/rewrite`: rewrite version 전용 목록

## blog dashboard 설명

`app/dashboard/blog/page.tsx`. `wordpress_blog`/`naver_blog`만
기본으로 보여준다(`naver_cafe`/`x`/`threads`/`instagram`은 기본
제외). platform/quality_status/approval_status/publish_status/
performance_status 필터와 "rewrite 포함" 체크박스를 제공한다. 각 행에
게시 완료/Metrics 필요/Low Performance/재게시 추천 배지를 붙인다.

## rewrite dashboard 설명

`app/dashboard/rewrite/page.tsx`. `is_rewrite_version=true`인
social_post만 보여준다. version_number/root/parent, version_comparison_
status, recommended_for_repost, rewrite_reapproval_status,
rewrite_reexport_status, rewrite_performance_comparison_status와
winner, latest_performance_score를 한 테이블에서 확인할 수 있다.

## content dashboard 설명

`app/dashboard/content/page.tsx`. article별로 blogCount/community
Count/socialCount/rewriteCount/publishedCount/metricsMeasuredCount/
lowPerformanceCount/rewriteSuggestionCount/rewriteComparisonCount를
집계해 보여준다. `buildContentDashboard()`
(`lib/social/social-performance-dashboard-service.ts`)가
`listArticleContentBreakdowns()`(dashboard repository)를 호출한다.

## performance dashboard와의 관계

Phase 3-15의 Social Performance Dashboard는 그대로 유지되며, 이번
단계에서는 여기에 content group 필터와 다른 dashboard로의 이동 링크만
추가했다. Blog/Rewrite/Content Dashboard는 Social Performance
Dashboard의 "특정 관점으로 미리 필터링된 뷰"에 가깝다 — 데이터
소스(`social_posts`, `social_post_metrics`,
`social_rewrite_performance_comparisons`)는 동일하다.

## 필터 기본값

`DEFAULT_DASHBOARD_FILTER`(`social-performance-dashboard-types.ts`)를
다음과 같이 좁혔다.

- `contentGroup: "all"`
- `includeRewriteVersions: false` (기존 `true`에서 변경 — rewrite
  version은 Rewrite Dashboard에서 별도로 본다)
- `onlyMetricsMissing`/`onlyLowPerformance`/`onlyRecommendedForRepost`:
  모두 `false`
- 기본 정렬(`DEFAULT_DASHBOARD_SORT`): `updated_at desc` (기존
  `latest_performance_score desc`에서 변경)

`DashboardFilter`에 `contentGroup`(all/blog/community/social/rewrite/
performance) 필드를 추가했다. `contentGroup='rewrite'`는
`is_rewrite_version=true`만, `blog`/`community`/`social`은 rewrite
version을 제외한 결과만 반환한다(`includeRewriteVersions` 설정보다
우선한다).

## badge 정책

`components/social/content-group-badge.tsx`.

- `ContentGroupBadge`: 원본 기사/블로그/커뮤니티/SNS/Rewrite/성과 —
  `classifyContentGroup()` 결과를 그대로 매핑
- `InfoBadge`: 게시 완료/Metrics 필요/Low Performance/재게시 추천/
  수동 검토 후보

기존 프로젝트의 Tailwind 유틸리티 클래스만 사용했고 새 스타일
라이브러리는 추가하지 않았다.

## 로그 보안 원칙

`content_grouping_started`/`content_grouping_completed`/
`content_grouping_failed`/`dashboard_information_architecture_loaded`
이벤트의 `details_json`에는 articleId/blogPostCount/communityPostCount/
socialPostCount/rewriteVersionCount/metricsMissingCount/
lowPerformanceCount/contentGroup/filterPlatform/filterToneStyle **만**
저장한다. full post_body/full caption/full export_payload/full
notes/API key/auth token/Authorization header/Application
Password/image binary는 **어디에도** 저장하지 않는다.

## 아직 하지 않는 것

- 차트 (여전히 table/card 중심)
- 외부 API 연결
- 자동 게시
- 자동 metrics 수집
- 자동 rewrite 실행
- A/B 테스트
- 성과 점수 계산 방식 변경(Phase 3-9/3-14 로직 그대로 사용)
- DB 데이터 삭제/기존 workflow 변경

## 다음 단계 제안

- (완료) article 상세 페이지를 진짜 탭 UI로 전환 — 자세한 내용은
  `docs/phase-3-16-article-blog-social-page-separation.md` 참고
- Blog/Rewrite Dashboard에 대시보드 전용 페이지네이션(현재는 전체
  목록을 한 번에 표시)
- Content Dashboard에서 article을 클릭하면 바로 해당 content group
  섹션으로 스크롤되는 딥링크
- `monetized_blog` content_type을 실제로 판별할 수익화 메타데이터
  설계

## 확인 방법

1. `/articles/[id]` 접속 → "생성된 콘텐츠 요약" 카드와 4개 하위
   route 이동 버튼이 보이는지 확인 → 각 버튼을 눌러 `/blog`, `/social`,
   `/rewrite`, `/performance`로 이동되는지 확인
2. 각 social_post 카드 헤더에 content group 배지가 붙어 있는지 확인
3. `/dashboard/blog` 접속 → naver_cafe/x/threads/instagram 글이
   기본적으로 보이지 않는지 확인
4. `/dashboard/rewrite` 접속 → rewrite version만 보이는지, version_
   number/root/parent/재승인/재export/성과 비교 상태가 보이는지 확인
5. `/dashboard/content` 접속 → article별 blog/community/social/
   rewrite 개수가 집계되는지 확인
6. `/dashboard/social-performance`에서 `contentGroup` 필터를 바꿔가며
   목록이 바뀌는지 확인

## 확인 SQL

```sql
select
  id,
  article_id,
  platform,
  tone_style,
  is_rewrite_version,
  version_number,
  quality_status,
  approval_status,
  publish_status,
  manual_post_status,
  performance_status,
  latest_performance_score,
  updated_at
from social_posts
order by updated_at desc
limit 50;
```
