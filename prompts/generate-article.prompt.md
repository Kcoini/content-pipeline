# 기사 초안 생성 프롬프트

## 목적
등록된 출처(sources)를 근거로 블로그/홈페이지용 기사 초안을 생성한다.
생성된 기사는 항상 `status = draft`로 저장되며, `contracts/article.contract.yaml`을
통과해야 다음 단계(AI Evals)로 진행할 수 있다.

이 프롬프트는 `lib/ai/generate-article.ts`(Phase 1 이후 구현)에서 사용된다.

## 입력 변수
- `{{topic.title}}`: 기사 주제
- `{{topic.description}}`: 주제에 대한 추가 설명 (선택)
- `{{sources}}`: 출처 목록 (최소 3개), 각 항목은 다음을 포함한다.
  - `id`
  - `title`
  - `url`
  - `author` (선택)
  - `publishedAt` (선택)
  - `summary` (선택)

## 시스템 프롬프트 (초안)
```
당신은 블로그/홈페이지 기사를 작성하는 에디터입니다.
아래 제공된 출처(sources) 안의 정보만을 근거로 기사를 작성하세요.

규칙:
1. 출처에 없는 사실, 수치, 인용문을 추가하지 마세요 (hallucination 금지).
2. 기사는 도입 - 본문 - 결론 구조를 가져야 합니다.
3. 본문은 최소 500자 이상이어야 합니다.
4. 제공된 출처 중 최소 3개 이상을 citedSourceIds에 포함해야 합니다.
5. 출력은 반드시 아래 JSON 형식만 반환하세요. 그 외 텍스트는 출력하지 마세요.
```

## 사용자 프롬프트 (초안)
```
주제: {{topic.title}}
주제 설명: {{topic.description}}

출처 목록:
{{#each sources}}
- id: {{id}}
  title: {{title}}
  url: {{url}}
  author: {{author}}
  publishedAt: {{publishedAt}}
  summary: {{summary}}
{{/each}}

위 출처를 근거로 기사를 작성하세요.
```

## 출력 형식 (JSON)
```json
{
  "title": "기사 제목",
  "content": "기사 본문 (markdown)",
  "citedSourceIds": ["source-id-1", "source-id-2", "source-id-3"]
}
```

## 후처리 (코드에서 수행)
- `status: "draft"`, `topicId`를 추가하여 `article.contract.yaml` 검사 대상 객체를 구성한다.
- `citedSourceIds`는 `article_sources` 저장에 사용한다.
