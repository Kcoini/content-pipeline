# 기사 품질 평가 프롬프트 (v1 - Phase 1-8 강화)

## 목적
`contracts/article.contract.yaml`을 통과한 기사 초안의 품질을 평가한다.
`evals/article-quality.v1.eval.yaml`의 10가지 평가 기준을 사용하여 채점한다.

이 프롬프트는 `lib/ai/eval-article.ts`의 `evaluateArticleWithAi`에서 사용된다.

## 평가 기준 (10가지)

### 기존 기준 (가중치 조정)
1. **출처 기반성 (factual-grounding, 0.10)**: 기사의 주요 주장이 인용된 출처
   요약으로 뒷받침되는가. 출처에 없는 주장을 사실처럼 서술하면 낮은 점수.
2. **사실/의견 구분 (fact-opinion-separation, 0.05)**: 사실(fact)과 의견(opinion)이
   명확히 구분되어 서술되는가
3. **과장 표현 여부 (exaggeration-check, 0.05)**: 클릭베이트성 과장 표현이나
   근거 없는 단정적 표현이 없는가
4. **출처 없는 수치 여부 (unsourced-numbers-check, 0.10)**: 출처에 없는 통계, 날짜,
   고유명사가 새로 추가되지 않았는가
5. **기사 구조 (structure, 0.15)**: 리드문→배경→핵심 쟁점→비교/시사점→전망
   구조를 갖추고 있는가. 출처별 요약 나열에 그치면 낮은 점수.
6. **독자 이해도 (readability, 0.05)**: 문장이 명확하고 가독성이 좋은가

### Phase 1-8 신규 기준
7. **독창성 (originality, 0.20)**: 기사 문장이 출처 요약과 독립적으로 작성되었는가.
   출처 요약을 거의 그대로 복사했으면 1점, 완전히 재구성했으면 5점.
8. **종합성 (synthesis, 0.20)**: 여러 출처의 정보를 통합해 하나의 논지/흐름으로
   재구성했는가. 출처를 각각 나열하는 수준이면 1점, 유기적으로 통합했으면 5점.
9. **출처 통합도 (source-integration, 0.10)**: 본문에서 출처를 자연스럽게 언급하거나
   인용했는가 (단순 나열 금지). 출처가 기사 흐름 속에 녹아 있으면 높은 점수.
10. **복사 위험도 (copy-risk, gate only)**: 출처 요약과 15단어 이상 연속으로 동일한
    구문이 발견되는가. 점수가 높을수록 복사 위험이 높다 (1=위험 없음, 5=심각한 복사).
    **이 기준은 가중 평균에 포함하지 않으며, 점수 4 이상이면 passed=false 강제.**

## 입력 변수
- `{{theme.title}}`: 기사 주제
- `{{article.title}}`: 평가 대상 기사 제목
- `{{article.content}}`: 평가 대상 기사 본문
- `{{sourceSummaries}}`: 기사가 인용한 출처 요약 목록 (sourceId, title, url, summary)

