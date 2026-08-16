# Phase 3-20: A/B Testing Draft Structure

## 목적

Phase 3-14(rewrite performance comparison)와 Phase 3-15~3-19(dashboard/
차트)가 만든 "원본 vs rewrite 성과 비교" 구조 위에, 실제 자동 A/B
테스트를 실행하기 전 단계로 **테스트 계획(draft)과 variant 구조**를
먼저 만든다. 이번 단계는 실행이 아니라 준비다 — 테스트 이름/가설/목적/
지표를 정하고, 비교할 social_post(variant)들을 묶어두는 것까지만
한다.

## Phase 3-14~3-19와의 관계

- Phase 3-14의 `social_rewrite_performance_comparisons`(원본 vs 특정
  rewrite 1건 비교)와 Phase 3-20의 `social_ab_tests`/
  `social_ab_test_variants`(계획 + N개 variant)는 서로 다른 목적의
  별도 테이블이다 — 기존 테이블/로직을 전혀 바꾸지 않았다.
  `createOriginalVsRewriteAbTest()`는 Phase 3-14 비교 결과가 아니라
  원본/rewrite social_post 자체를 control/variant_a로 묶어 A/B test
  draft를 만드는 별도 진입점이다("구조 재사용"은 rewrite 페이지의
  "원본↔rewrite" 관계를 그대로 가져와 쓴다는 뜻이다).
- Phase 3-15~3-19의 dashboard/차트가 계산하는 performance_score 등
  지표 계산 로직은 그대로 재사용한다 — `compareAbTestVariants()`는
  `social_post_metrics`에 이미 저장된 값을 읽어 비교할 뿐, 새로운
  점수 계산식을 도입하지 않았다.
- Phase 3-16~3-18의 article 하위 페이지 구조(overview/blog/social/
  rewrite/performance)에 6번째 탭 `/articles/[id]/ab-tests`가
  추가됐고, Phase 3-17의 returnTo/deep link, Phase 3-18의
  `/social-posts/[id]` 상세 페이지 구조를 그대로 재사용한다.

## A/B test draft 구조

```
social_ab_tests (테스트 계획 1건)
  └─ social_ab_test_variants (variant 여러 건, 각각 social_posts 1건을 가리킴)
```

draft를 만들어도 어떤 social_post도 새로 생성/게시되지 않는다 —
variant는 **이미 존재하는** social_post를 가리키는 참조일 뿐이다.
variant로 추가된 social_post는 여전히 blog/social 페이지의 승인/
export/handoff/manual posting 흐름을 그대로 거쳐야 게시된다 — 이
단계 어디에도 자동 게시 버튼은 없다.

## social_ab_tests 테이블 설명

`db/migrations/040_phase-3-20-ab-testing-draft-structure.sql`.
테스트 계획 한 건 — 이름/설명/가설/목적/primary_metric/
secondary_metrics/상태(test_status)/유형(test_type)/비교 방법
(comparison_method)/승자(winner_social_post_id, winner_reason)/
결과 요약(result_summary jsonb)/경고(warnings jsonb)를 담는다.
`root_social_post_id`는 "원본 vs rewrite" 유형일 때 원본 버전 체인의
root를 가리키는 선택 필드다.

## social_ab_test_variants 테이블 설명

variant 한 건 = A/B test 하나 + social_post 하나. `variant_label`
(사람이 읽는 이름), `variant_role`(control/variant_a/variant_b/
variant_c/candidate), `is_control`, `variant_status`, 그리고
`refreshAbTestVariantMetrics()`가 social_posts에서 복사해 오는
`manual_post_status`/`post_url`/`latest_performance_score`/
`latest_metrics_recorded_at`(스냅샷 — 원본을 다시 계산하지 않고
그대로 복사한다)를 갖는다. `(ab_test_id, social_post_id)`에 유니크
제약을 걸어 같은 social_post를 같은 테스트에 중복 추가할 수 없다.

social_posts 테이블에는 `ab_test_status`/`latest_ab_test_id`/
`ab_test_variant_role`/`ab_test_variant_label` 4개 컬럼만 추가했다 —
"이 글이 현재 어떤 A/B test에 속해 있는지" 요약만 저장하며, 실제
비교 데이터는 여전히 `social_ab_tests`/`social_ab_test_variants`에
있다.

## test_status 설명

