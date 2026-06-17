# Phase 1-8: 기사 품질 개선 및 요약 복사 방지

> Phase 1-7에서 AI mode 검증 중 생성된 기사가 출처 요약을 거의 그대로
> 복사하거나 단순 나열하는 문제가 확인되었다. 이 단계에서는 기사 구조 강화,
> 평가 기준 확장, 품질 경고 흐름을 구현한다.

---

## 1. 목표

- 출처 요약을 단순 복사하지 않고 여러 출처를 비교·종합·해석해서 독립적인
  기사 구조로 작성하도록 프롬프트를 강화한다.
- AI Evals에 `originality`, `synthesis`, `copy-risk`, `source-integration`
  4가지 기준을 추가한다.
- 품질 미통과 시 `article_quality_warning` 로그를 남기고 UI에 경고를 표시한다.

---

## 2. 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `prompts/article-draft.v1.md` | 7개 섹션 구조 + 표절 방지 규칙 추가 |
| `prompts/article-eval.v1.md` | 10가지 평가 기준으로 확장 |
| `evals/article-quality.v1.eval.yaml` | 10개 기준, copy-risk/synthesis gate 추가 |
| `lib/ai/article-writer.ts` | ARTICLE_SYSTEM_PROMPT 강화, 입력 구조화 |
| `lib/ai/eval-article.ts` | EVAL_SYSTEM_PROMPT 10기준, gate 로직 추가 |
| `lib/repositories/log-repository.ts` | `article_quality_warning` 이벤트 타입 추가 |
| `app/dashboard/actions.ts` | eval 실패 시 quality_warning 로그 기록 |
| `app/articles/[id]/page.tsx` | passed=false 시 "품질 검토 필요" 배너 표시 |
| `lib/ai/prompts.test.ts` | 프롬프트 내용 검증 테스트 추가 |

---

## 3. 기사 생성 프롬프트 변경 (article-writer.ts)

### 필수 7개 섹션 구조
기사는 반드시 다음 섹션을 포함해야 한다:

1. **제목**: 주제를 명확하게 전달 (과장 금지)
2. **리드문**: 핵심 내용 요약 2~3문장
3. **배경**: 이 주제가 왜 지금 중요한지 맥락
4. **핵심 쟁점**: 출처들이 공통으로 다루는 문제/이슈
5. **출처 간 공통점과 차이점**: 여러 출처 비교·대조
6. **독자에게 중요한 의미**: 독자에게 이 정보가 왜 중요한지 해석
7. **향후 전망 또는 과제**: 출처에 근거한 전망

### 표절 방지 규칙
- 출처 요약 그대로 붙여넣기 금지
- 출처 요약과 15단어(어절) 이상 연속 동일 구문 금지
- 출처별 단순 나열 금지
- 최소 3개 이상 출처를 유기적으로 종합

### 입력 구조화
`buildArticleUserPrompt`에 `intendedAudience`와 `articleAngle`을 추가하여
AI가 독자 대상과 기사 관점을 인지하고 작성한다.

---

## 4. AI Evals 기준 확장

### 10가지 기준 (evals/article-quality.v1.eval.yaml)

| 기준 ID | 가중치 | 설명 |
|---------|--------|------|
| factual-grounding | 0.10 | 출처 기반성 |
| fact-opinion-separation | 0.05 | 사실/의견 구분 |
| exaggeration-check | 0.05 | 과장 표현 여부 |
| unsourced-numbers-check | 0.10 | 출처 없는 수치 |
| structure | 0.15 | 기사 구조 |
| readability | 0.05 | 가독성 |
| **originality** | **0.20** | 독창성 (신규) |
| **synthesis** | **0.20** | 종합성 (신규) |
| **source-integration** | **0.10** | 출처 통합도 (신규) |
| **copy-risk** | **0.00** | 복사 위험도 (gate only, 신규) |

### Gate 조건 (aggregate_score와 별도)
- `copy-risk score >= 4` → `passed=false` 강제
- `synthesis score < 2` → `passed=false` 강제

### passed 판정 순서 (lib/ai/eval-article.ts)
1. `aggregate_score < 3.0` → `false`
2. `copy-risk >= 4` → `false`
3. `synthesis < 2` → `false`
4. 그 외 → `true`

---

## 5. 품질 경고 흐름

```
evaluateArticleWithAi() → passed=false
  ↓
saveEvalRun()  (eval_runs에 저장, passed=false)
  ↓
logEvent(article_quality_warning, status=failed)  (pipeline_logs에 기록)
  ↓
/articles/[id] 에서 passed=false 배너 표시: "품질 검토 필요"
```

> 품질 미통과가 자동으로 기사를 차단하지는 않는다.
> 기사는 `draft` 상태로 저장되며, 최종 판단은 사람이 한다 (Human Approval).

---

## 6. Mock 모드 동작

`evaluateArticleMock`은 gate 조건을 트리거하지 않는 점수를 사용한다:
- `copy-risk`: 1점 (위험 없음)
- `synthesis`: 5점 (완벽한 종합)
- 그 외: 4점

---

## 7. 한계 및 다음 단계

### 현재 한계
- URL 본문 자동 수집 미구현: 출처 요약은 사용자가 직접 입력한 값에 의존한다.
  원문을 가져오지 않으므로 15단어 복사 판단은 요약 텍스트 기준이다.
- copy-risk는 AI가 주관적으로 판단한다. 실제 n-gram 일치 알고리즘은 구현하지 않는다.
- 사용자 인증 미구현: `reviewed_by='local-user'` 고정.

### 다음 단계 (Phase 2 이후)
- URL 본문 자동 수집 및 원문 기반 copy-risk 판단
- 기사 품질 기반 자동 재생성 옵션 (사용자 승인 하에)
- published 상태 전환 및 WordPress 게시

---

## 8. 검증 시나리오

1. AI mode에서 기사 생성 → `originality`, `synthesis`, `copy-risk`, `source-integration`
   점수가 eval 결과에 표시되는지 확인
2. copy-risk >= 4인 기사 → `/articles/[id]`에 "품질 검토 필요" 배너 표시 확인
3. 파이프라인 로그에 `article_quality_warning` 이벤트 기록 확인
4. passed=false여도 기사가 draft로 저장되고 승인 가능한지 확인
