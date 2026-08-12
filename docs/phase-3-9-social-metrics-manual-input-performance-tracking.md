# Phase 3-9: Social Metrics Manual Input & Performance Tracking

## 목적

Phase 3-8에서 `manual_post_status='posted'`가 된 `social_posts`에 대해,
사용자가 각 플랫폼 화면에서 직접 확인한 성과 지표(조회수/좋아요/댓글/
공유/저장/클릭 등)를 수동으로 입력하고 이력을 추적할 수 있게 한다.
실제 네이버 Analytics, X API metrics, Threads/Instagram Insights API
연동, 자동 성과 수집, 자동 재작성, 자동 A/B 테스트는 이 단계에서 하지
않는다.

## Phase 3-8과의 관계

Phase 3-8이 "게시했다"는 사실을 기록했다면, Phase 3-9는 "게시한 결과가
어땠는지"를 기록한다. `manual_post_status='posted'`인 social post를
우선 대상으로 하지만, 테스트/사전 확인 목적으로 그렇지 않은 post에도
입력 자체는 허용하고 대신 warning을 남긴다(차단하지 않음).

## manual metrics input이 필요한 이유

이 프로젝트는 어떤 플랫폼 API와도 연동되어 있지 않으므로, 조회수·좋아요
같은 수치를 시스템이 자동으로 알 방법이 없다. 사람이 플랫폼 화면에서
직접 확인한 수치를 입력해야 `social_posts`에 최신 성과가 반영되고,
플랫폼/문체별 비교가 가능해진다.

## social_post_metrics 테이블 구조

매 입력마다 `social_post_metrics`에 새 row가 insert된다(기존 row를
덮어쓰지 않음 — 시계열 이력으로 누적). 주요 컬럼: `measured_at`,
`recorded_by`, `views`/`impressions`/`likes`/`comments`/`shares`/
`saves`/`clicks`/`profile_visits`/`follows`/`reach`(원시 입력값),
`engagement_rate`/`click_through_rate`/`conversion_rate`/
`performance_score`(계산값), `notes`, `raw_metrics`(예비 확장용 JSON).

## social_posts latest metrics 구조

`social_posts`에는 가장 최근 측정값만 요약해서 보관하는 `latest_*`
컬럼과 `performance_status`/`performance_summary`를 추가했다. 매
입력마다 `social_post_metrics`에 이력을 쌓는 동시에 이 컬럼들을 최신값
으로 덮어써서, social post 목록을 조회할 때마다 이력 테이블을 조인하지
않고도 최신 성과를 바로 볼 수 있게 한다.

## 플랫폼별 지표

`lib/social/platform-metrics-config.ts`의 `PLATFORM_METRICS_CONFIGS`가
플랫폼별 필수/선택 지표와 `performance_score` 가중치를 정의한다.

| 플랫폼 | 필수 | 선택 | 가중치 |
|---|---|---|---|
| wordpress_blog | views | clicks, comments, conversionCount | views 25 / clicks 35 / comments 10 / conversion 30 |
| naver_blog | views | likes, comments, shares, saves | views 30 / likes 20 / comments 20 / shares·saves 각 15 |
| naver_cafe | views | comments, likes, shares | views 25 / comments 40 / likes 15 / shares 20 |
| x | impressions | likes, comments, shares, clicks, profileVisits, follows | impressions·likes·comments·shares·clicks 각 20 |
| threads | likes | views, comments, shares, follows | views 20 / likes 25 / comments 25 / shares 15 / follows 15 |
| instagram | reach | impressions, likes, comments, shares, saves, profileVisits, follows | reach·likes·comments 각 20 / shares·saves 각 15 / profileVisits·follows 각 5 |

## engagement_rate 계산 방식

`(likes + comments + shares + saves) / 분모`. 분모는 `impressions →
reach → views` 순으로 값이 있는 첫 번째 지표를 사용하며, 아무 분모도
0보다 크지 않으면 `null`을 반환한다(0으로 나누지 않음).

## click_through_rate 계산 방식

`clicks / 분모` — 분모 우선순위는 engagement_rate와 동일하다.

## performance_score 계산 방식