`draft`(계획만 있음) → `ready`(variant 2개 이상, 시작 준비 완료) →
`running`(진행 중) ⇄ `paused`(일시정지) → `completed`(완료, 결과
있을 수 있음). `draft`/`ready`/`running`/`paused`에서 `cancelled`로
취소할 수 있다. `completed` 이후 비교 결과가 애매하면
`inconclusive`로 표시된다(자동으로 다시 `completed`로 되돌리지
않는다 — 사람이 판단할 몫이다). `blocked`/`failed`는 이번 단계
서비스 함수가 직접 세팅하지 않지만 스키마상 허용해 향후 검증 실패
케이스에 대비했다.

## test_type 설명

`manual`(기본, 자유 형식) / `original_vs_rewrite`(원본 vs rewrite
전용) / `title_test` / `hook_test` / `cta_test` / `tone_test` /
`platform_test` / `hashtag_test` — 무엇을 바꿔 비교하는지 분류만
한다. 분류값이 달라도 비교 로직은 동일하다(모두 primary_metric
기준).

## primary_metric 설명

`performance_score`(기본) / `views` / `impressions` /
`engagement_rate` / `click_through_rate` / `clicks` / `comments` /
`shares` / `saves` / `conversion_rate`. 값은 각 variant의
social_post에 대해 `getLatestMetricsBySocialPost()`로 조회한
`social_post_metrics`의 최신 값에서 가져온다(모두 사람이 수동
입력한 값). `secondary_metrics`는 draft에 함께 저장해두지만, 이번
단계의 승자 판정 로직은 primary_metric만 사용한다 — secondary는
사람이 참고하도록 남겨둔 것뿐, 자동 판단에 관여하지 않는다.

## original vs rewrite test 구조

