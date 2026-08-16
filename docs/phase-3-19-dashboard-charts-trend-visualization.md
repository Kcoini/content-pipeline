# Phase 3-19: Dashboard Charts & Trend Visualization

## 목적

Phase 3-15에서 만든 Social Performance Dashboard와 Phase 3-16~3-18에서
정리한 페이지 구조(overview/blog/social/rewrite/performance 분리,
returnTo/deep link, `/social-posts/[id]` 상세, pagination) 위에, 표와
숫자로만 보던 성과 데이터를 플랫폼별·문체별·시간별·rewrite 비교
관점에서 한눈에 볼 수 있는 **읽기 전용 차트**를 추가했다. 이번 단계는
새 데이터를 계산하지 않는다 — 이미 Phase 3-9~3-15가 만든 집계 결과를
차트가 읽기 좋은 모양으로 다시 묶을 뿐이다.

## Phase 3-15와의 관계

차트 데이터는 새 SQL이나 새 집계 로직 없이 Phase 3-15
`social-performance-dashboard-repository.ts`의 select-only 함수(
`listSocialPostsForDashboard`, `listPlatformPerformanceSummaries`,
`listTonePerformanceSummaries`, `listRecentMetrics`,
`listRewritePerformanceSummaries`)를 그대로 재사용한다.
`social-performance-chart-repository.ts`는 이 함수들을 차트 용도
이름으로 다시 노출하는 얇은 위임(delegate) 계층일 뿐이며, 자체 SQL을
작성하지 않았다. **performance_score 계산 방식, engagement_rate 계산
방식, low performance 임계값(40점) 등 Phase 3-9~3-15의 어떤 계산도
바꾸지 않았다.**

## Phase 3-16~3-18 이후 차트가 필요한 이유

Phase 3-16~3-18을 거치며 화면은 목적별로 잘 나뉘었지만(overview/blog/
social/rewrite/performance, `/social-posts/[id]`, pagination), 성과를
"비교"하는 작업은 여전히 표를 눈으로 훑으며 해야 했다. 플랫폼 6개,
tone_style 여러 개, 월별 추세, rewrite 비교 결과처럼 항목 수가 늘어날
수록 표만으로는 "어디가 잘 되고 있는지"를 파악하기 어려워진다. 차트는
같은 데이터를 다른 표현으로 보여줄 뿐 새 판단 기준을 추가하지 않는다.

## 추가한 차트 목록

1. Platform Performance Chart — 플랫폼별 평균 performance_score
2. Tone Performance Chart — tone_style별 평균 performance_score
3. Metrics Trend Chart — 월별/일별 views·clicks·performance_score 추세
4. Rewrite Comparison Chart — rewrite_won/original_won/similar/
   needs_more_data 분포
5. Low Performance Chart — performance_status 6종 분포
6. Metrics Missing Chart — metrics 측정 완료 vs 미입력 비율

### Platform Performance Chart

`components/social-performance-dashboard/charts/platform-performance-chart.tsx`.
`listPlatformChartRows()`(Phase 3-15 `listPlatformPerformanceSummaries`)
결과를 platform별 bar 하나로 그린다. bar 길이는 이 필터 내 최고
평균 점수를 100%로 정규화(`normalizeChartValue`)한 상대값이다. 점수
옆에 measured 개수를 함께 표시해 표본이 적은 플랫폼을 과대해석하지
않도록 한다.

### Tone Performance Chart

`tone-performance-chart.tsx`. Platform Performance Chart와 같은
구조를 tone_style 기준으로 반복한다. `TonePerformanceSummary`에는
`metricsMeasuredCount`가 없어 `postCount`(Phase 3-15 집계)를
measuredCount로 대신 표시한다.

### Metrics Trend Chart

`metrics-trend-chart.tsx`. line chart 대신 스펙이 허용한 "trend
table + simple bar sparkline" 형태로 구현했다 — 각 행이 기간(월 또는
일)이고 views는 작은 bar + 숫자, clicks/likes/comments/shares는
숫자, performance_score 평균을 함께 보여준다. `buildMetricsTrendChart()`
(`social-performance-chart-service.ts`)가 `measuredAt`을 "YYYY-MM"으로
잘라 월별로 묶고, 서로 다른 달이 1개뿐이면(짧은 기간에 데이터가
몰려있으면) "YYYY-MM-DD" 일별로 다시 묶는다. 데이터 원본은 Phase
3-15와 같은 `listRecentMetrics`(최대 20건)이라 **정확한 실시간
분석이 아니라 dashboard summary용 추세**다 — 최근 입력된 20건 안에서만
집계된다.

### Rewrite Comparison Chart

`rewrite-comparison-chart.tsx`. `listRewritePerformanceComparisonsForChart()`
(Phase 3-15 `listRewritePerformanceSummaries`, 20건 제한 없이 전체
비교 결과 기준)의 4개 카운트를 bar로 그린다. "동일 조건의 A/B
테스트가 아니므로 참고 지표로만 사용하세요" 문구를 차트 하단에 항상
표시한다.

### Low Performance Chart

`low-performance-chart.tsx`. `listSocialPostsForChart()`로 조회한
social_post 목록을 `performance_status`(low/needs_review/not_measured/
average/good/excellent) 6종으로 나눠 개수를 bar로 그린다 — Phase
3-15의 `lowPerformancePosts`(low/needs_review만 필터링된 목록)와
달리, 이 차트는 **전체 분포**를 보여주는 것이 목적이라 6종을 모두
집계한다.

### Metrics Missing Chart

`metrics-missing-chart.tsx`. 같은 social_post 목록에서
`latest_metrics_recorded_at`이 있는지 없는지로 measured/missing 2개
bar와 측정 비율(%)을 보여준다.

