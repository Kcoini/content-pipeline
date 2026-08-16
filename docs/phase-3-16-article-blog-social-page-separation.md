# Phase 3-16: Article / Blog / Social / Rewrite / Performance Page Separation

## 왜 페이지 분리가 필요한지

`/articles/[id]` 한 페이지에 원본 기사, WordPress 발행 파이프라인,
멀티플랫폼 소셜 글쓰기(블로그/SNS/커뮤니티), rewrite suggestion/version,
metrics/성과 비교까지 전부 렌더링되면서 파일이 4,000줄을 넘어섰다.
사용자가 "지금 이 화면에서 무엇을 하려는지"에 따라 필요한 정보가
전혀 다른데도 한 화면에서 모두 찾아야 했다. 이번 단계는 목적별로
화면을 나눠 각 작업에 필요한 정보/버튼만 보여주는 것을 목표로 한다.

## 기존 문제: article/blog/social/rewrite/performance 혼합

기존 `/articles/[id]`는 다음을 한 페이지에서 순서대로 렌더링했다.

1. article 리뷰/수정/승인
2. WordPress 발행 파이프라인(SEO 메타데이터, 대표 이미지, 미디어
   업로드, 최종 검토, 품질 게이트, 공개 발행 승인) — 약 1,800줄
3. Multi-platform Writing(social_posts 전체 목록 + rewrite
   suggestion/version + 재승인/재export + metrics/성과 비교) — 약
   1,800줄

이 중 2번(WordPress 발행 파이프라인)은 **기사 자체**의 게시 상태를
다루는, 이 프로젝트의 핵심 파이프라인(Phase 1-2)이므로 이번 단계에서
건드리지 않았다 — "기존 WordPress publish workflow를 깨뜨리지
않는다"는 원칙에 따라 `/articles/[id]`에 그대로 둔다. 3번(약
1,800줄)이 정확히 이번 단계에서 분리 대상인 "블로그/SNS·커뮤니티/
rewrite/성과" 콘텐츠였다.

## 새로운 route 구조

```
app/articles/[id]/page.tsx          → 기사 개요 (신규: 요약 중심으로 축소)
app/articles/[id]/blog/page.tsx     → 블로그 글쓰기 관리 (신규)
app/articles/[id]/social/page.tsx   → SNS/커뮤니티 글쓰기 관리 (신규)
app/articles/[id]/rewrite/page.tsx  → Rewrite 관리 (신규)
app/articles/[id]/performance/page.tsx → 성과 보기 (신규)
```

## /articles/[id]의 역할

원본 기사와 WordPress 발행 파이프라인(기존 그대로) + "생성된 콘텐츠
요약" 카드(블로그/SNS·커뮤니티/Rewrite/Low Performance 개수, 게시
완료/metrics 측정/미입력/재게시 추천 개수) + 4개 하위 페이지로 가는
이동 버튼만 제공한다. `lib/social/article-content-summary-service.ts`의
`buildArticleContentSummary()`가 이 요약을 계산한다 — 내부적으로
Phase 3-16(이전 라운드)의 `groupSocialPostsForArticle()`을 그대로
재사용한다. 이 페이지는 더 이상 social_posts 전체 목록이나 긴
post_body/caption/export_payload를 직접 렌더링하지 않는다.

## /articles/[id]/blog의 역할

`wordpress_blog`/`naver_blog` social_post만 다룬다(기본적으로 rewrite
version 제외, "rewrite 포함" 체크박스로 노출 가능). 기사 자체의
monetized_blog SEO 필드(seoTitle/metaDescription/targetKeyword)를 상단
요약으로 보여주고, 각 글 카드에서 품질검사/승인 요청/승인/Manual
Export/게시 체크리스트 준비/게시 결과 기록/Metrics 입력을 처리한다.
`lib/social/article-blog-page-service.ts`의 `buildArticleBlogPageData()`
가 데이터를 조회한다.

## /articles/[id]/social의 역할

`naver_cafe`/`x`/`threads`/`instagram` social_post만 다룬다(기본적으로
rewrite version 제외). WordPress/Naver Blog는 표시하지 않는다. 품질검사/
승인 요청/Manual Export/Publishing Guard/Dry-run/Handoff/게시 결과
기록/Metrics 입력 버튼을 제공한다.
`lib/social/article-social-page-service.ts`의 `buildArticleSocialPageData()`
가 데이터를 조회한다.

## /articles/[id]/rewrite의 역할

rewrite suggestion과 `is_rewrite_version=true`인 social_post(rewrite
version)만 다룬다 — 일반 social post와 섞어 보여주지 않는다. 개선 제안
생성/승인/반려/적용, Version Quality Recheck, 원본과 비교, 재승인
요청/승인, 재Export 준비/생성 버튼을 제공하며, root/parent/version_number/
version_status/version_comparison_status/recommended_for_repost/
rewrite_reapproval_status/rewrite_reexport_status/
rewrite_republish_workflow_status/rewrite_performance_comparison_status/
rewrite_performance_winner를 카드에 표시한다. 이 페이지의 어떤 버튼도
자동 게시를 수행하지 않는다.
`lib/social/article-rewrite-page-service.ts`의 `buildArticleRewritePageData()`
가 데이터를 조회한다.

## /articles/[id]/performance의 역할

