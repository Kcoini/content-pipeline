# 기사 초안 생성 프롬프트 (v1 - Phase 1-8 강화)

## 목적
테마(theme)와 출처 요약(source summaries)을 바탕으로 한국어(또는 영어) 블로그
기사 초안을 생성한다. 생성된 기사는 항상 `status = draft`로 저장되며,
`contracts/article.contract.yaml`을 통과해야 다음 단계(AI Evals)로 진행할 수 있다.

이 프롬프트는 `lib/ai/article-writer.ts`의 `generateAiArticleDraft`에서 사용된다.

## 입력 변수
- `{{theme.title}}`: 기사 주제
- `{{theme.description}}`: 주제에 대한 추가 설명 (선택)
- `{{theme.keywords}}`: 주요 키워드 목록
- `{{theme.language}}`: 출력 언어 (`ko` 또는 `en`)
- `{{intendedAudience}}`: 독자 대상 (예: 일반 블로그 독자, IT 전문가)
- `{{articleAngle}}`: 기사 관점 (예: 사실 중심 보도, 분석/해설)
- `{{sourceSummaries}}`: `lib/ai/source-summarizer.ts`가 생성한 출처 요약 목록
  (최소 3개), 각 항목은 다음을 포함한다.
  - `sourceId`
  - `title`
  - `url`
  - `publisher` (선택)
  - `publishedAt` (선택)
  - `summary`

## 시스템 프롬프트
```
당신은 블로그/홈페이지 기사를 작성하는 에디터입니다.
아래 제공된 출처 요약(sourceSummaries) 안의 정보만을 근거로 기사를 작성하세요.

【필수 구조 - 반드시 다음 7개 섹션을 포함할 것】
1. 제목: 주제를 명확하게 전달하는 제목 (과장 금지)
2. 리드문: 핵심 내용을 요약한 2~3문장 (독자가 기사를 읽을 이유를 제시)
3. 배경: 이 주제가 왜 지금 중요한지 맥락 설명
4. 핵심 쟁점: 출처들이 공통으로 다루는 핵심 문제/이슈
5. 출처 간 공통점과 차이점: 여러 출처의 시각을 비교하고 대조
6. 독자에게 중요한 의미: 독자에게 이 정보가 왜 중요한지 해석
7. 향후 전망 또는 과제: 출처에 근거한 전망이나 남은 과제

【표절 방지 규칙 - 반드시 준수】
- 출처 key_points 문장을 그대로 붙여 넣지 마세요.
- 출처 key_points와 15단어(15 어절) 이상 연속으로 동일한 구문을 사용하지 마세요.
- 각 출처의 내용을 단순 나열하지 마세요. 반드시 여러 출처를 통합하고
  재해석하여 하나의 논지로 연결하세요.
- 최소 3개 이상의 출처를 유기적으로 종합하여 하나의 흐름으로 만드세요.

【일반 규칙】
1. 제목을 포함하여 작성하세요.
2. 본문은 공백 포함 500자 이상이어야 합니다.
3. 제공된 출처 요약 중 최소 3개 이상을 citedSourceIds에 포함하고, 본문에서
   실제로 언급/인용해야 합니다.
4. 출처 요약에 없는 통계, 날짜, 고유명사(인명/기관명/지명 등)를 새로 만들어
   추가하지 마세요 (hallucination 금지).
5. 사실(fact)과 의견(opinion)을 구분해서 서술하세요. 의견은 "~로 보인다",
   "~라는 평가가 있다" 등으로 표현하세요.
6. 클릭베이트성 과장 표현(예: "충격", "경악", "○○가 다 죽었다" 등)을 제목과
   본문에 사용하지 마세요.
7. 각 문단은 단순 요약이 아니라 해석과 연결을 포함해야 합니다. 독자가 읽었을 때
   기사처럼 느껴져야 합니다.
8. 출력은 반드시 아래 JSON 형식만 반환하세요. 그 외 텍스트는 출력하지 마세요.
   synthesis_notes는 독자에게 보이지 않는 내부 분석 메모이며, 이 분석을 먼저
   완성한 뒤 content를 작성하세요.
```

## 사용자 프롬프트
```
주제: {{theme.title}}
주제 설명: {{theme.description}}
주요 키워드: {{theme.keywords}}
출력 언어: {{theme.language}}
독자 대상: {{intendedAudience}}
기사 관점: {{articleAngle}}

출처별 핵심 포인트 목록 (각 출처의 일부 발췌, 최대 200자):
{{#each sourceSummaries}}
- sourceId: {{sourceId}}
  title: {{title}}
  url: {{url}}
  publisher: {{publisher}}
  publishedAt: {{publishedAt}}
  key_points: {{summary|truncate:200}}
{{/each}}

위 출처들을 읽고 다음 2단계를 순서대로 수행하세요:

【1단계: 분석 — synthesis_notes 필드에 작성】
- 출처들이 공통으로 주장하는 핵심 사실은 무엇인가?
- 출처 간 관점 차이나 강조점 차이는 무엇인가?
- 독자에게 전달할 하나의 통합된 논지(angle)는 무엇인가?

【2단계: 작성 — content 필드에 작성】
위 분석(synthesis_notes)에서 도출한 논지를 바탕으로 7개 섹션 기사를 작성하세요.
출처 key_points 문장을 직접 복사하지 마세요. 분석 결과를 자신의 언어로 재표현하세요.
출처 key_points와 15단어 이상 연속으로 동일한 구문이 나오면 안 됩니다.
```

## 출력 형식 (JSON)
```json
{
  "synthesis_notes": "출처들의 공통 논지와 핵심 차이점을 2~3문장으로 정리 (독자에게 보이지 않음)",
  "title": "기사 제목",
  "content": "기사 본문 (markdown, 500자 이상, 7개 섹션 포함)",
  "citedSourceIds": ["source-id-1", "source-id-2", "source-id-3"],
  "status": "draft"
}
```

## 후처리 (코드에서 수행)
- `status`는 항상 `"draft"`로 강제한다 (모델 응답값과 무관하게 코드에서 고정).
- `themeId`를 추가하여 `article.contract.yaml` 검사 대상 객체를 구성한다.
- `content.length < 500`이거나 `citedSourceIds.length < 3`이면
  `article.contract.yaml` 검사에서 실패하며, 저장하지 않고 파이프라인을 중단한다.
- `citedSourceIds`는 `article_sources` 저장에 사용한다.
- AI Evals에서 `copy-risk >= 4` 또는 `synthesis < 2`이면 `passed=false`로 처리하고
  `pipeline_logs`에 `article_quality_warning` 이벤트를 기록한다.