## filter 연동 방식

`lib/social/social-performance-chart-types.ts`의 `DashboardChartFilter`
(articleId/platform/toneStyle/dateFrom/dateTo/includeRewriteVersions/
onlyPublished/onlyMeasured)를 서비스 내부에서 기존 `DashboardFilter`
(Phase 3-15)로 변환해 repository를 호출한다.

- `/dashboard/social-performance`: 기존 `DashboardFilterControls`
  폼에 `dateFrom`/`dateTo`(날짜 입력, 기존 `DashboardFilter`에 이미
  있던 필드라 테이블에도 함께 적용됨)와 `onlyPublished`/`onlyMeasured`
  (차트 전용, 새 체크박스)를 추가했다 — 같은 필터 폼 하나로 표와
  차트가 함께 갱신된다. `onlyPublished`/`onlyMeasured`는
  `DashboardFilter`에 없는 필드라 테이블 조회(`buildSocialPerformanceDashboard`)
  에는 전달되지 않는다 — 기존 table filter 동작은 그대로다.
- `/articles/[id]/performance`: `articleId`와
  `includeRewriteVersions=true`(기존 이 페이지의 정책과 동일)로 항상
  이 기사 소속 social_post만 필터링해 차트를 그린다. 별도 필터 UI는
  없다.
- platform/toneStyle 필터는 `listPlatformChartRows`/`listToneChartRows`
  호출 전에 이미 적용되므로, 예를 들어 platform=x로 필터링하면 Platform
  Performance Chart는 x 하나만(또는 필터링 결과가 없으면 empty state)
  보여준다.

## empty state 정책

`chart-empty-state.tsx`(`ChartEmptyState`)가 모든 차트 컴포넌트의
데이터 없음 상태를 담당한다.

- metrics 관련 차트(platform/tone/trend/low-performance/
  metrics-missing) 데이터가 없으면: "아직 metrics가 입력되지
  않았습니다. 수동 게시 후 metrics를 입력하면 차트가 표시됩니다."
- rewrite comparison 차트 데이터가 없으면: "rewrite comparison
  데이터가 없습니다. 성과 비교를 실행하면 rewrite chart가
  표시됩니다."

필터를 적용해 결과가 0건이 되는 경우도 "원본 데이터가 아예 없는
경우"와 동일하게 처리한다 — 별도의 "필터 결과 없음" 문구를 추가하지
않고 같은 empty state를 재사용한다(문구 자체가 필터 유무와 무관하게
성립하도록 작성했다).

## 수동 metrics 기반이라는 한계

세 화면(전체 dashboard, article-level 차트) 모두 "metrics는 외부
API가 아니라 수동 입력값입니다"라는 문구를 안내 배너에 유지한다
(Phase 3-9~3-15부터 있던 문구, 이번 단계에서 지우지 않았다). Metrics
Trend Chart는 추가로 "실시간 분석이 아니라 dashboard summary용
추세입니다"를 `ChartSection`의 `note`로 표시한다.

## A/B 테스트가 아니라는 한계

Rewrite Comparison Chart는 컴포넌트 내부에 "동일 조건의 A/B 테스트가
아니므로 참고 지표로만 사용하세요"를 항상 출력하고, `ChartSection`의
`note`로도 "동일 조건의 A/B 테스트가 아닙니다"를 한 번 더 보여준다.

## 아직 하지 않는 것

- 자동 metrics 수집(여전히 사람이 직접 입력해야 한다)
- 실시간 분석(모든 차트는 조회 시점 스냅샷이다)
- 외부 Analytics API 연결
- 자동 rewrite 실행
- 자동 게시
- A/B 테스트 실행
- 광고 수익 자동 계산
- 새 차트 라이브러리 도입(HTML/CSS bar chart + trend table만 사용)
- DB 구조 변경

## 다음 단계 제안

- Metrics Trend Chart를 20건 제한 없이 article/전체 기간 전체를 볼 수
  있는 전용 조회로 확장(현재는 Phase 3-15 `listRecentMetrics`의 20건
  상한을 그대로 따른다)
- 차트에 CSV/이미지 내보내기
- Low Performance/Metrics Missing 차트를 클릭하면 해당 필터가 적용된
  테이블로 스크롤/이동하는 연동
- article-level 차트에서 사용된 rewrite version이 1~2개뿐일 때 차트
  대신 요약 카드로 자동 전환하는 로직(현재는 bar chart가 항목이
  적어도 그대로 렌더링된다 — 값이 0~1개여도 깨지지는 않지만 아직
  "1~2개면 summary card로 전환"까지는 구현하지 않았다)

## 확인 방법

1. `/dashboard/social-performance` 접속
2. Summary cards 아래 "Chart Overview" 섹션 확인
3. Platform Performance Chart(플랫폼별 bar) 확인
4. Tone Performance Chart(접힌 상태로 시작 — 펼쳐서 확인)
5. Metrics Trend Chart(월별/일별 표 + views bar) 확인
6. Rewrite Comparison Chart(4개 bar + A/B 테스트 아님 안내) 확인
7. Low Performance Chart(접힌 상태, 펼쳐서 6개 상태 분포 확인)
8. Metrics Missing Chart(접힌 상태, 펼쳐서 측정/미입력 비율 확인)
9. 필터(플랫폼/tone_style/날짜/게시 완료만/측정된 글만)를 바꿔
   "적용" 클릭 → 차트 데이터가 함께 바뀌는지 확인
10. platform 필터를 metrics가 없는 값으로 좁혀 empty state 문구 확인
11. `/articles/[id]/performance` 접속 → Summary cards 아래 이 기사
    전용 Chart Overview(Platform/Tone/Trend/Rewrite Comparison) 확인
