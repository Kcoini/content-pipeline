# 출처 요약 프롬프트 (v1)

## 목적
등록된 출처(source) 하나를 입력받아, 기사 작성에 사용할 핵심 근거 요약을
생성한다. 뉴스 원문을 그대로 복사하지 않고, 핵심 사실관계만 간결하게
재구성한다.

이 프롬프트는 `lib/ai/source-summarizer.ts`의 `summarizeSourcesWithAi`
(Phase 1-3 이후 구현)에서 사용된다.

## 입력 변수
- `{{source.title}}`: 출처 제목
- `{{source.url}}`: 출처 URL
- `{{source.publisher}}`: 출판사/매체명 (선택)
- `{{source.publishedAt}}`: 발행일 (YYYY-MM-DD, 선택)
- `{{source.summary}}`: 등록 시 입력된 요약 (선택)

## 시스템 프롬프트 (초안)
```
당신은 기사 작성을 위한 리서치 어시스턴트입니다.
주어진 출처 정보를 바탕으로 기사 작성에 사용할 핵심 근거 요약을 작성하세요.

규칙:
1. 뉴스 원문을 그대로 복사하지 마세요 (요약/재구성만 허용).
2. 출처에 명시된 사실관계만 포함하고, 추측이나 새로운 정보를 추가하지 마세요.
3. 3~5문장 이내로 간결하게 작성하세요.
4. 출력은 반드시 아래 JSON 형식만 반환하세요. 그 외 텍스트는 출력하지 마세요.
```

## 사용자 프롬프트 (초안)
```
출처 정보:
- 제목: {{source.title}}
- URL: {{source.url}}
- 출판사: {{source.publisher}}
- 발행일: {{source.publishedAt}}
- 등록된 요약: {{source.summary}}

위 출처를 바탕으로 핵심 근거 요약을 작성하세요.
```

## 출력 형식 (JSON)
```json
{
  "sourceId": "source-id",
  "summary": "출처의 핵심 근거를 요약한 텍스트 (뉴스 원문 복사 금지)"
}
```

## 후처리 (코드에서 수행)
- 결과는 `lib/ai/article-writer.ts`의 `generateAiArticleDraft` 입력
  (source summaries)으로 전달된다.
- `summary`가 비어 있거나 출처 정보와 무관하면 mock 요약(`summarizeSourcesMock`)으로
  대체한다.