## 시스템 프롬프트
```
당신은 콘텐츠 품질 평가자입니다.
아래 기사를 다음 10가지 평가 기준에 따라 1~5점으로 채점하세요.

【기존 기준】
1. factual-grounding: 기사의 주요 주장이 인용된 출처 요약으로 뒷받침되는가
   (출처에 없는 주장을 사실처럼 서술하면 낮은 점수)
2. fact-opinion-separation: 사실(fact)과 의견(opinion)이 명확히 구분되어 서술되는가
3. exaggeration-check: 클릭베이트성 과장 표현이나 근거 없는 단정적 표현이 없는가
4. unsourced-numbers-check: 출처에 없는 통계, 날짜, 고유명사가 새로 추가되지 않았는가
5. structure: 리드문→배경→핵심 쟁점→비교/시사점→전망 구조를 갖추고 있는가
   (출처별 요약 나열에 그치면 낮은 점수)
6. readability: 문장이 명확하고 가독성이 좋은가

【Phase 1-8 신규 기준】
7. originality: 기사 문장이 출처 요약과 독립적으로 작성되었는가
   (출처 요약을 거의 그대로 복사했으면 1점, 완전히 재구성했으면 5점)
8. synthesis: 여러 출처의 정보를 통합해 하나의 논지/흐름으로 재구성했는가
   (출처를 각각 나열하는 수준이면 1점, 유기적으로 통합했으면 5점)
9. source-integration: 본문에서 출처를 자연스럽게 언급하거나 인용했는가
   (단순 나열 금지, 기사 흐름 속에 녹아 있으면 높은 점수)
10. copy-risk: 출처 요약과 15단어 이상 연속으로 동일한 구문이 발견되는가
    (1=위험 없음, 5=심각한 복사 — 점수가 높을수록 위험)

규칙:
1. 각 기준에 대해 점수(score, 1~5 정수)와 근거(reason)를 작성하세요.
2. factual-grounding, unsourced-numbers-check 기준은 반드시 제공된 출처
   요약(sourceSummaries)과 대조하여 평가하세요.
3. originality, synthesis, copy-risk 기준은 기사 본문과 출처 요약을 직접 비교하여
   평가하세요. copy-risk 점수 산정 시 15단어 이상 연속 동일 구문이 있으면 4~5점을
   부여하세요.
4. 출력은 반드시 아래 JSON 형식만 반환하세요. 그 외 텍스트는 출력하지 마세요.

출력 형식:
{
  "criteria_scores": {
    "factual-grounding": { "score": 4, "reason": "..." },
    "fact-opinion-separation": { "score": 4, "reason": "..." },
    "exaggeration-check": { "score": 5, "reason": "..." },
    "unsourced-numbers-check": { "score": 4, "reason": "..." },
    "structure": { "score": 4, "reason": "..." },
    "readability": { "score": 4, "reason": "..." },
    "originality": { "score": 4, "reason": "..." },
    "synthesis": { "score": 4, "reason": "..." },
    "source-integration": { "score": 4, "reason": "..." },
    "copy-risk": { "score": 1, "reason": "..." }
  },
  "notes": "전반적인 평가 요약"
}
```

## 사용자 프롬프트
```
주제: {{theme.title}}

기사 제목: {{article.title}}
기사 본문:
{{article.content}}

인용된 출처 요약:
{{#each sourceSummaries}}
- sourceId: {{sourceId}}
  title: {{title}}
  url: {{url}}
  summary: {{summary}}
{{/each}}
```

## 출력 형식 (JSON)
```json
{
  "criteria_scores": {
    "factual-grounding": { "score": 4, "reason": "..." },
    "fact-opinion-separation": { "score": 4, "reason": "..." },
    "exaggeration-check": { "score": 5, "reason": "..." },
    "unsourced-numbers-check": { "score": 4, "reason": "..." },
    "structure": { "score": 4, "reason": "..." },
    "readability": { "score": 4, "reason": "..." },
    "originality": { "score": 4, "reason": "..." },
    "synthesis": { "score": 4, "reason": "..." },
    "source-integration": { "score": 4, "reason": "..." },
    "copy-risk": { "score": 1, "reason": "..." }
  },
  "notes": "전반적인 평가 요약"
}
```

## 후처리 (코드에서 수행)
- `aggregate_score`는 `evals/article-quality.v1.eval.yaml`의 `weight`를 이용해
  `lib/ai/eval-article.ts`에서 재계산한다 (copy-risk weight=0.00이므로 집계 제외).
- `passed`는 코드에서 다음 순서로 판정한다:
  1. `aggregate_score >= 3.0`이어야 한다.
  2. `copy-risk score >= 4`이면 `passed=false` 강제 (가중 평균과 무관).
  3. `synthesis score < 2`이면 `passed=false` 강제 (가중 평균과 무관).
- 결과는 `eval_runs` 테이블에 저장하고, 사용자 승인(human_review) 이전에
  참고 자료로 표시한다.
- `passed=false`이면 `pipeline_logs`에 `article_quality_warning` 이벤트를 기록한다.
  단, 이 경고가 자동으로 기사를 차단하지는 않는다 (최종 판단은 사람이 한다).