`lib/social/social-metrics-calculator.ts`의 `calculatePerformanceScore()`
가 담당한다. 각 지표를 "이 정도면 훌륭하다"는 기준값(threshold, 예:
views 1000, likes 100, comments 20 등)으로 나눈 뒤 0~1 사이로
saturate시키고, 플랫폼별 가중치를 곱해 합산한다(가중치 합은 100이므로
결과도 자연히 0~100 범위). 지표가 하나도 없으면 0점이다.

## performance_status 설명

`classifyPerformanceStatus(score)`가 점수를 5단계로 분류한다(측정 자체가
없는 `not_measured`는 이 함수가 아니라 `social_posts`의 기본값으로
표현된다).

- 80 이상: `excellent`
- 65 이상: `good`
- 40 이상: `average`
- 1 이상: `low`
- 0(측정은 했지만 지표가 전혀 없음): `needs_review`

## 성과 점수는 내부 비교용이라는 점

**이 점수는 정확한 마케팅 분석 공식이 아니다.** 조회수 1000, 좋아요
100 같은 saturation 기준값은 임의로 정한 내부 기준이며, 실제 업종/
채널 규모에 따라 "좋은 성과"의 기준은 크게 다르다. 이 점수는 같은
기사에서 만든 여러 플랫폼/문체 버전 중 **상대적으로 무엇이 더 반응이
좋았는지**를 비교하는 용도로만 사용해야 한다.

## UI 사용법

social post 상세의 "Performance Metrics" 패널에서 조회수/노출/도달/
좋아요/댓글/공유/저장/클릭/프로필방문/팔로우/전환수를 입력하고 "Metrics
저장" 버튼을 누르면 `recordSocialPostMetrics()`가 실행된다. "Metrics
이력 보기"를 펼치면 시계열 이력 테이블을, "최신 Metrics 새로고침"은
페이지를 다시 불러와 최신 `latest_*` 값을 반영한다. article 상세의
Multi-platform Writing 섹션 상단에는 플랫폼별/문체별 최고 점수와
`bestPlatform`/`bestToneStyle`, 측정됨/미측정 개수를 요약해서 보여준다
(`buildArticleSocialPerformanceSummary()`).

## 로그 보안 원칙

`pipeline_logs.details_json`에는 socialPostId/articleId/platform/
toneStyle/measuredAt/hasViews/hasImpressions/hasLikes/hasComments/
hasShares/hasSaves/hasClicks/hasReach/hasConversions(불리언만)/
engagementRate/clickThroughRate/performanceScore/performanceStatus/
warningCount/reasonCode **만** 저장한다. full post_body/full caption/
full export text/**메모(notes) 전문**/API key/auth token/Authorization
header/Application Password/image binary는 **어디에도** 저장하지
않는다 — notes 자체는 `social_post_metrics.notes` 컬럼에는 정상
저장되지만, 로그에는 존재 여부조차 남기지 않는다.

## 아직 하지 않는 것

- 실제 API 기반 자동 metrics 수집
- X/Threads/Instagram Insights 연동
- 네이버 통계 API 연동
- 자동 재작성 (성과가 낮다고 AI가 스스로 다시 쓰지 않음)
- A/B 테스트 (자동 분기/자동 승자 선정 없음)

## 다음 단계 제안

- metrics 입력값 수정/삭제 기능(현재는 이력 누적만 가능)
- 플랫폼/문체별 성과 비교를 그래프로 보여주는 대시보드
- `social_post_metrics.raw_metrics`(예비 JSON 컬럼)를 활용한 플랫폼별
  세부 지표 확장
- 실제 API 연동 시 이 manual input 구조를 자동 수집 구조와 병행 운영
  하는 방안 검토(예: `recorded_by='api'`로 구분)

## Supabase 확인 SQL

```sql
-- metrics 이력 확인
select
  id,
  social_post_id,
  article_id,
  platform,
  measured_at,
  views,
  impressions,
  likes,
  comments,
  shares,
  saves,
  clicks,
  engagement_rate,
  click_through_rate,
  performance_score,
  created_at
from social_post_metrics
order by created_at desc
limit 20;

-- social_posts latest metrics 확인
select
  id,
  article_id,
  platform,
  tone_style,
  manual_post_status,
  publish_status,
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
order by updated_at desc
limit 20;

-- pipeline logs 확인
select
  event_name,
  status,
  message,
  details_json,
  created_at
from pipeline_logs
where event_name like 'social_metrics_%'
order by created_at desc
limit 50;
```
