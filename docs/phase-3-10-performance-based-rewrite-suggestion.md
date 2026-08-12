# Phase 3-10: Performance-based Rewrite Suggestion

## 목적

Phase 3-9에서 기록한 `social_post_metrics`/`social_posts.latest_*` 성과
데이터를 바탕으로, 성과가 낮은(또는 낮지 않더라도 더 개선하고 싶은)
social post에 대해 제목/도입부/문체/CTA/해시태그/스레드 구성/카드뉴스
문구 개선 제안을 생성한다. 실제 글 자동 덮어쓰기, 자동 재게시, 실제
플랫폼 API 게시, 자동 A/B 테스트는 이 단계에서 하지 않는다.

## Phase 3-9와의 관계

Phase 3-9가 "성과를 기록"했다면, Phase 3-10은 "그 기록을 바탕으로 무엇을
바꾸면 좋을지 제안"한다. 제안은 `social_post_rewrite_suggestions`라는
완전히 별도의 테이블에만 저장되며, 기존 `social_posts`의 `post_body`/
`caption`/`thread_items`/`card_items`는 **이 단계의 어떤 함수도 수정하지
않는다**. 승인(`approved`)된 제안이라도 실제로 본문에 반영하는 기능은
아직 구현하지 않았다("제안 적용"은 다음 단계로 명시적으로 미룸).

## 성과 기반 개선 제안이 필요한 이유

Phase 3-9까지의 파이프라인은 "무엇이 얼마나 반응이 좋았는지"만
기록한다. 이 데이터를 실제로 활용하려면 "그래서 다음엔 뭘 어떻게
바꿔야 하는지"에 대한 판단이 필요한데, 이를 사람이 매번 처음부터
분석하는 대신 시스템이 1차 진단과 제안 초안을 만들어주면 검토 시간을
줄일 수 있다.

## social_post_rewrite_suggestions 테이블 구조

`social_post_id`/`article_id`/`platform`/`tone_style` 참조 정보,
`original_performance_status`/`original_performance_score`(제안 생성
시점의 성과 스냅샷), `suggestion_status`(draft/ready/needs_review/
approved/rejected/applied/blocked/failed), `diagnosis`(진단 결과 JSON),
`suggested_changes`(개선 대상/전략 요약 JSON), 플랫폼별 제안 필드
(`suggested_title`/`suggested_hook`/`suggested_body_outline`/
`suggested_cta`/`suggested_hashtags`/`suggested_thread_items`/
`suggested_card_items`/`suggested_tone_style`), `risk_notes`/
`quality_notes`(경고·참고사항 배열), `expected_improvement_reason`,
생성/검토 메타데이터(`generated_by`/`generated_at`/`reviewed_by`/
`reviewed_at`/`applied_at`/`rejected_reason`)로 구성된다.

`social_posts`에는 요약 컬럼(`latest_rewrite_suggestion_id`,
`rewrite_suggestion_status`, `rewrite_suggestion_count`,
`latest_rewrite_suggested_at`)만 추가해 매번 이력 테이블을 조인하지
않고도 최신 상태를 바로 볼 수 있게 했다.

## diagnosis 구조

`lib/social/performance-rewrite-diagnosis-service.ts`의
`diagnoseSocialPostPerformance(socialPostId)`가 담당한다.

- social post와 최신 metrics(`getLatestMetricsBySocialPost`)를 조회
- metrics가 있으면: 조회수/노출 부족, engagement 부족(2% 미만),
  clicks/comments/shares·saves 부족을 진단
- metrics가 **없으면**: `status='needs_review'`로 처리한다(spec 원칙:
  "metrics가 전혀 없으면 blocked가 아니라 needs_review로 처리") —
  `improvementTargets`에 `metrics_missing`만 추가하고, 구조적 진단
  (hook/CTA/해시태그/플랫폼 적합성 등)은 metrics 유무와 무관하게
  계속 진행한다
- 구조적 진단: 플랫폼 필수 필드 존재 여부, 문체별 금지 표현(tone
  mismatch), hook 약함, CTA 약함, 해시태그 부족/과다, X thread 구조
  (3~7개 권장), Instagram caption 길이/card_items 존재, 게시 URL 존재
  여부
- `manual_post_status!='posted'`/`publish_status!='published'`이면
  warning(차단하지 않음)
- platform/tone_style이 유효하지 않은 경우에만 `status='blocked'`

## 플랫폼별 rewrite strategy

`lib/social/platform-rewrite-strategies.ts`의
`getPlatformRewriteStrategy(platform)`이 플랫폼별 개선 가이드 문자열
목록을 반환한다(wordpress_blog: title/excerpt/첫문단/SEO keyword/CTA/
내부링크, naver_blog: 검색형 제목/소제목 구조/키워드 반복 줄이기/AI티
완화/태그, naver_cafe: 광고성 문구 줄이기/질문형 마무리/공감 문장/토론
유도/링크 의존도, x: hook 강화/thread 재구성/item 짧게/CTA/해시태그
축소/과장 클릭유도 금지, threads: 대화형 강화/첫 문장 짧게/질문형
마무리/해시태그 축소, instagram: caption 첫 줄/카드뉴스 문구/부드러운
저장·공유 유도/해시태그 정리/이미지 필요성 명확화).

