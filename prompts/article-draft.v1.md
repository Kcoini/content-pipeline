# 기사 초안 생성 프롬프트 (v1)

## 목적
테마(theme)와 출처 요약(source summaries)을 바탕으로 한국어(또는 영어) 블로그
기사 초안을 생성한다. 생성된 기사는 항상 `status = draft`로 저장되며,
`contracts/article.contract.yaml`을 통과해야 다음 단계(AI Evals)로 진행할 수 있다.

이 프롬프트는 `lib/ai/article-writer.ts`의 `generateAiArticleDraft`
(Phase 1-3 이후 구현)에서 사용된다. `prompts/generate-article.prompt.md`를
대체하는 v1 버전이며, `lib/ai/source-summarizer.ts`가 생성한 출처 요약을
입력으로 받는다는 점이 다르다.

## 입력 변수
- `{{theme.title}}`: 기사 주제
- `{{theme.description}}`: 주제에 대한 추가 설명 (선택)
- `{{theme.keywords}}`: 주요 키워드 목록
- `{{theme.language}}`: 출력 언어 (`ko` 또는 `en`)
- `{{sourceSummaries}}`: `lib/ai/source-summarizer.ts`가 생성한 출처 요약 목록
  (최소 3개), 각 항목은 다음을 포함한다.
  - `sourceId`
  - `title`
  - `url`
  - `publisher` (선택)
  - `publishedAt` (선택)
  - `summary`

## 시스템 프롬프트 (초안)
```
당신은 블로그/홈페이지 기사를 작성하는 한국어 에디터입니다.
아래 제공된 출처 요약(sourceSummaries) 안의 정보만을 근거로 기사를 작성하세요.

규칙:
1. 제목을 포함하여 작성하세요.
2. 본문은 공백 포함 800자 이상이어야 합니다.
3. 제공된 출처 요약 중 최소 3개 이상을 citedSourceIds에 포함하고, 본문에서
   실제로 언급/인용해야 합니다.
4. 출처 요약에 없는 통계, 날짜, 고유명사(인명/기관명/지명 등)를 새로 만들어
   추가하지 마세요 (hallucination 금지).
5. 사실(fact)과 의견(opinion)을 구분해서 서술하세요. 의견은 "~로 보인다",
   "~라는 평가가 있다" 등으로 표현하세요.
6. 클릭베이트성 과장 표현(예: "충격", "경악", "○○가 다 죽었다" 등)을 제목과
   본문에 사용하지 마세요.
7. 기사는 도입 - 본문 - 결론 구조를 가져야 합니다.
8. 출력은 반드시 아래 JSON 형식만 반환하세요. 그 외 텍스트는 출력하지 마세요.
```

## 사용자 프롬프트 (초안)
```
주제: {{theme.title}}
주제 설명: {{theme.description}}
주요 키워드: {{theme.keywords}}
출력 언어: {{theme.language}}

출처 요약 목록:
{{#each sourceSummaries}}
- sourceId: {{sourceId}}
  title: {{title}}
  url: {{url}}
  publisher: {{publisher}}
  publishedAt: {{publishedAt}}
  summary: {{summary}}
{{/each}}

위 출처 요약을 근거로 기사를 작성하세요.
```

## 출력 형식 (JSON)
```json
{
  "title": "기사 제목",
  "content": "기사 본문 (markdown, 800자 이상)",
  "citedSourceIds": ["source-id-1", "source-id-2", "source-id-3"],
  "status": "draft"
}
```

## 후처리 (코드에서 수행)
- `status`는 항상 `"draft"`로 강제한다 (모델 응답값과 무관하게 코드에서 고정).
- `themeId`를 추가하여 `article.contract.yaml` 검사 대상 객체를 구성한다.
- `content.length < 800`이거나 `citedSourceIds.length < 3`이면
  `article.contract.yaml` 검사에서 실패하며, 저장하지 않고 파이프라인을 중단한다.
- `citedSourceIds`는 `article_sources` 저장에 사용한다.
