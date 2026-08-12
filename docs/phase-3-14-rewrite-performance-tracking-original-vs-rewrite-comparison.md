# Phase 3-14: Rewrite Performance Tracking & Original-vs-Rewrite Result Comparison

## 목적

Phase 3-13에서 재승인/재Export되어 실제로 수동 게시된 rewrite version이,
같은 root의 원본 social_post보다 실제로 성과가 좋았는지를 수동 입력된
metrics 기준으로 비교해 저장한다. 이 비교는 판단 보조용 참고 자료이며,
어떤 경우에도 자동 게시나 자동 원본 수정으로 이어지지 않는다.

## Phase 3-13과의 관계

Phase 3-13이 "rewrite version을 다시 게시할 수 있게 만드는" 단계였다면,
Phase 3-14는 "그렇게 게시된 rewrite version이 실제로 더 나았는가"를
사후에 검증하는 단계다. 즉 Phase 3-9(수동 metrics 입력) → Phase
3-13(재승인/재게시) → Phase 3-14(성과 비교)로 이어지는 흐름의 마지막
고리다.

## rewrite performance comparison이 필요한 이유

Phase 3-12의 `version_comparison_status`(rewrite_better 등)는 품질
재검사와 콘텐츠 비교에 기반한 "게시 전" 판단이었다. 반대로 이 단계의
비교는 실제로 사람이 플랫폼에서 확인한 조회수/좋아요/댓글/공유 등
"게시 후" 실측 데이터를 기반으로 한다 — 사전 판단과 사후 검증은
서로 다른 근거를 사용하므로 별도 테이블로 분리해 관리한다.

## social_rewrite_performance_comparisons 테이블 구조

`db/migrations/039_phase-3-14-rewrite-performance-tracking-original-vs-rewrite-comparison.sql`.

- 식별 정보: article_id, root_social_post_id, original_social_post_id,
  rewrite_social_post_id, rewrite_source_suggestion_id,
  version_comparison_id, platform, tone_style, original/rewrite
  version_number
- 원본 metrics 스냅샷: original_views/impressions/reach/likes/comments/
  shares/saves/clicks/profile_visits/follows/conversion_count/
  engagement_rate/click_through_rate/conversion_rate/performance_score/
  performance_status (+ original_metrics_id/original_measured_at)
- rewrite metrics 스냅샷: 위와 동일한 구조의 rewrite_* 컬럼
- 비교 결과: comparison_status, winner, performance_score_delta(_rate),
  views_delta(_rate), impressions_delta(_rate), engagement_rate_delta,
  click_through_rate_delta, clicks/comments/shares/saves_delta(_rate),
  improvement_summary(jsonb), platform_specific_summary(jsonb),
  warnings/failures(jsonb 배열), compared_by, compared_at

`social_posts`에는 rewrite version 요약용 컬럼 7개
(`latest_rewrite_performance_comparison_id`,
`rewrite_performance_comparison_status`, `rewrite_performance_winner`,
`rewrite_performance_score_delta`, `rewrite_performance_improvement_rate`,
`rewrite_performance_checked_at`, `rewrite_performance_summary`)를
추가했다.

## 원본 metrics와 rewrite metrics의 차이

두 metrics 모두 Phase 3-9의 `social_post_metrics`에서 각 social_post의
가장 최근 측정값(`getLatestMetricsBySocialPost`)을 가져온 스냅샷이다.
원본과 rewrite는 서로 다른 `social_posts` row이므로 metrics 이력도
완전히 독립적으로 쌓인다 — 비교 시점에 "그 시점까지의 최신값"을 그대로
복사해 저장하므로, 이후 원본/rewrite에 새 metrics가 입력되어도 이미
저장된 비교 결과는 변하지 않는다(다시 비교를 실행해야 최신화됨).

## delta / delta_rate 계산 방식

- `delta = rewrite - original`
- `delta_rate = delta / original` (`original > 0`일 때만)
- `original = 0`이면 `rewrite`가 0보다 크더라도 delta_rate는 계산할 수
  없으므로 `null`을 반환하고, 대신 `warnings`에 "delta_rate 계산 불가"
  안내를 추가한다(증가폭 자체는 delta로 확인 가능).
- `original = 0`이고 `rewrite = 0`이면 delta_rate는 `null`이다.

## performance_score_delta 계산 방식

원본/rewrite 각각의 `social_post_metrics.performance_score`(Phase 3-9의
내부 비교용 점수)를 그대로 사용해 `performance_score_delta = rewrite -
original`, `performance_score_delta_rate = delta / original`을
계산한다. 둘 중 하나라도 없으면 `null`이다.

## winner 결정 방식

`lib/social/rewrite-performance-comparison-calculator.ts`의
`decideRewritePerformanceWinner()`.

1. performance_score가 둘 다 있으면: 차이가 **10점 이상**이면
   rewrite_won/original_won, 10점 미만이면 similar(tie)로 판단한다.
2. performance_score가 없으면: 플랫폼별 primary metrics(아래 표)의
   다수결로 판단한다 — rewrite가 조회수는 낮아도 CTR/engagement 등
   해당 플랫폼의 주요 지표에서 앞서면 rewrite가 이길 수 있다. 다수결
   차이가 과반 미만이면 inconclusive로 처리한다.
3. performance_score도 primary metrics도 없으면 needs_more_data(winner
   없음)로 처리한다.

이 점수/순위는 **내부 비교용 참고 지표**일 뿐이며, 절대적인 마케팅
성공 지표가 아니다.

## 플랫폼별 primary metrics

`lib/social/rewrite-performance-comparison-rules.ts`.

