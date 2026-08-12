# Phase 3-15: Social Performance Dashboard

## 목적

Phase 3-9~3-14에서 쌓인 수동 입력 metrics, rewrite version 성과 비교
데이터를 한 화면에서 조회할 수 있는 읽기 전용 Social Performance
Dashboard를 제공한다. 이 단계의 어떤 기능도 `social_posts` 등 기존
데이터를 변경하지 않는다 — 대시보드를 열어보는 것 자체는 상태에
영향을 주지 않는다.

## Phase 3-9~3-14와의 관계

- Phase 3-9: `social_post_metrics`/`social_posts.latest_*` — 대시보드
  summary/platform/tone/article 집계의 원천 데이터.
- Phase 3-10~3-13: rewrite suggestion/application/reapproval/reexport —
  `is_rewrite_version`, `recommended_for_repost` 등 필터 조건으로 사용.
- Phase 3-14: `social_rewrite_performance_comparisons` — Rewrite
  Performance Summary와 Recent Rewrite Comparisons 섹션의 원천 데이터.

즉 이번 단계는 새 데이터를 만들지 않고, 지금까지 쌓인 데이터를
**모아서 보여주는** 조회 레이어다.

## 대시보드가 보여주는 데이터

`app/dashboard/social-performance/page.tsx`:

1. 전체 Summary cards
2. Platform Performance table
3. Tone Style Performance table
4. Article Performance table
5. Low Performance Social Posts
6. Metrics Missing Social Posts
7. Rewrite Performance Summary
8. Recent Metrics
9. Recent Rewrite Comparisons

## summary card 설명

`SocialPerformanceDashboardSummary` — 전체 social post 수, 게시/수동
게시/measured/missing 카운트, 평균·최고·최저 performance_score, 지표
합계(views/impressions/likes/comments/shares/saves/clicks), 평균
engagement_rate/CTR, rewrite version 수, rewrite 비교 결과별 카운트
(rewrite_won/original_won/similar/needs_more_data)를 보여준다.

## platform performance summary 설명

`platform`별로 묶어 글 수, 수동 게시 수, measured 수, 평균 score/
engagement, 지표 합계, best/worst social_post id를 계산한다. best
performing platform은 평균 score가 가장 높은 플랫폼이며 "Best
Platform" 배지로 표시된다.

## tone performance summary 설명

`tone_style`별로 동일한 방식으로 집계한다. best performing tone_style도
평균 score 기준으로 "Best Tone" 배지로 표시된다.

## article performance summary 설명

`article_id`별로 묶어 social post 수, platform 종류 수, measured 수,
평균 score, best platform/tone_style/social_post, 이 기사에 속한
rewrite 비교 건수와 rewrite 승리 건수를 계산한다. 기사 제목은
`getArticles()`로 조회해 매핑한다.

## low performance posts 설명

`performance_status`가 `low`/`needs_review`이거나 `latest_performance_score
< 40`인 social post를 모은다. 이 목록의 항목은 Phase 3-10의 rewrite
suggestion 대상으로 볼 수 있다는 안내를 함께 표시한다.

## metrics missing posts 설명

`manual_post_status='posted'`인데 `latest_metrics_recorded_at`이 아직
없는(=metrics를 입력하지 않은) social post를 모은다. 각 행에는 metrics
입력 화면(social post 카드)으로 바로 이동하는 링크를 둔다.

## rewrite performance summary 설명

`social_rewrite_performance_comparisons`를 필터 조건에 맞게 모아
comparison_status별 카운트, 평균 performance_score_delta, 가장 잘된/
안된 rewrite version, rewrite가 잘 통한 플랫폼/문체 목록을 계산한다.
이 요약은 동일 조건 A/B 테스트가 아니므로 참고 지표라는 안내를 항상
함께 표시한다.

## filter/sort 설명

`DashboardFilter`: articleId, platform, toneStyle, performanceStatus,
manualPostStatus, dateFrom/dateTo, includeRewriteVersions,
onlyRewriteVersions, onlyRecommendedForRepost, onlyMetricsMissing,
onlyLowPerformance. `?platform=x&onlyLowPerformance=true` 같은 GET
쿼리 파라미터로 전달되며, 페이지는 이를 파싱해 서비스에 넘긴다.

`DashboardSortOption` 9종은 Low Performance Social Posts 테이블에
적용된다(performance score/조회수/클릭수/engagement_rate/수정일 기준
정렬). platform/tone/article summary는 항상 평균 performance_score
내림차순으로 정렬된다.

## 수동 metrics 기반이라는 한계

이 대시보드가 보여주는 모든 수치는 Phase 3-9에서 **사람이 직접
입력한** metrics를 집계한 것이다. 외부 플랫폼 API를 호출해 자동으로
수집한 값이 아니므로, 입력 주기·정확도에 따라 실제 성과와 차이가 날
수 있다. 화면 상단에 항상 이 사실을 안내한다.

