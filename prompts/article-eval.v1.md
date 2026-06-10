# 기사 품질 평가 프롬프트 (v1)

## 목적
`contracts/article.contract.yaml`을 통과한 기사 초안의 품질을 평가한다.
`prompts/eval-article.prompt.md`를 대체하는 v1 버전이며,
`evals/article-quality.eval.yaml`의 평가 기준을 그대로 사용하되 평가 항목을
다음 6가지 관점으로 명시한다.

이 프롬프트는 `lib/ai/eval-article.ts`의 `evaluateArticleWithAi`
(Phase 1-3 이후 구현)에서 사용된다.

## 평가 기준
1. **출처 기반성 (factual-grounding)**: 기사의 주요 주장이 인용된 출처
   요약(source summaries)으로 뒷받침되는가
2. **사실/의견 구분 (fact-opinion-separation)**: 사실(fact)과 의견(opinion)이
   명확히 구분되어 서술되는가
3. **과장 표현 여부 (exaggeration-check)**: 클릭베이트성 과장 표현이나
   근거 없는 단정적 표현이 없는가
4. **출처 없는 수치 여부 (unsourced-numbers-check)**: 출처에 없는 통계, 날짜,
   고유명사가 새로 추가되지 않았는가
5. **기사 구조 (structure)**: 도입-본문-결론 구조를 갖추고 있는가
6. **독자 이해도 (readability)**: 문장이 명확하고 가독성이 좋은가

## 입력 변수
- `{{theme.title}}`: 기사 주제
- `{{article.title}}`: 평가 대상 기사 제목
- `{{article.content}}`: 평가 대상 기사 본문
- `{{sourceSummaries}}`: 기사가 인용한 출처 요약 목록 (sourceId, title, url, summary)

## 시스템 프롬프트 (초안)
```
당신은 콘텐츠 품질 평가자입니다.
아래 기사를 위 6가지 평가 기준에 따라 1~5점으로 채점하세요.

규칙:
1. 각 기준에 대해 점수(score, 1~5 정수)와 근거(reason)를 작성하세요.
2. factual-grounding, unsourced-numbers-check 기준은 반드시 제공된 출처
   요약(sourceSummaries)과 대조하여 평가하세요.
3. exaggeration-check, fact-opinion-separation 기준은 본문의 표현 방식을
   기준으로 평가하세요.
4. 출력은 반드시 아래 JSON 형식만 반환하세요. 그 외 텍스트는 출력하지 마세요.
```

## 사용자 프롬프트 (초안)
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
    "readability": { "score": 4, "reason": "..." }
  },
  "aggregate_score": 4.17,
  "passed": true,
  "notes": "전반적으로 출처를 잘 활용했으나 2번째 단락의 수치 출처가 불명확함"
}
```

## 후처리 (코드에서 수행)
- `aggregate_score`는 `evals/article-quality.eval.yaml`의 `weight`를 이용해
  `lib/ai/eval-article.ts`에서 재계산하여 검증한다 (모델 응답값을 그대로
  신뢰하지 않는다).
- `passed`는 `evals/article-quality.eval.yaml`의 `scoring.pass_threshold`와
  비교하여 코드에서 다시 판정한다.
- 결과는 `eval_runs` 테이블에 저장하고, 사용자 승인(human_review) 이전에
  참고 자료로 표시한다. 평가 미통과가 자동으로 기사를 차단하지는 않는다.
