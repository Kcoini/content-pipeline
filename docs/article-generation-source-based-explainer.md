# `source_based_explainer` 모드 — 출처 기반 해설 기사

이 문서는 기사 생성 모드 3종(`source_based_explainer`, `general_news`,
`monetized_blog`) 중 **기본값인 `source_based_explainer`**의 개선된
설계를 설명한다. 구현은 `lib/ai/article-writer.ts`
(`ARTICLE_SYSTEM_PROMPT`, `ARTICLE_TOOL`,
`generateSourceBasedExplainerAiDraft`)에 있고, 평가 기준은
`evals/article-quality.v1.eval.yaml` + `lib/ai/eval-article.ts`에
있다.

## 정의

`source_based_explainer`는 **출처 기반 해설 기사** 모드다. 여러 출처의
사실 조각(key_points)을 종합해, 그 출처들이 공통으로 보여주는
흐름·차이·긴장관계를 바탕으로 **하나의 중심 해석(thesis)**을 제시하는
기사를 작성한다. 목표는 "출처를 이어 붙이는 것"이 아니라 "독자가 왜
이 주제가 중요한지 이해하도록 돕는 것"이다.

## 다른 모드와의 차이

| | `source_based_explainer` | `general_news` | `monetized_blog` |
| --- | --- | --- | --- |
| 성격 | 해설 기사 | 스트레이트 뉴스 | SEO 수익형 블로그 |
| 핵심 산출물 | thesis(중심 해석) 중심 7기능 구조 | 빠른 사실 전달, 짧은 구조 | SEO 제목/메타설명/광고 슬롯 marker |
| 길이 | 800자 이상 권장(최소 500) | 500~1500자 | 1200자 이상 |
| 광고/수익 요소 | 없음 (금지) | 없음 | AD_SLOT marker(실제 코드 아님) |
| 문체 | 일간지 수준 설명형 저널리즘 | 객관적·간결 | 검색 유입/체류시간 지향 |

`source_based_explainer`는 SEO 블로그 글이 아니며, 수익형 블로그
문체·광고 클릭 유도 표현을 사용하지 않는다.

## 실행 조건과 fallback 기준

`checkSourceBasedExplainerReadiness(sourceSummaries)`가 실행 전
판단한다.

- **usable source**: `keyPoints.length > 0` 또는 `summary`가 비어
  있지 않은 출처. 둘 다 비어 있으면 종합할 사실이 없으므로 usable로
  세지 않는다.
- **기준**: usable source가 **3개 이상**이어야 실행할 수 있다
  (`MIN_USABLE_SOURCES_FOR_EXPLAINER = 3`).
- **미달 시**: `generateSourceBasedExplainerAiDraft()`가 실제 API를
  호출하기 전에 `InsufficientSourceMaterialError`를 던진다. 이
  오류는 AI 호출 실패(`ai_generation_failed`)와 구분되는
  `article_generation_input_warning` 로그로 기록되고
  (`app/dashboard/actions.ts`), 기존 mock 생성 경로로 안전하게
  전환된다 — 새로운 fallback 모드를 만들지 않았다.
- 이 판단 함수는 export되어 있어, 필요하면 UI/서버 액션에서 AI 호출
  전에 미리 "source_based_explainer는 최소 3개 출처가 필요합니다"
  같은 안내에 사용할 수 있다.

주의: 이 가드는 등록된 출처 개수가 아니라 **"내용이 있는" 출처
개수**를 본다. `source.contract.yaml`의 `min-source-count`는 등록
개수(3개 이상)만 확인하므로, 등록은 됐지만 요약/핵심 포인트 추출에
실패한 출처가 섞여 있으면 이 가드가 별도로 걸러낸다.

## synthesis_notes 역할

- 독자에게 노출되지 않고 DB에도 저장하지 않는 내부 분석 메모다.
- 모든 출처의 key_points를 훑어 공통 논지·차이점·긴장관계·독자에게
  중요한 이유를 3~5문장으로 정리한다.
- 특정 출처 하나의 구조를 따라가지 않고 여러 출처를 재배열·통합해
  해석하도록 지시한다.

## thesis 역할 (개선된 정의)

- **강한 주장이나 사설식 결론이 아니라, "이 사안을 이해하는 중심
  해석"**이다. 찬반을 과도하게 단정하지 않는다.
- 출처들이 보여주는 흐름과 의미를 1~2문장으로 압축한다.
- title과 content 전체가 이 thesis를 뒷받침해야 한다.

## title 기준

- thesis 핵심 반영, 40자 이내.
- 클릭베이트 표현("충격", "대박", "난리", "무조건", "끝났다" 등) 금지.
- 출처에 없는 숫자·고유명사를 제목에 넣지 않는다.
- 결론을 과도하게 단정하지 않는다.

## content 구조 (유연화)

content는 아래 **7가지 기능**을 포함해야 하지만, 실제 heading은
주제에 맞게 자연스럽게 작성하고 "## 배경", "## 핵심 쟁점" 같은 고정
제목을 기계적으로 반복하지 않아도 된다.

1. 리드문 — 독자가 계속 읽을 이유 (thesis 반영)
2. 배경 — 왜 지금 중요한지 맥락
3. 핵심 쟁점 — 여러 출처가 공통으로 짚는 문제
4. 다각도 분석 — 출처들의 공통점·차이점·긴장관계를 통합 해석
5. 사실과 데이터 — 출처에 명시된 구체적 수치·사례만 사용
6. 독자에게 주는 의미 — 왜 중요한지 해석
7. 향후 전망 또는 과제 — 출처 기반의 제한적 전망

## sourceUsage 구조 (신규)

`ARTICLE_TOOL` 출력에 `sourceUsage` 필드가 추가됐다.