## performance_score가 내부 비교용이라는 점

`performance_score`/각종 평균 점수는 이 프로젝트 내부에서 서로 다른
글을 상대 비교하기 위한 값일 뿐, 업계 표준이나 절대적인 마케팅 성공
지표가 아니다.

## rewrite comparison이 A/B 테스트가 아니라는 점

원본과 rewrite version은 서로 다른 시점/조건에서 게시되었을 수 있으므로
`comparison_status='rewrite_won'`이어도 엄밀한 A/B 테스트 결과로
해석해서는 안 된다. Rewrite Performance Summary/Recent Rewrite
Comparisons 섹션에 이 한계를 명시한다.

## 로그 보안 원칙

`pipeline_logs.details_json`에는 filterPlatform/filterToneStyle/
filterPerformanceStatus/includeRewriteVersions/onlyLowPerformance/
onlyMetricsMissing/totalSocialPosts/measuredPosts/metricsMissingPosts/
platformCount/toneCount/articleCount/rewriteComparisonCount/
lowPerformanceCount/reasonCode **만** 저장한다. full post_body/full
caption/full export_payload/full notes/API key/auth token/Authorization
header/Application Password/image binary는 **어디에도** 저장하지
않는다.

## 아직 하지 않는 것

- 자동 metrics 수집 (여전히 Phase 3-9의 수동 입력에 의존)
- 실시간 analytics
- 차트 기반 시각화 (이번 단계는 table/card 중심)
- API 기반 게시 성과 수집
- 자동 개선 실행 (낮은 성과를 봐도 자동으로 rewrite/재게시하지 않음)
- DB view/materialized view (성능 문제가 생기면 다음 단계에서 검토)

## 다음 단계 제안

- 성능 문제가 발생하면 platform/tone/article summary용 materialized
  view 또는 캐시 테이블 도입
- 시계열 차트(주간/월간 추이) 시각화 라이브러리 도입
- 대시보드에서 바로 Low Performance 글의 rewrite suggestion을
  생성하도록 연결(단, 여전히 사람 승인 필요)
- article/social_post 상세 페이지 전용 라우트(`/social-posts/[id]`)가
  생기면 dashboard 링크를 그쪽으로 교체

## Supabase 확인 SQL

```sql
-- 전체 social posts 성과 확인
select
  id,
  article_id,
  platform,
  tone_style,
  is_rewrite_version,
  manual_post_status,
  performance_status,
  latest_performance_score,
  latest_views,
  latest_impressions,
  latest_likes,
  latest_comments,
  latest_shares,
  latest_saves,
  latest_clicks,
  latest_engagement_rate,
  latest_click_through_rate,
  latest_metrics_recorded_at,
  updated_at
from social_posts
order by latest_performance_score desc nulls last
limit 50;

-- 플랫폼별 요약 확인
select
  platform,
  count(*) as post_count,
  count(*) filter (where manual_post_status = 'posted') as posted_count,
  count(*) filter (where latest_metrics_recorded_at is not null) as measured_count,
  avg(latest_performance_score) as avg_score,
  sum(latest_views) as total_views,
  sum(latest_impressions) as total_impressions,
  sum(latest_likes) as total_likes,
  sum(latest_comments) as total_comments,
  sum(latest_shares) as total_shares,
  sum(latest_saves) as total_saves,
  sum(latest_clicks) as total_clicks
from social_posts
group by platform
order by avg_score desc nulls last;

-- 문체별 요약 확인
select
  tone_style,
  count(*) as post_count,
  count(*) filter (where latest_metrics_recorded_at is not null) as measured_count,
  avg(latest_performance_score) as avg_score,
  sum(latest_views) as total_views,
  sum(latest_likes) as total_likes,
  sum(latest_comments) as total_comments,
  sum(latest_shares) as total_shares,
  sum(latest_clicks) as total_clicks
from social_posts
group by tone_style
order by avg_score desc nulls last;

-- rewrite comparison 요약 확인
select
  comparison_status,
  winner,
  count(*) as count,
  avg(performance_score_delta) as avg_score_delta,
  avg(performance_score_delta_rate) as avg_score_delta_rate
from social_rewrite_performance_comparisons
group by comparison_status, winner
order by count desc;

-- metrics missing 확인
select
  id,
  article_id,
  platform,
  tone_style,
  manual_post_status,
  performance_status,
  latest_metrics_recorded_at,
  post_url,
  updated_at
from social_posts
where manual_post_status = 'posted'
  and latest_metrics_recorded_at is null
order by updated_at desc;

-- pipeline logs 확인
select
  event_name,
  status,
  message,
  details_json,
  created_at
from pipeline_logs
where event_name like 'social_performance_dashboard_%'
order by created_at desc
limit 50;
```
