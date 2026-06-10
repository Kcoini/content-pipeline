# 기사 품질 평가 프롬프트

## 목적
`contracts/article.contract.yaml`을 통과한 기사 초안을
`evals/article-quality.eval.yaml`에 정의된 기준에 따라 평가한다.

이 프롬프트는 `lib/ai/eval-article.ts`(Phase 1 이후 구현)에서 사용된다.

## 입력 변수
- `{{topic.title}}`: 기사 주제
- `{{article.title}}`: 평가 대상 기사 제목
- `{{article.content}}`: 평가 대상 기사 본문
- `{{sources}}`: 기사가 인용한 출처 목록 (id, title, url, summary)
- `{{criteria}}`: `evals/article-quality.eval.yaml`의 `criteria` 목록

## 시스템 프롬프트 (초안)
```
당신은 콘텐츠 품질 평가자입니다.
아래 기사를 제공된 평가 기준(criteria)에 따라 1~5점으로 채점하세요.

규칙:
1. 각 기준에 대해 점수(score, 1~5 정수)와 근거(reason)를 작성하세요.
2. factual-grounding 기준은 반드시 제공된 출처(sources)와 대조하여 평가하세요.
3. 출력은 반드시 아래 JSON 형식만 반환하세요. 그 외 텍스트는 출력하지 마세요.
```

## 사용자 프롬프트 (초안)
```
주제: {{topic.title}}

기사 제목: {{article.title}}
기사 본문:
{{article.content}}

인용된 출처:
{{#each sources}}
- id: {{id}}
  title: {{title}}
  url: {{url}}
  summary: {{summary}}
{{/each}}

평가 기준:
{{#each criteria}}
- id: {{id}}
  설명: {{description}}
  배점 범위: {{scale}}
  통과 기준: {{pass_threshold}} 이상
{{/each}}
```

## 출력 형식 (JSON)
```json
{
  "criteria_scores": {
    "factual-grounding": { "score": 4, "reason": "..." },
    "source-coverage": { "score": 3, "reason": "..." },
    "structure": { "score": 4, "reason": "..." },
    "readability": { "score": 4, "reason": "..." },
    "tone-consistency": { "score": 3, "reason": "..." }
  },
  "aggregate_score": 3.65,
  "passed": true,
  "notes": "전반적으로 출처를 잘 활용했으나 출처 2의 인용이 부족함"
}
```

## 후처리 (코드에서 수행)
- `aggregate_score`는 `evals/article-quality.eval.yaml`의 `weight`를 이용해
  코드에서 재계산하여 검증한다 (모델 응답값을 그대로 신뢰하지 않는다).
- 결과는 `eval_runs` 테이블에 저장한다.