```json
{
  "sourceUsage": [
    { "sourceId": "source-1", "usedFor": ["background", "data"] },
    { "sourceId": "source-2", "usedFor": ["contrast", "analysis"] }
  ]
}
```

- `usedFor` 허용값: `background`, `data`, `contrast`, `analysis`,
  `implication`, `watch_point`.
- `sourceId`는 `citedSourceIds`에 포함된 값만 허용한다.
  `parseSourceUsage()`가 `citedSourceIds`에 없는 `sourceId`나 허용
  되지 않은 `usedFor` 값을 조용히 걸러내므로, 모델 응답이 다소
  어긋나도 기사 생성 자체를 막지 않는다.
- 어떤 출처가 실제로 어떤 역할로 쓰였는지 확인할 수 있어, 품질검사/
  eval에서 "출처를 활용은 했는지"를 더 세밀하게 볼 수 있다.
- **DB에는 저장하지 않는다.** `GeneratedArticle.sourceUsage`는 결과
  객체에만 포함되며, 기존 저장 로직(`app/dashboard/actions.ts`,
  `saveDraftArticle`)은 변경하지 않았다. 필요해지면 이후 단계에서
  저장 여부를 검토한다.

## 금지 규칙 (강화)

- key_points 그대로 복사/paraphrase 금지
- 출처를 순서대로 나열하는 구조 금지 ("A에 따르면... B에 따르면...")
- **특정 출처 하나의 문단 순서·논리 전개를 그대로 따라가는 "source
  structure copy" 금지** (신규 — 문장을 안 베껴도 구조만 복제하는
  경우까지 막는다)
- key_points에 없는 수치·날짜·고유명사 추가 금지 (hallucination)
- 출처에 없는 인과관계·전망 단정 금지 (신규 — 명시적으로 분리)
- 광고 클릭 유도 표현, 수익형 블로그 문체 금지
- 선정적 제목, 과장된 위기감 금지
- 개인 투자·의료·법률 판단 단정 금지
- 결론에서 근거 없는 "~일 것이다/~해야 한다" 나열 금지
- 500자 미만 본문 금지

### 불확실성 표현 규칙 (신규)

출처에서 직접 확인되지 않는 인과관계·전망·평가는 "가능성이 있다",
"관찰된다", "해석할 수 있다", "과제로 남는다"처럼 제한적으로
표현하도록 지시한다. 다만 출처가 직접 확인한 사실까지 불필요하게
헤지하지는 않는다.

## key_points만 전달하는 이유 (유지)

`buildSourceBlock()`은 출처 요약문 전체가 아니라 key_points(불릿
사실)만 프롬프트에 넣는다. 완성된 문장을 주면 그 문장을 살짝만 바꿔
재사용하는 paraphrase 경향이 강해지기 때문에, 애초에 표절하기 어려운
형태로 입력을 가공해 절대 금지 규칙을 이중으로 뒷받침한다. 이번
개선에서 각 출처 블록에 `sourceId(정확히 그대로 사용): <id>` 줄을
추가해, `sourceUsage.sourceId`가 정확한 문자열을 참조하도록 보강했다.

## contract/eval 후처리 기준

- **article.contract.yaml**: `min-content-length`(500자),
  `min-linked-sources`(3개 이상 인용) 규칙은 그대로 적용된다 —
  변경하지 않았다.
- **evals/article-quality.v1.eval.yaml**: 기존 `copy-risk`,
  `synthesis` gate(각각 4점 이상/2점 미만이면 `passed=false`)에
  더해, **`source-structure-copy-risk` 기준을 신규 추가**했다
  (가중치 0, 4점 이상이면 `passed=false`). 이 기준은 "특정 출처의
  문단 구조를 그대로 따라갔는가"를 별도로 채점해, 기존 `structure`/
  `synthesis`가 "나열 구조" 위주로만 보던 것을 보완한다.
- `general_news`/`monetized_blog` 모드의 eval 파일(`general-news.
  eval.yaml`, `monetized-blog.eval.yaml`)과 그 모드들의 프롬프트는
  이번 개선의 대상이 아니며 변경하지 않았다.
- `sourceUsage`의 배열/참조 유효성은 계약(contract) 레벨이 아니라
  **코드 레벨(`parseSourceUsage`)에서 이미 보장**되므로 별도 계약
  규칙을 추가하지 않았다 — 잘못된 항목은 애초에 결과에 포함되지
  않는다.
- title clickbait 검사, thesis 선동성 검사는 기존 `exaggeration-
  check` 기준이 이미 다루고 있어 별도 기준을 추가하지 않았다(중복
  방지).

## 실행 조건 요약 (표)

| 조건 | 결과 |
| --- | --- |
| usable source ≥ 3 | 정상 실행, AI 호출 |
| usable source < 3 | `InsufficientSourceMaterialError` → `article_generation_input_warning` 로그 → mock 생성으로 전환 |
| `ANTHROPIC_API_KEY` 없음 | 기존과 동일하게 즉시 오류(가드보다 먼저 발생) |
| AI 응답 파싱 실패 | 기존과 동일하게 `ai_generation_failed` 로그 → mock 생성으로 전환 |

## 로깅 원칙 (변경 없음)

`lib/ai/article-writer.ts`는 직접 로그를 남기지 않는다(모든 로깅은
`app/dashboard/actions.ts`가 담당). 이번 개선으로 추가된
`article_generation_input_warning` 로그도 `themeId`, 사용 가능한
출처 개수, 전체 출처 개수, `articleMode`만 기록하며, 기사 본문/
프롬프트 전문/API key/토큰은 로그에 남기지 않는다.

## 관련 문서

- 운영 매뉴얼: [`phase-3-operation-manual.md`](./phase-3-operation-manual.md)
- 요구사항: [`requirements.md`](./requirements.md)