Phase 3-15의 `buildSocialPerformanceDashboard()`를 `articleId` 필터로
그대로 재사용한다(`lib/social/article-performance-page-service.ts`) —
성과 계산 방식은 전혀 바꾸지 않았다. article-level summary, platform별/
tone_style별 성과, low performance 목록, metrics missing 목록, rewrite
성과 비교 요약, 최근 metrics/rewrite comparison을 Phase 3-15에서 이미
만든 컴포넌트(`components/social-performance-dashboard/*`)를 그대로
가져와 렌더링한다. "Original vs Rewrite 성과 비교 실행" 버튼도 이
페이지에 있다.

## content group 분류 기준

`lib/social/content-type-classifier.ts`(이전 Phase 3-16 라운드에서
이미 구현됨, 이번 단계에서 그대로 재사용). platform과
`is_rewrite_version`만으로 `blog`/`community`/`social`/`rewrite`를
판단한다 — DB 컬럼을 추가하지 않았다.

## navigation 구조

`components/articles/article-workflow-navigation.tsx`의
`ArticleWorkflowNavigation` 컴포넌트가 5개 탭(기사 개요/블로그 글쓰기/
SNS·커뮤니티 글쓰기/Rewrite 관리/성과 보기)을 렌더링하며, 현재 페이지를
`aria-current="page"` + 강조 스타일로 표시한다. URL 생성 로직은
`getArticleWorkflowTabs(articleId)`로 분리해 렌더링 없이 테스트할 수
있게 했다. 5개 페이지 모두 이 컴포넌트를 최상단에 둔다.

대시보드 쪽에서는 이전 Phase 3-16 라운드에서 이미 `/dashboard`에
Content/Blog/Social Performance/Rewrite Dashboard 링크를 추가해 두었다
— 이번 단계에서 추가로 손댈 것이 없어 그대로 유지했다.

## 필터 기본값

- blog 페이지: `includeRewriteVersions=false`,
  platform은 wordpress_blog/naver_blog만 노출
- social 페이지: `includeRewriteVersions=false`,
  platform은 naver_cafe/x/threads/instagram만 노출
- rewrite 페이지: rewrite version만 조회(별도 필터 없이 항상
  `is_rewrite_version=true`만 대상)
- performance 페이지: `includeRewriteVersions=true`로 항상 rewrite
  version도 포함해 원본과 비교할 수 있게 한다. metrics missing/low
  performance 목록은 항상 함께 표시한다(별도 토글 없음).

## 기존 workflow와의 호환성

- 모든 새 페이지는 `app/articles/[id]/actions.ts`에 이미 정의된 서버
  액션을 **그대로 재사용**한다 — 새 액션을 만들지 않았고 비즈니스
  로직도 바꾸지 않았다.
- 각 서버 액션은 `articleId`를 hidden input으로 받아 항상
  `/articles/${articleId}`(개요 페이지)로 redirect한다 — 이는 기존
  액션 전체가 공유하는 동작이라 이번 단계에서 바꾸지 않았다. 즉 blog/
  social/rewrite/performance 페이지에서 폼을 제출하면 성공/실패
  메시지와 함께 개요 페이지로 돌아간다. 개선하려면 각 액션에
  `returnTo` hidden input을 추가해 리다이렉트 대상을 동적으로 만들어야
  하며, 이는 다음 단계로 남겨둔다.
- `/articles/[id]`에서 WordPress 발행 파이프라인(SEO/이미지/최종
  검토/공개 발행)은 코드 한 줄도 옮기거나 바꾸지 않았다.
- 기존 `social_posts`/`social_post_metrics`/
  `social_rewrite_performance_comparisons` 데이터는 삭제하거나
  마이그레이션하지 않았다 — 이번 단계는 순수하게 화면 구조 변경이다.

## 아직 하지 않는 것

- 차트 (여전히 table/card 중심)
- 외부 API 연동
- 자동 게시
- 자동 metrics 수집
- 자동 rewrite 실행
- A/B 테스트
- 성과 점수 계산 방식 변경

## 다음 단계 제안

- 서버 액션에 `returnTo` hidden input을 추가해 폼 제출 후 원래
  하위 페이지로 돌아가게 하기
- blog/social 페이지에 페이지네이션(현재는 전체 목록을 한 번에 표시)
- rewrite 페이지에서 suggestion → applied version → performance
  comparison까지 이어지는 딥링크
- `/social-posts/[id]` 같은 전용 상세 라우트가 생기면 각 페이지의
  앵커 링크(`#social-post-{id}`)를 그쪽으로 교체

## 확인 방법

1. `/articles/[id]` 접속 → 긴 글 목록이 사라지고 "생성된 콘텐츠 요약"
   카드 + 4개 이동 버튼만 보이는지 확인
2. `/articles/[id]/blog` 접속 → WordPress/Naver Blog 글만 보이는지
   확인(naver_cafe/x/threads/instagram 없음)
3. `/articles/[id]/social` 접속 → Naver Cafe/X/Threads/Instagram 글만
   보이는지 확인(WordPress/Naver Blog 없음)
4. `/articles/[id]/rewrite` 접속 → rewrite version과 suggestion만
   보이는지 확인(원본 글 목록과 섞이지 않음)
5. `/articles/[id]/performance` 접속 → metrics/성과 정보만 보이는지
   확인
6. 5개 페이지 상단 navigation에서 현재 페이지가 강조 표시되는지
   (active state) 확인

## Supabase 확인 SQL

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
