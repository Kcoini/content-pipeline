# Phase 3-12: Rewrite Version Quality Recheck & Comparison

## 목적

Phase 3-11에서 생성된 rewrite version `social_posts`를 원본과 비교하고,
새 버전의 품질을 재검사해 어느 버전이 더 나은지 판단할 수 있는 보조
지표를 제공한다. 실제 재게시, 자동 A/B 테스트, 자동 성과 수집, 자동
원본 교체는 이 단계에서 하지 않는다 — 비교 결과는 사람이 최종 판단하기
위한 참고 자료일 뿐이다.

## Phase 3-11과의 관계

Phase 3-11이 "새 버전을 만드는" 단계였다면, Phase 3-12는 "그 새 버전이
원본보다 나은지 판단을 돕는" 단계다. 새 버전은 `quality_status=
'not_checked'` 상태로 시작하므로(Phase 3-11 원칙), 의미 있는 비교를
하려면 먼저 quality gate를 다시 실행해야 한다 — 이 단계의 quality
recheck 서비스가 그 역할을 한다.

## rewrite version quality recheck가 필요한 이유

Phase 3-4에서 이미 quality gate 재실행 기능이 있지만, rewrite version은
"성과가 낮아서 다시 쓴 글"이라는 맥락이 있으므로 별도의 진입점
(`recheckRewriteVersionQuality`)을 두어 로그 이벤트와 의도를 명확히
구분했다. 내부적으로는 동일한 `runSocialPostQualityGate()`를 재사용한다.

## 원본과 rewrite version을 비교하는 이유

quality_score 하나만으로는 "실제로 게시할 가치가 있는지" 판단하기
어렵다. 원본이 이미 게시되어 실제 성과(조회수/좋아요 등)가 있는
경우와, rewrite version이 아직 게시 전이라 quality 데이터만 있는
경우를 함께 놓고 봐야 사람이 더 나은 판단을 할 수 있다.

## social_post_version_comparisons 테이블 구조

한 번의 비교마다 새 row를 남긴다(이력 누적). 원본/rewrite 각각의
`quality_status`/`quality_score`/`performance_status`/`performance_score`
스냅샷, 플랫폼, 버전 번호, 비교 결과(`comparison_status`,
`comparison_score`, `recommended_social_post_id`,
`recommendation_reason`), 상세 근거(`checklist`/`warnings`/`failures`)
를 저장한다.

## comparison_status 설명

- `not_compared`: 아직 비교하지 않음(기본값)
- `original_better`: 원본이 더 낫다고 판단됨
- `rewrite_better`: rewrite version이 더 낫다고 판단됨
- `similar`: 품질 차이가 크지 않음(quality_score 차이 10점 미만)
- `needs_review`: 판단 근거(quality gate 미실행 등)가 부족함
- `blocked`: rewrite version에서 금지 표현 등 심각한 문제가 발견됨
- `failed`: 비교 실행 자체가 예외로 실패함

결정 로직(`lib/social/rewrite-version-comparison-rules.ts`의
`decideRecommendedVersion()`)은 다음 우선순위로 판단한다: (1) 금지
표현/심각한 문제 → `blocked`, (2) 어느 한쪽이라도 quality gate 미실행
→ `needs_review`, (3) rewrite가 blocked → `original_better`, (4) 한쪽만
`ready` → 그쪽이 더 나음, (5) 둘 다 quality_score가 있으면 10점 이상
차이로 판단, 아니면 `similar`, (6) 점수 데이터가 부족하면 `needs_review`.

## recommended_for_repost 의미

`recommended_for_repost=true`는 **"이 rewrite version이 원본보다 나아
보이니 재게시를 고려해볼 만하다"**는 뜻일 뿐이다. `comparison_status=
'rewrite_better'`이고 rewrite의 `quality_status='ready'`일 때만
true가 된다. 이 값이 true여도 **어떤 자동 게시도 일어나지 않는다** —
Phase 3-4~3-8의 approval/export/guard/handoff/manual posting을 모두
다시 사람이 진행해야 한다.

## performance data가 없는 경우의 처리

rewrite version은 아직 게시되지 않았을 가능성이 높으므로
`performance_status='not_measured'`인 경우가 흔하다. 이 경우 비교를
차단하지 않고 **quality 데이터 중심**으로 판단한다
(`decideRecommendedVersion()`이 quality_status/quality_score만으로도
결론을 낼 수 있도록 설계됨). performance 데이터는 있으면 비교
결과에 함께 기록되지만(원본/rewrite 스냅샷), 현재 버전의 결정 로직에서
직접 가중치로 사용하지는 않는다 — 원본이 게시된 지 얼마 안 됐거나
rewrite가 아직 게시 전인 상태에서 성과 데이터로 직접 비교하면
오해를 부를 수 있기 때문이다.

## 플랫폼별 비교 기준

`lib/social/rewrite-version-comparison-rules.ts`의 `compareStructure()`가
담당한다.

| 플랫폼 | 비교 항목 |
|---|---|
| x | thread item 개수(3~7개 권장), 각 item 길이(280자 이내) |
| instagram | caption 존재, hashtags 존재, card_items 존재, media_requirements.requiresImage 명시 |
| naver_cafe | 질문형/토론형 문장 존재 |
| naver_blog | 검색형 제목(10자 이상), 키워드 과다 반복 여부 |
| wordpress_blog | title/body 존재, excerpt 존재, 본문 길이 적정성 |

이 외에 모든 플랫폼 공통으로 `compareToneFit()`이 금지 표현(협박/공포
조장/광고클릭유도/과장수익)과 문체 정합성을 검사하고, `comparePlatformFit()`
이 `platform_publish_guard_status` 변화를 기록한다.

## 자동 게시하지 않는 이유

비교는 "품질 판단 보조용"이다. 아무리 `rewrite_better`로 판단되고
`recommended_for_repost=true`라도, 이 시스템은 성과를 완전히 예측할 수
없고, 플랫폼 정책·시기·맥락 등 사람만 알 수 있는 정보가 있다. 그래서
이 단계의 모든 함수는 `social_posts`의 비교 요약 컬럼만 갱신할 뿐,
`publish_status`나 `approval_status`를 절대 바꾸지 않는다.

## 로그 보안 원칙

`pipeline_logs.details_json`에는 articleId/rootSocialPostId/
originalSocialPostId/rewriteSocialPostId/platform/toneStyle/
originalVersionNumber/rewriteVersionNumber/originalQualityStatus/
originalQualityScore/rewriteQualityStatus/rewriteQualityScore/
originalPerformanceStatus/originalPerformanceScore/
rewritePerformanceStatus/rewritePerformanceScore/comparisonStatus/
comparisonScore/recommendedSocialPostId/recommendedForRepost/
warningCount/failureCount/blockedCount/reasonCode **만** 저장한다.
full original post_body/full rewrite post_body/full caption/full
thread_items text/full card_items text/full export text/API key/auth
token/Authorization header/Application Password/image binary는
**어디에도** 저장하지 않는다.

## 아직 하지 않는 것

- 실제 플랫폼 재게시
- 실제 API 게시
- 자동 A/B 테스트
- 자동 성과 수집
- 자동으로 원본을 대체
- 자동 public publish
- 기존 게시글 수정

## 다음 단계 제안

- `listRewriteVersionsNeedingComparison()`/`listRecommendedRewriteVersions()`
  를 활용한 "비교 필요/재게시 후보" 대시보드
- performance 데이터가 쌓인 뒤(둘 다 게시되고 일정 기간 지난 뒤) 성과
  기준 재비교를 제안하는 기능
- 여러 rewrite version이 있을 때(v2, v3, ...) 전체 계보를 한 번에
  비교하는 다자間 비교
- 비교 근거(checklist)를 사람이 직접 조정/재검토할 수 있는 UI

## Supabase 확인 SQL

```sql
-- version comparison 확인
select
  id,
  article_id,
  root_social_post_id,
  original_social_post_id,
  rewrite_social_post_id,
  platform,
  original_version_number,
  rewrite_version_number,
  original_quality_status,
  original_quality_score,
  rewrite_quality_status,
  rewrite_quality_score,
  comparison_status,
  comparison_score,
  recommended_social_post_id,
  compared_at,
  created_at
from social_post_version_comparisons
order by created_at desc
limit 20;

-- social_posts comparison summary 확인
select
  id,
  article_id,
  platform,
  tone_style,
  parent_social_post_id,
  root_social_post_id,
  version_number,
  is_rewrite_version,
  quality_status,
  quality_score,
  performance_status,
  latest_performance_score,
  version_comparison_status,
  version_comparison_score,
  recommended_for_repost,
  latest_version_comparison_id,
  version_comparison_checked_at,
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
where event_name like 'social_rewrite_version_%'
order by created_at desc
limit 50;
```