## 문체별 rewrite strategy

`lib/social/tone-rewrite-strategies.ts`의
`getToneRewriteStrategy(toneStyle)`이 8개 문체별 개선 방향을 반환한다.
`warning`은 "위험을 설명하되 위협하지 않기", `loss_aversion`은 "과장
손실 표현 제거"를 명시적으로 포함해 협박형으로 흐르지 않도록 한다.
협박형(threat) 문체는 애초에 `ToneStyle` 타입에 존재하지 않는다.

## AI rewrite와 rule-based suggestion의 차이

| 항목 | rule-based/mock (기본값) | AI 기반(다음 단계 예정) |
|---|---|---|
| 생성 방식 | 진단 결과 + 전략 문자열을 결정론적으로 조합 | Claude API 호출(`prompts/social-rewrite/*.md` 참고) |
| `generated_by` | `"mock"` | `"ai"` |
| 실제 API 호출 | 없음 | 있음(다음 단계에서 연결) |
| 이번 단계 구현 여부 | ✅ 구현됨 | ❌ 아직 미구현(설정값과 prompt 문서만 준비) |

## SOCIAL_REWRITE_AI_ENABLED 설명

```bash
SOCIAL_REWRITE_AI_ENABLED=false   # 기본값. rule-based/mock 제안만 생성.
SOCIAL_REWRITE_AI_MODEL=claude-sonnet-4-5
SOCIAL_REWRITE_AI_MAX_TOKENS=2000
SOCIAL_REWRITE_AI_TEMPERATURE=0.6
```

`true`로 바꿔도 이번 단계는 실제 Claude API를 호출하지 않는다 —
`generated_by` 필드만 `"ai"`로 표시되고 내부 생성 로직은 여전히
rule-based다. 실제 AI 연동은 이후 단계에서 `prompts/social-rewrite/`
문서를 참고해 구현할 예정이다.

## 제안은 자동 적용되지 않는다는 점

`suggestion_status`가 `approved`가 되어도 `social_posts`의 본문 필드는
바뀌지 않는다. UI의 "제안 적용" 버튼은 의도적으로 비활성화되어 있으며
"다음 단계에서 구현"이라고 표시한다. 이는 성과 기반 제안이 항상 사람의
최종 검토를 거쳐야 한다는 프로젝트 원칙을 지키기 위함이다.

## 협박/공포 조장 금지 원칙

`rewrite-suggestion-validator.ts`가 협박/공포조장/광고클릭유도/과장
수익 표현을 재검사해 발견되면 `blocked` 처리한다. 성과가 낮다고 해서
더 자극적이거나 위협적인 문구를 만들지 않는다 — mock 생성기 자체가
`applyToneTransform()`(Phase 3-3에서 이미 "협박 없음"이 검증된 함수)을
재사용하므로 구조적으로도 협박형 문구가 생성되지 않는다.

## 로그 보안 원칙

`pipeline_logs.details_json`에는 socialPostId/articleId/platform/
toneStyle/performanceStatus/performanceScore/metricsRecordedAt/
suggestionStatus/improvementTargetCount/warningCount/blockedCount/
hasSuggestedTitle/hasSuggestedHook/hasSuggestedCta(불리언만)/
hashtagCount/threadItemCount/cardItemCount/reasonCode **만** 저장한다.
full original post_body/full caption/full export text/**full suggested
rewrite text**/full prompt/API key/auth token/Authorization header/
Application Password/image binary는 **어디에도** 저장하지 않는다.

## 아직 하지 않는 것

- 실제 글 자동 덮어쓰기 (제안은 별도 테이블에만 저장)
- 자동 재게시
- 실제 네이버/X/Threads/Instagram API 게시
- 자동 A/B 테스트
- 자동 성과 수집 (Phase 3-9와 동일하게 수동 입력 유지)
- 자동 이미지 생성
- 기존 publish workflow 변경

## 다음 단계 제안

- 승인된 제안을 실제로 social post에 반영("제안 적용")하는 기능 —
  반영 시 반드시 `revision_count` 증가와 `quality_status`/
  `approval_status` 초기화(Phase 3-4 편집 규칙)를 함께 적용해야 함
- `SOCIAL_REWRITE_AI_ENABLED=true`일 때 실제 Claude API 연동
  (`prompts/social-rewrite/*.md` 활용)
- 제안 이력을 비교하는 "before/after" diff UI
- 제안이 실제로 성과를 개선했는지 추적하는 피드백 루프(적용 후 metrics
  재입력과 연결)

## Supabase 확인 SQL

```sql
-- rewrite suggestions 확인
select
  id,
  social_post_id,
  article_id,
  platform,
  tone_style,
  original_performance_status,
  original_performance_score,
  suggestion_status,
  suggested_title,
  suggested_hook,
  suggested_cta,
  suggested_tone_style,
  generated_at,
  created_at
from social_post_rewrite_suggestions
order by created_at desc
limit 20;

-- social_posts rewrite summary 확인
select
  id,
  article_id,
  platform,
  tone_style,
  performance_status,
  latest_performance_score,
  rewrite_suggestion_status,
  rewrite_suggestion_count,
  latest_rewrite_suggestion_id,
  latest_rewrite_suggested_at,
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
where event_name like 'social_rewrite_%'
order by created_at desc
limit 50;
```