| platform | primary metrics |
| --- | --- |
| wordpress_blog | clicks, views, conversionCount, comments |
| naver_blog | views, likes, comments, saves, shares |
| naver_cafe | comments, views, likes |
| x | impressions, likes, comments, shares, clicks |
| threads | views, likes, comments, shares |
| instagram | reach, impressions, likes, comments, saves, shares, profileVisits |

## needs_more_data 처리 방식

원본/rewrite 중 metrics가 하나라도 없으면 **blocked가 아니라
needs_more_data**로 처리한다 — 이는 정책 위반이나 오류가 아니라 단순히
아직 측정값이 부족한 상태이기 때문이다. 둘 다 없어도 마찬가지로
needs_more_data이며, 비교 row 자체는 정상적으로 생성되어 이후 metrics가
채워지면 다시 비교를 실행할 수 있다. blocked는 `is_rewrite_version=false`,
원본을 특정할 수 없음, platform 불일치처럼 애초에 비교 자체가 성립하지
않는 경우에만 사용한다.

## 동일 조건 A/B 테스트가 아니라는 한계

원본과 rewrite는 게시 시점, 노출 시간, 플랫폼 알고리즘 변화, 계절성,
외부 이슈 등 서로 다른 조건에서 게시되었을 수 있다. 이 비교는 동일한
트래픽을 절반씩 나눠 보여주는 정식 A/B 테스트가 아니므로, 결과는
참고용으로만 사용하고 절대적인 우열로 해석하지 않아야 한다.

## 결과가 자동 게시나 자동 수정으로 이어지지 않는다는 점

`comparison_status='rewrite_won'`이거나 `winner='rewrite'`이더라도 이
단계의 어떤 함수도 원본을 자동으로 교체하거나, rewrite를 자동으로
정식 게시하거나, 다음 rewrite를 자동으로 생성하지 않는다. 모든 후속
조치(다음 rewrite 제안 검토, 원본 교체 여부 판단 등)는 사람이 이 비교
결과를 참고해 별도로 결정해야 한다.

## 로그 보안 원칙

`pipeline_logs.details_json`에는 articleId/rootSocialPostId/
originalSocialPostId/rewriteSocialPostId/platform/toneStyle/
originalVersionNumber/rewriteVersionNumber/originalMetricsId/
rewriteMetricsId/originalPerformanceStatus/rewritePerformanceStatus/
originalPerformanceScore/rewritePerformanceScore/performanceScoreDelta/
improvementRate/comparisonStatus/winner/hasOriginalMetrics/
hasRewriteMetrics/missingDataCount/warningCount/reasonCode **만**
저장한다. full post_body/full caption/full export_payload/full
notes/API key/auth token/Authorization header/Application
Password/image binary는 **어디에도** 저장하지 않는다.

## 아직 하지 않는 것

- 실제 Analytics API 자동 수집 (모든 수치는 여전히 사람이 입력)
- 자동 A/B 테스트
- 자동 재게시
- 자동 원본 수정
- 자동 rewrite 반복(성과가 좋다고 다음 rewrite를 자동 생성하지 않음)
- 네이버/X/Threads/Instagram API 연결
- 외부 Analytics API 연결

## 다음 단계 제안

- rewrite가 연속으로 이겼을 때(예: 2회 이상 rewrite_won) 사람에게
  "원본 교체 검토" 알림을 보여주는 UI
- 플랫폼별 primary metrics 가중치를 사람이 조정할 수 있게 하는 설정 화면
- article 전체가 아니라 root_social_post 단위로 여러 rewrite 버전의
  성과를 한 번에 비교하는 타임라인 뷰
- 시간 경과에 따른 성과 추이(초기 24시간 vs 1주일 등) 비교

## Supabase 확인 SQL

```sql
-- rewrite performance comparison 확인
select
  id,
  article_id,
  root_social_post_id,
  original_social_post_id,
  rewrite_social_post_id,
  platform,
  original_version_number,
  rewrite_version_number,
  original_performance_score,
  rewrite_performance_score,
  performance_score_delta,
  performance_score_delta_rate,
  views_delta,
  views_delta_rate,
  engagement_rate_delta,
  click_through_rate_delta,
  comparison_status,
  winner,
  compared_at,
  created_at
from social_rewrite_performance_comparisons
order by created_at desc
limit 20;

-- social_posts rewrite performance summary 확인
select
  id,
  article_id,
  platform,
  tone_style,
  version_number,
  is_rewrite_version,
  manual_post_status,
  performance_status,
  latest_performance_score,
  rewrite_performance_comparison_status,
  rewrite_performance_winner,
  rewrite_performance_score_delta,
  rewrite_performance_improvement_rate,
  latest_rewrite_performance_comparison_id,
  rewrite_performance_checked_at,
  updated_at
from social_posts
where is_rewrite_version = true
order by updated_at desc
limit 20;

-- metrics 비교용 확인
select
  sp.id,
  sp.platform,
  sp.version_number,
  sp.is_rewrite_version,
  sp.parent_social_post_id,
  sp.manual_post_status,
  sp.latest_metrics_recorded_at,
  sp.performance_status,
  sp.latest_performance_score,
  sp.latest_views,
  sp.latest_impressions,
  sp.latest_likes,
  sp.latest_comments,
  sp.latest_shares,
  sp.latest_saves,
  sp.latest_clicks
from social_posts sp
where sp.is_rewrite_version = true
   or sp.id in (
     select parent_social_post_id
     from social_posts
     where is_rewrite_version = true
       and parent_social_post_id is not null
   )
order by sp.root_social_post_id, sp.version_number;

-- pipeline logs 확인
select
  event_name,
  status,
  message,
  details_json,
  created_at
from pipeline_logs
where event_name like 'social_rewrite_performance_comparison_%'
order by created_at desc
limit 50;
```