`createOriginalVsRewriteAbTest(originalSocialPostId, rewriteSocialPostId, input?)`
가 한 번에: (1) `test_type='original_vs_rewrite'`,
`comparison_method='rewrite_performance_comparison'`인 draft 생성,
(2) 원본을 `variant_role='control'`(`is_control=true`)로 추가,
(3) rewrite를 `variant_role='variant_a'`로 추가한다. article_id/
platform이 다르거나 `is_rewrite_version=false`이거나 metrics가
없어도 draft 자체는 생성되며, 각 상황은 `warnings`로 안내된다 —
어떤 조건도 draft 생성을 막지 않는다("두 social_post 모두 수동
게시/metrics가 없어도 draft 생성 가능").

## variant 관리 방식

`addVariantToAbTest(abTestId, socialPostId, input)`가 검증하는 것:
social_post 존재 여부, `social_post.article_id === abTest.article_id`
(다르면 차단), 같은 social_post 중복 추가(차단). platform이 테스트
platform과 다르면 차단하지 않고 warning만 남긴다(정책 선택 — 완전히
막으면 cross-platform 비교 실험 자체를 못 만들게 되므로).
`markAbTestReady()`는 variant가 최소 2개 이상이어야 draft→ready
전환을 허용한다(의미 있는 비교를 위한 최소 조건).

## winner 결정 기준

`compareAbTestVariants(abTestId)`(읽기 전용, 아무것도 저장하지
않음)가 각 variant의 최신 `primary_metric` 값을 비교한다.

- 측정된 값이 2개 미만이면 → inconclusive("데이터 부족").
- `performance_score`는 **절대 점수 차이 10점 이상**이면 높은 쪽이
  winner.
- 그 외 지표(views/clicks/engagement_rate 등)는 1위 값 대비
  **상대 차이 10% 이상**이면 winner.
- 위 기준을 만족하지 못하면 → inconclusive("차이가 승자를 가릴
  만큼 크지 않음").

`decideAbTestWinner(abTestId)`는 `compareAbTestVariants()` 결과를
`social_ab_tests.winner_social_post_id`/`winner_reason`/
`result_summary`, 각 variant의 `variant_status`(winner/loser/
inconclusive)와 `result_rank`, 그리고 social_posts의
`ab_test_status`에 반영한다. **winner가 결정돼도 그 자체로는 아무
게시 액션도 발생시키지 않는다** — 실제로 그 버전을 다시 게시하고
싶으면 사람이 blog/social 페이지에서 직접 진행해야 한다.

## 수동 metrics 기반이라는 한계

모든 비교는 `social_post_metrics`에 사람이 입력한 값을 기반으로
한다. `refreshAbTestVariantMetrics()`도 외부 Analytics API를
호출하지 않고, 이미 `social_posts.latest_*`에 저장된 값을 variant
row로 복사할 뿐이다. UI(테스트 draft 안내 배너, 요약 카드)에 항상
"수동 입력된 metrics 기반"임을 표시한다.

## 동일 조건 A/B 테스트가 아닐 수 있다는 한계

같은 A/B test 안의 variant들이 같은 시간대/같은 독자층/같은 채널
알고리즘 조건에서 노출됐다는 보장이 없다 — 특히
`original_vs_rewrite` 유형은 원본과 rewrite가 서로 다른 시점에
게시됐을 가능성이 높다. `AbTestSummaryCard`와 페이지 상단 배너에
"동일 조건의 A/B 테스트가 아닐 수 있으며, 참고 지표로만 사용해야
한다"는 안내를 항상 표시한다.

## 자동 게시하지 않는다는 원칙

이 단계에서 만든 draft/action 어디에도 실제 플랫폼 게시 API 호출이
없다. `startAbTest()`는 `test_status`만 `running`으로 바꿀 뿐 아무
social_post도 게시하지 않으며, 각 variant는 여전히 기존 blog/social
페이지의 승인 → export → handoff → manual posting 흐름을 각자
거쳐야 한다. `decideAbTestWinner()`가 승자를 정해도 자동 재게시나
원본 교체는 절대 수행하지 않는다.

## 아직 하지 않는 것

- 실제 A/B 게시(플랫폼별 동시/순차 자동 게시)
- 자동 metrics 수집(외부 Analytics/Insights API 연동)
- 외부 API analytics 연동
- 자동 승자 반영(winner 결정 후 자동 재게시/원본 교체)
- 광고 실험 자동화
- 실시간 analytics
- DB 데이터 삭제
- 기존 WordPress publish workflow 변경

## 다음 단계 제안

- `social_ab_test_variants`에 3개 이상(variant_b/variant_c)을 UI
  폼에서 한 번에 추가하는 다중 variant 생성 흐름
- secondary_metrics를 승자 판정의 tie-breaker로 실제 반영(현재는
  참고용으로만 저장)
- A/B test 결과를 Phase 3-19 차트(rewrite comparison chart)에 함께
  표시
- `/social-posts/[id]` 상세 페이지에서 "A/B test에 추가"를 새 draft
  생성이 아니라 기존 draft에 바로 추가하는 선택 UI로 발전

## 확인 SQL

```sql
select
  id,
  article_id,
  platform,
  test_name,
  test_type,
  test_status,
  primary_metric,
  winner_social_post_id,
  created_at,
  updated_at
from social_ab_tests
order by created_at desc
limit 20;
```

```sql
select
  id,
  ab_test_id,
  article_id,
  social_post_id,
  variant_label,
  variant_role,
  platform,
  tone_style,
  manual_post_status,
  latest_performance_score,
  latest_metrics_recorded_at,
  variant_status,
  result_rank,
  created_at
from social_ab_test_variants
order by created_at desc
limit 50;
```

```sql
select
  id,
  article_id,
  platform,
  tone_style,
  ab_test_status,
  latest_ab_test_id,
  ab_test_variant_role,
  ab_test_variant_label,
  latest_performance_score,
  manual_post_status,
  updated_at
from social_posts
where ab_test_status != 'not_in_test'
order by updated_at desc
limit 50;
```

```sql
select
  event_name,
  status,
  message,
  details_json,
  created_at
from pipeline_logs
where event_name like 'social_ab_test_%'
order by created_at desc
limit 50;
```

## 확인 방법

1. `/articles/[id]/ab-tests` 접속 → article workflow navigation에
   "A/B Tests" 탭이 보이는지 확인
2. "A/B test draft 생성" 폼으로 draft 하나 생성 → 목록에 draft
   상태로 표시되는지 확인
3. "원본 vs Rewrite test 생성" 폼으로 원본+rewrite variant 2개가
   자동으로 채워진 draft 생성 확인
4. "ready로 변경" 클릭(variant 2개 미만이면 비활성화되는지 확인)
5. "running 시작" → "metrics 새로고침" → "variant 비교" 순서로
   실행해 winner/inconclusive 판정 확인
6. "완료 처리"/"취소" 버튼 동작 확인
7. `/articles/[id]/rewrite`의 재게시 추천 rewrite version 카드에서
   "A/B test draft 만들기 →" 링크 확인
8. `/articles/[id]/performance`에서 rewrite 비교 결과가 있으면
   "A/B test로 관리 →" 링크 확인
9. `/social-posts/[id]` 상세 페이지에서 "A/B Test" 섹션과 "A/B
   test에 추가/새로 만들기 →" 링크 확인
10. 위 확인 SQL로 `social_ab_tests`/`social_ab_test_variants`/
    `social_posts.ab_test_status`/`pipeline_logs`가 기대대로
    쌓이는지 확인
